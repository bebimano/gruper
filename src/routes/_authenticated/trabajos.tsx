import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ArrowRight, AlertTriangle, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { JOB_STATUSES, statusInfo } from "@/lib/jobs";
import { notifyEvent } from "@/lib/notify.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/trabajos")({
  head: () => ({
    meta: [
      { title: "Trabajos — Gruper Remote" },
      { name: "description", content: "Trabajos asignados y su estado." },
      { property: "og:title", content: "Trabajos — Gruper Remote" },
      { property: "og:description", content: "Trabajos asignados y su estado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trabajos,
});

function Trabajos() {
  const me = useMe();
  const qc = useQueryClient();
  const notify = useServerFn(notifyEvent);
  const isAdmin = !!me.data?.isAdmin;
  const jobs = useQuery({
    queryKey: ["jobs", me.data?.id],
    enabled: !!me.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const users = useQuery({
    queryKey: ["profile-list"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("profiles").select("id, username").order("username")).data ?? [],
  });
  const [form, setForm] = useState({ title: "", client: "", description: "", assigned_to: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["jobs"] });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const { data, error } = await supabase.from("jobs").insert({ ...form, assigned_to: form.assigned_to || null }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setForm({ title: "", client: "", description: "", assigned_to: "" });
    toast.success("Trabajo creado");
    refresh();
    notify({ data: { event: "new_job", id: data.id } }).catch(() => {});
  }
  async function setStatus(id: string, status: string, note: string) {
    const { error } = await supabase.rpc("set_job_status", { _id: id, _status: status, _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success("Estado actualizado");
    refresh();
    notify({ data: { event: "job_status", id } }).catch(() => {});
  }
  async function remove(id: string) {
    if (!confirm("¿Eliminar este trabajo?")) return;
    await supabase.from("jobs").delete().eq("id", id);
    refresh();
  }
  const name = (id: string | null) => users.data?.find((u) => u.id === id)?.username ?? (id ? "Usuario" : "Sin asignar");

  const allJobs = jobs.data ?? [];
  const regularJobs = allJobs.filter((j) => !j.title?.startsWith("[AVERÍA]"));
  const averiaJobs = allJobs.filter((j) => j.title?.startsWith("[AVERÍA]"));

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-12">
      <header className="py-3">
        <Link
          to="/maquinas"
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-foreground/90 shadow-2xs transition-all hover:bg-muted hover:border-primary/50 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-primary" />
          <span>Volver a máquinas</span>
        </Link>
      </header>
      <h1 className="mt-4 text-2xl sm:text-3xl font-bold">Trabajos</h1>

      {averiaJobs.length > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-base text-foreground">
                {averiaJobs.length} {averiaJobs.length === 1 ? "aviso de avería pendiente" : "avisos de averías pendientes"} de clientes
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Las averías reportadas por clientes con fotos y estados se gestionan en su sección dedicada.
              </p>
            </div>
          </div>
          <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white font-medium shrink-0 self-stretch sm:self-auto shadow-xs">
            <Link to="/averias">
              Ver Averías / Fallos <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      )}

      {isAdmin && (
        <form onSubmit={create} className="mt-5 rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3.5 shadow-sm">
          <h2 className="font-semibold text-foreground text-sm uppercase tracking-wide">Crear nuevo trabajo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Título del trabajo" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Input placeholder="Cliente" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          </div>
          <Textarea placeholder="Descripción" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <select className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Asignar a…</option>
              {users.data?.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <Button type="submit" className="rounded-xl font-semibold shadow-xs active:scale-95 transition-all gap-1.5"><Plus className="h-4 w-4" /> Crear trabajo</Button>
          </div>
        </form>
      )}

      {regularJobs.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-card/50">
          No hay trabajos creados todavía.
        </div>
      )}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {regularJobs.map((j) => (
          <JobCard
            key={j.id}
            j={j}
            admin={isAdmin}
            who={name(j.assigned_to)}
            onStatus={setStatus}
            onDelete={remove}
          />
        ))}
      </div>
    </main>
  );
}

type Job = { id: string; title: string; client: string; description: string; status: string; status_note: string; assigned_to: string | null; updated_at: string };
function JobCard({ j, admin, who, onStatus, onDelete }: { j: Job; admin: boolean; who: string; onStatus: (id: string, s: string, n: string) => void; onDelete: (id: string) => void }) {
  const [note, setNote] = useState(j.status_note);
  const st = statusInfo(j.status);

  // Limpiar y formatear descripción humana para que NUNCA aparezca código JSON
  const cleanDescription = (() => {
    if (!j.description) return "";
    const trimmed = j.description.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.description || parsed.title || "";
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  })();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5 shadow-xs transition-all hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wrench className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-foreground break-words">{j.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">
              {[j.client, admin ? who : null, new Date(j.updated_at).toLocaleString("es-ES")].filter(Boolean).join(" · ")}
            </p>
            {cleanDescription && (
              <p className="mt-2.5 text-sm text-foreground/90 whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2.5 border border-border/60">
                {cleanDescription}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
          {admin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(j.id)}
              aria-label="Eliminar"
              className="text-muted-foreground hover:text-destructive h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Selector de estado responsive que no se solapa nunca */}
      <div className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Estado:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {JOB_STATUSES.map((s) => {
            const isSelected = j.status === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onStatus(j.id, s.value, note)}
                className={`flex items-center justify-center px-2 py-2 rounded-xl text-xs font-semibold border transition-all text-center select-none active:scale-95 ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Input
        placeholder="Nota del estado (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== j.status_note && onStatus(j.id, j.status, note)}
        className="h-10 text-sm bg-background"
      />
    </div>
  );
}
