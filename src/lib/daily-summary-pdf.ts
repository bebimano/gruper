import { jsPDF } from "jspdf";
import logo from "@/assets/gruper-logo.png.asset.json";

export type DailyReportItem = {
  id: string;
  number: string | number;
  createdTime: string; // Ej: "08:45"
  createdAtIso: string;
  cliente: string;
  workerName?: string;
  workerId?: string;
  tipo: "trabajo" | "taller" | string;
  maquina?: string;
  numSerie?: string;
  trabajoEfectuado?: string;
  horasTotal?: string;
  kmTotal?: number;
  closed?: boolean;
};

export type DailyJobItem = {
  id: string;
  title: string;
  cliente: string;
  workerName?: string;
  workerId?: string;
  status: string;
  statusLabel: string;
  statusNote?: string;
  description?: string;
  updatedTime: string; // Ej: "13:20"
};

export type WorkerClientGroup = {
  clientName: string;
  reports: DailyReportItem[];
  jobs: DailyJobItem[];
};

export type UserDailySummary = {
  workerId: string;
  workerName: string;
  dateStr: string; // "2026-11-18"
  dateFormatted: string; // "18 de Noviembre de 2026"
  reports: DailyReportItem[];
  jobs: DailyJobItem[];
  clientsList: string[];
  byClient: WorkerClientGroup[];
};

export type ClientWorkerGroup = {
  workerId: string;
  workerName: string;
  reports: DailyReportItem[];
  jobs: DailyJobItem[];
};

export type ClientDailySummary = {
  clientId: string;
  clientName: string;
  dateStr: string;
  dateFormatted: string;
  reports: DailyReportItem[];
  jobs: DailyJobItem[];
  workersList: string[];
  byWorker: ClientWorkerGroup[];
};

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  pausado: "Pausado",
  terminado: "Terminado",
};

/**
 * Genera el documento jsPDF del resumen diario de un usuario/técnico.
 * Logotipo arriba a la izquierda y desglose por clientes.
 */
export async function generateDailySummaryPdfDoc(summary: UserDailySummary): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14;
  let y = 14;

  const need = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 14;
    }
  };

  // 1. Cabecera con Logo Gruper ARRIBA A LA IZQUIERDA
  const img = await toDataUrl(logo.url);
  if (img) {
    doc.addImage(img, "PNG", M, y, 50, 16);
  }

  doc.setFontSize(8).setTextColor(100).setFont("helvetica", "normal");
  doc.text("GRUPER REMOTE · ADMINISTRACIÓN", W - M, y + 4, { align: "right" });

  doc.setFontSize(14).setTextColor(15, 23, 42).setFont("helvetica", "bold");
  doc.text("RESUMEN DIARIO POR TÉCNICO", W - M, y + 10, { align: "right" });

  doc.setFontSize(9).setTextColor(37, 159, 253).setFont("helvetica", "bold");
  doc.text(summary.dateFormatted.toUpperCase(), W - M, y + 15, { align: "right" });

  y += 22;

  // Línea divisoria
  doc.setDrawColor(226, 232, 240).setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 5;

  // 2. Ficha del Técnico
  need(24);
  doc.setFillColor(248, 250, 252).setDrawColor(203, 213, 225).roundedRect(M, y, W - 2 * M, 20, 2.5, 2.5, "FD");

  doc.setFontSize(8.5).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("TRABAJADOR / TÉCNICO:", M + 5, y + 5.5);
  doc.setFontSize(11).setTextColor(15, 23, 42).setFont("helvetica", "bold");
  doc.text(summary.workerName, M + 5, y + 11.5);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
  doc.text(`Fecha: ${summary.dateFormatted}`, M + 5, y + 16.5);

  // Métricas
  const metricX = W - M - 80;
  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("PARTES:", metricX, y + 6);
  doc.setFontSize(10).setTextColor(37, 159, 253).setFont("helvetica", "bold");
  doc.text(`${summary.reports.length}`, metricX + 16, y + 6);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("TRABAJOS:", metricX + 28, y + 6);
  doc.setFontSize(10).setTextColor(16, 185, 129).setFont("helvetica", "bold");
  doc.text(`${summary.jobs.length}`, metricX + 48, y + 6);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
  const clientsStr = summary.clientsList.length > 0 ? summary.clientsList.join(", ") : "Sin clientes";
  const clientsFit = doc.splitTextToSize(`Clientes: ${clientsStr}`, 75);
  doc.text(clientsFit[0] ?? "", metricX, y + 14.5);

  y += 25;

  const sectionHeader = (title: string, count: number, bgR = 37, bgG = 159, bgB = 253) => {
    need(11);
    doc.setFillColor(bgR, bgG, bgB).rect(M, y, W - 2 * M, 6.5, "F");
    doc.setTextColor(255).setFontSize(9.5).setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), M + 3, y + 4.8);
    doc.text(`${count}`, W - M - 4, y + 4.8, { align: "right" });
    doc.setTextColor(0).setFont("helvetica", "normal");
    y += 9.5;
  };

  // 3. Sección: PARTES DE TRABAJO
  sectionHeader("1. Partes de trabajo generados en el día", summary.reports.length, 37, 159, 253);

  if (summary.reports.length === 0) {
    need(8);
    doc.setFontSize(8.5).setTextColor(120).setFont("helvetica", "italic");
    doc.text("No se generaron partes de trabajo en esta fecha.", M + 3, y + 2);
    y += 8;
  } else {
    for (const r of summary.reports) {
      need(16);
      doc.setFillColor(255, 255, 255).setDrawColor(226, 232, 240).roundedRect(M, y, W - 2 * M, 14, 1.5, 1.5, "FD");
      doc.setFillColor(37, 159, 253).rect(M, y, 2, 14, "F");

      doc.setFontSize(9).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      doc.text(`Parte Nº ${r.number}`, M + 5, y + 4.8);

      // Hora destacada
      doc.setFillColor(239, 246, 255).roundedRect(M + 32, y + 1.2, 22, 5, 1, 1, "F");
      doc.setFontSize(7.5).setTextColor(29, 78, 216).setFont("helvetica", "bold");
      doc.text(`Hora: ${r.createdTime}`, M + 34, y + 4.6);

      doc.setFontSize(7.5).setTextColor(100, 116, 139).setFont("helvetica", "bold");
      doc.text(r.tipo === "taller" ? "[TALLER]" : "[ASISTENCIA TÉCNICA]", M + 57, y + 4.6);

      // Cliente
      doc.setFontSize(8.5).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      doc.text(`Cliente: ${r.cliente || "Sin cliente"}`, W - M - 4, y + 4.8, { align: "right" });

      // Detalles
      doc.setFontSize(7.5).setTextColor(71, 85, 105).setFont("helvetica", "normal");
      const details = [
        r.maquina ? `Máquina: ${r.maquina}` : null,
        r.trabajoEfectuado ? `Trabajo: ${r.trabajoEfectuado}` : null,
        r.horasTotal ? `Tiempo: ${r.horasTotal}` : null,
        r.kmTotal ? `${r.kmTotal} Km` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const detailFit = doc.splitTextToSize(details || "Sin descripción adicional", W - 2 * M - 10);
      doc.text(detailFit[0] ?? "", M + 5, y + 10.5);

      y += 16.5;
    }
  }

  y += 2;

  // 4. Sección: TRABAJOS Y TAREAS
  sectionHeader("2. Trabajos y tareas asignados / realizados en el día", summary.jobs.length, 16, 185, 129);

  if (summary.jobs.length === 0) {
    need(8);
    doc.setFontSize(8.5).setTextColor(120).setFont("helvetica", "italic");
    doc.text("No se registraron trabajos ni tareas en esta fecha.", M + 3, y + 2);
    y += 8;
  } else {
    for (const j of summary.jobs) {
      need(16);
      doc.setFillColor(255, 255, 255).setDrawColor(226, 232, 240).roundedRect(M, y, W - 2 * M, 14, 1.5, 1.5, "FD");

      const isDone = j.status === "terminado";
      const isInProgress = j.status === "en_curso";
      if (isDone) {
        doc.setFillColor(16, 185, 129).rect(M, y, 2, 14, "F");
      } else if (isInProgress) {
        doc.setFillColor(59, 130, 246).rect(M, y, 2, 14, "F");
      } else {
        doc.setFillColor(245, 158, 11).rect(M, y, 2, 14, "F");
      }

      doc.setFontSize(9).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      const titleFit = doc.splitTextToSize(j.title, 95);
      doc.text(titleFit[0] ?? "", M + 5, y + 4.8);

      const stLabel = j.statusLabel || STATUS_LABELS[j.status] || j.status;
      doc.setFontSize(7.5).setTextColor(isDone ? 16 : isInProgress ? 29 : 180, isDone ? 185 : isInProgress ? 78 : 83, isDone ? 129 : isInProgress ? 216 : 9).setFont("helvetica", "bold");
      doc.text(`[${stLabel.toUpperCase()}]`, M + 103, y + 4.8);

      doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
      doc.text(
        `${j.cliente ? `${j.cliente} · ` : ""}Hora: ${j.updatedTime}`,
        W - M - 4,
        y + 4.8,
        { align: "right" }
      );

      const noteText = j.statusNote ? `Nota: "${j.statusNote}"` : j.description ? `Detalle: ${j.description}` : "Sin notas adicionales";
      doc.setFontSize(7.5).setTextColor(71, 85, 105).setFont("helvetica", "normal");
      const noteFit = doc.splitTextToSize(noteText, W - 2 * M - 10);
      doc.text(noteFit[0] ?? "", M + 5, y + 10.5);

      y += 16.5;
    }
  }

  // 5. Pie de página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5).setTextColor(148, 163, 184).setFont("helvetica", "normal");
    doc.text(
      `Gruper Remote · Documento de control de actividad diaria para Administración · Página ${i} de ${pageCount}`,
      M,
      290
    );
    doc.text(
      new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      W - M,
      290,
      { align: "right" }
    );
  }

  return doc;
}

/**
 * Genera el documento jsPDF del resumen diario de un cliente.
 * Logotipo arriba a la izquierda y desglose por técnicos que intervinieron.
 */
export async function generateClientDailySummaryPdfDoc(summary: ClientDailySummary): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14;
  let y = 14;

  const need = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 14;
    }
  };

  // 1. Cabecera con Logo Gruper ARRIBA A LA IZQUIERDA
  const img = await toDataUrl(logo.url);
  if (img) {
    doc.addImage(img, "PNG", M, y, 50, 16);
  }

  doc.setFontSize(8).setTextColor(100).setFont("helvetica", "normal");
  doc.text("GRUPER REMOTE · ADMINISTRACIÓN", W - M, y + 4, { align: "right" });

  doc.setFontSize(14).setTextColor(15, 23, 42).setFont("helvetica", "bold");
  doc.text("RESUMEN DIARIO POR CLIENTE", W - M, y + 10, { align: "right" });

  doc.setFontSize(9).setTextColor(37, 159, 253).setFont("helvetica", "bold");
  doc.text(summary.dateFormatted.toUpperCase(), W - M, y + 15, { align: "right" });

  y += 22;

  // Línea divisoria
  doc.setDrawColor(226, 232, 240).setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 5;

  // 2. Ficha del Cliente
  need(24);
  doc.setFillColor(248, 250, 252).setDrawColor(203, 213, 225).roundedRect(M, y, W - 2 * M, 20, 2.5, 2.5, "FD");

  doc.setFontSize(8.5).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("CLIENTE:", M + 5, y + 5.5);
  doc.setFontSize(11).setTextColor(15, 23, 42).setFont("helvetica", "bold");
  doc.text(summary.clientName, M + 5, y + 11.5);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
  doc.text(`Fecha: ${summary.dateFormatted}`, M + 5, y + 16.5);

  // Métricas
  const metricX = W - M - 80;
  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("PARTES:", metricX, y + 6);
  doc.setFontSize(10).setTextColor(37, 159, 253).setFont("helvetica", "bold");
  doc.text(`${summary.reports.length}`, metricX + 16, y + 6);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("TRABAJOS:", metricX + 28, y + 6);
  doc.setFontSize(10).setTextColor(16, 185, 129).setFont("helvetica", "bold");
  doc.text(`${summary.jobs.length}`, metricX + 48, y + 6);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
  const workersStr = summary.workersList.length > 0 ? summary.workersList.join(", ") : "Sin técnicos asignados";
  const workersFit = doc.splitTextToSize(`Técnicos: ${workersStr}`, 75);
  doc.text(workersFit[0] ?? "", metricX, y + 14.5);

  y += 25;

  const sectionHeader = (title: string, count: number, bgR = 37, bgG = 159, bgB = 253) => {
    need(11);
    doc.setFillColor(bgR, bgG, bgB).rect(M, y, W - 2 * M, 6.5, "F");
    doc.setTextColor(255).setFontSize(9.5).setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), M + 3, y + 4.8);
    doc.text(`${count}`, W - M - 4, y + 4.8, { align: "right" });
    doc.setTextColor(0).setFont("helvetica", "normal");
    y += 9.5;
  };

  // 3. Sección: Partes de Trabajo del Cliente
  sectionHeader("1. Partes de trabajo realizados en este cliente", summary.reports.length, 37, 159, 253);

  if (summary.reports.length === 0) {
    need(8);
    doc.setFontSize(8.5).setTextColor(120).setFont("helvetica", "italic");
    doc.text("No se generaron partes de trabajo para este cliente en esta fecha.", M + 3, y + 2);
    y += 8;
  } else {
    for (const r of summary.reports) {
      need(16);
      doc.setFillColor(255, 255, 255).setDrawColor(226, 232, 240).roundedRect(M, y, W - 2 * M, 14, 1.5, 1.5, "FD");
      doc.setFillColor(37, 159, 253).rect(M, y, 2, 14, "F");

      doc.setFontSize(9).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      doc.text(`Parte Nº ${r.number}`, M + 5, y + 4.8);

      // Hora destacada
      doc.setFillColor(239, 246, 255).roundedRect(M + 32, y + 1.2, 22, 5, 1, 1, "F");
      doc.setFontSize(7.5).setTextColor(29, 78, 216).setFont("helvetica", "bold");
      doc.text(`Hora: ${r.createdTime}`, M + 34, y + 4.6);

      doc.setFontSize(7.5).setTextColor(100, 116, 139).setFont("helvetica", "bold");
      doc.text(r.tipo === "taller" ? "[TALLER]" : "[ASISTENCIA TÉCNICA]", M + 57, y + 4.6);

      // Técnico
      doc.setFontSize(8.5).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      doc.text(`Técnico: ${r.workerName || "Sin asignar"}`, W - M - 4, y + 4.8, { align: "right" });

      // Detalles
      doc.setFontSize(7.5).setTextColor(71, 85, 105).setFont("helvetica", "normal");
      const details = [
        r.maquina ? `Máquina: ${r.maquina}` : null,
        r.trabajoEfectuado ? `Trabajo: ${r.trabajoEfectuado}` : null,
        r.horasTotal ? `Tiempo: ${r.horasTotal}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const detailFit = doc.splitTextToSize(details || "Sin descripción adicional", W - 2 * M - 10);
      doc.text(detailFit[0] ?? "", M + 5, y + 10.5);

      y += 16.5;
    }
  }

  y += 2;

  // 4. Sección: Trabajos y Tareas del Cliente
  sectionHeader("2. Trabajos y tareas del cliente en el día", summary.jobs.length, 16, 185, 129);

  if (summary.jobs.length === 0) {
    need(8);
    doc.setFontSize(8.5).setTextColor(120).setFont("helvetica", "italic");
    doc.text("No se registraron trabajos ni tareas para este cliente en esta fecha.", M + 3, y + 2);
    y += 8;
  } else {
    for (const j of summary.jobs) {
      need(16);
      doc.setFillColor(255, 255, 255).setDrawColor(226, 232, 240).roundedRect(M, y, W - 2 * M, 14, 1.5, 1.5, "FD");

      const isDone = j.status === "terminado";
      const isInProgress = j.status === "en_curso";
      if (isDone) {
        doc.setFillColor(16, 185, 129).rect(M, y, 2, 14, "F");
      } else if (isInProgress) {
        doc.setFillColor(59, 130, 246).rect(M, y, 2, 14, "F");
      } else {
        doc.setFillColor(245, 158, 11).rect(M, y, 2, 14, "F");
      }

      doc.setFontSize(9).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      const titleFit = doc.splitTextToSize(j.title, 95);
      doc.text(titleFit[0] ?? "", M + 5, y + 4.8);

      const stLabel = j.statusLabel || STATUS_LABELS[j.status] || j.status;
      doc.setFontSize(7.5).setTextColor(isDone ? 16 : isInProgress ? 29 : 180, isDone ? 185 : isInProgress ? 78 : 83, isDone ? 129 : isInProgress ? 216 : 9).setFont("helvetica", "bold");
      doc.text(`[${stLabel.toUpperCase()}]`, M + 103, y + 4.8);

      doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
      doc.text(
        `${j.workerName ? `Técnico: ${j.workerName} · ` : ""}Hora: ${j.updatedTime}`,
        W - M - 4,
        y + 4.8,
        { align: "right" }
      );

      const noteText = j.statusNote ? `Nota: "${j.statusNote}"` : j.description ? `Detalle: ${j.description}` : "Sin notas adicionales";
      doc.setFontSize(7.5).setTextColor(71, 85, 105).setFont("helvetica", "normal");
      const noteFit = doc.splitTextToSize(noteText, W - 2 * M - 10);
      doc.text(noteFit[0] ?? "", M + 5, y + 10.5);

      y += 16.5;
    }
  }

  // 5. Pie de página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5).setTextColor(148, 163, 184).setFont("helvetica", "normal");
    doc.text(
      `Gruper Remote · Documento de control de actividad diaria para Administración · Página ${i} de ${pageCount}`,
      M,
      290
    );
    doc.text(
      new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      W - M,
      290,
      { align: "right" }
    );
  }

  return doc;
}

/**
 * Descarga el PDF del resumen diario del trabajador.
 */
export async function downloadDailySummaryPdf(summary: UserDailySummary): Promise<void> {
  const doc = await generateDailySummaryPdfDoc(summary);
  const cleanName = summary.workerName.trim().replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_");
  const filename = `Resumen_Diario_Tecnico_${cleanName}_${summary.dateStr}.pdf`;
  doc.save(filename);
}

/**
 * Descarga el PDF del resumen diario del cliente.
 */
export async function downloadClientDailySummaryPdf(summary: ClientDailySummary): Promise<void> {
  const doc = await generateClientDailySummaryPdfDoc(summary);
  const cleanName = summary.clientName.trim().replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_");
  const filename = `Resumen_Diario_Cliente_${cleanName}_${summary.dateStr}.pdf`;
  doc.save(filename);
}

/**
 * Muestra de ejemplo para el resumen diario de un trabajador.
 */
export function getSampleDailySummary(dateStr = new Date().toISOString().slice(0, 10)): UserDailySummary {
  const parts = dateStr.split("-");
  const dateFormatted = `${parts[2]} de Noviembre de ${parts[0]}`;

  const rep1: DailyReportItem = {
    id: "rep-1",
    number: 42,
    createdTime: "08:45",
    createdAtIso: `${dateStr}T08:45:00.000Z`,
    cliente: "Frutinter S.A.",
    workerName: "Juan Pérez (Técnico de Servicio)",
    tipo: "trabajo",
    maquina: "Depuradora Principal Mod. D-200",
    numSerie: "SN-98231",
    trabajoEfectuado: "Sustitución de bomba de recirculación y comprobación de estanqueidad.",
    horasTotal: "3h 15m",
    kmTotal: 34,
    closed: true,
  };

  const rep2: DailyReportItem = {
    id: "rep-2",
    number: 43,
    createdTime: "14:20",
    createdAtIso: `${dateStr}T14:20:00.000Z`,
    cliente: "Avícola Velasco Gallinas",
    workerName: "Juan Pérez (Técnico de Servicio)",
    tipo: "taller",
    maquina: "Compresor de Aire Industrial",
    numSerie: "CP-4401",
    trabajoEfectuado: "Mantenimiento preventivo, cambio de filtros de aire y aceite hidráulico.",
    horasTotal: "2h 30m",
    kmTotal: 0,
    closed: true,
  };

  const job1: DailyJobItem = {
    id: "job-1",
    title: "Montar baterías SAI y comprobación de alimentación",
    cliente: "Frutinter S.A.",
    workerName: "Juan Pérez (Técnico de Servicio)",
    status: "terminado",
    statusLabel: "Terminado",
    statusNote: "Baterías instaladas y comprobado SAI en carga correcta.",
    description: "Montaje de los dos módulos de baterías auxiliares.",
    updatedTime: "11:30",
  };

  const job2: DailyJobItem = {
    id: "job-2",
    title: "Revisión caldera y circuito de vapor",
    cliente: "Cítricos del Mediterráneo",
    workerName: "Juan Pérez (Técnico de Servicio)",
    status: "en_curso",
    statusLabel: "En curso",
    statusNote: "Válvulas de seguridad sustituidas, pendiente prueba térmica.",
    description: "Comprobación anual obligatoria de circuito de presión.",
    updatedTime: "17:10",
  };

  return {
    workerId: "sample-worker-id",
    workerName: "Juan Pérez (Técnico de Servicio)",
    dateStr,
    dateFormatted,
    reports: [rep1, rep2],
    jobs: [job1, job2],
    clientsList: ["Frutinter S.A.", "Avícola Velasco Gallinas", "Cítricos del Mediterráneo"],
    byClient: [
      {
        clientName: "Frutinter S.A.",
        reports: [rep1],
        jobs: [job1],
      },
      {
        clientName: "Avícola Velasco Gallinas",
        reports: [rep2],
        jobs: [],
      },
      {
        clientName: "Cítricos del Mediterráneo",
        reports: [],
        jobs: [job2],
      },
    ],
  };
}

/**
 * Muestra de ejemplo para el resumen diario de un cliente.
 */
export function getSampleClientDailySummary(dateStr = new Date().toISOString().slice(0, 10)): ClientDailySummary {
  const parts = dateStr.split("-");
  const dateFormatted = `${parts[2]} de Noviembre de ${parts[0]}`;

  const rep1: DailyReportItem = {
    id: "rep-1",
    number: 42,
    createdTime: "08:45",
    createdAtIso: `${dateStr}T08:45:00.000Z`,
    cliente: "Frutinter S.A.",
    workerName: "Juan Pérez",
    tipo: "trabajo",
    maquina: "Depuradora Principal Mod. D-200",
    trabajoEfectuado: "Sustitución de bomba de recirculación.",
    horasTotal: "3h 15m",
    closed: true,
  };

  const job1: DailyJobItem = {
    id: "job-1",
    title: "Montar baterías SAI y comprobación de alimentación",
    cliente: "Frutinter S.A.",
    workerName: "Juan Pérez",
    status: "terminado",
    statusLabel: "Terminado",
    statusNote: "Baterías instaladas.",
    updatedTime: "11:30",
  };

  return {
    clientId: "sample-client-1",
    clientName: "Frutinter S.A.",
    dateStr,
    dateFormatted,
    reports: [rep1],
    jobs: [job1],
    workersList: ["Juan Pérez"],
    byWorker: [
      {
        workerId: "w-1",
        workerName: "Juan Pérez",
        reports: [rep1],
        jobs: [job1],
      },
    ],
  };
}
