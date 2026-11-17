import type { Dia, WorkReport } from "@/lib/work-report";

/**
 * Parses "HH:MM" string to minutes from midnight (0..1439).
 */
export function timeToMinutes(timeStr?: string): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Calculates duration in minutes between start and end "HH:MM".
 */
export function durationMinutes(start?: string, end?: string): number {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60; // Crosses midnight
  return diff;
}

/**
 * Formats minutes into "Xh Ym" or "Xh" or "Y min".
 */
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Parses numeric distance (e.g. "45", "45.5", "45,5 km") safely.
 */
export function parseKm(kmStr?: string): number {
  if (!kmStr || typeof kmStr !== "string") return 0;
  const cleaned = kmStr.replace(/[^\d.,]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export type ReportTotals = {
  totalWorkMinutes: number;
  formattedWorkHours: string;
  totalTravelMinutes: number;
  formattedTravelHours: string;
  totalKm: number;
};

/**
 * Synchronizes morning (manana) and afternoon (tarde) intervals from client arrival (idaA)
 * and client departure (vueltaDe).
 */
export function syncDayWorkIntervals(day: Dia): Dia {
  if (!day.idaA) return day;

  const sMin = timeToMinutes(day.idaA);
  if (sMin === null) return day;

  const splitMin = 14 * 60; // 14:00

  if (day.vueltaDe) {
    const eMin = timeToMinutes(day.vueltaDe);
    if (eMin !== null) {
      if (sMin < splitMin && eMin > splitMin) {
        day.mananaDe = day.idaA;
        day.mananaA = "14:00";
        day.tardeDe = "14:00";
        day.tardeA = day.vueltaDe;
      } else if (sMin >= splitMin) {
        day.mananaDe = "";
        day.mananaA = "";
        day.tardeDe = day.idaA;
        day.tardeA = day.vueltaDe;
      } else {
        day.mananaDe = day.idaA;
        day.mananaA = day.vueltaDe;
        day.tardeDe = "";
        day.tardeA = "";
      }
      return day;
    }
  }

  // Arrival set, departure not yet set (in progress)
  if (sMin >= splitMin) {
    day.tardeDe = day.idaA;
    day.tardeA = "";
  } else {
    day.mananaDe = day.idaA;
    day.mananaA = "";
  }
  return day;
}

/**
 * Computes total work time (morning + afternoon intervals) and total kilometers
 * across all days registered in the report.
 */
export function calculateReportTotals(report: WorkReport): ReportTotals {
  let workMinutes = 0;
  let travelMinutes = 0;
  let km = 0;

  for (const d of report.dias || []) {
    // Travel duration
    travelMinutes += durationMinutes(d.idaDe, d.idaA);
    travelMinutes += durationMinutes(d.vueltaDe, d.vueltaA);

    // Work labor duration (Mano de obra)
    // Regla principal: tiempo total desde que llega al cliente (idaA) hasta que sale del cliente (vueltaDe)
    let dayWork = 0;
    if (d.idaA && d.vueltaDe) {
      dayWork = durationMinutes(d.idaA, d.vueltaDe);
    } else {
      // Fallback si no están ambos marcados
      dayWork = durationMinutes(d.mananaDe, d.mananaA) + durationMinutes(d.tardeDe, d.tardeA);
    }
    workMinutes += dayWork;

    // Kilometers
    km += parseKm(d.kmIda);
    km += parseKm(d.kmVuelta);
  }

  return {
    totalWorkMinutes: workMinutes,
    formattedWorkHours: formatMinutes(workMinutes),
    totalTravelMinutes: travelMinutes,
    formattedTravelHours: formatMinutes(travelMinutes),
    totalKm: Math.round(km * 10) / 10,
  };
}

/**
 * Gets current time in "HH:MM" format.
 */
export function getCurrentTimeStr(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Gets today's date in "YYYY-MM-DD" format.
 */
export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
