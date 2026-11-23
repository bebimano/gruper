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
  const contentW = W - 2 * M; // 182 mm
  let y = 14;

  // Paleta de colores corporativos de alto contraste y elegancia
  const PRIMARY_RGB = [37, 159, 253] as const;  // Azul Gruper #259FFD
  const PRIMARY_DARK = [2, 132, 199] as const;  // Azul medio #0284C7
  const DARK_RGB = [15, 23, 42] as const;        // Pizarra muy oscuro #0F172A
  const SLATE_HEADER = [30, 41, 59] as const;   // Pizarra cabecera #1E293B
  const TEXT_RGB = [51, 65, 85] as const;        // Texto cuerpo #334155
  const MUTED_RGB = [100, 116, 139] as const;    // Gris medio #64748B
  const BORDER_RGB = [226, 232, 240] as const;   // Borde fino #E2E8F0
  const CARD_BG = [255, 255, 255] as const;      // Blanco puro para tarjetas
  const CARD_STRIP = [248, 250, 252] as const;  // Fondo sutil #F8FAFC
  const ACCENT_BG = [240, 247, 255] as const;    // Azul tenue #F0F7FF

  const need = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 14;
      drawHeaderBorder();
    }
  };

  // Franja superior de marca (Azul Gruper + Pizarra)
  const drawHeaderBorder = () => {
    doc.setFillColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
    doc.rect(0, 0, W, 3, "F");
    doc.setFillColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
    doc.rect(W - 40, 0, 40, 3, "F");
  };
  drawHeaderBorder();

  // 1. CABECERA CORPORATIVA DE ALTA CALIDAD
  const img = await toDataUrl(logo.url);
  if (img) {
    doc.addImage(img, "PNG", M, y, 46, 14.5);
  }

  // Subtítulo corporativo debajo del logo
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("Servicio de Asistencia Técnica Oficial · Water Solutions", M, y + 19);

  const isTaller = r.tipo === "taller";
  const docTypeLabel = isTaller ? "PARTE DE TALLER" : "SERVICIO DE ASISTENCIA TÉCNICA";

  // Tarjeta derecha de metadatos del documento
  const numStr = String(number || "").trim();
  const isNuevo = !numStr || numStr.toLowerCase() === "nuevo";
  const displayNum = isNuevo ? "BORRADOR" : `Nº ${numStr}`;

  // Badge tipo de documento
  const badgeW = 66;
  const badgeH = 5.5;
  const badgeX = W - M - badgeW;
  doc.setFillColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.roundedRect(badgeX, y, badgeW, badgeH, 1, 1, "F");
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(255, 255, 255);
  doc.text(docTypeLabel, badgeX + badgeW / 2, y + 3.8, { align: "center" });

  // Número de parte destacado
  doc.setFont("helvetica", "bold").setFontSize(15);
  if (isNuevo) {
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  } else {
    doc.setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  }
  doc.text(displayNum, W - M, y + 13, { align: "right" });

  // Fecha de emisión y referencia
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  const fechaEmision = r.dias?.[0]?.fecha
    ? new Date(r.dias[0].fecha).toLocaleDateString("es-ES")
    : new Date().toLocaleDateString("es-ES");
  doc.text(`Fecha: ${fechaEmision}   ·   SAT Gruper España`, W - M, y + 18, { align: "right" });

  y += 24;

  // 2. FUNCIÓN DE TÍTULO DE SECCIÓN ELEGANTE
  const title = (t: string) => {
    need(12);
    // Barra de acento izquierda nítida
    doc.setFillColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
    doc.rect(M, y, 2.5, 4.5, "F");

    // Texto de la sección
    doc.setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
    doc.setFontSize(8.5).setFont("helvetica", "bold");
    doc.text(t.toUpperCase(), M + 5, y + 3.6);

    // Línea divisoria continua en todo el ancho
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.2);
    doc.line(M, y + 6, W - M, y + 6);

    doc.setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
    doc.setFont("helvetica", "normal");
    y += 9;
  };

  // 3. DATOS GENERALES (Dos tarjetas lado a lado, estructuradas y limpias)
  title("Datos generales de la intervención");
  need(30);

  const halfCardW = (contentW - 5) / 2; // ~88.5 mm cada tarjeta
  const cardH = 26;

  // --- TARJETA 1: DATOS DEL CLIENTE ---
  doc.setFillColor(CARD_BG[0], CARD_BG[1], CARD_BG[2]);
  doc.roundedRect(M, y, halfCardW, cardH, 1.5, 1.5, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y, halfCardW, cardH, 1.5, 1.5, "S");

  // Barra de cabecera tarjeta cliente
  doc.setFillColor(CARD_STRIP[0], CARD_STRIP[1], CARD_STRIP[2]);
  doc.roundedRect(M, y, halfCardW, 5, 1.5, 1.5, "F");
  doc.rect(M, y + 3, halfCardW, 2, "F"); // Tapar bordes redondeados inferiores de la barra
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(PRIMARY_DARK[0], PRIMARY_DARK[1], PRIMARY_DARK[2]);
  doc.text("CLIENTE Y UBICACIÓN", M + 3, y + 3.6);

  const c1X = M + 3;
  const renderRow = (label: string, val: string, x: number, lineY: number, maxW = 82) => {
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(`${label}:`, x, lineY);
    const labelW = doc.getTextWidth(`${label}:`) + 1.5;
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
    const cleanVal = val || "—";
    const truncated = doc.splitTextToSize(cleanVal, maxW - labelW)[0] || cleanVal;
    doc.text(truncated, x + labelW, lineY);
  };

  // Nombre de cliente destacado
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("Cliente:", c1X, y + 10);
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(r.cliente || "—", c1X + 13, y + 10);

  renderRow("Dirección", r.direccion || "—", c1X, y + 15, halfCardW - 6);
  renderRow("Población", r.de || "—", c1X, y + 19.5, halfCardW - 6);
  renderRow("Solicitado por", r.solicitadoPor || "—", c1X, y + 24, halfCardW - 6);

  // --- TARJETA 2: DATOS DE LA MÁQUINA Y SERVICIO ---
  const c2CardX = M + halfCardW + 5;
  doc.setFillColor(CARD_BG[0], CARD_BG[1], CARD_BG[2]);
  doc.roundedRect(c2CardX, y, halfCardW, cardH, 1.5, 1.5, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(c2CardX, y, halfCardW, cardH, 1.5, 1.5, "S");

  // Barra de cabecera tarjeta máquina
  doc.setFillColor(CARD_STRIP[0], CARD_STRIP[1], CARD_STRIP[2]);
  doc.roundedRect(c2CardX, y, halfCardW, 5, 1.5, 1.5, "F");
  doc.rect(c2CardX, y + 3, halfCardW, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(PRIMARY_DARK[0], PRIMARY_DARK[1], PRIMARY_DARK[2]);
  doc.text("SERVICIO TÉCNICO Y EQUIPO", c2CardX + 3, y + 3.6);

  const c2X = c2CardX + 3;
  // Técnico destacado
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("Técnico:", c2X, y + 10);
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(r.tecnico || creatorName || "—", c2X + 13, y + 10);

  renderRow("Vehículo", r.vehiculo || "—", c2X, y + 15, halfCardW - 6);
  renderRow("Máquina", r.codigoMaquina || "—", c2X, y + 19.5, halfCardW - 6);
  renderRow("Nº Serie", r.numSerie || "—", c2X, y + 24, halfCardW - 6);

  y += cardH + 5;

  // 4. HORAS DE TRABAJO Y JORNADAS (Tabla estructurada con cabecera oscura y columnas delimitadas)
  const numDias = r.dias?.length || 1;
  title(numDias > 1 ? `Control de tiempos y desplazamientos (${numDias} jornadas)` : "Control de tiempos y desplazamientos");

  need(12);
  const tableHeaderH = 6;
  doc.setFillColor(SLATE_HEADER[0], SLATE_HEADER[1], SLATE_HEADER[2]);
  doc.rect(M, y, contentW, tableHeaderH, "F");

  // Anchos exactos de las 7 columnas (Suma = 182 mm)
  // [32mm Día, 26mm Ida, 18mm Km Ida, 34mm Trabajo, 26mm Vuelta, 18mm Km Vta, 28mm Mano Obra]
  const cX = {
    dia: M + 3,
    ida: M + 32 + 13,       // 59
    kmIda: M + 58 + 9,      // 81
    trabajo: M + 76 + 17,   // 107
    vuelta: M + 110 + 13,   // 137
    kmVuelta: M + 136 + 9,  // 159
    manoObra: M + 154 + 14, // 182
  };

  // Separadores verticales finos en la cabecera
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.15);
  [M + 32, M + 58, M + 76, M + 110, M + 136, M + 154].forEach((sepX) => {
    doc.line(sepX, y, sepX, y + tableHeaderH);
  });

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(255, 255, 255);
  doc.text("DÍA / FECHA", cX.dia, y + 4.1);
  doc.text("SALIDA (IDA)", cX.ida, y + 4.1, { align: "center" });
  doc.text("KM IDA", cX.kmIda, y + 4.1, { align: "center" });
  doc.text("TRABAJO", cX.trabajo, y + 4.1, { align: "center" });
  doc.text("VUELTA", cX.vuelta, y + 4.1, { align: "center" });
  doc.text("KM VTA", cX.kmVuelta, y + 4.1, { align: "center" });

  // Mano de Obra en celeste brillante en la cabecera
  doc.setTextColor(56, 189, 248); // #38BDF8
  doc.text("MANO OBRA", cX.manoObra, y + 4.1, { align: "center" });

  y += tableHeaderH;

  const rg = (a?: string, b?: string) => (a || b ? `${a || "—"}-${b || "—"}` : "—");

  // Filas de jornadas de trabajo
  (r.dias || []).forEach((d: Dia, idx: number) => {
    need(7);

    // Fondo alterno
    if (idx % 2 === 1) {
      doc.setFillColor(CARD_STRIP[0], CARD_STRIP[1], CARD_STRIP[2]);
      doc.rect(M, y, contentW, 6.5, "F");
    }

    // Separadores verticales sutiles en los datos
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.15);
    [M + 32, M + 58, M + 76, M + 110, M + 136, M + 154].forEach((sepX) => {
      doc.line(sepX, y, sepX, y + 6.5);
    });

    // Borde de la fila
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.2);
    doc.rect(M, y, contentW, 6.5, "S");

    // Intervalo de trabajo en el cliente
    let trabajoStr = "—";
    if (d.idaA && d.vueltaDe) {
      trabajoStr = `${d.idaA}-${d.vueltaDe}`;
    } else {
      const parts: string[] = [];
      if (d.mananaDe || d.mananaA) parts.push(`${d.mananaDe || "—"}-${d.mananaA || "—"}`);
      if (d.tardeDe || d.tardeA) parts.push(`${d.tardeDe || "—"}-${d.tardeA || "—"}`);
      if (parts.length > 0) trabajoStr = parts.join(" / ");
    }

    const dayWorkMin = (d.idaA && d.vueltaDe)
      ? durationMinutes(d.idaA, d.vueltaDe)
      : (durationMinutes(d.mananaDe, d.mananaA) + durationMinutes(d.tardeDe, d.tardeA));

    const dateFormatted = d.fecha ? new Date(d.fecha).toLocaleDateString("es-ES") : "—";
    const dayLabel = numDias > 1 ? `Día ${idx + 1} (${dateFormatted})` : dateFormatted;

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);

    doc.text(dayLabel, cX.dia, y + 4.5);
    doc.text(rg(d.idaDe, d.idaA), cX.ida, y + 4.5, { align: "center" });
    doc.text(d.kmIda ? `${d.kmIda} km` : "—", cX.kmIda, y + 4.5, { align: "center" });
    doc.text(trabajoStr, cX.trabajo, y + 4.5, { align: "center" });
    doc.text(rg(d.vueltaDe, d.vueltaA), cX.vuelta, y + 4.5, { align: "center" });
    doc.text(d.kmVuelta ? `${d.kmVuelta} km` : "—", cX.kmVuelta, y + 4.5, { align: "center" });

    // Mano de obra destacada en azul corporativo
    doc.setFont("helvetica", "bold").setTextColor(PRIMARY_DARK[0], PRIMARY_DARK[1], PRIMARY_DARK[2]);
    doc.text(formatMinutes(dayWorkMin), cX.manoObra, y + 4.5, { align: "center" });

    y += 6.5;
  });

  // TARJETAS DE TOTALES / KPIS (3 Tarjetas métricas ejecutivas lado a lado)
  const totals = calculateReportTotals(r);
  need(16);
  y += 3;

  const statCardW = (contentW - 6) / 3; // ~58.6 mm cada tarjeta
  const statCardH = 13.5;

  // --- KPI 1: MANO DE OBRA TOTAL ---
  const s1X = M;
  doc.setFillColor(ACCENT_BG[0], ACCENT_BG[1], ACCENT_BG[2]);
  doc.roundedRect(s1X, y, statCardW, statCardH, 1.5, 1.5, "F");
  doc.setDrawColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(s1X, y, statCardW, statCardH, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(PRIMARY_DARK[0], PRIMARY_DARK[1], PRIMARY_DARK[2]);
  doc.text("MANO DE OBRA TOTAL", s1X + statCardW / 2, y + 4.2, { align: "center" });
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(totals.formattedWorkHours || "0 h", s1X + statCardW / 2, y + 10, { align: "center" });

  // --- KPI 2: KILÓMETROS TOTALES ---
  const s2X = M + statCardW + 3;
  doc.setFillColor(CARD_STRIP[0], CARD_STRIP[1], CARD_STRIP[2]);
  doc.roundedRect(s2X, y, statCardW, statCardH, 1.5, 1.5, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(s2X, y, statCardW, statCardH, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("DESPLAZAMIENTO TOTAL", s2X + statCardW / 2, y + 4.2, { align: "center" });
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(`${totals.totalKm} Km`, s2X + statCardW / 2, y + 10, { align: "center" });

  // --- KPI 3: TIEMPO DE VIAJE TOTAL ---
  const s3X = s2X + statCardW + 3;
  doc.setFillColor(CARD_STRIP[0], CARD_STRIP[1], CARD_STRIP[2]);
  doc.roundedRect(s3X, y, statCardW, statCardH, 1.5, 1.5, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(s3X, y, statCardW, statCardH, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("TIEMPO DE VIAJE", s3X + statCardW / 2, y + 4.2, { align: "center" });
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(totals.formattedTravelHours || "0 min", s3X + statCardW / 2, y + 10, { align: "center" });

  y += statCardH + 5;

  // 5. TRABAJO REALIZADO (Lista estructurada y moderna)
  const validTrabajos = (r.trabajos || []).filter((x) => x.descripcion?.trim());
  if (validTrabajos.length > 0) {
    title("Trabajo realizado");
    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);

    for (const l of validTrabajos) {
      const descText = l.descripcion.trim();
      const lines = doc.splitTextToSize(descText, contentW - 8);
      const blockH = lines.length * 4 + 2;
      need(blockH);

      // Icono de viñeta azul limpio
      doc.setFillColor(PRIMARY_RGB[0], PRIMARY_RGB[1], PRIMARY_RGB[2]);
      doc.rect(M + 2, y + 1.8, 1.5, 1.5, "F");

      doc.text(lines, M + 6, y + 3.2);
      y += blockH;
    }
    y += 2;
  }

  // 6. MATERIAL UTILIZADO (Tabla limpia y alineada)
  const validMateriales = (r.materialesLista || []).filter((x) => x.codigo || x.descripcion);
  if (validMateriales.length > 0) {
    title("Materiales y repuestos utilizados");
    need(10);

    const matHeaderH = 5.5;
    doc.setFillColor(CARD_STRIP[0], CARD_STRIP[1], CARD_STRIP[2]);
    doc.rect(M, y, contentW, matHeaderH, "F");
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.2);
    doc.rect(M, y, contentW, matHeaderH, "S");

    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text("REFERENCIA", M + 3, y + 3.8);
    doc.text("DESCRIPCIÓN DEL REPUESTO / MATERIAL", M + 45, y + 3.8);
    doc.text("CANTIDAD", W - M - 3, y + 3.8, { align: "right" });
    y += matHeaderH;

    for (const l of validMateriales) {
      const descLines = doc.splitTextToSize(l.descripcion || "—", contentW - 68);
      const rowH = Math.max(descLines.length * 4 + 2, 6);
      need(rowH);

      doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
      doc.setLineWidth(0.15);
      doc.line(M, y + rowH, M + contentW, y + rowH);

      doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
      doc.text(l.codigo || "—", M + 3, y + 4.2);

      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
      doc.text(descLines, M + 45, y + 4.2);

      doc.setFont("helvetica", "bold").setTextColor(PRIMARY_DARK[0], PRIMARY_DARK[1], PRIMARY_DARK[2]);
      doc.text(l.cantidad || "1", W - M - 3, y + 4.2, { align: "right" });

      y += rowH;
    }
    y += 3;
  }

  // 7. FOTOGRAFÍAS DEL TRABAJO (Antes / Después cuadradas y elegantes)
  const validFotos = (r.fotos || []).filter((f) => f.url);
  if (validFotos.length > 0) {
    title("Fotografías de la intervención (Antes / Después)");
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

        const isAntes = f.tipo === "antes";
        const label = isAntes
          ? "ESTADO INICIAL (ANTES)"
          : f.tipo === "despues"
          ? "REPARACIÓN FINAL (DESPUÉS)"
          : (f.titulo || "FOTO TÉCNICA").toUpperCase();

        doc.setFont("helvetica", "bold").setFontSize(7);
        if (isAntes) {
          doc.setTextColor(217, 119, 6); // Ámbar
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
          doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
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
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
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
    const obsH = obsLines.length * 4 + 4;
    need(obsH);

    doc.setFillColor(CARD_STRIP[0], CARD_STRIP[1], CARD_STRIP[2]);
    doc.roundedRect(M, y, contentW, obsH, 1.5, 1.5, "F");
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, y, contentW, obsH, 1.5, 1.5, "S");

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]);
    doc.text(obsLines, M + 3, y + 4.5);
    y += obsH + 4;
  }

  // 9. CIERRE Y FIRMA DEL CLIENTE (Dos cajas simétricas, elegantes y proporcionales)
  title("Conformidad y firma de la intervención");
  need(38);

  const sigBoxW = (contentW - 5) / 2; // ~88.5 mm
  const sigBoxH = 34;

  // --- CUADRO 1: FIRMA DEL CLIENTE ---
  doc.setFillColor(CARD_BG[0], CARD_BG[1], CARD_BG[2]);
  doc.roundedRect(M, y, sigBoxW, sigBoxH, 1.5, 1.5, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, y, sigBoxW, sigBoxH, 1.5, 1.5, "S");

  // Barra de cabecera de firma
  doc.setFillColor(CARD_STRIP[0], CARD_STRIP[1], CARD_STRIP[2]);
  doc.roundedRect(M, y, sigBoxW, 5, 1.5, 1.5, "F");
  doc.rect(M, y + 3, sigBoxW, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text("CONFORMIDAD DEL CLIENTE", M + sigBoxW / 2, y + 3.6, { align: "center" });

  doc.setFont("helvetica", "italic").setFontSize(6).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("El cliente manifiesta su conformidad con los trabajos y tiempos indicados.", M + sigBoxW / 2, y + 8, { align: "center" });

  if (r.firma) {
    try {
      const sigW = Math.min(sigBoxW - 14, 55);
      const sigH = 14;
      const sigX = M + (sigBoxW - sigW) / 2;
      doc.addImage(r.firma, "PNG", sigX, y + 9.5, sigW, sigH);
    } catch (e) {
      console.error("Error adding signature", e);
    }
  } else {
    // Línea de firma si no está firmado aún
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(M + 12, y + 21, M + sigBoxW - 12, y + 21);
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text("Firma y sello de la empresa", M + sigBoxW / 2, y + 24, { align: "center" });
  }

  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(`Firmado por: ${r.firmaNombre || r.cliente || "Cliente"}`, M + sigBoxW / 2, y + sigBoxH - 3, { align: "center" });

  // --- CUADRO 2: SERVICIO TÉCNICO OFICIAL GRUPER ---
  const box2X = M + sigBoxW + 5;
  doc.setFillColor(CARD_BG[0], CARD_BG[1], CARD_BG[2]);
  doc.roundedRect(box2X, y, sigBoxW, sigBoxH, 1.5, 1.5, "F");
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(box2X, y, sigBoxW, sigBoxH, 1.5, 1.5, "S");

  // Barra de cabecera SAT
  doc.setFillColor(ACCENT_BG[0], ACCENT_BG[1], ACCENT_BG[2]);
  doc.roundedRect(box2X, y, sigBoxW, 5, 1.5, 1.5, "F");
  doc.rect(box2X, y + 3, sigBoxW, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(PRIMARY_DARK[0], PRIMARY_DARK[1], PRIMARY_DARK[2]);
  doc.text("SERVICIO TÉCNICO OFICIAL GRUPER", box2X + sigBoxW / 2, y + 3.6, { align: "center" });

  // Logo de Gruper centrado y elegante como sello oficial
  if (img) {
    const logoW = 32;
    const logoH = 10;
    const logoX = box2X + (sigBoxW - logoW) / 2;
    doc.addImage(img, "PNG", logoX, y + 7, logoW, logoH);
  }

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
  doc.text(`Técnico Responsable: ${r.tecnico || creatorName || "SAT Gruper"}`, box2X + sigBoxW / 2, y + 21, { align: "center" });
  doc.text(`Vehículo SAT: ${r.vehiculo || "—"}   ·   Conforme y verificado`, box2X + sigBoxW / 2, y + 25.5, { align: "center" });
  doc.setFont("helvetica", "italic").setFontSize(6).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("Garantía oficial SAT Gruper Water Technologies", box2X + sigBoxW / 2, y + sigBoxH - 3, { align: "center" });

  y += sigBoxH + 4;

  // 10. PIE DE PÁGINA CORPORATIVO EN TODAS LAS PÁGINAS
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setLineWidth(0.15);
    doc.line(M, H - 10, W - M, H - 10);

    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text("Gruper Remote · Servicio de Asistencia Técnica Oficial · www.gruper.es", M, H - 6.5);
    doc.text("Documento generado electrónicamente", W / 2, H - 6.5, { align: "center" });
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
