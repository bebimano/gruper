import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const JOB_CREATORS_CLIENT_NAME = "__GRUPER_JOB_CREATORS__";

/**
 * Comprueba si el usuario actual tiene permisos para crear y asignar trabajos para otros.
 * Administradores siempre tienen acceso total.
 */
export const checkMyJobCreationAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Rol de administrador
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) {
      return { canCreateJobs: true, isAdmin: true };
    }

    // 2. Columna can_create_jobs en profiles
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("can_create_jobs" as any)
        .eq("id", userId)
        .maybeSingle();

      if ((profile as any)?.can_create_jobs) {
        return { canCreateJobs: true, isAdmin: false };
      }
    } catch {}

    // 3. Registro persistente en client_equipment
    try {
      const { data: record } = await supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", JOB_CREATORS_CLIENT_NAME)
        .eq("modelo", userId)
        .maybeSingle();

      if (record) {
        return { canCreateJobs: true, isAdmin: false };
      }
    } catch {}

    return { canCreateJobs: false, isAdmin: false };
  });

/**
 * Obtiene la lista de IDs de usuarios con permiso de creación de trabajos.
 */
export const getJobCreatorRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: adminRoles }, { data: records }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      supabaseAdmin
        .from("client_equipment")
        .select("modelo")
        .eq("client_name", JOB_CREATORS_CLIENT_NAME),
      supabaseAdmin
        .from("profiles")
        .select("id, can_create_jobs" as any)
        .catch(() => ({ data: [] })),
    ]);

    const ids = new Set<string>();
    for (const a of adminRoles ?? []) {
      if (a.user_id) ids.add(a.user_id);
    }
    for (const r of records ?? []) {
      if (r.modelo) ids.add(r.modelo);
    }
    for (const p of (profiles as any) ?? []) {
      if (p.can_create_jobs) ids.add(p.id);
    }

    return Array.from(ids);
  });

/**
 * Concede o revoca el permiso a un usuario para crear trabajos para otros.
 */
export const setUserCanCreateJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        enabled: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar admin
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("No autorizado");

    // 1. Intentar actualizar en profiles
    try {
      await supabaseAdmin
        .from("profiles")
        .update({ can_create_jobs: data.enabled } as any)
        .eq("id", data.userId);
    } catch {}

    // 2. Persistir en client_equipment
    if (data.enabled) {
      const { data: existing } = await supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", JOB_CREATORS_CLIENT_NAME)
        .eq("modelo", data.userId)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("client_equipment").insert({
          client_name: JOB_CREATORS_CLIENT_NAME,
          modelo: data.userId,
          direccion: "Creador de trabajos",
          poblacion: "Gruper",
          tipo_maquina: "job_creator",
          num_serie: String(Date.now()),
        });
      }
    } else {
      await supabaseAdmin
        .from("client_equipment")
        .delete()
        .eq("client_name", JOB_CREATORS_CLIENT_NAME)
        .eq("modelo", data.userId);
    }

    return { ok: true };
  });

/**
 * Consulta la lista de trabajos con supabaseAdmin respetando permisos.
 */
export const getJobsListServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [{ data: roleData }, { data: creatorRec }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", JOB_CREATORS_CLIENT_NAME)
        .eq("modelo", userId)
        .maybeSingle(),
    ]);

    let canViewAll = !!roleData || !!creatorRec;

    if (!canViewAll) {
      try {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("can_create_jobs, can_work_reports" as any)
          .eq("id", userId)
          .maybeSingle();
        if ((p as any)?.can_create_jobs || (p as any)?.can_work_reports) {
          canViewAll = true;
        }
      } catch {}
    }

    let q = supabaseAdmin.from("jobs").select("*").order("created_at", { ascending: false });

    // Si es un usuario normal sin permisos de creación ni admin, ve sólo los que tiene asignados
    if (!canViewAll) {
      q = q.eq("assigned_to", userId);
    }

    const { data: jobs, error } = await q;
    if (error) {
      console.error("Error consultando jobs:", error);
      throw error;
    }

    return jobs ?? [];
  });

/**
 * Crea un trabajo garantizando permisos sin bloqueos de RLS.
 */
export const createJobServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(1, "El título es obligatorio"),
        client: z.string().optional().default(""),
        description: z.string().optional().default(""),
        assigned_to: z.string().nullable().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Verificar permisos
    const [{ data: roleData }, { data: creatorRec }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", JOB_CREATORS_CLIENT_NAME)
        .eq("modelo", userId)
        .maybeSingle(),
    ]);

    let allowed = !!roleData || !!creatorRec;
    if (!allowed) {
      try {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("can_create_jobs" as any)
          .eq("id", userId)
          .maybeSingle();
        if ((p as any)?.can_create_jobs) allowed = true;
      } catch {}
    }

    if (!allowed) throw new Error("No tienes permiso para crear trabajos.");

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .insert({
        title: data.title.trim(),
        client: data.client.trim(),
        description: data.description.trim(),
        assigned_to: data.assigned_to || null,
        status: "pendiente",
        status_note: "",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error al crear trabajo en base de datos:", error);
      throw new Error(`Error: ${error.message}`);
    }

    // Enviar notificación Push móvil
    try {
      const { notifyEvent } = await import("./notify.functions");
      // Notificar si está asignado o a destinatarios configurados
      const { data: j } = await supabaseAdmin
        .from("jobs")
        .select("title, client, assigned_to")
        .eq("id", job.id)
        .maybeSingle();

      if (j) {
        const { data: s } = await supabaseAdmin
          .from("notification_settings")
          .select("enabled, recipients")
          .eq("event", "new_job")
          .maybeSingle();

        const extra = j.assigned_to ? [j.assigned_to] : [];
        const users = [...new Set([...(s?.recipients ?? []), ...extra])].filter((u) => u !== userId);

        if (users.length > 0) {
          const { data: toks } = await supabaseAdmin
            .from("push_tokens")
            .select("token")
            .in("user_id", users);
          const tokens = (toks ?? []).map((t) => t.token);

          if (tokens.length > 0) {
            const { sendPush } = await import("./push.server");
            const pushTitle = "Nuevo trabajo";
            const pushBody = `${j.title}${j.client ? ` · ${j.client}` : ""}`;
            await sendPush(tokens, pushTitle, pushBody, "/trabajos");
          }
        }
      }
    } catch (e) {
      console.warn("Aviso: no se pudo enviar push para nuevo trabajo:", e);
    }

    return { id: job.id };
  });

/**
 * Elimina un trabajo.
 */
export const deleteJobServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [{ data: roleData }, { data: creatorRec }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", JOB_CREATORS_CLIENT_NAME)
        .eq("modelo", userId)
        .maybeSingle(),
    ]);

    let allowed = !!roleData || !!creatorRec;
    if (!allowed) {
      try {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("can_create_jobs" as any)
          .eq("id", userId)
          .maybeSingle();
        if ((p as any)?.can_create_jobs) allowed = true;
      } catch {}
    }

    if (!allowed) throw new Error("No tienes permiso para eliminar trabajos.");

    const { error } = await supabaseAdmin.from("jobs").delete().eq("id", data.id);
    if (error) throw error;

    return { ok: true };
  });
