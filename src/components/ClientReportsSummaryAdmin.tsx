import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  FileText,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Plus,
  CheckCircle2,
  Clock,
  User,
  Hash,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getClientReportsSummaryAdminServer,
  type ClientReportsSummary,
  type ClientReportItem,
} from "@/lib/reports.functions";

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ClientReportsSummaryAdmin() {
  const qc = useQueryClient();
  const getSummaryFn = useServerFn(getClientReportsSummaryAdminServer);

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "with_reports" | "no_reports">("all");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ["admin-client-reports-summary"],
    queryFn: () => getSummaryFn(),
  });

  const clients: ClientReportsSummary[] = query.data?.clients ?? [];
  const totalClients = query.data?.totalClients ?? 0;
  const clientsWithReports = query.data?.clientsWithReports ?? 0;
  const totalReports = query.data?.totalReports ?? 0;

  // Filtrado por buscador y estado
  const filteredClients = useMemo(() => {
    let list = clients;

    // Filtro por pestañas rápidas
    if (filterMode === "with_reports") {
      list = list.filter((c) => c.totalPartes > 0);
    } else if (filterMode === "no_reports") {
      list = list.filter((c) => c.totalPartes === 0);
    }

    // Buscador
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const matchName = c.clientName.toLowerCase().includes(q);
        const matchNumber = c.partes.some((p) =>
          String(p.displayNumber).includes(q)
        );
        const matchTecnico = c.partes.some((p) =>
          p.tecnico.toLowerCase().includes(q)
        );
        return matchName || matchNumber || matchTecnico;
      });
    }

    return list;
  }, [clients, search, filterMode]);

  const toggleClient = (clientName: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientName]: !prev[clientName],
    }));
  };

  const isClientExpanded = (clientName: string) => {
    if (search.trim()) return true;
    return !!expandedClients[clientName];
  };

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-client-reports-summary"] });
    toast.success("Datos actualizados");
  };

  return (
    <div className="space-y-5">
      {/* Cabecera explicativa limpia */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Partes de Trabajo por Cliente
              </h2>
              <p className="text-xs text-muted-foreground">
                Control de partes realizados a cada cliente, cuántos tienen hechos y el número por el cual van.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={query.isFetching}
              className="rounded-xl h-9 text-xs font-semibold gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-primary ${query.isFetching ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl h-9 shadow-xs text-xs gap-1.5"
            >
              <Link to="/parte/$id" params={{ id: "nuevo" }}>
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo parte</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Tarjetas resumen de estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Clientes
              </p>
              <p className="text-xl font-bold text-foreground mt-0.5">{totalClients}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border text-muted-foreground">
              <Building2 className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wider">
                Con partes hechos
              </p>
              <p className="text-xl font-bold text-primary mt-0.5">{clientsWithReports}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Partes acumulados
              </p>
              <p className="text-xl font-bold text-foreground mt-0.5">{totalReports}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border text-muted-foreground">
              <FileText className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, número de parte o técnico…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm font-medium rounded-xl"
          />
        </div>

        <div className="flex gap-1.5 shrink-0 bg-muted/40 p-1 rounded-xl border border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterMode("all")}
            className={`rounded-lg h-8 text-xs font-semibold px-3 ${
              filterMode === "all"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({clients.length})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterMode("with_reports")}
            className={`rounded-lg h-8 text-xs font-semibold px-3 ${
              filterMode === "with_reports"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Con partes ({clientsWithReports})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterMode("no_reports")}
            className={`rounded-lg h-8 text-xs font-semibold px-3 ${
              filterMode === "no_reports"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sin partes ({clients.length - clientsWithReports})
          </Button>
        </div>
      </div>

      {/* Estado de carga */}
      {query.isLoading && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-foreground">Cargando partes por cliente…</p>
          <p className="text-xs text-muted-foreground">Analizando historial de partes y clientes</p>
        </div>
      )}

      {/* Lista de clientes */}
      {!query.isLoading && filteredClients.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No se encontraron clientes</p>
          <p className="text-xs text-muted-foreground">
            {search ? "Prueba a cambiar el texto de búsqueda." : "No hay clientes registrados en este filtro."}
          </p>
        </div>
      )}

      {!query.isLoading && filteredClients.length > 0 && (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const hasReports = client.totalPartes > 0;
            const isExpanded = isClientExpanded(client.clientName);

            return (
              <div
                key={client.clientName}
                className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden transition-all hover:border-border/80"
              >
                {/* Cabecera de la tarjeta del cliente */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                        hasReports
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-foreground truncate">
                          {client.clientName}
                        </h3>
                        {client.isRegisteredUser && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold bg-muted/60 text-muted-foreground border-border/80"
                          >
                            Usuario de app
                          </Badge>
                        )}
                      </div>

                      {/* Estado clave: Cuántos partes tienen hechos y por cuál van */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                        {hasReports ? (
                          <>
                            <span className="font-semibold text-primary">
                              {client.totalPartes} {client.totalPartes === 1 ? "parte hecho" : "partes hechos"}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                              <Hash className="h-3 w-3" />
                              <span>Van por el parte Nº {client.lastParteNumber}</span>
                            </span>
                            {client.lastParteDate && (
                              <span className="text-muted-foreground text-[11px]">
                                (último el {formatDate(client.lastParteDate)})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground italic flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Sin partes asignados todavía
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones del cliente */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {hasReports ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleClient(client.clientName)}
                        className="rounded-xl h-9 text-xs font-semibold gap-1.5 border-border hover:border-primary/40"
                      >
                        <span>{isExpanded ? "Ocultar listado" : "Ver números y detalles"}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl h-9 shadow-xs text-xs gap-1"
                      >
                        <Link to="/parte/$id" params={{ id: "nuevo" }}>
                          <Plus className="h-3.5 w-3.5" />
                          <span>Hacer primer parte</span>
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Si tiene partes: fila rápida de números de partes que tienen hechos */}
                {hasReports && (
                  <div className="px-4 sm:px-5 pb-3 pt-1 border-t border-border/40 bg-muted/20">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Hash className="h-3 w-3 text-primary" />
                      <span>Números de parte realizados ({client.partes.length}):</span>
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {client.partes.map((p) => (
                        <Link
                          key={p.id}
                          to="/parte/$id"
                          params={{ id: p.id }}
                          title={`Parte Nº ${p.displayNumber} · ${formatDate(p.created_at)}${p.tecnico ? ` · ${p.tecnico}` : ""}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-card border border-border/80 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all shadow-2xs group"
                        >
                          <span className="text-primary font-bold">Nº {p.displayNumber}</span>
                          <span className="text-[10px] font-sans text-muted-foreground group-hover:text-foreground">
                            {formatDate(p.created_at)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vista desplegable detallada */}
                {hasReports && isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Detalle cronológico de partes ({client.partes.length})
                      </p>
                      <span className="text-xs text-muted-foreground">
                        Pulsa en cualquier parte para abrirlo
                      </span>
                    </div>

                    <div className="divide-y divide-border/60 rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                      {client.partes.map((p, idx) => (
                        <Link
                          key={p.id}
                          to="/parte/$id"
                          params={{ id: p.id }}
                          className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-xs font-bold shrink-0">
                              #{p.displayNumber}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                  Parte Nº {p.displayNumber}
                                </span>
                                {idx === 0 && (
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold py-0">
                                    Último hecho
                                  </Badge>
                                )}
                                {p.closed && (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground py-0">
                                    Cerrado
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>{formatDate(p.created_at)}</span>
                                {p.tecnico && (
                                  <>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                                      <User className="h-3 w-3 inline" /> {p.tecnico}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                            <span>Ver parte</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </div>
                        </Link>
                      ))}
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
