import { useState } from "react";
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
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  downloadDailySummaryPdf,
  getSampleDailySummary,
  type UserDailySummary,
} from "@/lib/daily-summary-pdf";
import { getDailyActivitySummaryServer } from "@/lib/daily-summary.functions";

export function DailyWorkSummaryAdmin() {
  const getDailyFn = useServerFn(getDailyActivitySummaryServer);

  // Fecha seleccionada por defecto: Hoy
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [expandedWorkers, setExpandedWorkers] = useState<Record<string, boolean>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const dailyQuery = useQuery({
    queryKey: ["admin-daily-summary", selectedDate],
    queryFn: () => getDailyFn({ data: { date: selectedDate } }),
  });

  const activeWorkers = dailyQuery.data ?? [];

  const handleDownloadWorkerPdf = async (summary: UserDailySummary) => {
    setDownloadingId(summary.workerId);
    try {
      await downloadDailySummaryPdf(summary);
      toast.success(`PDF de ${summary.workerName} descargado`);
    } catch (e: any) {
      console.error(e);
      toast.error("Error al generar el PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (activeWorkers.length === 0) {
      toast.info("No hay trabajadores con actividad para esta fecha.");
      return;
    }

    toast.info(`Generando ${activeWorkers.length} documentos PDF...`);
    for (const w of activeWorkers) {
      try {
        await downloadDailySummaryPdf(w);
      } catch (err) {
        console.error("Error descargando PDF para", w.workerName, err);
      }
    }
    toast.success("Todos los PDFs diarios se han descargado correctamente");
  };

  const handleDownloadSample = async () => {
    try {
      const sample = getSampleDailySummary(selectedDate);
      await downloadDailySummaryPdf(sample);
      toast.success("PDF de demostración descargado");
    } catch {
      toast.error("Error al generar el PDF de muestra");
    }
  };

  const toggleWorker = (id: string) => {
    setExpandedWorkers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const setPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-5 mt-4">
      {/* Cabecera y controles de fecha */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
              <FileText className="h-5 w-5 text-primary" />
              <span>Trabajos realizados al día (PDF por usuario)</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Genera automáticamente al final del día un documento PDF individual por cada técnico con sus partes creados (con hora exacta) y trabajos realizados.
            </p>
          </div>

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

        {/* Selector de fecha y accesos rápidos */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2">
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

          {activeWorkers.length > 0 && (
            <Button
              type="button"
              onClick={handleDownloadAll}
              size="sm"
              className="rounded-xl font-semibold gap-1.5 shadow-xs self-start sm:self-auto active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Descargar todos los PDFs ({activeWorkers.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Lista de técnicos con actividad */}
      {dailyQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground bg-card/40">
          Cargando actividad de los técnicos para la fecha seleccionada…
        </div>
      ) : activeWorkers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40 space-y-2">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground text-sm">
            Sin actividad registrada para el día {selectedDate}
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Ningún usuario ha generado partes ni ha tenido trabajos asignados o realizados en esta fecha. Tal como has configurado, no se generará ningún PDF para usuarios sin actividad.
          </p>
          <div className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSample}
              className="rounded-xl text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Descargar PDF de muestra con datos de prueba</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              {activeWorkers.length} {activeWorkers.length === 1 ? "técnico con actividad" : "técnicos con actividad en el día"}
            </span>
            <span className="text-xs text-muted-foreground">
              Solo se muestran usuarios con partes o trabajos realizados
            </span>
          </div>

          {activeWorkers.map((worker) => {
            const isExpanded = !!expandedWorkers[worker.workerId];
            const isDownloading = downloadingId === worker.workerId;

            return (
              <div
                key={worker.workerId}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all"
              >
                {/* Cabecera del técnico */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/15">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                        <span>{worker.workerName}</span>
                        <Badge variant="outline" className="text-[11px] font-semibold bg-background">
                          {worker.reports.length} {worker.reports.length === 1 ? "parte" : "partes"} · {worker.jobs.length} {worker.jobs.length === 1 ? "trabajo" : "trabajos"}
                        </Badge>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {worker.clientsList.length > 0 ? (
                          <span>
                            Clientes: <strong className="text-foreground">{worker.clientsList.join(", ")}</strong>
                          </span>
                        ) : (
                          "Sin clientes específicos asignados"
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleWorker(worker.workerId)}
                      className="rounded-xl text-xs gap-1 border-border/80"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{isExpanded ? "Ocultar" : "Ver detalle"}</span>
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 ml-0.5" /> : <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
                    </Button>

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
                  </div>
                </div>

                {/* Detalle desplegable de partes y trabajos */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-border/60 space-y-4 bg-background/50 animate-in fade-in">
                    {/* 1. Partes de trabajo */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Partes creados en el día ({worker.reports.length})</span>
                      </h4>

                      {worker.reports.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No creó ningún parte en esta fecha.</p>
                      ) : (
                        <div className="space-y-2">
                          {worker.reports.map((rep) => (
                            <div
                              key={rep.id}
                              className="rounded-xl border border-border/70 bg-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-foreground">Parte Nº {rep.number}</span>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    <Clock className="h-3 w-3" /> Creado a las {rep.createdTime}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground uppercase font-medium">
                                    {rep.tipo === "taller" ? "Taller" : "SAT"}
                                  </span>
                                </div>
                                <p className="text-muted-foreground">
                                  Cliente: <strong className="text-foreground">{rep.cliente}</strong>
                                  {rep.maquina && ` · Máquina: ${rep.maquina}`}
                                </p>
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
                    </div>

                    {/* 2. Trabajos y tareas */}
                    <div className="pt-2 border-t border-border/60">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>Trabajos y tareas ({worker.jobs.length})</span>
                      </h4>

                      {worker.jobs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No tuvo trabajos asignados o actualizados en esta fecha.</p>
                      ) : (
                        <div className="space-y-2">
                          {worker.jobs.map((job) => (
                            <div
                              key={job.id}
                              className="rounded-xl border border-border/70 bg-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-foreground">{job.title}</span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {job.statusLabel}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground">
                                  {job.cliente && `Cliente: ${job.cliente} · `}
                                  Hora de actualización: {job.updatedTime}
                                </p>
                                {job.statusNote && (
                                  <p className="text-foreground/90 font-medium">Nota: "{job.statusNote}"</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
