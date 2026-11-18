import { jsPDF } from "jspdf";
import logo from "@/assets/gruper-logo.png.asset.json";

export type DailyReportItem = {
  id: string;
  number: string | number;
  createdTime: string; // Ej: "08:45"
  createdAtIso: string;
  cliente: string;
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
  status: string;
  statusLabel: string;
  statusNote?: string;
  description?: string;
  updatedTime: string; // Ej: "13:20"
};

export type UserDailySummary = {
  workerId: string;
  workerName: string;
  dateStr: string; // "2026-11-18"
  dateFormatted: string; // "18 de Noviembre de 2026"
  reports: DailyReportItem[];
  jobs: DailyJobItem[];
  clientsList: string[];
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

  // 1. Cabecera con Logo Gruper y Título del documento
  const img = await toDataUrl(logo.url);
  if (img) {
    doc.addImage(img, "PNG", M, y, 46, 14.5);
  }

  doc.setFontSize(8).setTextColor(100).setFont("helvetica", "normal");
  doc.text("GRUPER REMOTE · ADMINISTRACIÓN", W - M, y + 4, { align: "right" });

  doc.setFontSize(15).setTextColor(15, 23, 42).setFont("helvetica", "bold");
  doc.text("RESUMEN DIARIO DE ACTIVIDAD", W - M, y + 11, { align: "right" });

  doc.setFontSize(9).setTextColor(37, 159, 253).setFont("helvetica", "bold");
  doc.text(summary.dateFormatted.toUpperCase(), W - M, y + 16, { align: "right" });

  y += 22;

  // Línea divisoria elegante
  doc.setDrawColor(226, 232, 240).setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 5;

  // 2. Ficha de Datos del Técnico y Métricas del Día
  need(26);
  doc.setFillColor(248, 250, 252).setDrawColor(203, 213, 225).roundedRect(M, y, W - 2 * M, 22, 2.5, 2.5, "FD");

  doc.setFontSize(9).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("TÉCNICO / USUARIO:", M + 5, y + 6);
  doc.setFontSize(11).setTextColor(15, 23, 42).setFont("helvetica", "bold");
  doc.text(summary.workerName, M + 5, y + 12);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
  doc.text(`Fecha del registro: ${summary.dateFormatted}`, M + 5, y + 17);

  // Métricas a la derecha
  const metricX = W - M - 75;
  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("PARTES:", metricX, y + 7);
  doc.setFontSize(10).setTextColor(37, 159, 253).setFont("helvetica", "bold");
  doc.text(`${summary.reports.length}`, metricX + 16, y + 7);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "bold");
  doc.text("TRABAJOS:", metricX + 28, y + 7);
  doc.setFontSize(10).setTextColor(16, 185, 129).setFont("helvetica", "bold");
  doc.text(`${summary.jobs.length}`, metricX + 48, y + 7);

  doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
  const clientsStr = summary.clientsList.length > 0 ? summary.clientsList.join(", ") : "Sin clientes específicos";
  const clientsFit = doc.splitTextToSize(`Clientes atendidos: ${clientsStr}`, 70);
  doc.text(clientsFit[0] ?? "", metricX, y + 15);

  y += 27;

  const sectionHeader = (title: string, count: number, bgR = 37, bgG = 159, bgB = 253) => {
    need(11);
    doc.setFillColor(bgR, bgG, bgB).rect(M, y, W - 2 * M, 6.5, "F");
    doc.setTextColor(255).setFontSize(9.5).setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), M + 3, y + 4.8);
    doc.text(`${count}`, W - M - 4, y + 4.8, { align: "right" });
    doc.setTextColor(0).setFont("helvetica", "normal");
    y += 9.5;
  };

  // 3. Sección: PARTES DE TRABAJO GENERADOS
  sectionHeader("1. Partes de trabajo generados en el día", summary.reports.length, 37, 159, 253);

  if (summary.reports.length === 0) {
    need(8);
    doc.setFontSize(8.5).setTextColor(120).setFont("helvetica", "italic");
    doc.text("No se generaron partes de trabajo en esta fecha.", M + 3, y + 2);
    y += 8;
  } else {
    for (const r of summary.reports) {
      need(16);
      // Caja de parte
      doc.setFillColor(255, 255, 255).setDrawColor(226, 232, 240).roundedRect(M, y, W - 2 * M, 14, 1.5, 1.5, "FD");

      // Barra vertical indicadora izquierda
      doc.setFillColor(37, 159, 253).rect(M, y, 2, 14, "F");

      // Nº Parte y Hora de creación
      doc.setFontSize(9).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      doc.text(`Parte Nº ${r.number}`, M + 5, y + 4.8);

      // Hora destacada
      doc.setFillColor(239, 246, 255).roundedRect(M + 32, y + 1.2, 22, 5, 1, 1, "F");
      doc.setFontSize(7.5).setTextColor(29, 78, 216).setFont("helvetica", "bold");
      doc.text(`Hora: ${r.createdTime}`, M + 34, y + 4.6);

      // Tipo de parte (SAT / Taller)
      doc.setFontSize(7.5).setTextColor(100, 116, 139).setFont("helvetica", "bold");
      doc.text(r.tipo === "taller" ? "[TALLER]" : "[ASISTENCIA TÉCNICA]", M + 57, y + 4.6);

      // Cliente
      doc.setFontSize(8.5).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      doc.text(`Cliente: ${r.cliente || "Sin cliente"}`, W - M - 4, y + 4.8, { align: "right" });

      // Detalles: máquina y trabajo efectuado
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

  // 4. Sección: TRABAJOS Y TAREAS DEL DÍA
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

      // Color según estado
      const isDone = j.status === "terminado";
      const isInProgress = j.status === "en_curso";
      if (isDone) {
        doc.setFillColor(16, 185, 129).rect(M, y, 2, 14, "F"); // Verde
      } else if (isInProgress) {
        doc.setFillColor(59, 130, 246).rect(M, y, 2, 14, "F"); // Azul
      } else {
        doc.setFillColor(245, 158, 11).rect(M, y, 2, 14, "F"); // Ámbar
      }

      // Título del trabajo
      doc.setFontSize(9).setTextColor(15, 23, 42).setFont("helvetica", "bold");
      const titleFit = doc.splitTextToSize(j.title, 95);
      doc.text(titleFit[0] ?? "", M + 5, y + 4.8);

      // Estado Badge
      const stLabel = j.statusLabel || STATUS_LABELS[j.status] || j.status;
      doc.setFontSize(7.5).setTextColor(isDone ? 16 : isInProgress ? 29 : 180, isDone ? 185 : isInProgress ? 78 : 83, isDone ? 129 : isInProgress ? 216 : 9).setFont("helvetica", "bold");
      doc.text(`[${stLabel.toUpperCase()}]`, M + 103, y + 4.8);

      // Cliente y Hora de actualización
      doc.setFontSize(8).setTextColor(100, 116, 139).setFont("helvetica", "normal");
      doc.text(
        `${j.cliente ? `${j.cliente} · ` : ""}Hora: ${j.updatedTime}`,
        W - M - 4,
        y + 4.8,
        { align: "right" }
      );

      // Notas o descripción del trabajo
      const noteText = j.statusNote ? `Nota: "${j.statusNote}"` : j.description ? `Detalle: ${j.description}` : "Sin notas adicionales";
      doc.setFontSize(7.5).setTextColor(71, 85, 105).setFont("helvetica", "normal");
      const noteFit = doc.splitTextToSize(noteText, W - 2 * M - 10);
      doc.text(noteFit[0] ?? "", M + 5, y + 10.5);

      y += 16.5;
    }
  }

  // 5. Pie de página en todas las páginas
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
 * Descarga el PDF del resumen diario del usuario.
 */
export async function downloadDailySummaryPdf(summary: UserDailySummary): Promise<void> {
  const doc = await generateDailySummaryPdfDoc(summary);
  const cleanName = summary.workerName.trim().replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_");
  const filename = `Resumen_Diario_${cleanName}_${summary.dateStr}.pdf`;
  doc.save(filename);
}

/**
 * Devuelve un resumen diario de ejemplo para ver cómo queda el resultado.
 */
export function getSampleDailySummary(dateStr = new Date().toISOString().slice(0, 10)): UserDailySummary {
  const parts = dateStr.split("-");
  const dateFormatted = `${parts[2]} de Noviembre de ${parts[0]}`;

  return {
    workerId: "sample-worker-id",
    workerName: "Juan Pérez (Técnico de Servicio)",
    dateStr,
    dateFormatted,
    reports: [
      {
        id: "rep-1",
        number: 42,
        createdTime: "08:45",
        createdAtIso: `${dateStr}T08:45:00.000Z`,
        cliente: "Frutinter S.A.",
        tipo: "trabajo",
        maquina: "Depuradora Principal Mod. D-200",
        numSerie: "SN-98231",
        trabajoEfectuado: "Sustitución de bomba de recirculación y comprobación de estanqueidad.",
        horasTotal: "3h 15m",
        kmTotal: 34,
        closed: true,
      },
      {
        id: "rep-2",
        number: 43,
        createdTime: "14:20",
        createdAtIso: `${dateStr}T14:20:00.000Z`,
        cliente: "Avícola Velasco Gallinas",
        tipo: "taller",
        maquina: "Compresor de Aire Industrial",
        numSerie: "CP-4401",
        trabajoEfectuado: "Mantenimiento preventivo, cambio de filtros de aire y aceite hidráulico.",
        horasTotal: "2h 30m",
        kmTotal: 0,
        closed: true,
      },
    ],
    jobs: [
      {
        id: "job-1",
        title: "Montar baterías SAI y comprobación de alimentación",
        cliente: "Frutinter S.A.",
        status: "terminado",
        statusLabel: "Terminado",
        statusNote: "Baterías instaladas y comprobado SAI en carga correcta.",
        description: "Montaje de los dos módulos de baterías auxiliares.",
        updatedTime: "11:30",
      },
      {
        id: "job-2",
        title: "Revisión caldera y circuito de vapor",
        cliente: "Cítricos del Mediterráneo",
        status: "en_curso",
        statusLabel: "En curso",
        statusNote: "Válvulas de seguridad sustituidas, pendiente prueba térmica.",
        description: "Comprobación anual obligatoria de circuito de presión.",
        updatedTime: "17:10",
      },
    ],
    clientsList: ["Frutinter S.A.", "Avícola Velasco Gallinas", "Cítricos del Mediterráneo"],
  };
}
