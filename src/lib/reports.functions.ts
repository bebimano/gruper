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

/**
 * Admin: Lista todos los partes para el panel de numeración.
 */
export const getAllReportsForNumberingServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    const [{ data, error }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("work_reports")
        .select("id, number, user_number, created_at, user_id, data")
        .order("number", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, username"),
    ]);

    if (error) throw error;

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.username])
    );

    return {
      reports: (data ?? []).map((r) => {
        const creatorFromProfile = r.user_id ? profileMap[r.user_id] : null;
        const creatorFromData = String((r.data as any)?.tecnico ?? "").trim();
        const creator = creatorFromProfile || creatorFromData || "Sin autor";

        return {
          id: r.id as string,
          number: r.number as number,
          user_number: r.user_number as number | null,
          created_at: r.created_at as string,
          cliente: String((r.data as { cliente?: string })?.cliente ?? ""),
          creator,
        };
      }),
    };
  });

/**
 * Admin: Cambia el user_number de un parte — sin validación de duplicados.
 */
export const changeReportNumberServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), newNumber: z.number().int().positive() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    const { error } = await supabaseAdmin
      .from("work_reports")
      .update({ user_number: data.newNumber } as any)
      .eq("id", data.id);

    if (error) throw error;
    return { ok: true, conflict: false, conflictNum: 0, conflictCliente: "", conflictId: "" };
  });

export type ClientReportItem = {
  id: string;
  number: number;
  user_number: number | null;
  displayNumber: number;
  created_at: string;
  closed: boolean;
  tecnico: string;
};

export type ClientReportsSummary = {
  clientName: string;
  isRegisteredUser: boolean;
  totalPartes: number;
  lastParteNumber: number | null;
  lastParteDate: string | null;
  partes: ClientReportItem[];
};

/**
 * Admin: Obtiene el resumen consolidado de partes por cliente.
 * Para cada cliente devuelve:
 * - si tiene partes
 * - cuántos partes tiene hechos
 * - listado de los números de parte que tiene hechos
 * - por cuál número va (el último número de parte generado para él)
 */
export const getClientReportsSummaryAdminServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar que el usuario sea admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    const [
      { data: profiles },
      { data: contacts },
      { data: equipmentRows },
      { data: reports },
      { data: userTypeRows },
      { data: adminRoles },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, can_work_reports").order("username"),
      supabaseAdmin.from("report_contacts").select("name").order("name"),
      supabaseAdmin.from("client_equipment").select("client_name"),
      supabaseAdmin
        .from("work_reports")
        .select("id, number, user_number, created_at, closed, data")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("client_equipment")
        .select("client_name, num_serie")
        .like("client_name", "__USER_TYPE__%"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const adminUserIds = new Set((adminRoles ?? []).map((a) => a.user_id));
    const userTypeMap = new Map<string, "worker" | "client">();
    for (const r of userTypeRows ?? []) {
      const uid = (r.client_name as string).replace("__USER_TYPE__", "");
      const val = String((r as any).num_serie || "").trim().toLowerCase();
      if (val === "worker" || val === "client") {
        userTypeMap.set(uid, val);
      }
    }

    // Identificar qué perfiles son trabajadores (no deben contarse ni listarse como clientes)
    const workerUserIds = new Set<string>();
    const workerUsernames = new Set<string>();
    for (const p of profiles ?? []) {
      const explicit = userTypeMap.get(p.id);
      const isAdmin = adminUserIds.has(p.id);
      const isWorker =
        explicit === "worker" || (!explicit && (isAdmin || !!(p as any).can_work_reports));
      if (isWorker) {
        workerUserIds.add(p.id);
        if (p.username) workerUsernames.add(p.username.trim().toLowerCase());
      }
    }

    // Nombres de usuario registrados que son estrictamente CLIENTES
    const registeredClientUsernames = new Set(
      (profiles ?? [])
        .filter((p) => !workerUserIds.has(p.id))
        .map((p) => (p.username || "").trim().toLowerCase())
        .filter(Boolean)
    );

    const clientMap = new Map<
      string,
      {
        displayName: string;
        isRegisteredUser: boolean;
        partes: ClientReportItem[];
      }
    >();

    // 1. Clientes registrados (SOLO los que son clientes, NUNCA trabajadores)
    for (const p of profiles ?? []) {
      if (workerUserIds.has(p.id)) continue;
      const name = (p.username || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          displayName: name,
          isRegisteredUser: true,
          partes: [],
        });
      }
    }

    // 2. Contactos de partes
    for (const c of contacts ?? []) {
      const name = (c.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          displayName: name,
          isRegisteredUser: registeredClientUsernames.has(key),
          partes: [],
        });
      }
    }

    // 3. Clientes con equipos
    for (const eq of equipmentRows ?? []) {
      const name = (eq.client_name || "").trim();
      if (!name || name.startsWith("__") || name.startsWith("AVERIA_")) continue;
      const key = name.toLowerCase();
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          displayName: name,
          isRegisteredUser: registeredClientUsernames.has(key),
          partes: [],
        });
      }
    }

    // 4. Clientes en work_reports
    for (const r of reports ?? []) {
      const rawClient = String((r.data as any)?.cliente || "").trim();
      const clientName = rawClient || "Sin cliente asignado";
      const key = clientName.toLowerCase();

      if (!clientMap.has(key)) {
        clientMap.set(key, {
          displayName: clientName,
          isRegisteredUser: registeredUsernames.has(key),
          partes: [],
        });
      }

      const item: ClientReportItem = {
        id: r.id as string,
        number: r.number as number,
        user_number: r.user_number as number | null,
        displayNumber: (r.user_number ?? r.number) as number,
        created_at: r.created_at as string,
        closed: !!r.closed,
        tecnico: String((r.data as any)?.tecnico || "").trim(),
      };

      clientMap.get(key)!.partes.push(item);
    }

    // 5. Consolidar lista
    const clientsList: ClientReportsSummary[] = Array.from(clientMap.values()).map((entry) => {
      const sortedPartes = [...entry.partes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const latestParte = sortedPartes[0] || null;

      return {
        clientName: entry.displayName,
        isRegisteredUser: entry.isRegisteredUser,
        totalPartes: sortedPartes.length,
        lastParteNumber: latestParte ? latestParte.displayNumber : null,
        lastParteDate: latestParte ? latestParte.created_at : null,
        partes: sortedPartes,
      };
    });

    clientsList.sort((a, b) => {
      if (a.totalPartes > 0 && b.totalPartes === 0) return -1;
      if (a.totalPartes === 0 && b.totalPartes > 0) return 1;
      if (a.totalPartes > 0 && b.totalPartes > 0) {
        const timeA = a.lastParteDate ? new Date(a.lastParteDate).getTime() : 0;
        const timeB = b.lastParteDate ? new Date(b.lastParteDate).getTime() : 0;
        return timeB - timeA;
      }
      return a.clientName.localeCompare(b.clientName, "es-ES");
    });

    return {
      clients: clientsList,
      totalClients: clientsList.length,
      clientsWithReports: clientsList.filter((c) => c.totalPartes > 0).length,
      totalReports: (reports ?? []).length,
    };
  });

/**
 * Admin: Obtiene la configuración de numeración de partes por trabajador.
 * Se almacena en client_equipment con un prefijo especial __REPORT_CONFIG__.
 */
export const getWorkerReportConfigServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    const { data: rows } = await supabaseAdmin
      .from("client_equipment")
      .select("*")
      .like("client_name", "__REPORT_CONFIG__%");

    const configs = (rows ?? []).map((r) => {
      const userId = (r.client_name as string).replace("__REPORT_CONFIG__", "");
      const meta = r as any;
      return {
        userId,
        nextNumber: parseInt(String(meta.num_serie || "1"), 10) || 1,
        yearPrefix: parseInt(String(meta.modelo || String(new Date().getFullYear())), 10) || new Date().getFullYear(),
      };
    });

    return { configs };
  });

/**
 * Admin: Configura la numeración de partes para un trabajador.
 */
export const setWorkerReportConfigServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      nextNumber: z.number().int().min(0),
      yearPrefix: z.number().int().min(2000).max(2099),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    const configName = `__REPORT_CONFIG__${data.userId}`;

    // Check if config row exists
    const { data: existing } = await supabaseAdmin
      .from("client_equipment")
      .select("id")
      .eq("client_name", configName)
      .maybeSingle();

    if (existing) {
      // Update
      const { error } = await supabaseAdmin
        .from("client_equipment")
        .update({
          num_serie: String(data.nextNumber),
          modelo: String(data.yearPrefix),
        } as any)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabaseAdmin
        .from("client_equipment")
        .insert({
          client_name: configName,
          tipo_maquina: "report_config",
          num_serie: String(data.nextNumber),
          modelo: String(data.yearPrefix),
        } as any);
      if (error) throw error;
    }

    return { ok: true };
  });

/**
 * Server function: Get the next report number for a worker and increment the counter.
 * Called when creating a new report.
 */
export const getNextReportNumberServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const configName = `__REPORT_CONFIG__${userId}`;

    // Get current config
    const { data: existing } = await supabaseAdmin
      .from("client_equipment")
      .select("id, num_serie, modelo")
      .eq("client_name", configName)
      .maybeSingle();

    const currentYear = new Date().getFullYear();
    let nextNumber: number;
    let yearPrefix: number;

    if (existing) {
      nextNumber = parseInt(String((existing as any).num_serie || "1"), 10) || 1;
      yearPrefix = parseInt(String((existing as any).modelo || String(currentYear)), 10) || currentYear;

      // Increment counter
      const { error } = await supabaseAdmin
        .from("client_equipment")
        .update({
          num_serie: String(nextNumber + 1),
        } as any)
        .eq("id", existing.id);
      if (error) {
        console.error("Error incrementing report counter:", error);
      }
    } else {
      // No config exists, create one starting at 1
      nextNumber = 1;
      yearPrefix = currentYear;

      const { error } = await supabaseAdmin
        .from("client_equipment")
        .insert({
          client_name: configName,
          tipo_maquina: "report_config",
          num_serie: "2", // Next will be 2
          modelo: String(currentYear),
        } as any);
      if (error) {
        console.error("Error creating report config:", error);
      }
    }

    return { nextNumber, yearPrefix };
  });

function parseTimeToMinutes(t?: string): number | null {
  if (!t) return null;
  const parts = t.trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export type ClientViewWorkReport = {
  id: string;
  number: number;
  user_number: number | null;
  displayNumber: number;
  created_at: string;
  cliente: string;
  tecnico: string;
  direccion: string;
  data: any;
  totalHoursFormatted: string;
  totalHours: number;
  hasSignature: boolean;
  signerName: string;
  signatureImage: string | null;
  trabajosList: Array<{ descripcion: string; cantidad: string; codigo?: string }>;
  fotosCount: number;
  closed: boolean;
};

/**
 * Consulta los partes de trabajo correspondientes a la empresa del cliente autenticado.
 * - Solo devuelve los partes que correspondan a su empresa.
 * - Incluye fecha, horas, trabajos realizados, firma y metadatos para descargar el PDF oficial en cualquier momento.
 */
export const getMyClientReportsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientFilter: z.string().optional() }).optional().parse(d)
  )
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [{ data: roleData }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("id, username")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const isAdmin = !!roleData;
    const clientUsername = (profile?.username || "").trim();

    let targetClientNames: string[] = [];

    if (isAdmin && input?.clientFilter) {
      targetClientNames = [input.clientFilter.trim().toLowerCase()];
    } else if (!isAdmin) {
      if (!clientUsername) {
        return {
          companyName: "Sin empresa asignada",
          reports: [] as ClientViewWorkReport[],
          totalReports: 0,
          totalHoursFormatted: "0 h",
        };
      }
      targetClientNames = [clientUsername.toLowerCase()];

      // Buscar si tiene máquinas asociadas en client_equipment
      const { data: eq } = await supabaseAdmin
        .from("client_equipment")
        .select("client_name");
      for (const item of eq ?? []) {
        const cn = (item.client_name || "").trim().toLowerCase();
        if (
          cn &&
          (cn.includes(clientUsername.toLowerCase()) || clientUsername.toLowerCase().includes(cn))
        ) {
          if (!targetClientNames.includes(cn)) {
            targetClientNames.push(cn);
          }
        }
      }
    }

    // Consultar todos los partes
    const { data: allReports, error } = await supabaseAdmin
      .from("work_reports")
      .select("id, number, user_number, created_at, closed, data")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Filtrar los partes que pertenecen a la empresa del cliente
    const matched = (allReports ?? []).filter((r) => {
      if (isAdmin && !input?.clientFilter) return true;
      const repClient = String((r.data as any)?.cliente || "").trim().toLowerCase();
      if (!repClient) return false;
      return targetClientNames.some(
        (target) => repClient === target || repClient.includes(target) || target.includes(repClient)
      );
    });

    let cumulativeMinutes = 0;

    const reports: ClientViewWorkReport[] = matched.map((r) => {
      const d = r.data as any;
      const displayNumber = (r.user_number ?? r.number) as number;

      let totalMin = 0;
      if (Array.isArray(d?.dias)) {
        for (const dia of d.dias) {
          const mDe = parseTimeToMinutes(dia.mananaDe);
          const mA = parseTimeToMinutes(dia.mananaA);
          if (mDe !== null && mA !== null && mA > mDe) totalMin += mA - mDe;

          const tDe = parseTimeToMinutes(dia.tardeDe);
          const tA = parseTimeToMinutes(dia.tardeA);
          if (tDe !== null && tA !== null && tA > tDe) totalMin += tA - tDe;
        }
      }
      cumulativeMinutes += totalMin;

      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const totalHoursFormatted = m > 0 ? `${h}h ${m}m` : `${h} h`;

      const trabajosList = Array.isArray(d?.trabajos)
        ? d.trabajos
            .filter((t: any) => t?.descripcion?.trim())
            .map((t: any) => ({
              descripcion: String(t.descripcion || "").trim(),
              cantidad: String(t.cantidad || "1").trim(),
              codigo: String(t.codigo || "").trim(),
            }))
        : [];

      return {
        id: r.id as string,
        number: r.number as number,
        user_number: r.user_number as number | null,
        displayNumber,
        created_at: r.created_at as string,
        cliente: String(d?.cliente || clientUsername || "Cliente"),
        tecnico: String(d?.tecnico || "").trim() || "Técnico Gruper",
        direccion: String(d?.direccion || "").trim(),
        data: d,
        totalHours: totalMin / 60,
        totalHoursFormatted,
        hasSignature: !!d?.firma,
        signerName: String(d?.firmaNombre || "").trim(),
        signatureImage: d?.firma || null,
        trabajosList,
        fotosCount: Array.isArray(d?.fotos) ? d.fotos.length : 0,
        closed: !!r.closed,
      };
    });

    const cumH = Math.floor(cumulativeMinutes / 60);
    const cumM = cumulativeMinutes % 60;
    const totalHoursFormatted = cumM > 0 ? `${cumH}h ${cumM}m` : `${cumH} h`;

    return {
      companyName: clientUsername || "Tu Empresa",
      reports,
      totalReports: reports.length,
      totalHoursFormatted,
    };
  });

/**
 * Admin: Guarda las iniciales de un trabajador en client_equipment.
 */
export const saveWorkerInitialsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), initials: z.string().max(5) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    const key = `__INITIALS__${data.userId}`;
    const clean = data.initials.trim().toUpperCase();

    const { data: existing } = await supabaseAdmin
      .from("client_equipment")
      .select("id")
      .eq("client_name", key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("client_equipment")
        .update({ num_serie: clean } as any)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("client_equipment")
        .insert({ client_name: key, tipo_maquina: "worker_initials", num_serie: clean } as any);
      if (error) throw error;
    }

    return { ok: true, initials: clean };
  });
