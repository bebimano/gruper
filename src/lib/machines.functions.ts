import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: checks whether each machine's link answers (any HTTP response = online). */
export const checkMachinesStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("No autorizado");
    const { data: machines } = await context.supabase.from("machines").select("id, url");
    const results = await Promise.all(
      (machines ?? []).map(async (m) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        try {
          const res = await fetch(m.url, { method: "GET", redirect: "manual", signal: ctrl.signal });
          return { id: m.id, online: res.status > 0 && res.status < 500 };
        } catch {
          return { id: m.id, online: false };
        } finally {
          clearTimeout(t);
        }
      }),
    );
    return Object.fromEntries(results.map((r) => [r.id, r.online])) as Record<string, boolean>;
  });
