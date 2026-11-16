import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, FileText, ChevronRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { normalizeReport } from "@/lib/work-report";
import { Button } from "@/components/ui/button";

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

function Partes() {
  const me = useMe();
  const reports = useQuery({
    queryKey: ["work-reports", me.data?.id],
    enabled: !!me.data?.canReports,
    queryFn: async () => {
      let q = supabase.from("work_reports").select("id, number, user_number, data, created_at, user_id, closed").order("created_at", { ascending: false });
      if (me.data && !me.data.isAdmin) q = q.eq("user_id", me.data.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const names = useQuery({
    queryKey: ["profile-names"],
    enabled: !!me.data?.isAdmin,
    queryFn: async () => new Map(((await supabase.from("profiles").select("id, username")).data ?? []).map((p) => [p.id, p.username])),
  });
  const map = new Map<string, { userId: string; name: string; items: NonNullable<typeof reports.data> }>();
  for (const r of reports.data ?? []) {
    const username = names.data?.get(r.user_id) ?? (r.user_id === me.data?.id ? me.data?.username ?? "" : "Usuario");
    const g = map.get(r.user_id) ?? { userId: r.user_id, name: username, items: [] };
    g.items.push(r);
    map.set(r.user_id, g);
  }
  const groups = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (me.isLoading) return null;
  if (!me.data?.canReports) return <p className="p-8 text-center text-muted-foreground">No tienes acceso a partes de trabajo.</p>;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-12">
      <header className="flex items-center justify-between py-3">
        <Link to="/maquinas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</Link>
        <Button asChild size="sm"><Link to="/parte/$id" params={{ id: "nuevo" }}><Plus /> Nuevo parte</Link></Button>
      </header>
      <h1 className="mt-4 text-2xl sm:text-3xl font-bold">Partes de trabajo</h1>
      {reports.data?.length === 0 && <p className="mt-6 rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Aún no hay partes. Crea el primero.</p>}
      {groups.map((g) => (
      <section key={g.userId} className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <User className="h-4 w-4 text-primary" /> {g.name} <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium normal-case">{g.items.length}</span>
        </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {g.items.map((r) => {
          const d = normalizeReport(r.data);
          // Show per-user number (Nº personal), falls back to global number
          const displayNum = r.user_number ?? r.number;
          return (
            <Link key={r.id} to="/parte/$id" params={{ id: r.id }} className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card shadow-sm hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate text-foreground">
                  Parte Nº {displayNum} · {d.cliente || "Sin cliente"}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                  {new Date(r.created_at).toLocaleDateString("es-ES")}
                  {" · "}
                  <span className="font-medium text-foreground/70">{g.name}</span>
                  {d.tecnico && d.tecnico !== g.name && ` · Técnico: ${d.tecnico}`}
                  {r.closed && <span className="ml-1.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium border border-border">Cerrado</span>}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
      </section>
      ))}
    </main>
  );
}
