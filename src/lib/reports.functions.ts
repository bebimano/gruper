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

    const { data, error } = await supabaseAdmin
      .from("work_reports")
      .select("id, number, user_number, created_at, data")
      .order("number", { ascending: false });

    if (error) throw error;

    return {
      reports: (data ?? []).map((r) => ({
        id: r.id as string,
        number: r.number as number,
        user_number: r.user_number as number | null,
        created_at: r.created_at as string,
        cliente: String((r.data as { cliente?: string })?.cliente ?? ""),
      })),
    };
  });

/**
 * Admin: Cambia el user_number de un parte con validación de conflicto.
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

    // Conflicto por user_number
    const { data: c1 } = await supabaseAdmin
      .from("work_reports")
      .select("id, data")
      .eq("user_number", data.newNumber)
      .neq("id", data.id)
      .maybeSingle();

    if (c1) {
      return {
        conflict: true,
        ok: false,
        conflictNum: data.newNumber,
        conflictCliente: String((c1.data as { cliente?: string })?.cliente ?? ""),
        conflictId: c1.id as string,
      };
    }

    // Conflicto por número original
    const { data: c2 } = await supabaseAdmin
      .from("work_reports")
      .select("id, data")
      .eq("number", data.newNumber)
      .is("user_number", null)
      .neq("id", data.id)
      .maybeSingle();

    if (c2) {
      return {
        conflict: true,
        ok: false,
        conflictNum: data.newNumber,
        conflictCliente: String((c2.data as { cliente?: string })?.cliente ?? ""),
        conflictId: c2.id as string,
      };
    }

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

    const [{ data: profiles }, { data: contacts }, { data: equipmentRows }, { data: reports }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, username").order("username"),
        supabaseAdmin.from("report_contacts").select("name").order("name"),
        supabaseAdmin.from("client_equipment").select("client_name"),
        supabaseAdmin
          .from("work_reports")
          .select("id, number, user_number, created_at, closed, data")
          .order("created_at", { ascending: false }),
      ]);

    const registeredUsernames = new Set(
      (profiles ?? [])
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

    // 1. Clientes registrados
    for (const p of profiles ?? []) {
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
          isRegisteredUser: registeredUsernames.has(key),
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
          isRegisteredUser: registeredUsernames.has(key),
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
