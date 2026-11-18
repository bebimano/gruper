import { jsPDF } from "jspdf";
import type { Averia } from "./averias";

// Importamos el logo como asset
// @ts-ignore
import logo from "@/assets/gruper-logo.png.asset.json";

/** Genera un PDF del informe de avería resuelta */
export async function generateAveriaReportPdf(averia: Averia): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 14;

  // ─── Logo top-left ────────────────────────────────────────────────────────
  try {
    const logoUrl: string = (logo as any).url;
    doc.addImage(logoUrl, "PNG", margin, y, 38, 12);
  } catch {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 100, 200);
    doc.text("GRUPER", margin, y + 8);
  }

  // ─── Cabecera informe (esquina derecha) ───────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const fechaGen = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Generado: ${fechaGen}`, pageW - margin, y + 4, { align: "right" });
  doc.text(`ID: ${averia.id.slice(0, 8).toUpperCase()}`, pageW - margin, y + 9, { align: "right" });

  y += 20;

  // ─── Línea separadora azul ────────────────────────────────────────────────
  doc.setDrawColor(30, 100, 200);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // ─── Título central ───────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text("INFORME DE AVERÍA RESUELTA", pageW / 2, y, { align: "center" });
  y += 10;

  // ─── Badge URGENTE si aplica ──────────────────────────────────────────────
  if (averia.urgency === "urgente") {
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(pageW / 2 - 20, y - 5, 40, 7, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("⚠ URGENTE", pageW / 2, y, { align: "center" });
    y += 8;
  }

  y += 2;

  // ─── Bloque de datos principales ─────────────────────────────────────────
  const drawField = (label: string, value: string, leftX: number, fieldW: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(label.toUpperCase(), leftX, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(value || "—", fieldW);
    doc.text(lines, leftX, y);
    y += lines.length * 5 + 4;
  };

  // Dos columnas: Cliente | Máquina
  const halfW = (contentW - 6) / 2;
  const col2X = margin + halfW + 6;

  // Guardamos y para restaurar
  const yBefore = y;
  drawField("Cliente", averia.clientName, margin, halfW);
  const yAfterClient = y;

  y = yBefore;
  drawField("Máquina afectada", averia.machineName, col2X, halfW);
  const yAfterMachine = y;

  y = Math.max(yAfterClient, yAfterMachine) + 2;

  // Fecha de creación | Fecha resolución
  const yBefore2 = y;
  drawField(
    "Fecha del aviso",
    new Date(averia.createdAt).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    margin,
    halfW
  );
  const yAfterCreated = y;

  y = yBefore2;
  drawField(
    "Fecha de resolución",
    averia.updatedAt
      ? new Date(averia.updatedAt).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : fechaGen,
    col2X,
    halfW
  );
  const yAfterResolved = y;

  y = Math.max(yAfterCreated, yAfterResolved) + 2;

  // ─── Línea separadora fina ────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ─── Descripción del problema ─────────────────────────────────────────────
  if (averia.description) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text("DESCRIPCIÓN DEL PROBLEMA", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    const descLines = doc.splitTextToSize(averia.description, contentW);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 6;
  }

  // ─── Nota de resolución ────────────────────────────────────────────────────
  if (averia.statusNote) {
    doc.setFillColor(240, 247, 255);
    const noteLines = doc.splitTextToSize(averia.statusNote, contentW - 8);
    const noteH = noteLines.length * 5 + 8;
    doc.roundedRect(margin, y - 2, contentW, noteH, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 100, 200);
    doc.text("NOTA DEL SERVICIO TÉCNICO", margin + 4, y + 3);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(noteLines, margin + 4, y);
    y += noteLines.length * 5 + 6;
  }

  // ─── Fotos adjuntas ───────────────────────────────────────────────────────
  if (averia.photos && averia.photos.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`FOTOS ADJUNTAS (${averia.photos.length})`, margin, y);
    y += 5;

    const photoSize = 50; // mm
    const gap = 5;
    const cols = Math.floor(contentW / (photoSize + gap));
    let col = 0;

    for (const photo of averia.photos) {
      try {
        if (y + photoSize + 10 > pageH - 20) {
          doc.addPage();
          y = 20;
        }
        const xPos = margin + col * (photoSize + gap);
        doc.addImage(photo.url, "JPEG", xPos, y, photoSize, photoSize);
        col++;
        if (col >= cols) {
          col = 0;
          y += photoSize + gap;
        }
      } catch {
        // si la imagen falla, omitir
      }
    }
    if (col > 0) y += photoSize + gap;
    y += 4;
  }

  // ─── Estado final ─────────────────────────────────────────────────────────
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(margin, y - 2, contentW, 12, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(21, 128, 61);
  doc.text("✓  AVERÍA RESUELTA Y CERRADA", margin + 4, y + 6);
  y += 16;

  // ─── Pie de página en todas las páginas ───────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gruper Remote · Informe de avería · Pág. ${i} de ${totalPages}`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
    // Línea pie
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
  }

  return doc;
}

/** Descarga el PDF del informe de avería en el navegador */
export async function downloadAveriaReportPdf(averia: Averia): Promise<void> {
  const doc = await generateAveriaReportPdf(averia);
  const machineSafe = averia.machineName.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30);
  const dateSafe = new Date(averia.createdAt).toISOString().slice(0, 10);
  doc.save(`Informe_Averia_${machineSafe}_${dateSafe}.pdf`);
}

/** Genera el PDF en base64 para envío por email */
export async function getAveriaReportPdfBase64(averia: Averia): Promise<string> {
  const doc = await generateAveriaReportPdf(averia);
  return doc.output("datauristring");
}
