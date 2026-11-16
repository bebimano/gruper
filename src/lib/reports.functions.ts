import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fetches the list of work reports for the authenticated user.
 * - If user is admin OR has can_view_all_reports = true, returns all reports from all workers.
 * - Otherwise returns only reports created by this user.
 */
export const getReportsList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleData;

    // Check profile permissions
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("can_work_reports, can_view_all_reports")
      .eq("id", userId)
      .maybeSingle();

    if (!isAdmin && !profile?.can_work_reports) {
      return { reports: [], profiles: {}, canViewAll: false, isAdmin: false };
    }

    const canViewAll = isAdmin || !!(profile as any)?.can_view_all_reports;

    let query = supabaseAdmin
      .from("work_reports")
      .select("id, number, user_number, data, created_at, user_id, closed")
      .order("created_at", { ascending: false });

    if (!canViewAll) {
      query = query.eq("user_id", userId);
    }

    const { data: reports, error } = await query;
    if (error) throw error;

    // Load username lookup
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, username");
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.username]));

    return {
      reports: reports ?? [],
      profiles: profileMap,
      canViewAll,
      isAdmin,
    };
  });

/**
 * Logs when a report is opened and sends push notification to admin(s).
 */
export const logReportOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: r } = await supabaseAdmin
      .from("work_reports")
      .select("number, user_number, data, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!r) return { ok: false };

    const { data: openerProfile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    const username = openerProfile?.username || "Un trabajador";

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isOpenerAdmin = !!adminRole;

    const reportNum = r.user_number ?? r.number;
    const clientName = (r.data as any)?.cliente || "Sin cliente";

    // Try inserting into report_opens table if exists
    try {
      await supabaseAdmin.from("report_opens" as any).insert({
        report_id: data.id,
        user_id: userId,
      });
    } catch {
      // Table might not be migrated yet
    }

    // If opener is not an admin, notify all admins
    if (!isOpenerAdmin) {
      const { data: adminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = (adminRoles ?? []).map((a) => a.user_id).filter((id) => id !== userId);

      if (adminIds.length > 0) {
        const { data: toks } = await supabaseAdmin
          .from("push_tokens")
          .select("token")
          .in("user_id", adminIds);
        const tokens = (toks ?? []).map((t) => t.token);

        if (tokens.length > 0) {
          const { sendPush } = await import("./push.server");
          try {
            await sendPush(
              tokens,
              `Parte abierto: ${clientName}`,
              `${username} ha abierto el Parte Nº ${reportNum}`,
              `/parte/${data.id}`
            );
          } catch (e) {
            console.error("Error sending push for report opened:", e);
          }
        }
      }
    }

    return {
      ok: true,
      reportNum,
      clientName,
      username,
      userId,
    };
  });

/**
 * Admin: Toggles whether a user can view all work reports or only their own.
 */
export const setUserReportViewAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      enabled: z.boolean(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify caller is admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ can_view_all_reports: data.enabled } as any)
      .eq("id", data.id);

    if (error) throw error;
    return { ok: true };
  });
