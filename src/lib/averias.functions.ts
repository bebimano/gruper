import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERMISOS_CLIENT_NAME = "__GRUPER_AVERIAS_PERMISOS__";
const NOTIFY_USERS_CLIENT_NAME = "__GRUPER_AVERIAS_NOTIFY_USERS__";

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
 * Comprueba si el usuario autenticado actual debe recibir avisos (pop-ups y push) de averías.
 * Son los administradores + los trabajadores configurados expresamente.
 */
export const checkShouldReceiveAveriaAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Administradores siempre reciben avisos
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) return { receiveAlerts: true };

    // Comprobar si está en la lista de trabajadores con aviso
    try {
      const { data: record } = await supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", NOTIFY_USERS_CLIENT_NAME)
        .eq("modelo", userId)
        .maybeSingle();

      if (record) return { receiveAlerts: true };
    } catch {}

    return { receiveAlerts: false };
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

/**
 * Obtiene los IDs de los trabajadores configurados para recibir alertas de averías.
 */
export const getAveriaNotifyRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: adminRoles }, { data: records }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      supabaseAdmin
        .from("client_equipment")
        .select("modelo")
        .eq("client_name", NOTIFY_USERS_CLIENT_NAME),
    ]);

    const ids = new Set<string>();
    for (const a of adminRoles ?? []) {
      if (a.user_id) ids.add(a.user_id);
    }
    for (const r of records ?? []) {
      if (r.modelo) ids.add(r.modelo);
    }

    return Array.from(ids);
  });

/**
 * Concede o revoca la recepción de alertas de averías a un usuario/trabajador.
 */
export const setAveriaNotifyRecipient = createServerFn({ method: "POST" })
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

    if (data.enabled) {
      const { data: existing } = await supabaseAdmin
        .from("client_equipment")
        .select("id")
        .eq("client_name", NOTIFY_USERS_CLIENT_NAME)
        .eq("modelo", data.userId)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("client_equipment").insert({
          client_name: NOTIFY_USERS_CLIENT_NAME,
          modelo: data.userId,
          direccion: "Alerta Averias",
          poblacion: "Gruper",
          tipo_maquina: "notify_recipient",
          num_serie: String(Date.now()),
        });
      }
    } else {
      await supabaseAdmin
        .from("client_equipment")
        .delete()
        .eq("client_name", NOTIFY_USERS_CLIENT_NAME)
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
 * Se guarda en jobs con supabaseAdmin garantizando inserción sin bloqueos de RLS,
 * y envía notificaciones push al móvil para que suene con pantalla apagada.
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

    // Insertar en tabla jobs con descripción limpia y legible (NUNCA JSON crudo)
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .insert({
        title: `[AVERÍA] ${data.machineName}: ${data.title}`,
        client: clientName,
        description: data.description,
        status: "pendiente",
        status_note: statusNote,
      })
      .select("id")
      .single();

    if (jobErr) {
      console.error("Error al registrar avería en jobs:", jobErr);
      throw new Error(`Error en base de datos: ${jobErr.message}`);
    }

    // Persistir metadatos completos (fotos, máquina, cliente) en client_equipment
    try {
      await supabaseAdmin.from("client_equipment").insert({
        client_name: "AVERIA_METADATA",
        modelo: job.id,
        direccion: JSON.stringify({
          photos: data.photos,
          machineId: data.machineId,
          machineName: data.machineName,
          title: data.title,
          description: data.description,
          urgency: data.urgency,
          clientId: userId,
          clientName,
        }),
        poblacion: "Gruper",
        tipo_maquina: "averia_meta",
        num_serie: String(Date.now()),
      });
    } catch (metaErr) {
      console.warn("Aviso: no se pudo guardar metadatos extendidos en client_equipment:", metaErr);
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

    // Enviar notificación Push al móvil (pantalla apagada / fuera de la app)
    // Incluye: Todos los administradores + destinatarios de 'new_job' + destinatarios activados para averías
    try {
      const [{ data: adminRoles }, { data: notifyRows }, { data: jobSettings }] = await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
        supabaseAdmin
          .from("client_equipment")
          .select("modelo")
          .eq("client_name", NOTIFY_USERS_CLIENT_NAME),
        supabaseAdmin
          .from("notification_settings")
          .select("recipients")
          .eq("event", "new_job")
          .maybeSingle(),
      ]);

      const recipientSet = new Set<string>();
      for (const a of adminRoles ?? []) {
        if (a.user_id) recipientSet.add(a.user_id);
      }
      for (const n of notifyRows ?? []) {
        if (n.modelo) recipientSet.add(n.modelo);
      }
      for (const r of jobSettings?.recipients ?? []) {
        if (r) recipientSet.add(r);
      }

      // Si hay más de un receptor y el creador es admin testeando, o si es cliente:
      // Excluir al cliente de su propia alerta pero no bloquear si el admin está probando
      if (recipientSet.size > 1 && !adminRoles?.some((a) => a.user_id === userId)) {
        recipientSet.delete(userId);
      }

      const targetUserIds = Array.from(recipientSet);
      if (targetUserIds.length > 0) {
        const { data: toks } = await supabaseAdmin
          .from("push_tokens")
          .select("token")
          .in("user_id", targetUserIds);

        const tokens = (toks ?? []).map((t) => t.token);
        if (tokens.length > 0) {
          const { sendPush } = await import("@/lib/push.server");
          const isUrgent = data.urgency === "urgente";
          const pushTitle = isUrgent
            ? `🚨 ¡AVERÍA URGENTE: ${data.machineName}!`
            : `⚠️ Avería: ${data.machineName}`;
          const pushBody = `${clientName}: ${data.title}`;
          const pushLink = "/averias";

          const dead = await sendPush(tokens, pushTitle, pushBody, pushLink);
          if (dead.length) {
            await supabaseAdmin.from("push_tokens").delete().in("token", dead);
          }
        }
      }
    } catch (pushErr) {
      console.error("Error enviando push notifications de avería:", pushErr);
    }

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

    const [{ data: jobs, error }, { data: metaRows }] = await Promise.all([
      q,
      supabaseAdmin
        .from("client_equipment")
        .select("modelo, direccion")
        .eq("client_name", "AVERIA_METADATA"),
    ]);

    if (error) {
      console.error("Error consultando averias desde jobs:", error);
      throw error;
    }

    const metaMap = new Map<string, any>();
    for (const m of metaRows ?? []) {
      try {
        if (m.modelo && m.direccion) {
          metaMap.set(m.modelo, JSON.parse(m.direccion));
        }
      } catch {}
    }

    // Auto-sanear registros existentes que tengan JSON crudo guardado en la descripción
    for (const j of jobs ?? []) {
      if (j.description?.startsWith("{")) {
        try {
          const parsed = JSON.parse(j.description);
          if (parsed?.description) {
            supabaseAdmin
              .from("jobs")
              .update({ description: parsed.description })
              .eq("id", j.id)
              .then(() => {});

            if (!metaMap.has(j.id)) {
              const metaPayload = {
                photos: parsed.photos || [],
                machineId: parsed.machineId || "",
                machineName: parsed.machineName || "",
                title: parsed.title || "",
                description: parsed.description || "",
                urgency: parsed.urgency || "normal",
                clientId: parsed.clientId || "",
                clientName: parsed.clientName || j.client || "Cliente",
              };
              metaMap.set(j.id, metaPayload);
              supabaseAdmin
                .from("client_equipment")
                .insert({
                  client_name: "AVERIA_METADATA",
                  modelo: j.id,
                  direccion: JSON.stringify(metaPayload),
                  poblacion: "Gruper",
                  tipo_maquina: "averia_meta",
                  num_serie: String(Date.now()),
                })
                .then(() => {});
            }
          }
        } catch {}
      }
    }

    const averias = (jobs ?? []).map((j) => {
      const meta = metaMap.get(j.id);
      let parsed: any = null;
      try {
        if (j.description?.startsWith("{")) {
          parsed = JSON.parse(j.description);
        }
      } catch {}

      const machineName =
        meta?.machineName ||
        parsed?.machineName ||
        j.title.replace(/^\[AVERÍA\]\s*/i, "").split(":")[0]?.trim() ||
        "Máquina";
      const title =
        meta?.title ||
        parsed?.title ||
        (j.title.includes(":") ? j.title.split(":").slice(1).join(":").trim() : j.title);
      const description =
        meta?.description ||
        parsed?.description ||
        (parsed ? "" : j.description);
      const photos = Array.isArray(meta?.photos)
        ? meta.photos
        : Array.isArray(parsed?.photos)
        ? parsed.photos
        : [];
      const urgency = (meta?.urgency ||
        parsed?.urgency ||
        (j.status_note?.includes("URGENTE") ? "urgente" : "normal")) as
        | "normal"
        | "urgente";
      const status = (j.status === "terminado"
        ? "solucionado"
        : j.status === "en_curso"
        ? "en_curso"
        : "pendiente") as "pendiente" | "en_curso" | "solucionado";

      return {
        id: j.id,
        clientId: meta?.clientId || parsed?.clientId || "",
        clientName: meta?.clientName || j.client || parsed?.clientName || "Cliente",
        machineId: meta?.machineId || parsed?.machineId || "",
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
