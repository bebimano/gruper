import { jsPDF } from "jspdf";
import logo from "@/assets/gruper-logo.png.asset.json";
import type { WorkReport } from "@/lib/work-report";
import { calculateReportTotals } from "@/lib/time-calculator";

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

/** Generates clean, standard filename: e.g. Parte_1_Juan_EmpresaABC.pdf */
export function getReportFilename(number: string | number, creatorName?: string, cliente?: string): string {
  const clean = (s: string) => s.trim().replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_");
  const parts = [`Parte_${number || "nuevo"}`];
  if (creatorName?.trim()) parts.push(clean(creatorName));
  if (cliente?.trim()) parts.push(clean(cliente));
  return `${parts.join("_")}.pdf`;
}

/** Generates the jsPDF document instance. */
export async function generatePdfDoc(r: WorkReport, number: string | number, creatorName?: string): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14;
  let y = 14;
  const need = (h: number) => { if (y + h > 285) { doc.addPage(); y = 14; } };
  const img = await toDataUrl(logo.url);
  if (img) doc.addImage(img, "PNG", M, y, 50, 16);

  doc.setFontSize(9).setTextColor(100).text("SERVICIO ASISTENCIA TÉCNICA", W - M, y + 5, { align: "right" });
  doc.setFontSize(16).setTextColor(0).setFont("helvetica", "bold").text(`Parte de trabajo Nº ${number}`, W - M, y + 13, { align: "right" });
  if (creatorName) {
    doc.setFontSize(9).setTextColor(80).setFont("helvetica", "normal").text(`Creado por: ${creatorName}`, W - M, y + 19, { align: "right" });
    y += 26;
  } else {
    y += 24;
  }

  const title = (t: string) => {
    need(12);
    doc.setFillColor(37, 159, 253).rect(M, y, W - 2 * M, 7, "F");
    doc.setTextColor(255).setFontSize(10).setFont("helvetica", "bold").text(t.toUpperCase(), M + 2, y + 5);
    doc.setTextColor(0).setFont("helvetica", "normal");
    y += 10;
  };

  const pairs = (items: [string, string][]) => {
    doc.setFontSize(9);
    for (let i = 0; i < items.length; i += 2) {
      need(7);
      items.slice(i, i + 2).forEach(([k, v], j) => {
        const x = M + j * 91;
        doc.setFont("helvetica", "bold").text(`${k}:`, x, y);
        doc.setFont("helvetica", "normal").text(String(doc.splitTextToSize(v || "—", 60)[0] ?? ""), x + 28, y);
      });
      y += 6;
    }
    y += 2;
  };

  title("Datos generales");
  pairs([
    ["Cliente", r.cliente],
    ["Dirección", r.direccion || "—"],
    ["Población (De)", r.de || "—"],
    ["Creado por", creatorName || "—"],
    ["Técnico", r.tecnico || "—"],
    ["Vehículo", r.vehiculo || "—"],
    ["Modelo / Máq.", r.codigoMaquina || "—"],
    ["Nº serie", r.numSerie || "—"],
    ["Reparación", r.reparacion || "—"],
    ["Suministro", r.suministro || "—"],
    ["Materiales", r.materiales || "—"],
    ["Instalación", r.instalacion || "—"],
  ]);

  title("Horas de trabajo");
  doc.setFontSize(8);
  const cols = ["Fecha", "Ida", "Km", "Mañana", "Tarde", "Vuelta", "Km"];
  const cx = [M, M + 26, M + 56, M + 70, M + 100, M + 130, M + 160];
  doc.setFont("helvetica", "bold");
  cols.forEach((c, i) => doc.text(c, cx[i]!, y));
  doc.setFont("helvetica", "normal");
  y += 5;

  const rg = (a: string, b: string) => (a || b ? `${a}-${b}` : "");
  for (const d of r.dias) {
    need(6);
    [
      d.fecha ? new Date(d.fecha).toLocaleDateString("es-ES") : "",
      rg(d.idaDe, d.idaA),
      d.kmIda,
      rg(d.mananaDe, d.mananaA),
      rg(d.tardeDe, d.tardeA),
      rg(d.vueltaDe, d.vueltaA),
      d.kmVuelta,
    ].forEach((v, i) => doc.text(v || "", cx[i]!, y));
    y += 5;
  }
  y += 2;

  const totals = calculateReportTotals(r);
  if (totals.totalKm > 0 || totals.totalWorkMinutes > 0 || totals.totalTravelMinutes > 0) {
    need(9);
    doc.setFillColor(240, 247, 255).rect(M, y, W - 2 * M, 6.5, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(37, 159, 253);
    const summaryText = `TOTALES CALCULADOS:  Mano de obra: ${totals.formattedWorkHours}   |   Desplazamiento: ${totals.totalKm} Km${totals.formattedTravelHours ? ` (${totals.formattedTravelHours} viaje)` : ""}`;
    doc.text(summaryText, M + 3, y + 4.5);
    doc.setTextColor(0).setFont("helvetica", "normal");
    y += 9.5;
  } else {
    y += 1;
  }

  title("Trabajo realizado");
  doc.setFontSize(9);
  for (const l of r.trabajos.filter((x) => x.descripcion?.trim())) {
    const desc = doc.splitTextToSize(`• ${l.descripcion.trim()}`, W - 2 * M);
    need(desc.length * 4.5 + 2);
    doc.text(desc, M, y);
    y += desc.length * 4.5 + 1.5;
  }
  y += 3;

  title("Material utilizado");
  doc.setFontSize(9);
  for (const l of r.materialesLista.filter((x) => x.codigo || x.descripcion)) {
    const desc = doc.splitTextToSize(l.descripcion || "", 120);
    need(desc.length * 4.5 + 2);
    doc.text(l.codigo || "", M, y);
    doc.text(desc, M + 34, y);
    doc.text(l.cantidad || "", W - M, y, { align: "right" });
    y += desc.length * 4.5 + 1.5;
  }
  y += 3;

  const validFotos = (r.fotos || []).filter((f) => f.url);
  if (validFotos.length > 0) {
    title("Fotografías del trabajo (Antes / Después)");
    const gap = 6;
    const photoW = (W - 2 * M - gap) / 2;
    const photoH = 50;
    for (let i = 0; i < validFotos.length; i += 2) {
      const batch = validFotos.slice(i, i + 2);
      const maxDescLen = Math.max(...batch.map((f) => (f.descripcion?.trim() ? doc.splitTextToSize(f.descripcion.trim(), photoW).length : 0)));
      const extraH = maxDescLen > 0 ? maxDescLen * 3.5 + 4 : 0;

      need(photoH + 12 + extraH);
      batch.forEach((f, idx) => {
        const x = M + idx * (photoW + gap);
        doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(50);
        const label = f.tipo === "antes" ? "ANTES (Avería / Estado inicial)" : f.tipo === "despues" ? "DESPUÉS (Reparación / Estado final)" : (f.titulo || "Foto de trabajo");
        doc.text(label, x, y + 3);
        try {
          doc.addImage(f.url, "JPEG", x, y + 5, photoW, photoH);
        } catch (imgErr) {
          console.error("Error adding photo to PDF", imgErr);
        }
        if (f.descripcion?.trim()) {
          doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(60);
          const descLines = doc.splitTextToSize(f.descripcion.trim(), photoW);
          doc.text(descLines, x, y + photoH + 9);
        }
      });
      y += photoH + 11 + extraH;
    }
    y += 2;
  }

  title("Cierre");
  pairs([["Solicitado por", r.solicitadoPor || "—"], ["", ""]]);

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
      need(10);
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(30);
      if (esp.length > 0) {
        doc.text(`Dietas España: ${esp.join(" · ")}`, M, y);
        y += 5;
      }
      if (ext.length > 0) {
        doc.text(`Dietas Extranjero: ${ext.join(" · ")}`, M, y);
        y += 5;
      }
      doc.setFont("helvetica", "normal");
      y += 1;
    }
  }

  const obs = doc.splitTextToSize(`Observaciones: ${r.observaciones || "—"}`, W - 2 * M);
  need(obs.length * 4.5);
  doc.setFontSize(9).text(obs, M, y);
  y += obs.length * 4.5 + 4;

  title("Firma del cliente");
  need(45);
  if (r.firma) doc.addImage(r.firma, "PNG", M, y, 90, 30);
  y += 33;
  doc.setFontSize(9).text(r.firmaNombre || "", M, y);

  return doc;
}

/** Builds the signed work report PDF; returns base64 (no data: prefix). */
export async function buildReportPdf(r: WorkReport, number: string | number, creatorName?: string): Promise<string> {
  const doc = await generatePdfDoc(r, number, creatorName);
  return doc.output("datauristring").split(",")[1] ?? "";
}

/** Triggers a browser download of the report PDF with a descriptive filename. */
export async function downloadReportPdf(r: WorkReport, number: string | number, creatorName?: string): Promise<void> {
  const doc = await generatePdfDoc(r, number, creatorName);
  const filename = getReportFilename(number, creatorName, r.cliente);
  doc.save(filename);
}
