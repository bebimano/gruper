import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Download,
  Search,
  Building2,
  RefreshCw,
  FileDown,
  AlertCircle,
  Camera,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMe } from "@/lib/useRole";
import {
  getMyClientReportsServer,
  type ClientViewWorkReport,
} from "@/lib/reports.functions";
import { downloadReportPdf } from "@/lib/report-pdf";

export const Route = createFileRoute("/_authenticated/mis-partes")({
  head: () => ({
    meta: [
      { title: "Mis Partes de Trabajo — Gruper Remote" },
      {
        name: "description",
        content: "Consulta los partes de trabajo, horas, firmas y descarga tus PDF oficiales de Gruper.",
      },
      { property: "og:title", content: "Mis Partes de Trabajo — Gruper Remote" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: MisPartesView,
});

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function MisPartesView() {
  const qc = useQueryClient();
  const me = useMe();
  const getReportsFn = useServerFn(getMyClientReportsServer);

  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedPhotos, setExpandedPhotos] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ["my-client-reports"],
    queryFn: () => getReportsFn(),
  });

  const reports: ClientViewWorkReport[] = query.data?.reports ?? [];
  const companyName = query.data?.companyName || me.data?.username || "Tu Empresa";
  const totalHoursFormatted = query.data?.totalHoursFormatted || "0 h";

  // Filtrado de partes por buscador
  const filteredReports = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter((r) => {
      const matchNum = String(r.displayNumber).includes(q) || `parte ${r.displayNumber}`.includes(q);
      const matchTecnico = r.tecnico.toLowerCase().includes(q);
      const matchFecha = r.created_at.includes(q);
      const matchTrabajos = r.trabajosList.some((t) =>
        t.descripcion.toLowerCase().includes(q)
      );
      const matchDireccion = r.direccion.toLowerCase().includes(q);
      return matchNum || matchTecnico || matchFecha || matchTrabajos || matchDireccion;
    });
  }, [reports, search]);

  const togglePhotos = (id: string) => {
    setExpandedPhotos((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDownloadPdf = async (report: ClientViewWorkReport) => {
    setDownloadingId(report.id);
    try {
      toast.info(`Generando PDF oficial del Parte Nº ${report.displayNumber}…`);
      await downloadReportPdf(
        report.data,
        report.displayNumber,
        report.tecnico
      );
      toast.success(`PDF del Parte Nº ${report.displayNumber} descargado con éxito`);
    } catch (err: any) {
      console.error("Error al descargar PDF:", err);
      toast.error(err?.message || "No se pudo generar el documento PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-hero px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-16">
      {/* Cabecera de navegación */}
      <header className="flex items-center justify-between py-3">
        <Button
          variant="outline"
          asChild
          className="rounded-xl border border-border/80 bg-card h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-2xs hover:border-primary/50 hover:bg-muted hover:text-primary active:scale-95 transition-all cursor-pointer gap-2"
        >
          <Link to="/maquinas">
            <ArrowLeft className="h-4 w-4 text-primary" />
            <span>Volver a máquinas</span>
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["my-client-reports"] })}
          disabled={query.isFetching}
          className="rounded-xl h-10 text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-primary ${query.isFetching ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </header>

      {/* Tarjeta principal de bienvenida e información de la empresa */}
      <div className="mt-4 rounded-3xl border border-border/80 bg-card/85 backdrop-blur p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-2xs">
              <FileText className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Mis Partes de Trabajo
                </h1>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold px-2 py-0.5 rounded-md">
                  Portal Cliente Oficial
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Historial de servicios realizados en tus instalaciones para{" "}
                <strong className="text-foreground">{companyName}</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Resumen de cifras clave para contabilidad y administración */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60">
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Empresa
              </p>
              <p className="text-base font-bold text-foreground truncate mt-0.5 max-w-[200px]">
                {companyName}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border text-muted-foreground">
              <Building2 className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                Partes realizados
              </p>
              <p className="text-xl font-bold text-primary mt-0.5">{reports.length}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Horas técnicas totales
              </p>
              <p className="text-xl font-bold text-foreground mt-0.5">{totalHoursFormatted}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border text-muted-foreground">
              <Clock className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="mt-5 flex gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de parte, trabajo realizado, técnico o fecha…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 text-sm font-medium rounded-xl border-border/80 bg-card shadow-2xs"
          />
        </div>
      </div>

      {/* Estado de carga */}
      {query.isLoading && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-10 text-center space-y-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-foreground">Cargando partes de tu empresa…</p>
          <p className="text-xs text-muted-foreground">Recuperando registros oficiales y firmas</p>
        </div>
      )}

      {/* Estado vacío: Sin partes */}
      {!query.isLoading && filteredReports.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mx-auto">
            <FileText className="h-7 w-7" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            {search ? "No se encontraron partes coincidentes" : "Sin partes de trabajo registrados aún"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {search
              ? "Prueba con otro término de búsqueda o limpia el buscador."
              : `Cuando el servicio técnico de Gruper complete y firme un parte de trabajo para ${companyName}, aparecerá automáticamente aquí para su consulta y descarga en PDF.`}
          </p>
        </div>
      )}

      {/* Listado de partes de trabajo */}
      {!query.isLoading && filteredReports.length > 0 && (
        <div className="mt-5 space-y-4">
          {filteredReports.map((r) => {
            const isDownloading = downloadingId === r.id;
            const hasPhotos = r.fotosCount > 0;
            const isPhotosOpen = !!expandedPhotos[r.id];

            return (
              <div
                key={r.id}
                className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden transition-all hover:border-primary/50"
              >
                {/* Cabecera de la tarjeta del parte */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-mono text-sm font-bold shrink-0">
                      #{r.displayNumber}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-foreground">
                          Parte Oficial Nº {r.displayNumber}
                        </span>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold py-0">
                          {r.totalHoursFormatted} de intervención
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span>{formatDate(r.created_at)}</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Técnico: {r.tecnico}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botón de descarga PDF oficial en el mismo azul de la app */}
                  <Button
                    onClick={() => handleDownloadPdf(r)}
                    disabled={isDownloading}
                    className="self-stretch sm:self-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl h-10 px-4 shadow-xs text-xs gap-2 shrink-0 cursor-pointer"
                  >
                    {isDownloading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    <span>{isDownloading ? "Generando…" : "Descargar PDF Oficial"}</span>
                  </Button>
                </div>

                {/* Cuerpo del parte: Trabajos realizados y Firma */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Trabajos realizados */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span>Trabajos Realizados en la Instalación:</span>
                    </h3>

                    {r.trabajosList.length > 0 ? (
                      <ul className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 sm:p-3.5">
                        {r.trabajosList.map((trabajo, idx) => (
                          <li
                            key={idx}
                            className="text-xs sm:text-sm text-foreground flex items-start gap-2.5 leading-relaxed"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0"></span>
                            <span className="flex-1 font-medium">{trabajo.descripcion}</span>
                            {trabajo.cantidad && trabajo.cantidad !== "1" && (
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0 bg-background text-muted-foreground font-mono"
                              >
                                Cant: {trabajo.cantidad}
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic rounded-xl border border-border/50 bg-muted/20 p-3">
                        Intervención técnica completada y registrada en el PDF oficial adjunto.
                      </p>
                    )}
                  </div>

                  {/* Observaciones si las hay */}
                  {r.data?.observaciones && (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                      <strong className="text-foreground">Observaciones técnicas:</strong>{" "}
                      {r.data.observaciones}
                    </div>
                  )}

                  {/* Sección de Firma y Validación */}
                  <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {r.hasSignature && r.signatureImage ? (
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-28 rounded-lg border border-border bg-white p-1 flex items-center justify-center shrink-0 shadow-2xs">
                            <img
                              src={r.signatureImage}
                              alt="Firma del cliente"
                              className="max-h-full max-w-full object-contain filter contrast-125"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                Validado y firmado por el cliente
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {r.signerName ? `Firmado por: ${r.signerName}` : "Firma registrada en el parte"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span>Pendiente de rúbrica / firma</span>
                        </div>
                      )}
                    </div>

                    {/* Botón para ver fotos de la intervención si tiene */}
                    {hasPhotos && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePhotos(r.id)}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 self-start sm:self-auto"
                      >
                        <Camera className="h-3.5 w-3.5 text-primary" />
                        <span>
                          {r.fotosCount} {r.fotosCount === 1 ? "foto adjunta" : "fotos adjuntas"}
                        </span>
                        {isPhotosOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Vista de fotos desplegable */}
                  {hasPhotos && isPhotosOpen && (
                    <div className="pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(r.data?.fotos ?? []).map((foto: any, fIdx: number) => (
                        <div
                          key={fIdx}
                          className="rounded-xl border border-border overflow-hidden bg-background aspect-square shadow-2xs group relative"
                        >
                          <img
                            src={foto.url}
                            alt={foto.titulo || "Foto de trabajo"}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          {foto.tipo && (
                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                              {foto.tipo}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
