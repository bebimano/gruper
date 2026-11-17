import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Printer, Trash2, X, Cpu, Download, Mail, Send, Clock } from "lucide-react";
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
import { useClientEquipment } from "@/components/ClientEquipmentAdmin";
import { useServerFn } from "@tanstack/react-start";
import { buildReportPdf, downloadReportPdf, getReportFilename } from "@/lib/report-pdf";
import { sendReportEmail } from "@/lib/report-email.functions";
import { notifyEvent } from "@/lib/notify.functions";
import { logReportOpen } from "@/lib/reports.functions";
import { useWorkerInitials, formatReportNumber } from "@/lib/worker-initials";
import { ReportPhotos } from "@/components/ReportPhotos";
import { WorkTimeTracker } from "@/components/WorkTimeTracker";
import { DietasGastosSelector } from "@/components/DietasGastosSelector";

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
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const sendFn = useServerFn(sendReportEmail);
  const notifyFn = useServerFn(notifyEvent);
  const logOpenFn = useServerFn(logReportOpen);

  useEffect(() => {
    if (!isNew && id && id !== "nuevo") {
      logOpenFn({ data: { id } }).catch((err) => {
        console.error("Error logging report open:", err);
      });
    }
  }, [id, isNew]);

  const existing = useQuery({
    queryKey: ["work-report", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("work_reports").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const creator = useQuery({
    queryKey: ["creator-username", existing.data?.user_id],
    enabled: !isNew && !!existing.data?.user_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username").eq("id", existing.data!.user_id).maybeSingle();
      return data?.username ?? "";
    },
  });

  const { getInitials } = useWorkerInitials();
  const creatorName = isNew
    ? (me.data?.username ?? "")
    : (creator.data || (existing.data?.user_id === me.data?.id ? me.data?.username ?? "" : "Usuario"));

  const creatorUserId = existing.data?.user_id || me.data?.id;
  const creatorInitials = getInitials(creatorUserId, creatorName);
  const rawNum = existing.data ? (existing.data.user_number ?? existing.data.number) : null;
  const formattedReportNum = rawNum !== null ? formatReportNumber(creatorInitials, existing.data?.created_at, rawNum) : null;
  const reportNum = formattedReportNum ?? rawNum;

  const contacts = useReportContacts();
  const fixedEmails = useFixedEmails();
  // Load all client equipment to filter by selected client
  const allEquipment = useClientEquipment();
  const clientEquipment = (allEquipment.data ?? []).filter(
    (eq) => eq.client_name.trim().toLowerCase() === r?.cliente?.trim().toLowerCase(),
  );

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

  async function sendEmail() {
    const fixed = (fixedEmails.data ?? []).map((x: { email: string }) => x.email);
    if (!contactEmail && !fixed.length) { toast.error("No hay correos asociados. Pídeselos al administrador."); return; }
    setSending(true);
    try {
      const pdf = await buildReportPdf(r!, formattedReportNum ?? "", creatorName);
      const res = await sendFn({ data: { id, pdf } });
      toast.success(`Parte enviado a ${res.to.join(", ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar");
    } finally { setSending(false); }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      await downloadReportPdf(r!, formattedReportNum ?? "nuevo", creatorName);
      toast.success("PDF descargado");
    } catch (e) {
      toast.error("Error al generar el PDF");
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    const originalTitle = document.title;
    document.title = getReportFilename(formattedReportNum ?? "nuevo", creatorName, r?.cliente).replace(/\.pdf$/, "");
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 1000);
  }

  async function requestEdit() {
    const { error } = await supabase.rpc("request_report_edit", { _id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitud enviada al administrador");
    qc.invalidateQueries({ queryKey: ["work-report", id] });
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const payload = r as unknown as Json;
      const res = isNew
        ? await supabase.from("work_reports").insert({ data: payload, closed: false }).select("id, number, user_number").single()
        : await supabase.from("work_reports").update({ data: payload, closed: false, updated_at: new Date().toISOString() }).eq("id", id).select("id, number, user_number").single();
      if (res.error) throw res.error;
      toast.success("Borrador guardado");
      qc.invalidateQueries({ queryKey: ["work-reports"] });
      qc.invalidateQueries({ queryKey: ["work-report", res.data.id] });
      if (isNew) notifyFn({ data: { event: "new_report", id: res.data.id } }).catch(() => {});
      if (isNew) navigate({ to: "/parte/$id", params: { id: res.data.id }, replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function saveAndClose() {
    if (!r!.firma) {
      toast.error("Falta la firma del cliente antes de cerrar");
      return;
    }
    setSaving(true);
    try {
      const payload = r as unknown as Json;
      const res = isNew
        ? await supabase.from("work_reports").insert({ data: payload, closed: true }).select("id, number, user_number").single()
        : await supabase.from("work_reports").update({ data: payload, closed: true, updated_at: new Date().toISOString() }).eq("id", id).select("id, number, user_number").single();

      if (res.error) throw res.error;
      const savedId = res.data.id;
      const rawSavedNum = res.data.user_number ?? res.data.number;
      const savedNum = formatReportNumber(creatorInitials, new Date(), rawSavedNum);
      toast.success(`Parte Nº ${savedNum} cerrado`);
      qc.invalidateQueries({ queryKey: ["work-reports"] });
      qc.invalidateQueries({ queryKey: ["work-report", savedId] });
      if (isNew) notifyFn({ data: { event: "new_report", id: savedId } }).catch(() => {});

      // Envío automático del correo
      const fixed = (fixedEmails.data ?? []).map((x: { email: string }) => x.email);
      if (contactEmail || fixed.length) {
        setSending(true);
        try {
          const pdf = await buildReportPdf(r!, savedNum, creatorName);
          const emailRes = await sendFn({ data: { id: savedId, pdf } });
          toast.success(`Parte enviado por correo a ${emailRes.to.join(", ")}`);
        } catch (mailErr) {
          toast.error(mailErr instanceof Error ? `Parte cerrado, pero falló el envío: ${mailErr.message}` : "Parte cerrado, pero no se pudo enviar el correo");
        } finally {
          setSending(false);
        }
      } else {
        toast.info("Parte cerrado. No se envió correo porque no hay correos asociados.");
      }

      if (isNew) {
        navigate({ to: "/parte/$id", params: { id: savedId }, replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar y cerrar");
    } finally {
      setSaving(false);
    }
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
        if (key === "trabajos") {
          return (
            <div key={i} className="flex items-start gap-2">
              <Textarea
                placeholder="Descripción del trabajo realizado..."
                rows={2}
                value={l.descripcion}
                onChange={(e) => upd({ descripcion: e.target.value })}
                className="flex-1 min-h-11"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="print:hidden text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Quitar línea"
                onClick={() => set(key, r[key].filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        }
        return (
          <div key={i} className="grid grid-cols-[1fr_4.5rem_auto] gap-2 sm:grid-cols-[8rem_1fr_5rem_auto] items-start">
            <MaterialPicker value={l.codigo} placeholder={codeLabel} onChange={(v) => upd({ codigo: v })} onPick={(m) => upd({ codigo: m.codigo, descripcion: m.descripcion })} />
            <Textarea placeholder="Descripción" rows={2} value={l.descripcion} onChange={(e) => upd({ descripcion: e.target.value })} className="min-h-11" />
            <Input placeholder="Cant." value={l.cantidad} onChange={(e) => upd({ cantidad: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" className="print:hidden text-muted-foreground hover:text-destructive shrink-0" aria-label="Quitar línea" onClick={() => set(key, r[key].filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => set(key, [...r[key], emptyLinea()])}><Plus className="h-4 w-4 mr-1" /> Añadir línea</Button>
    </div>
  );

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-8 safe-top pb-32 max-w-4xl lg:max-w-5xl w-full mx-auto">
      <header className="flex items-center justify-between py-3 print:hidden">
        <Link to="/partes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Partes</Link>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={downloadPdf} disabled={downloading} aria-label="Descargar PDF" title="Descargar PDF"><Download className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={handlePrint} aria-label="Imprimir o PDF" title="Imprimir"><Printer className="h-4 w-4" /></Button>
          {!isNew && (!closed || me.data?.isAdmin) && <Button variant="ghost" size="icon" onClick={remove} aria-label="Eliminar parte"><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </header>
      <div className="mt-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Servicio asistencia técnica</p>
        <h1 className="text-2xl font-bold">
          Parte de trabajo {reportNum !== null ? `Nº ${reportNum}` : "nuevo"}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Creado por: <strong className="font-medium text-foreground">{creatorName || "—"}</strong></span>
          {existing.data?.created_at && (
            <span>· Fecha: {new Date(existing.data.created_at).toLocaleDateString("es-ES")}</span>
          )}
        </div>
        {closed && <p className="mt-2 text-sm text-muted-foreground">{isAdmin ? "Cerrado — como administrador puedes modificarlo." : "Cerrado — ya no se puede modificar ni borrar."}</p>}
      </div>

      <fieldset disabled={locked} className="min-w-0">
      <div className="space-y-4">
        <Section title="Datos generales">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</span>
              <Input
                list="report-clients"
                value={r.cliente}
                onChange={(e) => {
                  const val = e.target.value;
                  const match = (allEquipment.data ?? []).find(
                    (eq) => eq.client_name.trim().toLowerCase() === val.trim().toLowerCase(),
                  );
                  setR((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      cliente: val,
                      de: match?.poblacion ? match.poblacion : prev.de,
                      direccion: match?.direccion ? match.direccion : prev.direccion,
                    };
                  });
                }}
              />
              <datalist id="report-clients">{contacts.data?.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              {r.cliente && <span className="mt-1 block text-xs text-muted-foreground">{contactEmail ? `Correo: ${contactEmail}` : "Sin correo asociado"}</span>}
            </label>
            <Field label="Dirección" {...f("direccion")} />
            <Field label="Población (De)" {...f("de")} />
            <Field label="Técnico" {...f("tecnico")} />
            <Field label="Vehículo" {...f("vehiculo")} />
            <Field label="Modelo / Código máquina" {...f("codigoMaquina")} />
            <Field label="Nº serie" {...f("numSerie")} />
            <Field label="Reparación" {...f("reparacion")} />
            <Field label="Suministro" {...f("suministro")} />
            <Field label="Materiales" {...f("materiales")} />
            <Field label="Instalación" {...f("instalacion")} />
          </div>

          {/* Machine quick-pick: shown when there are registered machines for the selected client */}
          {clientEquipment.length > 0 && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 print:hidden">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" /> Máquinas de {r.cliente} — pulsa para rellenar modelo, nº serie y dirección:
              </p>
              <div className="flex flex-wrap gap-2">
                {clientEquipment.map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => {
                      setR((prev) => {
                        if (!prev) return null;
                        return {
                          ...prev,
                          codigoMaquina: eq.modelo || eq.tipo_maquina,
                          numSerie: eq.num_serie,
                          de: eq.poblacion || prev.de,
                          direccion: eq.direccion || prev.direccion,
                        };
                      });
                      toast.success(`Modelo "${eq.modelo || eq.tipo_maquina}" cargado`);
                    }}
                    className="rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-left text-sm transition-colors hover:bg-primary/10 hover:border-primary"
                  >
                    <span className="font-medium">{eq.tipo_maquina}</span>
                    {eq.modelo && <span className="ml-1.5 font-semibold text-primary">· {eq.modelo}</span>}
                    <span className="ml-1.5 font-mono text-xs text-muted-foreground">· Nº {eq.num_serie}</span>
                  </button>
                ))}
              </div>
              {/* Show address if available */}
              {(clientEquipment[0]?.direccion || clientEquipment[0]?.poblacion) && (
                <p className="text-xs text-muted-foreground">
                  📍 {[clientEquipment[0].direccion, clientEquipment[0].poblacion].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          )}
        </Section>

        <Section title="Horas de trabajo">
          <WorkTimeTracker
            dias={r.dias}
            onChange={(dias) => set("dias", dias)}
            disabled={locked}
          />
        </Section>

        <Section title="Trabajo realizado">{lines("trabajos", "Código (ej. MONTAJES)")}</Section>
        <Section title="Material utilizado">{lines("materialesLista", "Referencia")}</Section>

        <Section title="Fotografías de la avería y reparación">
          <ReportPhotos
            fotos={r.fotos ?? []}
            onChange={(fotos) => set("fotos", fotos)}
            disabled={locked}
          />
        </Section>

        <Section title="Dietas y Pernoctas">
          <DietasGastosSelector
            dietas={r.dietas}
            onChange={(dietas) => set("dietas", dietas)}
            disabled={locked}
          />
        </Section>

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

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur px-4 sm:px-6 md:px-8 py-3 safe-bottom print:hidden">
        <div className="mx-auto max-w-4xl lg:max-w-5xl">
          {closed ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={sendEmail} disabled={sending}>
                <Mail className="h-4 w-4 mr-1.5" /> {sending ? "Enviando…" : "Reenviar por correo"}
              </Button>
              {isAdmin ? (
                <Button className="flex-1 font-semibold" onClick={saveAndClose} disabled={saving || sending}>
                  <Send className="h-4 w-4 mr-1.5" />
                  {saving ? "Guardando…" : sending ? "Enviando…" : "Guardar cambios y reenviar"}
                </Button>
              ) : existing.data?.edit_requested ? (
                <Button variant="outline" className="flex-1 text-xs sm:text-sm" disabled>
                  <Clock className="h-4 w-4 mr-1.5" /> Modificación solicitada
                </Button>
              ) : (
                <Button variant="outline" className="flex-1 text-xs sm:text-sm font-medium" onClick={requestEdit}>
                  Pedir modificar el parte
                </Button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="w-full font-semibold" onClick={saveAndClose} disabled={saving || sending}>
                <Send className="h-4 w-4 mr-1.5" />
                {saving ? "Cerrando parte…" : sending ? "Enviando correo…" : "Cerrar y enviar parte"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
