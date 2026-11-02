import * as XLSX from "xlsx";

export type MaterialRow = { codigo: string; descripcion: string; stock: string };

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const CODE = ["codigo", "cod", "ref", "referencia", "articulo", "sku"];
const DESC = ["descripcion", "nombre", "denominacion", "producto", "material", "concepto"];
const STOCK = ["stock", "existencias", "cantidad", "uds", "unidades", "disponible"];
const find = (h: string[], keys: string[]) => h.findIndex((c) => keys.some((k) => c === k || c.startsWith(k)));

/** Reads the first sheet of an Excel/CSV file and maps code / description / stock columns. */
export function parseMaterials(buf: ArrayBuffer): MaterialRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  let hi = rows.findIndex((r) => { const h = r.map(norm); return find(h, CODE) >= 0 || find(h, DESC) >= 0; });
  let ci = 0, di = 1, si = 2;
  if (hi >= 0) {
    const h = rows[hi]!.map(norm);
    ci = find(h, CODE); di = find(h, DESC); si = find(h, STOCK);
  } else hi = -1;
  const cell = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  return rows.slice(hi + 1)
    .map((r) => ({ codigo: cell(r, ci), descripcion: cell(r, di), stock: cell(r, si) }))
    .filter((m) => m.codigo || m.descripcion)
    .slice(0, 20000);
}

/** Turns a Google Sheets / OneDrive / SharePoint share link into a direct download URL. */
export function downloadUrl(link: string): string {
  const u = new URL(link.trim());
  const g = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (u.hostname === "docs.google.com" && g) return `https://docs.google.com/spreadsheets/d/${g[1]}/export?format=xlsx`;
  if (u.hostname === "1drv.ms" || u.hostname.endsWith("onedrive.live.com")) {
    const b64 = btoa(link.trim()).replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
    return `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`;
  }
  if (u.hostname.endsWith("sharepoint.com")) { u.searchParams.set("download", "1"); return u.toString(); }
  return u.toString();
}
