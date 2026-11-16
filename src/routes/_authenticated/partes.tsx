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

interface ClientGroup {
  client: string;
  items: Array<{
    id: string;
    number: number;
    user_number: number | null;
    data: any;
    created_at: string;
    user_id: string;
    closed: boolean | null;
  }>;
}

function Partes() {
  const me = useMe();
  const [search, setSearch] = useState("");
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
      return data ?? [];
    },
  });

  const names = useQuery({
    queryKey: ["profile-names"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, username");
      return new Map((data ?? []).map((p) => [p.id, p.username]));
    },
  });

  const toggleFolder = (clientName: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [clientName]: !prev[clientName],
    }));
  };

  // Group by client automatically
  const clientGroups = useMemo(() => {
    const rawList = reports.data ?? [];
    const term = search.trim().toLowerCase();

    const map = new Map<string, ClientGroup>();

    for (const r of rawList) {
      const d = normalizeReport(r.data);
      const clientName = (d.cliente || "").trim() || "Sin cliente";
      const displayNum = String(r.user_number ?? r.number);
      const techName = (names.data?.get(r.user_id) || "").toLowerCase();

      // Check search filter if active
      if (term) {
        const matchesClient = clientName.toLowerCase().includes(term);
        const matchesNum = displayNum.toLowerCase().includes(term) || `parte ${displayNum}`.includes(term);
        const matchesTech = techName.includes(term);
        if (!matchesClient && !matchesNum && !matchesTech) {
          continue;
        }
      }

      if (!map.has(clientName)) {
        map.set(clientName, { client: clientName, items: [] });
      }
      map.get(clientName)!.items.push(r);
    }

    return Array.from(map.values()).sort((a, b) => a.client.localeCompare(b.client, "es-ES"));
  }, [reports.data, search, names.data]);

  const totalReportsCount = useMemo(() => {
    return (reports.data ?? []).length;
  }, [reports.data]);

  if (me.isLoading) return null;
  if (!me.data?.canReports) {
    return <p className="p-8 text-center text-muted-foreground">No tienes acceso a partes de trabajo.</p>;
  }

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

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Partes de trabajo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canViewAll ? "Viendo partes de todos los clientes y compañeros" : "Tus partes organizados por cliente"}
            {totalReportsCount > 0 && ` (${totalReportsCount} en total)`}
          </p>
        </div>
      </div>

      {/* Buscador rápido por cliente o número de parte */}
      <div className="mt-5 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente, número de parte o técnico..."
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

      {reports.data?.length === 0 && (
        <p className="mt-8 rounded-xl border border-border p-8 text-center text-sm text-muted-foreground bg-card">
          Aún no hay partes. Pulsa en <strong>Nuevo parte</strong> para crear el primero.
        </p>
      )}

      {reports.data && reports.data.length > 0 && clientGroups.length === 0 && search && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No se encontraron partes ni clientes para &quot;{search}&quot;.
        </div>
      )}

      {/* Carpetas por Cliente */}
      <div className="mt-6 space-y-4">
        {clientGroups.map((g) => {
          // If searching, keep folders auto-expanded so user immediately sees results
          const isCollapsed = search.trim().length > 0 ? false : !!collapsedFolders[g.client];

          return (
            <div
              key={g.client}
              className="rounded-2xl border border-border bg-card/60 backdrop-blur shadow-sm overflow-hidden transition-all"
            >
              {/* Encabezado de la Carpeta de Cliente */}
              <button
                type="button"
                onClick={() => toggleFolder(g.client)}
                className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {isCollapsed ? <Folder className="h-5 w-5" /> : <FolderOpen className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="block font-semibold text-base truncate text-foreground">{g.client}</span>
                    <span className="block text-xs text-muted-foreground">
                      {g.items.length} {g.items.length === 1 ? "parte guardado" : "partes guardados"}
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

              {/* Lista de Partes dentro de la carpeta */}
              {!isCollapsed && (
                <div className="p-3 sm:p-4 border-t border-border/60 bg-background/50 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {g.items.map((r) => {
                    const d = normalizeReport(r.data);
                    const displayNum = r.user_number ?? r.number;
                    const authorName =
                      names.data?.get(r.user_id) ??
                      (r.user_id === me.data?.id ? me.data?.username ?? "" : "Compañero");

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
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
