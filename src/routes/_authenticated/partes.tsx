import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  FileText,
  ChevronRight,
  Folder,
  FolderOpen,
  Search,
  X,
  ChevronDown,
  User,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { normalizeReport } from "@/lib/work-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/partes")({
  head: () => ({
    meta: [
      { title: "Partes de trabajo — Gruper Remote" },
      { name: "description", content: "Rellena y consulta tus partes de trabajo del servicio técnico." },
      { property: "og:title", content: "Partes de trabajo — Gruper Remote" },
      { property: "og:description", content: "Rellena y consulta tus partes de trabajo del servicio técnico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Partes,
});

type RawReport = {
  id: string;
  number: number;
  user_number: number | null;
  data: any;
  created_at: string;
  user_id: string;
  closed: boolean | null;
};

interface WorkerSubGroup {
  workerId: string;
  workerName: string;
  items: RawReport[];
}

interface ClientGroup {
  client: string;
  items: RawReport[];
  byWorker: WorkerSubGroup[];
}

interface WorkerGroup {
  workerId: string;
  workerName: string;
  items: RawReport[];
  byClient: { client: string; items: RawReport[] }[];
}

function Partes() {
  const me = useMe();
  const [search, setSearch] = useState("");
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"client" | "worker">("client");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const canViewAll = !!(me.data?.isAdmin || me.data?.canViewAllReports);

  const reports = useQuery({
    queryKey: ["work-reports", me.data?.id, canViewAll],
    enabled: !!me.data?.canReports,
    queryFn: async () => {
      let q = supabase
        .from("work_reports")
        .select("id, number, user_number, data, created_at, user_id, closed")
        .order("created_at", { ascending: false });

      if (!canViewAll && me.data?.id) {
        q = q.eq("user_id", me.data.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RawReport[];
    },
  });

  const names = useQuery({
    queryKey: ["profile-names"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, username");
      return new Map((data ?? []).map((p) => [p.id, p.username]));
    },
  });

  const getWorkerName = (userId: string) => {
    return (
      names.data?.get(userId) ??
      (userId === me.data?.id ? me.data?.username ?? "" : "Compañero")
    );
  };

  const toggleFolder = (key: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Distinct list of workers for filtering
  const availableWorkers = useMemo(() => {
    const list = reports.data ?? [];
    const set = new Map<string, string>();
    for (const r of list) {
      if (!set.has(r.user_id)) {
        set.set(r.user_id, getWorkerName(r.user_id));
      }
    }
    return Array.from(set.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es-ES"));
  }, [reports.data, names.data, me.data]);

  // Filtered raw reports
  const filteredReports = useMemo(() => {
    const rawList = reports.data ?? [];
    const term = search.trim().toLowerCase();

    return rawList.filter((r) => {
      const d = normalizeReport(r.data);
      const clientName = (d.cliente || "").trim() || "Sin cliente";
      const displayNum = String(r.user_number ?? r.number);
      const workerName = getWorkerName(r.user_id).toLowerCase();

      // Worker pill filter
      if (selectedWorkerFilter !== "all" && r.user_id !== selectedWorkerFilter) {
        return false;
      }

      // Text search
      if (term) {
        const matchesClient = clientName.toLowerCase().includes(term);
        const matchesNum = displayNum.toLowerCase().includes(term) || `parte ${displayNum}`.includes(term);
        const matchesWorker = workerName.includes(term);
        const matchesTecnico = (d.tecnico || "").toLowerCase().includes(term);
        if (!matchesClient && !matchesNum && !matchesWorker && !matchesTecnico) {
          return false;
        }
      }

      return true;
    });
  }, [reports.data, search, selectedWorkerFilter, names.data, me.data]);

  // Group by client -> inside grouped by worker
  const clientGroups = useMemo<ClientGroup[]>(() => {
    const clientMap = new Map<string, RawReport[]>();

    for (const r of filteredReports) {
      const d = normalizeReport(r.data);
      const clientName = (d.cliente || "").trim() || "Sin cliente";
      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, []);
      }
      clientMap.get(clientName)!.push(r);
    }

    return Array.from(clientMap.entries())
      .map(([client, items]) => {
        // Group items within client by worker
        const workerMap = new Map<string, RawReport[]>();
        for (const item of items) {
          if (!workerMap.has(item.user_id)) {
            workerMap.set(item.user_id, []);
          }
          workerMap.get(item.user_id)!.push(item);
        }

        const byWorker: WorkerSubGroup[] = Array.from(workerMap.entries())
          .map(([workerId, wItems]) => ({
            workerId,
            workerName: getWorkerName(workerId),
            items: wItems,
          }))
          .sort((a, b) => a.workerName.localeCompare(b.workerName, "es-ES"));

        return { client, items, byWorker };
      })
      .sort((a, b) => a.client.localeCompare(b.client, "es-ES"));
  }, [filteredReports, names.data, me.data]);

  // Group by worker -> inside grouped by client
  const workerGroups = useMemo<WorkerGroup[]>(() => {
    const workerMap = new Map<string, RawReport[]>();

    for (const r of filteredReports) {
      if (!workerMap.has(r.user_id)) {
        workerMap.set(r.user_id, []);
      }
      workerMap.get(r.user_id)!.push(r);
    }

    return Array.from(workerMap.entries())
      .map(([workerId, items]) => {
        const clientMap = new Map<string, RawReport[]>();
        for (const item of items) {
          const d = normalizeReport(item.data);
          const cName = (d.cliente || "").trim() || "Sin cliente";
          if (!clientMap.has(cName)) {
            clientMap.set(cName, []);
          }
          clientMap.get(cName)!.push(item);
        }

        const byClient = Array.from(clientMap.entries())
          .map(([client, cItems]) => ({ client, items: cItems }))
          .sort((a, b) => a.client.localeCompare(b.client, "es-ES"));

        return {
          workerId,
          workerName: getWorkerName(workerId),
          items,
          byClient,
        };
      })
      .sort((a, b) => a.workerName.localeCompare(b.workerName, "es-ES"));
  }, [filteredReports, names.data, me.data]);

  const totalReportsCount = useMemo(() => {
    return (reports.data ?? []).length;
  }, [reports.data]);

  if (me.isLoading) return null;
  if (!me.data?.canReports) {
    return <p className="p-8 text-center text-muted-foreground">No tienes acceso a partes de trabajo.</p>;
  }

  const renderReportCard = (r: RawReport, authorName: string) => {
    const d = normalizeReport(r.data);
    const displayNum = r.user_number ?? r.number;

    return (
      <Link
        key={r.id}
        to="/parte/$id"
        params={{ id: r.id }}
        className="group flex items-center gap-3.5 p-3 rounded-xl border border-border bg-card shadow-xs hover:border-primary/50 hover:bg-muted/50 transition-all"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <FileText className="h-4 w-4" />
        </div>

        <span className="flex-1 min-w-0">
          <span className="block font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
            Parte Nº {displayNum}
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5 truncate">
            {new Date(r.created_at).toLocaleDateString("es-ES")}
            {" · "}
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <User className="h-3 w-3 inline" /> {authorName}
            </span>
            {d.tecnico && d.tecnico !== authorName && ` · Tec: ${d.tecnico}`}
          </span>
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {r.closed && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
              Cerrado
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </Link>
    );
  };

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-16">
      <header className="flex items-center justify-between py-3">
        <Link
          to="/maquinas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Button asChild size="sm">
          <Link to="/parte/$id" params={{ id: "nuevo" }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo parte
          </Link>
        </Button>
      </header>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Partes de trabajo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canViewAll ? "Viendo partes de todos los clientes y compañeros" : "Tus partes de trabajo"}
            {totalReportsCount > 0 && ` (${totalReportsCount} en total)`}
          </p>
        </div>

        {/* Modo de agrupación: Por Cliente o Por Trabajador */}
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
            <Folder className="h-3.5 w-3.5" />
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
            <Users className="h-3.5 w-3.5" />
            Por Trabajador
          </button>
        </div>
      </div>

      {/* Buscador rápido */}
      <div className="mt-5 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, número de parte o técnico..."
          className="pl-9 pr-9 h-11 rounded-xl bg-card border-border shadow-sm text-sm"
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

      {/* Filtro rápido por trabajador (pills) si hay más de 1 trabajador */}
      {availableWorkers.length > 1 && (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-medium text-muted-foreground shrink-0 flex items-center gap-1">
            <User className="h-3.5 w-3.5" /> Filtrar:
          </span>
          <button
            type="button"
            onClick={() => setSelectedWorkerFilter("all")}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all shrink-0 ${
              selectedWorkerFilter === "all"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {availableWorkers.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedWorkerFilter(w.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all shrink-0 ${
                selectedWorkerFilter === w.id
                  ? "bg-primary text-primary-foreground border-primary font-medium"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      {reports.data?.length === 0 && (
        <p className="mt-8 rounded-xl border border-border p-8 text-center text-sm text-muted-foreground bg-card">
          Aún no hay partes. Pulsa en <strong>Nuevo parte</strong> para crear el primero.
        </p>
      )}

      {reports.data && reports.data.length > 0 && filteredReports.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No se encontraron partes con los filtros aplicados.
        </div>
      )}

      {/* VISTA 1: AGRUPADO POR CLIENTE (con sub-agrupación por trabajador dentro de cada cliente) */}
      {viewMode === "client" && (
        <div className="mt-6 space-y-4">
          {clientGroups.map((g) => {
            const isCollapsed = search.trim().length > 0 ? false : !!collapsedFolders[`c_${g.client}`];

            return (
              <div
                key={g.client}
                className="rounded-2xl border border-border bg-card/60 backdrop-blur shadow-sm overflow-hidden transition-all"
              >
                {/* Encabezado Carpeta Cliente */}
                <button
                  type="button"
                  onClick={() => toggleFolder(`c_${g.client}`)}
                  className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {isCollapsed ? <Folder className="h-5 w-5" /> : <FolderOpen className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-base truncate text-foreground">{g.client}</span>
                      <span className="block text-xs text-muted-foreground">
                        {g.items.length} {g.items.length === 1 ? "parte guardado" : "partes guardados"} ·{" "}
                        {g.byWorker.length}{" "}
                        {g.byWorker.length === 1 ? "trabajador" : "trabajadores distintos"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground ml-3">
                    <span className="text-xs font-medium bg-background border border-border px-2.5 py-1 rounded-full">
                      {g.items.length}
                    </span>
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Sub-agrupado por trabajador dentro del cliente */}
                {!isCollapsed && (
                  <div className="p-4 border-t border-border/60 bg-background/50 space-y-4">
                    {g.byWorker.map((w) => (
                      <div key={w.workerId} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                          <User className="h-3.5 w-3.5 text-primary" />
                          <span className="text-foreground/90 font-medium">{w.workerName}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal border border-border/60 normal-case">
                            {w.items.length} {w.items.length === 1 ? "parte" : "partes"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {w.items.map((r) => renderReportCard(r, w.workerName))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VISTA 2: AGRUPADO POR TRABAJADOR (con sub-agrupación por cliente dentro de cada trabajador) */}
      {viewMode === "worker" && (
        <div className="mt-6 space-y-4">
          {workerGroups.map((wg) => {
            const isCollapsed = search.trim().length > 0 ? false : !!collapsedFolders[`w_${wg.workerId}`];

            return (
              <div
                key={wg.workerId}
                className="rounded-2xl border border-border bg-card/60 backdrop-blur shadow-sm overflow-hidden transition-all"
              >
                {/* Encabezado Carpeta Trabajador */}
                <button
                  type="button"
                  onClick={() => toggleFolder(`w_${wg.workerId}`)}
                  className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {isCollapsed ? <Folder className="h-5 w-5" /> : <FolderOpen className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-base truncate text-foreground flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        {wg.workerName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {wg.items.length} {wg.items.length === 1 ? "parte" : "partes"} en {wg.byClient.length}{" "}
                        {wg.byClient.length === 1 ? "cliente" : "clientes"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground ml-3">
                    <span className="text-xs font-medium bg-background border border-border px-2.5 py-1 rounded-full">
                      {wg.items.length}
                    </span>
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Sub-agrupado por cliente dentro del trabajador */}
                {!isCollapsed && (
                  <div className="p-4 border-t border-border/60 bg-background/50 space-y-4">
                    {wg.byClient.map((cg) => (
                      <div key={cg.client} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                          <Folder className="h-3.5 w-3.5 text-primary" />
                          <span className="text-foreground/90 font-medium">{cg.client}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal border border-border/60 normal-case">
                            {cg.items.length} {cg.items.length === 1 ? "parte" : "partes"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {cg.items.map((r) => renderReportCard(r, wg.workerName))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
