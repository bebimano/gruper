import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Plus,
  Trash2,
  Wrench,
  Folder,
  FolderOpen,
  Users,
  User,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  PlayCircle,
  PauseCircle,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { JOB_STATUSES, statusInfo } from "@/lib/jobs";
import { notifyEvent } from "@/lib/notify.functions";
import {
  getJobsListServer,
  createJobServer,
  deleteJobServer,
} from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/trabajos")({
  head: () => ({
    meta: [
      { title: "Trabajos — Gruper Remote" },
      { name: "description", content: "Trabajos organizados por carpetas de cliente y técnico." },
      { property: "og:title", content: "Trabajos — Gruper Remote" },
      { property: "og:description", content: "Trabajos asignados y su estado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trabajos,
});

type Job = {
  id: string;
  title: string;
  client: string;
  description: string;
  status: string;
  status_note: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

type FolderGroup = {
  id: string;
  name: string;
  iconType: "client" | "worker";
  items: Job[];
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
};

function Trabajos() {
  const me = useMe();
  const qc = useQueryClient();
  const notify = useServerFn(notifyEvent);
  const getJobsFn = useServerFn(getJobsListServer);
  const createJobFn = useServerFn(createJobServer);
  const deleteJobFn = useServerFn(deleteJobServer);

  const isAdmin = !!me.data?.isAdmin;
  const canCreate = isAdmin || !!me.data?.canCreateJobs;

  // Lista de usuarios/técnicos para asignar trabajos
  const users = useQuery({
    queryKey: ["profile-list"],
    queryFn: async () => (await supabase.from("profiles").select("id, username").order("username")).data ?? [],
  });

  // Lista de trabajos con función de servidor para sortear RLS si es creador
  const jobs = useQuery({
    queryKey: ["jobs", me.data?.id],
    enabled: !!me.data,
    queryFn: async () => {
      try {
        const res = await getJobsFn();
        return (res ?? []) as Job[];
      } catch {
        const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as Job[];
      }
    },
  });

  const [form, setForm] = useState({ title: "", client: "", description: "", assigned_to: "" });
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Estados de vista, búsqueda y carpetas
  const [viewMode, setViewMode] = useState<"client" | "worker">("client");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const refresh = () => qc.invalidateQueries({ queryKey: ["jobs"] });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await createJobFn({
        data: {
          title: form.title.trim(),
          client: form.client.trim(),
          description: form.description.trim(),
          assigned_to: form.assigned_to || null,
        },
      });

      setForm({ title: "", client: "", description: "", assigned_to: "" });
      setShowCreateModal(false);
      toast.success("Trabajo creado correctamente");
      refresh();
      notify({ data: { event: "new_job", id: res.id } }).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || "Error al crear trabajo");
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: string, note: string) {
    const { error } = await supabase.rpc("set_job_status", { _id: id, _status: status, _note: note });
    if (error) {
      // Intento directo si RPC falla
      const { error: err2 } = await supabase.from("jobs").update({ status, status_note: note, updated_at: new Date().toISOString() }).eq("id", id);
      if (err2) {
        toast.error(err2.message);
        return;
      }
    }
    toast.success("Estado actualizado");
    refresh();
    notify({ data: { event: "job_status", id } }).catch(() => {});
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este trabajo?")) return;
    try {
      await deleteJobFn({ data: { id } });
      toast.success("Trabajo eliminado");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar");
    }
  }

  const getWorkerName = (id: string | null) =>
    users.data?.find((u) => u.id === id)?.username ?? (id ? "Usuario" : "Sin asignar");

  const allJobs = jobs.data ?? [];
  const regularJobs = allJobs.filter((j) => !j.title?.startsWith("[AVERÍA]"));
  const averiaJobs = allJobs.filter((j) => j.title?.startsWith("[AVERÍA]"));

  // Filtrado por buscador y estado
  const filteredJobs = useMemo(() => {
    return regularJobs.filter((j) => {
      // Filtro de estado
      if (statusFilter !== "all" && j.status !== statusFilter) return false;

      // Filtro de búsqueda
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const worker = getWorkerName(j.assigned_to).toLowerCase();
      const client = (j.client || "").toLowerCase();
      const title = (j.title || "").toLowerCase();
      const desc = (j.description || "").toLowerCase();
      const note = (j.status_note || "").toLowerCase();

      return (
        title.includes(q) ||
        client.includes(q) ||
        worker.includes(q) ||
        desc.includes(q) ||
        note.includes(q)
      );
    });
  }, [regularJobs, search, statusFilter, users.data]);

  // Agrupación por carpetas de Cliente
  const clientFolders = useMemo<FolderGroup[]>(() => {
    const map = new Map<string, Job[]>();

    for (const j of filteredJobs) {
      const c = (j.client || "").trim() || "Sin cliente";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(j);
    }

    return Array.from(map.entries())
      .map(([clientName, items]) => {
        const pendingCount = items.filter((x) => x.status === "pendiente").length;
        const inProgressCount = items.filter((x) => x.status === "en_curso").length;
        const completedCount = items.filter((x) => x.status === "terminado").length;
        return {
          id: `client-${clientName}`,
          name: clientName,
          iconType: "client" as const,
          items,
          pendingCount,
          inProgressCount,
          completedCount,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es-ES"));
  }, [filteredJobs]);

  // Agrupación por carpetas de Usuario / Técnico
  const workerFolders = useMemo<FolderGroup[]>(() => {
    const map = new Map<string, { name: string; items: Job[] }>();

    for (const j of filteredJobs) {
      const wId = j.assigned_to || "unassigned";
      const wName = getWorkerName(j.assigned_to);

      if (!map.has(wId)) {
        map.set(wId, { name: wName, items: [] });
      }
      map.get(wId)!.items.push(j);
    }

    return Array.from(map.entries())
      .map(([id, data]) => {
        const pendingCount = data.items.filter((x) => x.status === "pendiente").length;
        const inProgressCount = data.items.filter((x) => x.status === "en_curso").length;
        const completedCount = data.items.filter((x) => x.status === "terminado").length;
        return {
          id: `worker-${id}`,
          name: data.name,
          iconType: "worker" as const,
          items: data.items,
          pendingCount,
          inProgressCount,
          completedCount,
        };
      })
      .sort((a, b) => {
        if (a.name === "Sin asignar") return 1;
        if (b.name === "Sin asignar") return -1;
        return a.name.localeCompare(b.name, "es-ES");
      });
  }, [filteredJobs, users.data]);

  const activeFolders = viewMode === "client" ? clientFolders : workerFolders;

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: prev[folderId] === undefined ? false : !prev[folderId],
    }));
  };

  const isFolderExpanded = (folderId: string) => {
    // Si hay búsqueda activa, expandir automáticamente para ver los resultados
    if (search.trim()) return true;
    return expandedFolders[folderId] ?? true; // Abiertas por defecto
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    activeFolders.forEach((f) => {
      next[f.id] = true;
    });
    setExpandedFolders(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    activeFolders.forEach((f) => {
      next[f.id] = false;
    });
    setExpandedFolders(next);
  };

  // Contadores generales
  const totalPending = regularJobs.filter((j) => j.status === "pendiente").length;
  const totalInProgress = regularJobs.filter((j) => j.status === "en_curso").length;
  const totalCompleted = regularJobs.filter((j) => j.status === "terminado").length;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-16">
      <header className="py-3 flex items-center justify-between">
        <Link
          to="/maquinas"
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-foreground/90 shadow-2xs transition-all hover:bg-muted hover:border-primary/50 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Volver a máquinas</span>
          <span className="sm:hidden">Máquinas</span>
        </Link>

        <div className="flex items-center gap-2">
          <SettingsDropdown />
          {canCreate && (
            <Button
              onClick={() => setShowCreateModal((v) => !v)}
              size="sm"
              className="rounded-xl shadow-xs font-semibold active:scale-95 transition-all gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>{showCreateModal ? "Ocultar formulario" : "Crear trabajo"}</span>
            </Button>
          )}
        </div>
      </header>

      {/* Banner de Averías pendientes de clientes */}
      {averiaJobs.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-base text-foreground">
                {averiaJobs.length} {averiaJobs.length === 1 ? "aviso de avería pendiente" : "avisos de averías pendientes"} de clientes
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Las averías reportadas por clientes con fotos y seguimiento se gestionan en su sección dedicada.
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

      {/* Título y selector de modo de carpetas */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trabajos</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organizados por carpetas de cliente y técnico asignado ({regularJobs.length} trabajos)
          </p>
        </div>

        {/* Toggle de agrupación: Por Cliente o Por Trabajador */}
        <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-xl self-start sm:self-auto border border-border">
          <button
            type="button"
            onClick={() => setViewMode("client")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === "client"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Folder className="h-3.5 w-3.5 text-primary" />
            Por Cliente
          </button>
          <button
            type="button"
            onClick={() => setViewMode("worker")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === "worker"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            Por Técnico
          </button>
        </div>
      </div>

      {/* Formulario de creación de trabajo para usuarios autorizados */}
      {canCreate && showCreateModal && (
        <form
          onSubmit={create}
          className="mt-5 rounded-2xl border-2 border-primary/40 bg-card p-4 sm:p-5 space-y-3.5 shadow-md animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plus className="h-4 w-4" />
              </div>
              <h2 className="font-bold text-foreground text-sm uppercase tracking-wide">
                Crear nuevo trabajo y asignar
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Título</label>
              <Input
                placeholder="Ej. Montar Baterias Sai, Revisión caldera…"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Cliente</label>
              <Input
                placeholder="Nombre del cliente o empresa…"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Descripción</label>
            <Textarea
              placeholder="Detalles de la tarea a realizar…"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
            <div className="flex-1 max-w-sm">
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Asignar trabajo a:</label>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              >
                <option value="">(Sin asignar - visible para el equipo)</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="rounded-xl font-semibold shadow-xs active:scale-95 transition-all gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>{creating ? "Guardando…" : "Crear trabajo"}</span>
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Buscador y filtros */}
      <div className="mt-5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar trabajos por título, cliente, técnico o notas…"
            className="pl-9 pr-9 h-11 rounded-xl bg-card border-border shadow-xs text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtros rápidos de estado y botones de colapsar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({regularJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pendiente")}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                statusFilter === "pendiente"
                  ? "bg-amber-500 text-white border-amber-500 font-semibold shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Pendientes ({totalPending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("en_curso")}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                statusFilter === "en_curso"
                  ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              En curso ({totalInProgress})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("terminado")}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                statusFilter === "terminado"
                  ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Terminados ({totalCompleted})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              Expandir todo
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              Colapsar todo
            </button>
          </div>
        </div>
      </div>

      {/* Estado vacío si no hay trabajos */}
      {filteredJobs.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center bg-card/40">
          <Briefcase className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
          <p className="font-semibold text-foreground text-sm">No hay trabajos que coincidan con la búsqueda.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || statusFilter !== "all"
              ? "Prueba a cambiar los filtros o el término de búsqueda."
              : "Crea el primer trabajo con el botón superior."}
          </p>
        </div>
      )}

      {/* Carpetas de Trabajos (Agrupadas por Cliente o Técnico) */}
      <div className="mt-6 space-y-4">
        {activeFolders.map((folder) => {
          const isExpanded = isFolderExpanded(folder.id);

          return (
            <div
              key={folder.id}
              className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs transition-all hover:border-primary/40"
            >
              {/* Cabecera de la Carpeta */}
              <button
                type="button"
                onClick={() => toggleFolder(folder.id)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-muted/20 hover:bg-muted/40 transition-colors select-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                    {isExpanded ? (
                      <FolderOpen className="h-5 w-5" />
                    ) : folder.iconType === "worker" ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Folder className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-foreground truncate">{folder.name}</h3>
                      <Badge variant="outline" className="text-xs font-semibold bg-background">
                        {folder.items.length} {folder.items.length === 1 ? "trabajo" : "trabajos"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {folder.pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="h-3 w-3" /> {folder.pendingCount} pend.
                        </span>
                      )}
                      {folder.inProgressCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                          <PlayCircle className="h-3 w-3" /> {folder.inProgressCount} en curso
                        </span>
                      )}
                      {folder.completedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> {folder.completedCount} term.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                  <span className="text-xs font-medium hidden sm:inline">
                    {isExpanded ? "Ocultar" : "Ver carpeta"}
                  </span>
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </button>

              {/* Contenido de la Carpeta (Grid de Trabajos) */}
              {isExpanded && (
                <div className="p-4 sm:p-5 pt-2 border-t border-border/60 bg-background/50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {folder.items.map((j) => (
                      <JobCard
                        key={j.id}
                        j={j}
                        canManage={canCreate}
                        who={getWorkerName(j.assigned_to)}
                        onStatus={setStatus}
                        onDelete={remove}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function JobCard({
  j,
  canManage,
  who,
  onStatus,
  onDelete,
}: {
  j: Job;
  canManage: boolean;
  who: string;
  onStatus: (id: string, s: string, n: string) => void;
  onDelete: (id: string) => void;
}) {
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
    <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3.5 shadow-xs transition-all hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wrench className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-foreground break-words">{j.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">
              {[
                j.client ? `Cliente: ${j.client}` : null,
                `Técnico: ${who}`,
                new Date(j.updated_at || j.created_at).toLocaleString("es-ES", {
                  dateStyle: "short",
                  timeStyle: "short",
                }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {cleanDescription && (
              <p className="mt-2.5 text-sm text-foreground/90 whitespace-pre-wrap break-words rounded-xl bg-muted/40 p-3 border border-border/60">
                {cleanDescription}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(j.id)}
              aria-label="Eliminar"
              className="text-muted-foreground hover:text-destructive h-8 w-8 rounded-xl"
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
        className="h-10 text-sm bg-background rounded-xl"
      />
    </div>
  );
}
