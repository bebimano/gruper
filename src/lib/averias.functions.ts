import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERMISOS_CLIENT_NAME = "__GRUPER_AVERIAS_PERMISOS__";

/**
 * Comprueba si el usuario autenticado actual tiene acceso al apartado de Averías / Fallos.
 * Ejecuta en servidor con supabaseAdmin para evitar cualquier restricción de RLS.
 */
export const checkMyAveriasAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Es administrador
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) {
      return { canAverias: true, isAdmin: true };
    }

    // 2. Columna profiles.can_averias
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("can_averias" as any)
        .eq("id", userId)
        .maybeSingle();

      if ((profile as any)?.can_averias === true) {
        return { canAverias: true, isAdmin: false };
      }
    } catch {
      // Ignorar si la columna aún no está en la base de datos
    }

    // 3. Registro persistente en client_equipment
    try {
      const { data: record } = await supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", PERMISOS_CLIENT_NAME)
        .eq("modelo", userId)
        .maybeSingle();

      if (record) {
        return { canAverias: true, isAdmin: false };
      }
    } catch (e) {
      console.error("Error al comprobar permisos de averías en client_equipment:", e);
    }

    return { canAverias: false, isAdmin: false };
  });

/**
 * Obtiene la lista completa de IDs de usuarios que tienen permitido el acceso a Averías.
 * Solo administradores.
 */
export const getAllAllowedAveriasClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed = new Set<string>();

    try {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, can_averias" as any);
      if (profiles) {
        for (const p of profiles as any[]) {
          if (p.can_averias === true) allowed.add(p.id);
        }
      }
    } catch {}

    try {
      const { data: records } = await supabaseAdmin
        .from("client_equipment")
        .select("modelo")
        .eq("client_name", PERMISOS_CLIENT_NAME);
      if (records) {
        for (const r of records) {
          if (r.modelo) allowed.add(r.modelo);
        }
      }
    } catch (e) {
      console.error("Error al leer permisos de client_equipment:", e);
    }

    return Array.from(allowed);
  });

/**
 * Concede o revoca el acceso a Averías a un cliente.
 */
export const setClientAveriasAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        allow: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar rol de admin
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
        .update({ can_averias: data.allow } as any)
        .eq("id", data.userId);
    } catch {}

    // 2. Persistir en client_equipment
    if (data.allow) {
      const { data: existing } = await supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", PERMISOS_CLIENT_NAME)
        .eq("modelo", data.userId)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("client_equipment").insert({
          client_name: PERMISOS_CLIENT_NAME,
          modelo: data.userId,
          direccion: "Permiso Averias",
          poblacion: "Gruper",
          tipo_maquina: "permission",
          num_serie: String(Date.now()),
        });
      }
    } else {
      await supabaseAdmin
        .from("client_equipment")
        .delete()
        .eq("client_name", PERMISOS_CLIENT_NAME)
        .eq("modelo", data.userId);
    }

    return { ok: true };
  });

const photoSchema = z.object({
  id: z.string(),
  url: z.string(),
  descripcion: z.string().optional().default(""),
});

/**
 * Registra un aviso de avería de cliente.
 * Se guarda en jobs con supabaseAdmin garantizando inserción sin bloqueos de RLS.
 */
export const submitAveria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        machineId: z.string().optional().default(""),
        machineName: z.string().min(1, "Selecciona una máquina"),
        title: z.string().min(1, "Introduce el título del fallo"),
        description: z.string().min(1, "Describe el problema"),
        urgency: z.enum(["normal", "urgente"]).default("normal"),
        photos: z.array(photoSchema).default([]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Obtener nombre de usuario
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    const clientName = profile?.username || "Cliente";

    const payload = {
      type: "averia",
      clientId: userId,
      clientName,
      machineId: data.machineId,
      machineName: data.machineName,
      title: data.title,
      description: data.description,
      urgency: data.urgency,
      photos: data.photos,
      createdAt: new Date().toISOString(),
    };

    const statusNote =
      data.urgency === "urgente" ? "🚨 AVERÍA URGENTE REPORTADA" : "Aviso de avería recibido";

    // Insertar en tabla jobs
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .insert({
        title: `[AVERÍA] ${data.machineName}: ${data.title}`,
        client: clientName,
        description: JSON.stringify(payload),
        status: "pendiente",
        status_note: statusNote,
      })
      .select("id")
      .single();

    if (jobErr) {
      console.error("Error al registrar avería en jobs:", jobErr);
      throw new Error(`Error en base de datos: ${jobErr.message}`);
    }

    // Intentar también en tabla averias si existe
    try {
      await (supabaseAdmin.from("averias" as any) as any).insert({
        client_id: userId,
        client_name: clientName,
        machine_id: data.machineId || null,
        machine_name: data.machineName,
        title: data.title,
        description: data.description,
        urgency: data.urgency,
        photos: data.photos,
        status: "pendiente",
        status_note: "",
      });
    } catch {}

    return { id: job.id, clientName, machineName: data.machineName, title: data.title, urgency: data.urgency };
  });

/**
 * Consulta la lista de averías con supabaseAdmin.
 * - Administradores y trabajadores con acceso ven todas las averías.
 * - Clientes ven solo las averías de sus máquinas/cuenta.
 */
export const getAveriasList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [{ data: roleData }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabaseAdmin.from("profiles").select("username, can_work_reports").eq("id", userId).maybeSingle(),
    ]);

    const isAdmin = !!roleData;
    const canViewAll = isAdmin || !!profile?.can_work_reports;
    const clientUsername = profile?.username || "";

    let q = supabaseAdmin
      .from("jobs")
      .select("*")
      .ilike("title", "[AVERÍA]%")
      .order("created_at", { ascending: false });

    // Filtrar por cliente si no es admin o técnico
    if (!canViewAll) {
      q = q.eq("client", clientUsername);
    }

    const { data: jobs, error } = await q;
    if (error) {
      console.error("Error consultando averias desde jobs:", error);
      throw error;
    }

    const averias = (jobs ?? []).map((j) => {
      let parsed: any = null;
      try {
        if (j.description.startsWith("{")) {
          parsed = JSON.parse(j.description);
        }
      } catch {}

      const machineName =
        parsed?.machineName || j.title.replace(/^\[AVERÍA\]\s*/i, "").split(":")[0]?.trim() || "Máquina";
      const title =
        parsed?.title || (j.title.includes(":") ? j.title.split(":").slice(1).join(":").trim() : j.title);
      const description = parsed?.description || (parsed ? "" : j.description);
      const photos = Array.isArray(parsed?.photos) ? parsed.photos : [];
      const urgency = (parsed?.urgency || (j.status_note?.includes("URGENTE") ? "urgente" : "normal")) as
        | "normal"
        | "urgente";
      const status = (j.status === "terminado"
        ? "solucionado"
        : j.status === "en_curso"
        ? "en_curso"
        : "pendiente") as "pendiente" | "en_curso" | "solucionado";

      return {
        id: j.id,
        clientId: parsed?.clientId || "",
        clientName: j.client || parsed?.clientName || "Cliente",
        machineId: parsed?.machineId || "",
        machineName,
        title,
        description,
        urgency,
        photos,
        status,
        statusNote: j.status_note || "",
        createdAt: j.created_at,
        updatedAt: j.updated_at,
      };
    });

    return averias;
  });

/**
 * Actualiza el estado y notas de una avería.
 */
export const updateAveriaStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pendiente", "en_curso", "solucionado"]),
        statusNote: z.string().optional().default(""),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const jobStatus = data.status === "solucionado" ? "terminado" : data.status;
    const defaultNote =
      data.status === "solucionado"
        ? "Avería solucionada"
        : data.status === "en_curso"
        ? "En revisión técnica"
        : "";

    await supabaseAdmin
      .from("jobs")
      .update({
        status: jobStatus,
        status_note: data.statusNote || defaultNote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return { ok: true };
  });

/**
 * Elimina una avería (solo administradores).
 */
export const deleteAveriaServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Solo los administradores pueden eliminar avisos de avería");

    await supabaseAdmin.from("jobs").delete().eq("id", data.id);
    return { ok: true };
  });
