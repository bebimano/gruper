import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Printer, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useMe } from "@/lib/useRole";
import { emptyDia, emptyLinea, emptyReport, normalizeReport, type Linea, type WorkReport } from "@/lib/work-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { MaterialPicker } from "@/components/MaterialPicker";
import { useFixedEmails } from "@/components/FixedEmailsAdmin";
import { useReportContacts } from "@/components/ReportContactsAdmin";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parte/$id")({
  head: () => ({
    meta: [
      { title: "Parte de trabajo — Gruper Remote" },
      { name: "description", content: "Parte de trabajo del servicio de asistencia técnica Gruper." },
      { property: "og:title", content: "Parte de trabajo — Gruper Remote" },
      { property: "og:description", content: "Parte de trabajo del servicio de asistencia técnica Gruper." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Parte,
});

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-background p-4 space-y-3 print:border-0 print:p-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Parte() {
  const { id } = Route.useParams();
  const isNew = id === "nuevo";
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [r, setR] = useState<WorkReport | null>(null);
  const [saving, setSaving] = useState(false);

  const existing = useQuery({
    queryKey: ["work-report", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("work_reports").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const contacts = useReportContacts();
  const fixedEmails = useFixedEmails();

  useEffect(() => {
    if (isNew && me.data && !r) setR(emptyReport(me.data.username.toUpperCase()));
    if (!isNew && existing.data && !r) setR(normalizeReport(existing.data.data));
  }, [isNew, me.data, existing.data, r]);

  if (!r) return <p className="p-8 text-center text-muted-foreground">{existing.isFetched && !existing.data ? "Parte no encontrado" : "Cargando…"}</p>;

  const closed = !!existing.data?.closed;
  const isAdmin = !!me.data?.isAdmin;
  const locked = closed && !isAdmin;
  const set = <K extends keyof WorkReport>(k: K, v: WorkReport[K]) => setR({ ...r, [k]: v });
  const f = (k: keyof WorkReport) => ({ value: r[k] as string, onChange: (v: string) => set(k, v as never) });
  const contactEmail = contacts.data?.find((c) => c.name.trim().toLowerCase() === r.cliente.trim().toLowerCase())?.email;

  function sendEmail() {
    const fixed = (fixedEmails.data ?? []).map((x) => x.email);
    const to = [...new Set([contactEmail, ...fixed].filter(Boolean))].join(",");
    if (!to) { toast.error("No hay correos asociados. Pídeselos al administrador."); return; }
    const n = existing.data?.number ?? "";
    const body = [
      `Parte de trabajo Nº ${n}`, `Cliente: ${r!.cliente}`, `Técnico: ${r!.tecnico}`,
      `Máquina: ${r!.codigoMaquina}  Nº serie: ${r!.numSerie}`, "",
      "Trabajo realizado:", ...r!.trabajos.filter((t) => t.descripcion || t.codigo).map((t) => `- ${t.codigo} ${t.descripcion} ${t.cantidad}`),
      "", "Material utilizado:", ...r!.materialesLista.filter((t) => t.descripcion || t.codigo).map((t) => `- ${t.codigo} ${t.descripcion} x${t.cantidad}`),
      "", `Observaciones: ${r!.observaciones}`, `Firmado por: ${r!.firmaNombre}`, "", "Gruper",
    ].join("\n");
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(`Parte de trabajo Nº ${n} — Gruper`)}&body=${encodeURIComponent(body)}`;
  }
  async function requestEdit() {
    const { error } = await supabase.rpc("request_report_edit", { _id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitud enviada al administrador");
    qc.invalidateQueries({ queryKey: ["work-report", id] });
  }

  async function save(close: boolean) {
    if (close) {
      if (!r!.firma) { toast.error("Falta la firma del cliente"); return; }
      if (!closed && !confirm("Una vez cerrado, el parte no se podrá modificar ni borrar. ¿Cerrar?")) return;
    }
    setSaving(true);
    const payload = r as unknown as Json;
    const res = isNew
      ? await supabase.from("work_reports").insert({ data: payload, closed: close }).select("id").single()
      : await supabase.from("work_reports").update({ data: payload, closed: close, updated_at: new Date().toISOString() }).eq("id", id).select("id").single();
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(close ? "Parte cerrado" : "Parte guardado");
    qc.invalidateQueries({ queryKey: ["work-reports"] });
    qc.invalidateQueries({ queryKey: ["work-report", res.data.id] });
    if (isNew) navigate({ to: "/parte/$id", params: { id: res.data.id }, replace: true });
  }
  async function remove() {
    if (!confirm("¿Eliminar este parte?")) return;
    const { error } = await supabase.from("work_reports").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["work-reports"] });
    navigate({ to: "/partes" });
  }

  const lines = (key: "trabajos" | "materialesLista", codeLabel: string) => (
    <div className="space-y-2">
      {r[key].map((l, i) => {
        const upd = (p: Partial<Linea>) => set(key, r[key].map((x, j) => (j === i ? { ...x, ...p } : x)));
        return (
          <div key={i} className="grid grid-cols-[1fr_4.5rem_auto] gap-2 sm:grid-cols-[8rem_1fr_5rem_auto] items-start">
            {key === "materialesLista"
              ? <MaterialPicker value={l.codigo} placeholder={codeLabel} onChange={(v) => upd({ codigo: v })} onPick={(m) => upd({ codigo: m.codigo, descripcion: m.descripcion })} />
              : <Input placeholder={codeLabel} value={l.codigo} onChange={(e) => upd({ codigo: e.target.value })} className="col-span-3 sm:col-span-1" />}
            <Textarea placeholder="Descripción" rows={2} value={l.descripcion} onChange={(e) => upd({ descripcion: e.target.value })} className="min-h-11" />
            <Input placeholder="Cant." value={l.cantidad} onChange={(e) => upd({ cantidad: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" className="print:hidden" aria-label="Quitar línea" onClick={() => set(key, r[key].filter((_, j) => j !== i))}><X /></Button>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => set(key, [...r[key], emptyLinea()])}><Plus /> Añadir línea</Button>
    </div>
  );

  return (
    <main className="min-h-screen px-5 safe-top pb-28 max-w-3xl mx-auto">
      <header className="flex items-center justify-between py-3 print:hidden">
        <Link to="/partes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Partes</Link>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => window.print()} aria-label="Imprimir o PDF"><Printer /></Button>
          {!isNew && (!closed || me.data?.isAdmin) && <Button variant="ghost" size="icon" onClick={remove} aria-label="Eliminar parte"><Trash2 /></Button>}
        </div>
      </header>
      <div className="mt-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Servicio asistencia técnica</p>
        <h1 className="text-2xl font-bold">Parte de trabajo {existing.data ? `Nº ${existing.data.number}` : "nuevo"}</h1>
        {closed && <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Cerrado — como administrador puedes modificarlo." : "Cerrado — ya no se puede modificar ni borrar."}</p>}
      </div>

      <fieldset disabled={locked} className="min-w-0">
      <div className="space-y-4">
        <Section title="Datos generales">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</span>
              <Input list="report-clients" value={r.cliente} onChange={(e) => set("cliente", e.target.value)} />
              <datalist id="report-clients">{contacts.data?.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              {r.cliente && <span className="mt-1 block text-xs text-muted-foreground">{contactEmail ? `Correo: ${contactEmail}` : "Sin correo asociado"}</span>}
            </label>
            <Field label="De" {...f("de")} />
            <Field label="Técnico" {...f("tecnico")} />
            <Field label="Vehículo" {...f("vehiculo")} />
            <Field label="Código máquina" {...f("codigoMaquina")} />
            <Field label="Nº serie" {...f("numSerie")} />
            <Field label="Reparación" {...f("reparacion")} />
            <Field label="Suministro" {...f("suministro")} />
            <Field label="Materiales" {...f("materiales")} />
            <Field label="Instalación" {...f("instalacion")} />
          </div>
        </Section>

        <Section title="Horas de trabajo">
          {r.dias.map((d, i) => {
            const upd = (k: keyof typeof d) => ({ value: d[k], onChange: (v: string) => set("dias", r.dias.map((x, j) => (j === i ? { ...x, [k]: v } : x))) });
            return (
              <div key={i} className="rounded-lg bg-muted/60 p-3 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Field label="Fecha" type="date" {...upd("fecha")} /></div>
                  <Button type="button" variant="ghost" size="icon" className="print:hidden" aria-label="Quitar día" onClick={() => set("dias", r.dias.filter((_, j) => j !== i))}><X /></Button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Ida de" type="time" {...upd("idaDe")} />
                  <Field label="Ida a" type="time" {...upd("idaA")} />
                  <Field label="Km ida" {...upd("kmIda")} />
                  <span className="hidden sm:block" />
                  <Field label="Mañana de" type="time" {...upd("mananaDe")} />
                  <Field label="Mañana a" type="time" {...upd("mananaA")} />
                  <Field label="Tarde de" type="time" {...upd("tardeDe")} />
                  <Field label="Tarde a" type="time" {...upd("tardeA")} />
                  <Field label="Vuelta de" type="time" {...upd("vueltaDe")} />
                  <Field label="Vuelta a" type="time" {...upd("vueltaA")} />
                  <Field label="Km vuelta" {...upd("kmVuelta")} />
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => set("dias", [...r.dias, emptyDia()])}><Plus /> Añadir día</Button>
        </Section>

        <Section title="Trabajo realizado">{lines("trabajos", "Código (ej. MONTAJES)")}</Section>
        <Section title="Material utilizado">{lines("materialesLista", "Referencia")}</Section>

        <Section title="Cierre">
          <Field label="Solicitado por" {...f("solicitadoPor")} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Observaciones (dietas, pernoctas…)</span>
            <Textarea rows={3} value={r.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
          </label>
        </Section>

        <Section title="Firma del cliente">
          <Field label="Nombre de quien firma" {...f("firmaNombre")} />
          <SignaturePad value={r.firma} onChange={(v) => set("firma", v)} disabled={locked} />
        </Section>
      </div>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur px-5 py-3 safe-bottom print:hidden">
        <div className="mx-auto max-w-3xl">
          {closed ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={sendEmail}><Mail /> Enviar por correo</Button>
              {isAdmin ? (
                <Button className="flex-1" onClick={() => save(true)} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
              ) : existing.data?.edit_requested ? (
                <p className="flex-1 self-center text-center text-sm text-muted-foreground">Modificación solicitada</p>
              ) : me.data?.canRequestEdit && !existing.data?.edit_used ? (
                <Button className="flex-1" onClick={requestEdit}>Pedir modificar</Button>
              ) : (
                <p className="flex-1 self-center text-center text-sm text-muted-foreground">Cerrado y firmado</p>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => save(false)} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              <Button className="flex-1" onClick={() => save(true)} disabled={saving}>Cerrar parte</Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
