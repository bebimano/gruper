import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UserDailySummary, DailyReportItem, DailyJobItem } from "./daily-summary-pdf";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function formatDateEs(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    return `${d} de ${MONTH_NAMES[m - 1]} de ${y}`;
  } catch {
    return dateStr;
  }
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

/**
 * Consulta la actividad diaria de todos los usuarios para una fecha concreta (sólo para administradores).
 * Si un usuario no realizó ningún parte ni trabajo ese día, se omite por completo.
 */
export const getDailyActivitySummaryServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido YYYY-MM-DD"),
      })
      .parse(d)
  )
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Verificar rol de administrador
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Acceso restringido únicamente a Administradores.");
    }

    const targetDate = input.date; // "YYYY-MM-DD"

    // 2. Consultar usuarios, partes de trabajo y tareas en paralelo
    const [{ data: profiles }, { data: reports }, { data: jobs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username").order("username"),
      supabaseAdmin
        .from("work_reports")
        .select("id, number, user_number, user_id, created_at, closed, data")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

    const userMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      userMap.set(p.id, p.username || "Técnico");
    }

    // 3. Filtrar partes de trabajo creados en la fecha seleccionada
    const dayReports: Array<{
      workerId: string;
      item: DailyReportItem;
    }> = [];

    for (const r of reports ?? []) {
      const createdDate = (r.created_at || "").slice(0, 10);
      const reportData = (r.data || {}) as any;

      // Comprobar también si dentro de las fechas de intervención coincide
      let matchesDate = createdDate === targetDate;
      if (!matchesDate && Array.isArray(reportData.dias)) {
        matchesDate = reportData.dias.some((d: any) => d.fecha === targetDate);
      }

      if (matchesDate && r.user_id) {
        const num = r.user_number ?? r.number;
        const timeStr = formatTime(r.created_at);
        const cliente = (reportData.cliente || "").trim() || "Sin cliente";
        const tipo = reportData.tipo === "taller" ? "taller" : "trabajo";
        const maquina = reportData.codigoMaquina || reportData.maquina || "";
        const numSerie = reportData.numSerie || "";
        const trabajoEfectuado = reportData.trabajoEfectuado || "";

        dayReports.push({
          workerId: r.user_id,
          item: {
            id: r.id,
            number: num,
            createdTime: timeStr,
            createdAtIso: r.created_at,
            cliente,
            tipo,
            maquina,
            numSerie,
            trabajoEfectuado,
            closed: !!r.closed,
          },
        });
      }
    }

    // 4. Filtrar trabajos asignados / actualizados en la fecha seleccionada
    const dayJobs: Array<{
      workerId: string;
      item: DailyJobItem;
    }> = [];

    for (const j of jobs ?? []) {
      // Ignorar averías internas
      if (j.title?.startsWith("[AVERÍA]")) continue;

      const createdDate = (j.created_at || "").slice(0, 10);
      const updatedDate = (j.updated_at || "").slice(0, 10);

      const matchesDate = createdDate === targetDate || updatedDate === targetDate;

      if (matchesDate && j.assigned_to) {
        let cleanDesc = j.description || "";
        if (cleanDesc.startsWith("{")) {
          try {
            const p = JSON.parse(cleanDesc);
            cleanDesc = p.description || p.title || "";
          } catch {}
        }

        const updatedTime = formatTime(j.updated_at || j.created_at);

        dayJobs.push({
          workerId: j.assigned_to,
          item: {
            id: j.id,
            title: j.title,
            cliente: (j.client || "").trim(),
            status: j.status,
            statusLabel: j.status === "terminado" ? "Terminado" : j.status === "en_curso" ? "En curso" : j.status === "pausado" ? "Pausado" : "Pendiente",
            statusNote: j.status_note || "",
            description: cleanDesc,
            updatedTime,
          },
        });
      }
    }

    // 5. Agrupar por técnico y omitir los que tengan 0 actividad
    const results: UserDailySummary[] = [];

    for (const p of profiles ?? []) {
      const workerId = p.id;
      const workerName = p.username || "Técnico";

      const workerReports = dayReports
        .filter((x) => x.workerId === workerId)
        .map((x) => x.item);
      const workerJobs = dayJobs
        .filter((x) => x.workerId === workerId)
        .map((x) => x.item);

      // Si no ha realizado ningún parte ni trabajo en el día, se excluye por completo
      if (workerReports.length === 0 && workerJobs.length === 0) {
        continue;
      }

      // Obtener lista de clientes únicos atendidos por este técnico
      const clientsSet = new Set<string>();
      for (const r of workerReports) {
        if (r.cliente && r.cliente !== "Sin cliente") clientsSet.add(r.cliente);
      }
      for (const j of workerJobs) {
        if (j.cliente) clientsSet.add(j.cliente);
      }

      results.push({
        workerId,
        workerName,
        dateStr: targetDate,
        dateFormatted: formatDateEs(targetDate),
        reports: workerReports,
        jobs: workerJobs,
        clientsList: Array.from(clientsSet),
      });
    }

    return results;
  });
