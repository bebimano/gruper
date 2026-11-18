import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  UserDailySummary,
  ClientDailySummary,
  DailyReportItem,
  DailyJobItem,
  WorkerClientGroup,
  ClientWorkerGroup,
} from "./daily-summary-pdf";

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

export type DailyActivityResponse = {
  dateStr: string;
  dateFormatted: string;
  workers: UserDailySummary[];
  clients: ClientDailySummary[];
  stats: {
    totalReports: number;
    totalJobs: number;
    activeWorkersCount: number;
    activeClientsCount: number;
  };
};

/**
 * Consulta la actividad diaria para una fecha concreta (sólo para administradores).
 * Organizado por Trabajador y por Cliente.
 * Si un usuario o cliente no tiene ninguna actividad ese día, se excluye por completo.
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
  .handler(async ({ data: input, context }): Promise<DailyActivityResponse> => {
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
      workerName: string;
      item: DailyReportItem;
    }> = [];

    for (const r of reports ?? []) {
      const createdDate = (r.created_at || "").slice(0, 10);
      const reportData = (r.data || {}) as any;

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
        const workerName = userMap.get(r.user_id) || "Técnico";

        dayReports.push({
          workerId: r.user_id,
          workerName,
          item: {
            id: r.id,
            number: num,
            createdTime: timeStr,
            createdAtIso: r.created_at,
            cliente,
            workerName,
            workerId: r.user_id,
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
      workerName: string;
      item: DailyJobItem;
    }> = [];

    for (const j of jobs ?? []) {
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
        const workerName = userMap.get(j.assigned_to) || "Técnico";

        dayJobs.push({
          workerId: j.assigned_to,
          workerName,
          item: {
            id: j.id,
            title: j.title,
            cliente: (j.client || "").trim() || "Sin cliente",
            workerName,
            workerId: j.assigned_to,
            status: j.status,
            statusLabel:
              j.status === "terminado"
                ? "Terminado"
                : j.status === "en_curso"
                ? "En curso"
                : j.status === "pausado"
                ? "Pausado"
                : "Pendiente",
            statusNote: j.status_note || "",
            description: cleanDesc,
            updatedTime,
          },
        });
      }
    }

    const dateFormatted = formatDateEs(targetDate);

    // 5. Agrupación por Trabajador (excluyendo a quienes no tienen actividad)
    const workersResults: UserDailySummary[] = [];

    for (const p of profiles ?? []) {
      const workerId = p.id;
      const workerName = p.username || "Técnico";

      const workerReports = dayReports
        .filter((x) => x.workerId === workerId)
        .map((x) => x.item);
      const workerJobs = dayJobs
        .filter((x) => x.workerId === workerId)
        .map((x) => x.item);

      if (workerReports.length === 0 && workerJobs.length === 0) {
        continue;
      }

      // Subagrupación por Cliente dentro de este trabajador
      const clientGroupsMap = new Map<string, { reports: DailyReportItem[]; jobs: DailyJobItem[] }>();

      for (const r of workerReports) {
        const cName = r.cliente || "Sin cliente";
        if (!clientGroupsMap.has(cName)) {
          clientGroupsMap.set(cName, { reports: [], jobs: [] });
        }
        clientGroupsMap.get(cName)!.reports.push(r);
      }

      for (const j of workerJobs) {
        const cName = j.cliente || "Sin cliente";
        if (!clientGroupsMap.has(cName)) {
          clientGroupsMap.set(cName, { reports: [], jobs: [] });
        }
        clientGroupsMap.get(cName)!.jobs.push(j);
      }

      const byClient: WorkerClientGroup[] = Array.from(clientGroupsMap.entries())
        .map(([clientName, data]) => ({
          clientName,
          reports: data.reports,
          jobs: data.jobs,
        }))
        .sort((a, b) => a.clientName.localeCompare(b.clientName, "es-ES"));

      const clientsList = byClient
        .map((c) => c.clientName)
        .filter((c) => c !== "Sin cliente");

      workersResults.push({
        workerId,
        workerName,
        dateStr: targetDate,
        dateFormatted,
        reports: workerReports,
        jobs: workerJobs,
        clientsList,
        byClient,
      });
    }

    // 6. Agrupación por Cliente (excluyendo clientes sin actividad)
    const clientMap = new Map<string, { reports: DailyReportItem[]; jobs: DailyJobItem[] }>();

    for (const r of dayReports) {
      const cName = r.item.cliente || "Sin cliente";
      if (!clientMap.has(cName)) {
        clientMap.set(cName, { reports: [], jobs: [] });
      }
      clientMap.get(cName)!.reports.push(r.item);
    }

    for (const j of dayJobs) {
      const cName = j.item.cliente || "Sin cliente";
      if (!clientMap.has(cName)) {
        clientMap.set(cName, { reports: [], jobs: [] });
      }
      clientMap.get(cName)!.jobs.push(j.item);
    }

    const clientsResults: ClientDailySummary[] = [];

    for (const [clientName, cData] of clientMap.entries()) {
      if (cData.reports.length === 0 && cData.jobs.length === 0) continue;

      // Subagrupación por Trabajador dentro de este cliente
      const workerGroupsMap = new Map<string, { workerName: string; reports: DailyReportItem[]; jobs: DailyJobItem[] }>();

      for (const r of cData.reports) {
        const wId = r.workerId || "unknown";
        const wName = r.workerName || "Técnico";
        if (!workerGroupsMap.has(wId)) {
          workerGroupsMap.set(wId, { workerName: wName, reports: [], jobs: [] });
        }
        workerGroupsMap.get(wId)!.reports.push(r);
      }

      for (const j of cData.jobs) {
        const wId = j.workerId || "unknown";
        const wName = j.workerName || "Técnico";
        if (!workerGroupsMap.has(wId)) {
          workerGroupsMap.set(wId, { workerName: wName, reports: [], jobs: [] });
        }
        workerGroupsMap.get(wId)!.jobs.push(j);
      }

      const byWorker: ClientWorkerGroup[] = Array.from(workerGroupsMap.entries()).map(([wId, wData]) => ({
        workerId: wId,
        workerName: wData.workerName,
        reports: wData.reports,
        jobs: wData.jobs,
      }));

      const workersList = Array.from(new Set(byWorker.map((w) => w.workerName)));

      clientsResults.push({
        clientId: clientName,
        clientName,
        dateStr: targetDate,
        dateFormatted,
        reports: cData.reports,
        jobs: cData.jobs,
        workersList,
        byWorker,
      });
    }

    clientsResults.sort((a, b) => a.clientName.localeCompare(b.clientName, "es-ES"));

    return {
      dateStr: targetDate,
      dateFormatted,
      workers: workersResults,
      clients: clientsResults,
      stats: {
        totalReports: dayReports.length,
        totalJobs: dayJobs.length,
        activeWorkersCount: workersResults.length,
        activeClientsCount: clientsResults.length,
      },
    };
  });
