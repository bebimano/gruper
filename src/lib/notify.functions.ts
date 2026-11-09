import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendPush } from "./push.server";

const STATUS: Record<string, string> = { pendiente: "Pendiente", en_curso: "En curso", pausado: "Pausado", terminado: "Terminado" };

/** Sends a phone notification for an event. The caller must be able to see the row (checked via RLS). */
export const notifyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ event: z.enum(["new_report", "new_job", "job_status"]), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    let title = "", body = "", link = "", extra: string[] = [];
    if (data.event === "new_report") {
      const { data: r } = await context.supabase.from("work_reports").select("number, data").eq("id", data.id).maybeSingle();
      if (!r) return { sent: 0 };
      title = `Nuevo parte Nº ${r.number}`;
      body = String((r.data as { cliente?: string })?.cliente || "Sin cliente");
      link = `/parte/${data.id}`;
    } else {
      const { data: j } = await context.supabase.from("jobs").select("title, client, status, status_note, assigned_to").eq("id", data.id).maybeSingle();
      if (!j) return { sent: 0 };
      link = "/trabajos";
      if (data.event === "new_job") {
        title = "Nuevo trabajo"; body = `${j.title}${j.client ? ` · ${j.client}` : ""}`;
        if (j.assigned_to) extra = [j.assigned_to];
      } else {
        title = `Trabajo: ${STATUS[j.status] ?? j.status}`; body = `${j.title}${j.status_note ? ` — ${j.status_note}` : ""}`;
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("notification_settings").select("enabled, recipients").eq("event", data.event).maybeSingle();
    if (s && !s.enabled) return { sent: 0 };
    const users = [...new Set([...(s?.recipients ?? []), ...extra])].filter((u) => u !== context.userId);
    if (!users.length) return { sent: 0 };
    const { data: toks } = await supabaseAdmin.from("push_tokens").select("token").in("user_id", users);
    const tokens = (toks ?? []).map((t) => t.token);
    try {
      const dead = await sendPush(tokens, title, body, link);
      if (dead.length) await supabaseAdmin.from("push_tokens").delete().in("token", dead);
    } catch (e) { console.error(e); }
    return { sent: tokens.length };
  });
