import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Wrench } from "lucide-react";
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

  return (
    <main className="min-h-screen px-5 safe-top safe-bottom max-w-2xl mx-auto pb-10">
      <header className="py-3">
        <Link to="/maquinas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</Link>
      </header>
      <h1 className="mt-4 text-2xl font-bold">Trabajos</h1>

      {isAdmin && (
        <form onSubmit={create} className="mt-5 rounded-xl border border-border bg-background p-4 space-y-3">
          <h2 className="font-medium">Nuevo trabajo</h2>
          <Input placeholder="Título del trabajo" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input placeholder="Cliente" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          <Textarea placeholder="Descripción" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
            <option value="">Asignar a…</option>
            {users.data?.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
          <Button type="submit"><Plus /> Crear trabajo</Button>
        </form>
      )}

      {jobs.data?.length === 0 && <p className="mt-6 rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">No hay trabajos.</p>}
      <div className="mt-6 space-y-3">
        {jobs.data?.map((j) => <JobCard key={j.id} j={j} admin={isAdmin} who={name(j.assigned_to)} onStatus={setStatus} onDelete={remove} />)}
      </div>
    </main>
  );
}

type Job = { id: string; title: string; client: string; description: string; status: string; status_note: string; assigned_to: string | null; updated_at: string };
function JobCard({ j, admin, who, onStatus, onDelete }: { j: Job; admin: boolean; who: string; onStatus: (id: string, s: string, n: string) => void; onDelete: (id: string) => void }) {
  const [note, setNote] = useState(j.status_note);
  const st = statusInfo(j.status);
  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Wrench className="mt-0.5 h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">{j.title}</p>
          <p className="text-xs text-muted-foreground">{[j.client, admin ? who : null, new Date(j.updated_at).toLocaleString("es-ES")].filter(Boolean).join(" · ")}</p>
          {j.description && <p className="mt-2 text-sm whitespace-pre-wrap">{j.description}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
        {admin && <Button variant="ghost" size="icon" onClick={() => onDelete(j.id)} aria-label="Eliminar"><Trash2 /></Button>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {JOB_STATUSES.map((s) => (
          <Button key={s.value} type="button" size="sm" variant={j.status === s.value ? "default" : "outline"} onClick={() => onStatus(j.id, s.value, note)}>{s.label}</Button>
        ))}
      </div>
      <Input placeholder="Nota del estado (opcional)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== j.status_note && onStatus(j.id, j.status, note)} />
    </div>
  );
}
