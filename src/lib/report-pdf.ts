import { jsPDF } from "jspdf";
import logo from "@/assets/gruper-logo.png.asset.json";
import type { WorkReport } from "@/lib/work-report";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob); });
  } catch { return null; }
}

/** Builds the signed work report PDF; returns base64 (no data: prefix). */
export async function buildReportPdf(r: WorkReport, number: string | number): Promise<string> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14;
  let y = 14;
  const need = (h: number) => { if (y + h > 285) { doc.addPage(); y = 14; } };
  const img = await toDataUrl(logo.url);
  if (img) doc.addImage(img, "PNG", M, y, 50, 16);
  doc.setFontSize(9).setTextColor(100).text("SERVICIO ASISTENCIA TÉCNICA", W - M, y + 5, { align: "right" });
  doc.setFontSize(16).setTextColor(0).setFont("helvetica", "bold").text(`Parte de trabajo Nº ${number}`, W - M, y + 13, { align: "right" });
  y += 24;
  const title = (t: string) => { need(12); doc.setFillColor(37, 159, 253).rect(M, y, W - 2 * M, 7, "F"); doc.setTextColor(255).setFontSize(10).setFont("helvetica", "bold").text(t.toUpperCase(), M + 2, y + 5); doc.setTextColor(0).setFont("helvetica", "normal"); y += 10; };
  const pairs = (items: [string, string][]) => {
    doc.setFontSize(9);
    for (let i = 0; i < items.length; i += 2) {
      need(7);
      items.slice(i, i + 2).forEach(([k, v], j) => {
        const x = M + j * 91;
        doc.setFont("helvetica", "bold").text(`${k}:`, x, y);
        doc.setFont("helvetica", "normal").text(doc.splitTextToSize(v || "—", 60)[0], x + 28, y);
      });
      y += 6;
    }
    y += 2;
  };
  title("Datos generales");
  pairs([["Cliente", r.cliente], ["De", r.de], ["Técnico", r.tecnico], ["Vehículo", r.vehiculo], ["Código máquina", r.codigoMaquina], ["Nº serie", r.numSerie], ["Reparación", r.reparacion], ["Suministro", r.suministro], ["Materiales", r.materiales], ["Instalación", r.instalacion]]);

  title("Horas de trabajo");
  doc.setFontSize(8);
  const cols = ["Fecha", "Ida", "Km", "Mañana", "Tarde", "Vuelta", "Km"];
  const cx = [M, M + 26, M + 56, M + 70, M + 100, M + 130, M + 160];
  doc.setFont("helvetica", "bold"); cols.forEach((c, i) => doc.text(c, cx[i], y)); doc.setFont("helvetica", "normal"); y += 5;
  const rg = (a: string, b: string) => (a || b ? `${a}-${b}` : "");
  for (const d of r.dias) {
    need(6);
    [d.fecha ? new Date(d.fecha).toLocaleDateString("es-ES") : "", rg(d.idaDe, d.idaA), d.kmIda, rg(d.mananaDe, d.mananaA), rg(d.tardeDe, d.tardeA), rg(d.vueltaDe, d.vueltaA), d.kmVuelta].forEach((v, i) => doc.text(v || "", cx[i], y));
    y += 5;
  }
  y += 3;
  const lines = (t: string, ls: WorkReport["trabajos"]) => {
    title(t); doc.setFontSize(9);
    for (const l of ls.filter((x) => x.codigo || x.descripcion)) {
      const desc = doc.splitTextToSize(l.descripcion || "", 120);
      need(desc.length * 4.5 + 2);
      doc.text(l.codigo || "", M, y); doc.text(desc, M + 34, y); doc.text(l.cantidad || "", W - M, y, { align: "right" });
      y += desc.length * 4.5 + 1.5;
    }
    y += 3;
  };
  lines("Trabajo realizado", r.trabajos);
  lines("Material utilizado", r.materialesLista);
  title("Cierre");
  pairs([["Solicitado por", r.solicitadoPor], ["", ""]]);
  const obs = doc.splitTextToSize(`Observaciones: ${r.observaciones || "—"}`, W - 2 * M);
  need(obs.length * 4.5); doc.text(obs, M, y); y += obs.length * 4.5 + 4;
  title("Firma del cliente");
  need(45);
  if (r.firma) doc.addImage(r.firma, "PNG", M, y, 90, 30);
  y += 33; doc.setFontSize(9).text(r.firmaNombre || "", M, y);
  return doc.output("datauristring").split(",")[1];
}
