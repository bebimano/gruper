import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, FileText, ChevronRight } from "lucide-react";
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
      let q = supabase.from("work_reports").select("id, number, data, created_at").order("created_at", { ascending: false });
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
    const g = map.get(r.user_id) ?? { userId: r.user_id, name: names.data?.get(r.user_id) ?? (r.user_id === me.data?.id ? me.data.username : "Usuario"), items: [] };
    g.items.push(r);
    map.set(r.user_id, g);
  }
  const groups = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (me.isLoading) return null;
  if (!me.data?.canReports) return <p className="p-8 text-center text-muted-foreground">No tienes acceso a partes de trabajo.</p>;

  return (
    <main className="min-h-screen px-5 safe-top safe-bottom max-w-2xl mx-auto">
      <header className="flex items-center justify-between py-3">
        <Link to="/maquinas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</Link>
        <Button asChild size="sm"><Link to="/parte/$id" params={{ id: "nuevo" }}><Plus /> Nuevo parte</Link></Button>
      </header>
      <h1 className="mt-4 text-2xl font-bold">Partes de trabajo</h1>
      {reports.data?.length === 0 && <p className="mt-6 rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Aún no hay partes. Crea el primero.</p>}
      {groups.map((g) => (
      <section key={g.userId} className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <User className="h-4 w-4 text-primary" /> {g.name} <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium normal-case">{g.items.length}</span>
        </h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-background">
        {g.items.map((r) => {
          const d = normalizeReport(r.data);
          return (
            <Link key={r.id} to="/parte/$id" params={{ id: r.id }} className="flex items-center gap-3 p-4 hover:bg-muted transition-colors">
              <FileText className="h-5 w-5 text-primary" />
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">Nº {r.number} · {d.cliente || "Sin cliente"}</span>
                <span className="block text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("es-ES")} · {d.tecnico || "—"}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
      </section>
      ))}
    </main>
  );
}
