import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cloud, FileSpreadsheet, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseMaterials } from "@/lib/materials";
import { syncMaterialsFromUrl } from "@/lib/materials.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AUTO_REFRESH_MS = 60 * 60 * 1000;

export function MaterialsAdmin() {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncMaterialsFromUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [link, setLink] = useState("");
  const [q, setQ] = useState("");
  const autoDone = useRef(false);

  const source = useQuery({
    queryKey: ["material-source"],
    queryFn: async () => (await supabase.from("material_source").select("*").maybeSingle()).data,
  });
  const list = useQuery({
    queryKey: ["materials-admin", q],
    queryFn: async () => {
      let qb = supabase.from("materials").select("id, codigo, descripcion, stock", { count: "exact" }).order("codigo").limit(50);
      if (q.trim()) qb = qb.or(`codigo.ilike.%${q.trim().replace(/[,()%]/g, "")}%,descripcion.ilike.%${q.trim().replace(/[,()%]/g, "")}%`);
      const { data, count } = await qb;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["material-source"] }); qc.invalidateQueries({ queryKey: ["materials-admin"] }); qc.invalidateQueries({ queryKey: ["materials-search"] }); };

  async function syncUrl(url: string, silent = false) {
    setBusy(true);
    try {
      const r = await syncFn({ data: { url } });
      if (!silent) toast.success(`${r.count} materiales actualizados`);
      refresh();
    } catch (e) { if (!silent) toast.error(e instanceof Error ? e.message : "Error"); }
    setBusy(false);
  }

  // Automatic refresh of the cloud file when the admin opens this tab and the data is older than 1 hour.
  useEffect(() => {
    const s = source.data;
    if (autoDone.current || !s || s.kind !== "url" || !s.url) return;
    autoDone.current = true;
    if (Date.now() - new Date(s.synced_at).getTime() > AUTO_REFRESH_MS) syncUrl(s.url, true);
  }, [source.data]);

  async function upload(file: File) {
    setBusy(true);
    try {
      const rows = parseMaterials(await file.arrayBuffer());
      if (!rows.length) throw new Error("No se encontraron materiales en el archivo");
      const del = await supabase.from("materials").delete().not("id", "is", null);
      if (del.error) throw del.error;
      for (let i = 0; i < rows.length; i += 1000) {
        const { error } = await supabase.from("materials").insert(rows.slice(i, i + 1000));
        if (error) throw error;
      }
      const { error } = await supabase.from("material_source").upsert({ id: 1, kind: "file", name: file.name, url: null, synced_at: new Date().toISOString() });
      if (error) throw error;
      toast.success(`${rows.length} materiales importados`);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    setBusy(false);
  }

  async function clearAll() {
    if (!confirm("¿Borrar toda la lista de materiales y desconectar el archivo?")) return;
    setBusy(true);
    await supabase.from("materials").delete().not("id", "is", null);
    await supabase.from("material_source").delete().eq("id", 1);
    setBusy(false);
    toast.success("Lista de materiales borrada");
    refresh();
  }

  const s = source.data;
  return (
    <div className="space-y-4 mt-4">
      {s && (
        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            {s.kind === "url" ? <Cloud className="h-5 w-5 text-primary" /> : <FileSpreadsheet className="h-5 w-5 text-primary" />}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">{list.data?.count ?? 0} materiales · actualizado {new Date(s.synced_at).toLocaleString("es-ES")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {s.kind === "url" && s.url && <Button variant="outline" className="flex-1" disabled={busy} onClick={() => syncUrl(s.url!)}><RefreshCw className={busy ? "animate-spin" : ""} /> Refrescar</Button>}
            <Button variant="outline" className="flex-1" disabled={busy} onClick={clearAll}><Trash2 /> Borrar</Button>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${drag ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
      >
        <Upload className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-2 font-medium">Subir Excel o CSV</p>
        <p className="text-xs text-muted-foreground">Arrastra el archivo o pulsa aquí. Columnas: código, descripción, stock.</p>
        <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (link.trim()) syncUrl(link.trim()); }} className="rounded-xl border border-border bg-background p-4 space-y-3">
        <h2 className="font-medium flex items-center gap-2"><Cloud className="h-4 w-4 text-primary" /> Leer desde la nube</h2>
        <p className="text-xs text-muted-foreground">Pega el enlace compartido de Google Sheets, OneDrive o SharePoint (con acceso "cualquiera con el enlace"). Se actualiza solo cada hora al entrar aquí, o pulsando Refrescar.</p>
        <Input placeholder="https://docs.google.com/spreadsheets/…" value={link} onChange={(e) => setLink(e.target.value)} autoCapitalize="none" />
        <Button type="submit" className="w-full" disabled={busy}>Conectar y leer</Button>
      </form>

      {!!list.data && (s || q) && (
        <div className="rounded-xl border border-border bg-background p-4 space-y-2">
          <Input placeholder="Buscar material…" value={q} onChange={(e) => setQ(e.target.value)} />
          {list.data.rows.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-b border-border py-2 text-sm last:border-0">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground truncate">{m.codigo}</span>
              <span className="flex-1 min-w-0 truncate">{m.descripcion}</span>
              <span className="shrink-0 font-medium">{m.stock}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
