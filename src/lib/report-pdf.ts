import { jsPDF } from "jspdf";
import logo from "@/assets/gruper-logo.png.asset.json";
import type { WorkReport, Dia } from "@/lib/work-report";
import { calculateReportTotals, durationMinutes, timeToMinutes, formatMinutes } from "@/lib/time-calculator";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Recorta una imagen al centro para que sea 100% cuadrada sin deformar ni aplastar el contenido */
async function cropToSquare(url: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) {
            resolve(url);
            return;
          }
          const minDim = Math.min(w, h);
          const targetSize = Math.min(minDim, 1200);

          const canvas = document.createElement("canvas");
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(url);
            return;
          }

          const sx = (w - minDim) / 2;
          const sy = (h - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch {
          resolve(url);
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    } catch {
      resolve(url);
    }
  });
}

/**
 * Genera el nombre de archivo del PDF del parte.
 * Formato: [NUMERO_PARTE].pdf  → ej: BM260001.pdf
 */
export function getReportFilename(
  number: string | number,
  creatorName?: string,
  cliente?: string,
  tipo?: "trabajo" | "taller"
): string {
  const clean = (s: string) => s.trim().replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_");
  const numStr = String(number || "nuevo");

  if (/[a-zA-Z]/.test(numStr) && numStr !== "nuevo") {
    return `${numStr}.pdf`;
  }

  const prefix = tipo === "taller" ? "Parte_Taller" : "Parte";
  const parts = [`${prefix}_${numStr}`];
  if (creatorName?.trim()) parts.push(clean(creatorName));
  if (cliente?.trim()) parts.push(clean(cliente));
  return `${parts.join("_")}.pdf`;
}

/**
 * Genera el documento PDF con un diseño moderno, industrial y elegante,
 * manteniendo los colores corporativos de Gruper (#259FFD y pizarra oscuro).
 */
export async function generatePdfDoc(
  r: WorkReport,
  number: string | number,
  creatorName?: string
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 14;
  const contentW = W - 2 * M;
  let y = 14;

  // Paleta de colores corporativos
  const PRIMARY_RGB = [37, 159, 253] as const; // #259FFD
  const DARK_RGB = [15, 23, 42] as const;       // #0F172A
  const TEXT_RGB = [30, 41, 59] as const;       // #1E293B
  const MUTED_RGB = [100, 116, 139] as const;   // #64748B
  const BORDER_RGB = [226, 232, 240] as const;  // #E2E8F0
  const CARD_BG_RGB = [248, 250, 252] as const; // #F8FAFC
  const ACCENT_BG = [240, 247, 255] as const;   // Azul muy claro

  const need = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 14;
      drawHeaderBorder();
    }
  };

  // Franja superior azul moderna
  const drawHeaderBorder = () => {
    doc.setFillColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
    doc.rect(0, 0, W, 2.5, "F");
  };
  drawHeaderBorder();

  // 1. CABECERA CORPORATIVA ELEGANTE
  const img = await toDataUrl(logo.url);
  if (img) {
    doc.addImage(img, "PNG", M, y, 48, 15);
  }

  const isTaller = r.tipo === "taller";
  const docTypeLabel = isTaller ? "PARTE DE TALLER" : "SERVICIO DE ASISTENCIA TÉCNICA";

  // Badge derecho de tipo de documento
  doc.setFillColor(ACCENT_BG[0], ACCENT_BG[1], ACCENT_BG[2]);
  doc.roundedRect(W - M - 68, y, 68, 6, 1.5, 1.5, "F");
  doc.setDrawColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(W - M - 68, y, 68, 6, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold").setFontSize(7.5);
  doc.setTextColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
  doc.text(docTypeLabel, W - M - 34, y + 4.2, { align: "center" });

  // Título con número de parte en grande
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(`Nº ${number}`, W - M, y + 14, { align: "right" });

  // Metadatos de cabecera
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  const fechaEmision = r.dias?.[0]?.fecha
    ? new Date(r.dias[0].fecha).toLocaleDateString("es-ES")
    : new Date().toLocaleDateString("es-ES");
  doc.text(`Fecha: ${fechaEmision}   ·   SAT Gruper`, W - M, y + 19, { align: "right" });

  y += 24;

  // 2. FUNCIÓN DE TÍTULO DE SECCIÓN MODERNA (barra de acento izquierda + línea de división)
  const title = (t: string) => {
    need(12);
    // Píldora de acento azul a la izquierda
    doc.setFillColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
    doc.roundedRect(M, y, 3, 6.5, 0.8, 0.8, "F");

    // Texto de la sección
    doc.setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
    doc.setFontSize(9.5).setFont("helvetica", "bold");
    doc.text(t.toUpperCase(), M + 5.5, y + 4.8);

    // Línea divisoria suave a la derecha
    const titleWidth = doc.getTextWidth(t.toUpperCase());
    const lineStart = M + 7 + titleWidth;
    if (lineStart < W - M) {
      doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
      doc.setLineWidth(0.2);
      doc.line(lineStart, y + 3.5, W - M, y + 3.5);
    }

    doc.setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
    doc.setFont("helvetica", "normal");
    y += 9.5;
  };

  // 3. DATOS GENERALES (Tarjeta estructurada y limpia)
  title("Datos generales");
  need(30);

  const cardH = 26;
  doc.setFillColor(CARD_BG_RGB[0], CARD_BG_RGB[1], CARD_BG_RGB[2]);
  doc.roundedRect(M, y, contentW, cardH, 2, 2, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y, contentW, cardH, 2, 2, "S");

  const col1X = M + 4;
  const col2X = M + contentW / 2 + 4;
  const row1Y = y + 5.5;
  const row2Y = y + 11.5;
  const row3Y = y + 17.5;
  const row4Y = y + 23.5;

  const renderField = (label: string, val: string, x: number, fieldY: number, maxW = 75) => {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(`${label}:`, x, fieldY);
    const labelW = doc.getTextWidth(`${label}:`) + 2;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
    const cleanVal = val || "—";
    const truncated = doc.splitTextToSize(cleanVal, maxW - labelW)[0] || cleanVal;
    doc.text(truncated, x + labelW, fieldY);
  };

  renderField("Cliente", r.cliente || "—", col1X, row1Y, 80);
  renderField("Dirección", r.direccion || "—", col1X, row2Y, 80);
  renderField("Población", r.de || "—", col1X, row3Y, 80);
  renderField("Solicitado por", r.solicitadoPor || "—", col1X, row4Y, 80);

  renderField("Técnico", r.tecnico || creatorName || "—", col2X, row1Y, 80);
  renderField("Vehículo", r.vehiculo || "—", col2X, row2Y, 80);
  renderField("Máquina", r.codigoMaquina || "—", col2X, row3Y, 80);
  renderField("Nº Serie", r.numSerie || "—", col2X, row4Y, 80);

  y += cardH + 4;

  // 4. HORAS DE TRABAJO Y JORNADAS (Tabla moderna con soporte multidiario)
  const numDias = r.dias?.length || 1;
  title(numDias > 1 ? `Control de tiempos y jornadas (${numDias} días)` : "Control de tiempos y desplazamientos");

  // Cabecera de la tabla de jornadas
  need(12);
  const tableHeaderH = 6;
  doc.setFillColor(ACCENT_BG[0], ACCENT_BG[1], ACCENT_BG[2]);
  doc.rect(M, y, contentW, tableHeaderH, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.rect(M, y, contentW, tableHeaderH, "S");

  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
  const colX = [
    M + 3,        // Día / Fecha
    M + 30,       // Salida Ida
    M + 52,       // Km Ida
    M + 68,       // Trabajo Mañana
    M + 98,       // Trabajo Tarde
    M + 128,      // Salida Vuelta
    M + 152,      // Km Vuelta
    M + 168,      // Total Jornada
  ];

  doc.text("DÍA / FECHA", colX[0]!, y + 4.2);
  doc.text("SALIDA (IDA)", colX[1]!, y + 4.2);
  doc.text("KM IDA", colX[2]!, y + 4.2);
  doc.text("MAÑANA", colX[3]!, y + 4.2);
  doc.text("TARDE", colX[4]!, y + 4.2);
  doc.text("VUELTA", colX[5]!, y + 4.2);
  doc.text("KM VTA", colX[6]!, y + 4.2);
  doc.text("MANO OBRA", colX[7]!, y + 4.2);

  y += tableHeaderH;

  const rg = (a?: string, b?: string) => (a || b ? `${a || "—"}-${b || "—"}` : "—");

  // Filas por cada jornada de trabajo
  (r.dias || []).forEach((d: Dia, idx: number) => {
    need(7);

    // Fondo alterno suave
    if (idx % 2 === 1) {
      doc.setFillColor(252, 253, 255);
      doc.rect(M, y, contentW, 6.5, "F");
    }

    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.15);
    doc.line(M, y + 6.5, M + contentW, y + 6.5);

    let mananaStr = rg(d.mananaDe, d.mananaA);
    let tardeStr = rg(d.tardeDe, d.tardeA);

    // Cálculo automático si sólo se usó llegada y salida
    const workIntervalMin = durationMinutes(d.mananaDe, d.mananaA) + durationMinutes(d.tardeDe, d.tardeA);
    if ((mananaStr === "—" && tardeStr === "—") || (workIntervalMin === 0 && d.idaA && d.vueltaDe)) {
      const sMin = timeToMinutes(d.idaA);
      const eMin = timeToMinutes(d.vueltaDe);
      if (sMin !== null && eMin !== null) {
        const splitMin = 14 * 60;
        if (sMin < splitMin && eMin > splitMin) {
          mananaStr = `${d.idaA}-14:00`;
          tardeStr = `14:00-${d.vueltaDe}`;
        } else if (sMin >= splitMin) {
          mananaStr = "—";
          tardeStr = `${d.idaA}-${d.vueltaDe}`;
        } else {
          mananaStr = `${d.idaA}-${d.vueltaDe}`;
          tardeStr = "—";
        }
      }
    }

    const dayWorkMin = (d.idaA && d.vueltaDe)
      ? durationMinutes(d.idaA, d.vueltaDe)
      : (durationMinutes(d.mananaDe, d.mananaA) + durationMinutes(d.tardeDe, d.tardeA));

    const dateFormatted = d.fecha ? new Date(d.fecha).toLocaleDateString("es-ES") : "—";
    const dayLabel = numDias > 1 ? `Día ${idx + 1} (${dateFormatted})` : dateFormatted;

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);

    doc.text(dayLabel, colX[0]!, y + 4.5);
    doc.text(rg(d.idaDe, d.idaA), colX[1]!, y + 4.5);
    doc.text(d.kmIda ? `${d.kmIda} km` : "—", colX[2]!, y + 4.5);
    doc.text(mananaStr, colX[3]!, y + 4.5);
    doc.text(tardeStr, colX[4]!, y + 4.5);
    doc.text(rg(d.vueltaDe, d.vueltaA), colX[5]!, y + 4.5);
    doc.text(d.kmVuelta ? `${d.kmVuelta} km` : "—", colX[6]!, y + 4.5);

    // Total de mano de obra del día en negrita
    doc.setFont("helvetica", "bold").setTextColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
    doc.text(formatMinutes(dayWorkMin), colX[7]!, y + 4.5);

    y += 6.5;
  });

  // TARJETA DE TOTALES CALCULADOS
  const totals = calculateReportTotals(r);
  need(11);
  y += 2;
  doc.setFillColor(ACCENT_BG[0], ACCENT_BG[1], ACCENT_BG[2]);
  doc.roundedRect(M, y, contentW, 8, 1.5, 1.5, "F");
  doc.setDrawColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y, contentW, 8, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
  const summaryParts = [
    `MANO DE OBRA TOTAL: ${totals.formattedWorkHours || "0 h"}`,
    `DESPLAZAMIENTO: ${totals.totalKm} Km`,
    totals.formattedTravelHours ? `TIEMPO VIAJE: ${totals.formattedTravelHours}` : "",
    numDias > 1 ? `JORNADAS: ${numDias}` : "",
  ].filter(Boolean);

  doc.text(summaryParts.join("   ·   "), M + contentW / 2, y + 5.2, { align: "center" });
  y += 11;

  // 5. TRABAJO REALIZADO (Lista moderna con puntos estilizados)
  const validTrabajos = (r.trabajos || []).filter((x) => x.descripcion?.trim());
  if (validTrabajos.length > 0) {
    title("Trabajo realizado");
    doc.setFontSize(8.5).setFont("helvetica", "normal").setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);

    for (const l of validTrabajos) {
      const descText = l.descripcion.trim();
      const lines = doc.splitTextToSize(descText, contentW - 6);
      const blockH = lines.length * 4.2 + 2;
      need(blockH);

      // Pequeño indicador de lista
      doc.setFillColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
      doc.circle(M + 2, y + 2.5, 1, "F");

      doc.text(lines, M + 6, y + 3.5);
      y += blockH;
    }
    y += 2;
  }

  // 6. MATERIAL UTILIZADO (Tabla de materiales limpia y profesional)
  const validMateriales = (r.materialesLista || []).filter((x) => x.codigo || x.descripcion);
  if (validMateriales.length > 0) {
    title("Material utilizado");
    need(10);

    const matHeaderH = 5.5;
    doc.setFillColor(CARD_BG_RGB[0], CARD_BG_RGB[1], CARD_BG_RGB[2]);
    doc.rect(M, y, contentW, matHeaderH, "F");
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.2);
    doc.rect(M, y, contentW, matHeaderH, "S");

    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text("REFERENCIA / CÓDIGO", M + 3, y + 3.8);
    doc.text("DESCRIPCIÓN DEL MATERIAL", M + 42, y + 3.8);
    doc.text("CANTIDAD", W - M - 3, y + 3.8, { align: "right" });
    y += matHeaderH;

    for (const l of validMateriales) {
      const descLines = doc.splitTextToSize(l.descripcion || "—", contentW - 65);
      const rowH = Math.max(descLines.length * 4 + 2, 6);
      need(rowH);

      doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
      doc.setLineWidth(0.15);
      doc.line(M, y + rowH, M + contentW, y + rowH);

      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
      doc.text(l.codigo || "—", M + 3, y + 4.2);

      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
      doc.text(descLines, M + 42, y + 4.2);

      doc.setFont("helvetica", "bold").setTextColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
      doc.text(l.cantidad || "1", W - M - 3, y + 4.2, { align: "right" });

      y += rowH;
    }
    y += 3;
  }

  // 7. FOTOGRAFÍAS DEL TRABAJO (Antes / Después)
  const validFotos = (r.fotos || []).filter((f) => f.url);
  if (validFotos.length > 0) {
    title("Fotografías del trabajo (Antes / Después)");
    const gap = 8;
    const photoSize = (contentW - gap) / 2; // ~87 mm cuadrada

    const squaredFotos = await Promise.all(
      validFotos.map(async (f) => ({
        ...f,
        squareUrl: await cropToSquare(f.url),
      }))
    );

    for (let i = 0; i < squaredFotos.length; i += 2) {
      const batch = squaredFotos.slice(i, i + 2);
      const maxDescLen = Math.max(
        ...batch.map((f) =>
          f.descripcion?.trim()
            ? doc.splitTextToSize(f.descripcion.trim(), photoSize).length
            : 0
        )
      );
      const extraH = maxDescLen > 0 ? maxDescLen * 3.5 + 4 : 0;
      need(photoSize + 12 + extraH);

      batch.forEach((f, idx) => {
        const x = M + idx * (photoSize + gap);

        // Badge indicador tipo de foto
        const isAntes = f.tipo === "antes";
        const label = isAntes
          ? "ESTADO INICIAL (ANTES)"
          : f.tipo === "despues"
          ? "REPARACIÓN FINAL (DESPUÉS)"
          : (f.titulo || "FOTO TÉCNICA").toUpperCase();

        doc.setFont("helvetica", "bold").setFontSize(7.5);
        if (isAntes) {
          doc.setTextColor(234, 88, 12); // Naranja suave
        } else {
          doc.setTextColor(16, 185, 129); // Verde
        }
        doc.text(label, x, y + 3);

        try {
          doc.addImage(f.squareUrl, "JPEG", x, y + 5, photoSize, photoSize);
          doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
          doc.setLineWidth(0.2);
          doc.roundedRect(x, y + 5, photoSize, photoSize, 1, 1, "S");
        } catch (imgErr) {
          console.error("Error adding photo to PDF", imgErr);
        }

        if (f.descripcion?.trim()) {
          doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
          const descLines = doc.splitTextToSize(f.descripcion.trim(), photoSize);
          doc.text(descLines, x, y + photoSize + 9);
        }
      });

      y += photoSize + 12 + extraH;
    }
    y += 2;
  }

  // 8. DIETAS, PERNOCTAS Y OBSERVACIONES
  if (r.dietas) {
    const d = r.dietas;
    const esp: string[] = [];
    if (d.desayunoEsp > 0) esp.push(`${d.desayunoEsp} Desayuno${d.desayunoEsp > 1 ? "s" : ""}`);
    if (d.comidaEsp > 0) esp.push(`${d.comidaEsp} Comida${d.comidaEsp > 1 ? "s" : ""}`);
    if (d.cenaEsp > 0) esp.push(`${d.cenaEsp} Cena${d.cenaEsp > 1 ? "s" : ""}`);
    if (d.pernoctaEsp > 0) esp.push(`${d.pernoctaEsp} Pernocta${d.pernoctaEsp > 1 ? "s" : ""}`);

    const ext: string[] = [];
    if (d.desayunoExt > 0) ext.push(`${d.desayunoExt} Desayuno${d.desayunoExt > 1 ? "s" : ""}`);
    if (d.comidaExt > 0) ext.push(`${d.comidaExt} Comida${d.comidaExt > 1 ? "s" : ""}`);
    if (d.cenaExt > 0) ext.push(`${d.cenaExt} Cena${d.cenaExt > 1 ? "s" : ""}`);
    if (d.pernoctaExt > 0) ext.push(`${d.pernoctaExt} Pernocta${d.pernoctaExt > 1 ? "s" : ""}`);

    if (esp.length > 0 || ext.length > 0) {
      need(12);
      title("Dietas y gastos");
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
      if (esp.length > 0) {
        doc.text(`Nacional: ${esp.join(" · ")}`, M + 2, y + 2);
        y += 5;
      }
      if (ext.length > 0) {
        doc.text(`Internacional: ${ext.join(" · ")}`, M + 2, y + 2);
        y += 5;
      }
      y += 2;
    }
  }

  if (r.observaciones?.trim()) {
    title("Observaciones");
    const obsLines = doc.splitTextToSize(r.observaciones.trim(), contentW - 6);
    const obsH = obsLines.length * 4.2 + 4;
    need(obsH);

    doc.setFillColor(CARD_BG_RGB[0], CARD_BG_RGB[1], CARD_BG_RGB[2]);
    doc.roundedRect(M, y, contentW, obsH, 1.5, 1.5, "F");
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, y, contentW, obsH, 1.5, 1.5, "S");

    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
    doc.text(obsLines, M + 3, y + 4.5);
    y += obsH + 4;
  }

  // 9. CIERRE Y FIRMA DEL CLIENTE
  title("Conformidad y firma del cliente");
  need(42);

  const sigBoxW = (contentW - 6) / 2;
  const sigBoxH = 34;

  // Cuadro 1: Firma del cliente
  doc.setFillColor(CARD_BG_RGB[0], CARD_BG_RGB[1], CARD_BG_RGB[2]);
  doc.roundedRect(M, y, sigBoxW, sigBoxH, 2, 2, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y, sigBoxW, sigBoxH, 2, 2, "S");

  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("FIRMA DEL CLIENTE", M + 3, y + 4);

  if (r.firma) {
    try {
      doc.addImage(r.firma, "PNG", M + 4, y + 6, sigBoxW - 8, 20);
    } catch (e) {
      console.error("Error adding signature", e);
    }
  }

  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(`Firmado por: ${r.firmaNombre || r.cliente || "Cliente"}`, M + 3, y + sigBoxH - 2.5);

  // Cuadro 2: Servicio Técnico Responsable
  const box2X = M + sigBoxW + 6;
  doc.setFillColor(CARD_BG_RGB[0], CARD_BG_RGB[1], CARD_BG_RGB[2]);
  doc.roundedRect(box2X, y, sigBoxW, sigBoxH, 2, 2, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(box2X, y, sigBoxW, sigBoxH, 2, 2, "S");

  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("SERVICIO TÉCNICO OFICIAL", box2X + 3, y + 4);

  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
  doc.text("GRUPER REMOTE", box2X + 3, y + 13);

  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
  doc.text(`Técnico: ${r.tecnico || creatorName || "SAT"}`, box2X + 3, y + 19);
  doc.text(`Vehículo: ${r.vehiculo || "—"}`, box2X + 3, y + 24);
  doc.text(`Estado: Conforme y cerrado`, box2X + 3, y + sigBoxH - 2.5);

  y += sigBoxH + 4;

  // 10. PIE DE PÁGINA CORPORATIVO EN TODAS LAS PÁGINAS
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.15);
    doc.line(M, H - 10, W - M, H - 10);

    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text("Gruper Remote · Servicio de Asistencia Técnica Oficial · www.gruper.es", M, H - 6.5);
    doc.text(`Página ${p} de ${totalPages}`, W - M, H - 6.5, { align: "right" });
  }

  return doc;
}

/** Builds the signed work report PDF; returns base64 (no data: prefix). */
export async function buildReportPdf(
  r: WorkReport,
  number: string | number,
  creatorName?: string
): Promise<string> {
  const doc = await generatePdfDoc(r, number, creatorName);
  return doc.output("datauristring").split(",")[1] ?? "";
}

/** Triggers a browser download of the report PDF with a descriptive filename. */
export async function downloadReportPdf(
  r: WorkReport,
  number: string | number,
  creatorName?: string
): Promise<void> {
  const doc = await generatePdfDoc(r, number, creatorName);
  const filename = getReportFilename(number, creatorName, r.cliente, r.tipo);
  doc.save(filename);
}
