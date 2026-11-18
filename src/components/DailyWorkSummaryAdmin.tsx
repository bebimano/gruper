import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Calendar,
  Download,
  Eye,
  Clock,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  User,
  Users,
  Sparkles,
  Building,
  Folder,
  FolderOpen,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/gruper-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  downloadDailySummaryPdf,
  downloadClientDailySummaryPdf,
  getSampleDailySummary,
  getSampleClientDailySummary,
  type UserDailySummary,
  type ClientDailySummary,
} from "@/lib/daily-summary-pdf";
import {
  getDailyActivitySummaryServer,
  type DailyActivityResponse,
} from "@/lib/daily-summary.functions";

export function DailyWorkSummaryAdmin() {
  const getDailyFn = useServerFn(getDailyActivitySummaryServer);

  // Fecha seleccionada por defecto: Hoy
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Modo de visualización: "worker" (por trabajador) o "client" (por cliente)
  const [viewMode, setViewMode] = useState<"worker" | "client">("worker");

  // Búsqueda en vivo
  const [search, setSearch] = useState("");

  // Estado de carpetas expandidas (clave: id de carpeta)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [expandedSubFolders, setExpandedSubFolders] = useState<Record<string, boolean>>({});

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const dailyQuery = useQuery({
    queryKey: ["admin-daily-summary", selectedDate],
    queryFn: () => getDailyFn({ data: { date: selectedDate } }),
  });

  const data: DailyActivityResponse | undefined = dailyQuery.data;
  const workers = data?.workers ?? [];
  const clients = data?.clients ?? [];

  // Filtrado por buscador
  const filteredWorkers = useMemo(() => {
    if (!search.trim()) return workers;
    const q = search.toLowerCase();
    return workers.filter((w) => {
      const matchName = w.workerName.toLowerCase().includes(q);
      const matchClients = w.clientsList.some((c) => c.toLowerCase().includes(q));
      const matchReports = w.reports.some(
        (r) =>
          String(r.number).includes(q) ||
          r.cliente.toLowerCase().includes(q) ||
          (r.trabajoEfectuado || "").toLowerCase().includes(q)
      );
      const matchJobs = w.jobs.some(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.cliente.toLowerCase().includes(q) ||
          (j.statusNote || "").toLowerCase().includes(q)
      );
      return matchName || matchClients || matchReports || matchJobs;
    });
  }, [workers, search]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) => {
      const matchName = c.clientName.toLowerCase().includes(q);
      const matchWorkers = c.workersList.some((w) => w.toLowerCase().includes(q));
      const matchReports = c.reports.some(
        (r) =>
          String(r.number).includes(q) ||
          (r.workerName || "").toLowerCase().includes(q) ||
          (r.trabajoEfectuado || "").toLowerCase().includes(q)
      );
      const matchJobs = c.jobs.some(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          (j.workerName || "").toLowerCase().includes(q) ||
          (j.statusNote || "").toLowerCase().includes(q)
      );
      return matchName || matchWorkers || matchReports || matchJobs;
    });
  }, [clients, search]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isFolderExpanded = (id: string) => {
    if (search.trim()) return true;
    return expandedFolders[id] ?? true; // abiertas por defecto
  };

  const toggleSubFolder = (id: string) => {
    setExpandedSubFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const isSubFolderExpanded = (id: string) => {
    if (search.trim()) return true;
    return expandedSubFolders[id] ?? true;
  };

  const expandAll = () => {
    const nextF: Record<string, boolean> = {};
    const nextSub: Record<string, boolean> = {};
    if (viewMode === "worker") {
      filteredWorkers.forEach((w) => {
        nextF[w.workerId] = true;
        w.byClient.forEach((c) => {
          nextSub[`${w.workerId}_${c.clientName}`] = true;
        });
      });
    } else {
      filteredClients.forEach((c) => {
        nextF[c.clientId] = true;
        c.byWorker.forEach((w) => {
          nextSub[`${c.clientId}_${w.workerId}`] = true;
        });
      });
    }
    setExpandedFolders(nextF);
    setExpandedSubFolders(nextSub);
  };

  const collapseAll = () => {
    const nextF: Record<string, boolean> = {};
    const nextSub: Record<string, boolean> = {};
    if (viewMode === "worker") {
      filteredWorkers.forEach((w) => {
        nextF[w.workerId] = false;
        w.byClient.forEach((c) => {
          nextSub[`${w.workerId}_${c.clientName}`] = false;
        });
      });
    } else {
      filteredClients.forEach((c) => {
        nextF[c.clientId] = false;
        c.byWorker.forEach((w) => {
          nextSub[`${c.clientId}_${w.workerId}`] = false;
        });
      });
    }
    setExpandedFolders(nextF);
    setExpandedSubFolders(nextSub);
  };

  const handleDownloadWorkerPdf = async (summary: UserDailySummary) => {
    setDownloadingId(summary.workerId);
    try {
      await downloadDailySummaryPdf(summary);
      toast.success(`PDF de ${summary.workerName} descargado`);
    } catch (e: any) {
      console.error(e);
      toast.error("Error al generar el PDF del técnico");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadClientPdf = async (summary: ClientDailySummary) => {
    setDownloadingId(summary.clientId);
    try {
      await downloadClientDailySummaryPdf(summary);
      toast.success(`PDF del cliente ${summary.clientName} descargado`);
    } catch (e: any) {
      console.error(e);
      toast.error("Error al generar el PDF del cliente");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (viewMode === "worker") {
      if (filteredWorkers.length === 0) {
        toast.info("No hay trabajadores con actividad para esta fecha.");
        return;
      }
      toast.info(`Generando ${filteredWorkers.length} PDFs de técnicos...`);
      for (const w of filteredWorkers) {
        try {
          await downloadDailySummaryPdf(w);
        } catch (err) {
          console.error("Error descargando PDF para", w.workerName, err);
        }
      }
      toast.success("Todos los PDFs de los técnicos han sido descargados");
    } else {
      if (filteredClients.length === 0) {
        toast.info("No hay clientes con actividad para esta fecha.");
        return;
      }
      toast.info(`Generando ${filteredClients.length} PDFs de clientes...`);
      for (const c of filteredClients) {
        try {
          await downloadClientDailySummaryPdf(c);
        } catch (err) {
          console.error("Error descargando PDF para", c.clientName, err);
        }
      }
      toast.success("Todos los PDFs de los clientes han sido descargados");
    }
  };

  const handleDownloadSample = async () => {
    try {
      if (viewMode === "worker") {
        const sample = getSampleDailySummary(selectedDate);
        await downloadDailySummaryPdf(sample);
      } else {
        const sample = getSampleClientDailySummary(selectedDate);
        await downloadClientDailySummaryPdf(sample);
      }
      toast.success("PDF de muestra descargado");
    } catch {
      toast.error("Error al generar el PDF de muestra");
    }
  };

  const setPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const totalItems = viewMode === "worker" ? filteredWorkers.length : filteredClients.length;

  return (
    <div className="space-y-5 mt-4">
      {/* Cabecera con Logotipo Arriba a la Izquierda y Controles */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Logo arriba a la izquierda + Título */}
          <div className="flex items-start sm:items-center gap-3">
            <img
              src={logo.url}
              alt="Gruper"
              width={1076}
              height={343}
              className="h-8 sm:h-9 w-auto object-contain shrink-0"
            />
            <div className="border-l border-border/80 pl-3">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" />
                <span>Trabajos realizados al día</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Organizado en <strong>carpetas por trabajador</strong> y <strong>carpetas por cliente</strong> con PDF diario y hora de cada parte.
              </p>
            </div>
          </div>

          {/* Botón muestra de ejemplo */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadSample}
            className="rounded-xl border-border/80 text-xs gap-1.5 shadow-2xs hover:border-primary/50 self-start sm:self-auto shrink-0"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Ver PDF de ejemplo</span>
          </Button>
        </div>

        {/* Fila 2: Selector de Fecha + Selector de Modo de Carpeta */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-border/60">
          {/* Fecha */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <label className="text-xs font-semibold uppercase text-muted-foreground">Fecha:</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-auto text-sm font-medium rounded-xl bg-background border-border"
            />
            <div className="flex gap-1 ml-1">
              <Button
                type="button"
                variant={selectedDate === todayStr ? "default" : "outline"}
                size="sm"
                onClick={() => setPresetDate(0)}
                className="h-8 rounded-lg text-xs px-2.5"
              >
                Hoy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPresetDate(1)}
                className="h-8 rounded-lg text-xs px-2.5"
              >
                Ayer
              </Button>
            </div>
          </div>

          {/* Selector de modo de Carpetas: Por Trabajador vs Por Cliente */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setViewMode("worker")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === "worker"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-3.5 w-3.5 text-primary" />
                <span>Carpetas por Trabajador</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                  {workers.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("client")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === "client"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building className="h-3.5 w-3.5 text-emerald-600" />
                <span>Carpetas por Cliente</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600">
                  {clients.length}
                </span>
              </button>
            </div>

            {totalItems > 0 && (
              <Button
                type="button"
                onClick={handleDownloadAll}
                size="sm"
                className="rounded-xl font-semibold gap-1.5 shadow-xs active:scale-95 transition-all"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Descargar todos</span> ({totalItems})
              </Button>
            )}
          </div>
        </div>

        {/* Fila 3: Buscador y botones de expandir/colapsar carpetas */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder={
                  viewMode === "worker"
                    ? "Buscar por técnico, cliente o parte…"
                    : "Buscar por cliente, técnico o parte…"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl bg-background border-border"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-muted-foreground">
              <button
                type="button"
                onClick={expandAll}
                className="hover:text-primary transition underline underline-offset-2"
              >
                Expandir carpetas
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={collapseAll}
                className="hover:text-primary transition underline underline-offset-2"
              >
                Colapsar carpetas
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contenido principal según el modo de carpetas */}
      {dailyQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground bg-card/40">
          Cargando actividad diaria…
        </div>
      ) : totalItems === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40 space-y-2">
          <Folder className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground text-sm">
            Sin actividad registrada para el día {selectedDate}
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Ningún usuario o cliente tiene partes creados ni trabajos asignados o realizados en esta fecha.
            Tal como has configurado, no se generará ningún archivo PDF para usuarios o clientes sin actividad.
          </p>
        </div>
      ) : viewMode === "worker" ? (
        /* ================= VISTA: CARPETAS POR TRABAJADOR ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <span>{filteredWorkers.length} {filteredWorkers.length === 1 ? "trabajador con actividad" : "trabajadores con actividad"}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Cada carpeta contiene los clientes atendidos por el técnico
            </span>
          </div>

          {filteredWorkers.map((worker) => {
            const isExpanded = isFolderExpanded(worker.workerId);
            const isDownloading = downloadingId === worker.workerId;

            return (
              <div
                key={worker.workerId}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all"
              >
                {/* Cabecera de la Carpeta del Trabajador */}
                <div
                  onClick={() => toggleFolder(worker.workerId)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                      {isExpanded ? <FolderOpen className="h-6 w-6" /> : <Folder className="h-6 w-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground flex items-center gap-2 flex-wrap">
                        <span>{worker.workerName}</span>
                        <Badge variant="outline" className="text-[11px] font-semibold bg-background">
                          {worker.reports.length} {worker.reports.length === 1 ? "parte" : "partes"} · {worker.jobs.length} {worker.jobs.length === 1 ? "trabajo" : "trabajos"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {worker.byClient.length} {worker.byClient.length === 1 ? "cliente" : "clientes"}
                        </Badge>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Clientes atendidos: <strong className="text-foreground">{worker.clientsList.join(", ") || "Sin especificar"}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isDownloading}
                      onClick={() => handleDownloadWorkerPdf(worker)}
                      className="rounded-xl font-semibold gap-1.5 shadow-2xs active:scale-95 transition-all bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{isDownloading ? "Generando…" : "Descargar PDF"}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => toggleFolder(worker.workerId)}
                      className="rounded-xl h-8 w-8 border-border/80 text-foreground/80"
                      aria-label="Abrir carpeta"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Subcarpetas por Cliente dentro del Trabajador */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-border/60 space-y-4 bg-background/50 animate-in fade-in">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Subcarpetas de clientes atendidos por {worker.workerName}:
                    </p>

                    {worker.byClient.map((clientGroup) => {
                      const subId = `${worker.workerId}_${clientGroup.clientName}`;
                      const isSubOpen = isSubFolderExpanded(subId);

                      return (
                        <div
                          key={subId}
                          className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs"
                        >
                          {/* Cabecera de subcarpeta de cliente */}
                          <div
                            onClick={() => toggleSubFolder(subId)}
                            className="p-3 sm:p-3.5 flex items-center justify-between bg-muted/10 cursor-pointer hover:bg-muted/20 transition select-none"
                          >
                            <div className="flex items-center gap-2.5">
                              <Building className="h-4 w-4 text-emerald-600" />
                              <span className="font-bold text-sm text-foreground">{clientGroup.clientName}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {clientGroup.reports.length} partes · {clientGroup.jobs.length} trabajos
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              {isSubOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {/* Contenido de la subcarpeta: Partes y Trabajos de este cliente */}
                          {isSubOpen && (
                            <div className="p-3 sm:p-4 space-y-3 border-t border-border/60 bg-background/60">
                              {/* 1. Partes del cliente */}
                              {clientGroup.reports.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    <span>Partes de trabajo ({clientGroup.reports.length})</span>
                                  </span>
                                  {clientGroup.reports.map((rep) => (
                                    <div
                                      key={rep.id}
                                      className="rounded-lg border border-border/70 bg-card p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-foreground">Parte Nº {rep.number}</span>
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                            <Clock className="h-3 w-3" /> Creado a las {rep.createdTime}
                                          </span>
                                          <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                                            {rep.tipo === "taller" ? "Taller" : "SAT"}
                                          </span>
                                        </div>
                                        {rep.maquina && (
                                          <p className="text-muted-foreground text-[11px] mt-0.5">
                                            Máquina: <strong className="text-foreground">{rep.maquina}</strong>
                                          </p>
                                        )}
                                        {rep.trabajoEfectuado && (
                                          <p className="text-foreground/80 line-clamp-2 mt-0.5">
                                            {rep.trabajoEfectuado}
                                          </p>
                                        )}
                                      </div>
                                      <div className="shrink-0 text-right">
                                        {rep.closed ? (
                                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                                            <CheckCircle2 className="h-3 w-3" /> Firmado
                                          </span>
                                        ) : (
                                          <span className="text-amber-600 font-semibold text-[11px]">Borrador</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 2. Trabajos del cliente */}
                              {clientGroup.jobs.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-border/40">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    <span>Trabajos y tareas ({clientGroup.jobs.length})</span>
                                  </span>
                                  {clientGroup.jobs.map((job) => (
                                    <div
                                      key={job.id}
                                      className="rounded-lg border border-border/70 bg-card p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-foreground">{job.title}</span>
                                          <Badge variant="outline" className="text-[10px]">
                                            {job.statusLabel}
                                          </Badge>
                                        </div>
                                        <p className="text-muted-foreground text-[11px] mt-0.5">
                                          Hora: {job.updatedTime}
                                        </p>
                                        {job.statusNote && (
                                          <p className="text-foreground/90 font-medium text-[11px] mt-0.5">
                                            Nota: "{job.statusNote}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= VISTA: CARPETAS POR CLIENTE ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-emerald-600" />
              <span>{filteredClients.length} {filteredClients.length === 1 ? "cliente atendido" : "clientes atendidos"}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Cada carpeta contiene los técnicos que trabajaron para ese cliente
            </span>
          </div>

          {filteredClients.map((client) => {
            const isExpanded = isFolderExpanded(client.clientId);
            const isDownloading = downloadingId === client.clientId;

            return (
              <div
                key={client.clientId}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:border-emerald-500/40 transition-all"
              >
                {/* Cabecera de la Carpeta del Cliente */}
                <div
                  onClick={() => toggleFolder(client.clientId)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-inner">
                      <Building className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground flex items-center gap-2 flex-wrap">
                        <span>{client.clientName}</span>
                        <Badge variant="outline" className="text-[11px] font-semibold bg-background">
                          {client.reports.length} {client.reports.length === 1 ? "parte" : "partes"} · {client.jobs.length} {client.jobs.length === 1 ? "trabajo" : "trabajos"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {client.byWorker.length} {client.byWorker.length === 1 ? "técnico" : "técnicos"}
                        </Badge>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Técnicos que intervinieron: <strong className="text-foreground">{client.workersList.join(", ") || "Sin asignar"}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isDownloading}
                      onClick={() => handleDownloadClientPdf(client)}
                      className="rounded-xl font-semibold gap-1.5 shadow-2xs active:scale-95 transition-all bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{isDownloading ? "Generando…" : "Descargar PDF Cliente"}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => toggleFolder(client.clientId)}
                      className="rounded-xl h-8 w-8 border-border/80 text-foreground/80"
                      aria-label="Abrir carpeta"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Subcarpetas por Técnico dentro del Cliente */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-border/60 space-y-4 bg-background/50 animate-in fade-in">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Técnicos que realizaron intervenciones en {client.clientName}:
                    </p>

                    {client.byWorker.map((workerGroup) => {
                      const subId = `${client.clientId}_${workerGroup.workerId}`;
                      const isSubOpen = isSubFolderExpanded(subId);

                      return (
                        <div
                          key={subId}
                          className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs"
                        >
                          <div
                            onClick={() => toggleSubFolder(subId)}
                            className="p-3 sm:p-3.5 flex items-center justify-between bg-muted/10 cursor-pointer hover:bg-muted/20 transition select-none"
                          >
                            <div className="flex items-center gap-2.5">
                              <User className="h-4 w-4 text-primary" />
                              <span className="font-bold text-sm text-foreground">{workerGroup.workerName}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {workerGroup.reports.length} partes · {workerGroup.jobs.length} trabajos
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              {isSubOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {isSubOpen && (
                            <div className="p-3 sm:p-4 space-y-3 border-t border-border/60 bg-background/60">
                              {workerGroup.reports.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    <span>Partes creados ({workerGroup.reports.length})</span>
                                  </span>
                                  {workerGroup.reports.map((rep) => (
                                    <div
                                      key={rep.id}
                                      className="rounded-lg border border-border/70 bg-card p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-foreground">Parte Nº {rep.number}</span>
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                            <Clock className="h-3 w-3" /> Creado a las {rep.createdTime}
                                          </span>
                                        </div>
                                        {rep.maquina && (
                                          <p className="text-muted-foreground text-[11px] mt-0.5">
                                            Máquina: <strong className="text-foreground">{rep.maquina}</strong>
                                          </p>
                                        )}
                                        {rep.trabajoEfectuado && (
                                          <p className="text-foreground/80 line-clamp-2 mt-0.5">
                                            {rep.trabajoEfectuado}
                                          </p>
                                        )}
                                      </div>
                                      <div className="shrink-0 text-right">
                                        {rep.closed ? (
                                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                                            <CheckCircle2 className="h-3 w-3" /> Firmado
                                          </span>
                                        ) : (
                                          <span className="text-amber-600 font-semibold text-[11px]">Borrador</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {workerGroup.jobs.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-border/40">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    <span>Trabajos realizados ({workerGroup.jobs.length})</span>
                                  </span>
                                  {workerGroup.jobs.map((job) => (
                                    <div
                                      key={job.id}
                                      className="rounded-lg border border-border/70 bg-card p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-foreground">{job.title}</span>
                                          <Badge variant="outline" className="text-[10px]">
                                            {job.statusLabel}
                                          </Badge>
                                        </div>
                                        <p className="text-muted-foreground text-[11px] mt-0.5">
                                          Hora: {job.updatedTime}
                                        </p>
                                        {job.statusNote && (
                                          <p className="text-foreground/90 font-medium text-[11px] mt-0.5">
                                            Nota: "{job.statusNote}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
