import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Monitor, LogOut, Settings, ChevronRight, FileText, Wrench, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { Button } from "@/components/ui/button";
import { AboutLink } from "@/components/AboutLink";
import { ContactLink } from "@/components/ContactLink";
import logo from "@/assets/gruper-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/maquinas")({
  head: () => ({
    meta: [
      { title: "Mis máquinas — Gruper Remote" },
      { name: "description", content: "Elige la máquina a la que quieres acceder." },
      { property: "og:title", content: "Mis máquinas — Gruper Remote" },
      { property: "og:description", content: "Elige la máquina a la que quieres acceder." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Machines,
});

function Machines() {
  const navigate = useNavigate();
  const me = useMe();
  const machines = useQuery({
    queryKey: ["machines", me.data?.id],
    enabled: !!me.data,
    queryFn: async () => {
      // Admin sees all; clients only their assigned ones (enforced by database rules).
      const { data, error } = await supabase.from("machines").select("id, name, description").order("name");
      if (error) throw error;
      return data;
    },
  });

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <main className="min-h-screen bg-hero px-4 sm:px-6 md:px-8 safe-top safe-bottom flex flex-col max-w-5xl w-full mx-auto pb-10">
      <header className="flex items-center justify-between py-3">
        <img src={logo.url} alt="Gruper" width={1076} height={343} className="h-9 sm:h-11 w-auto" />
        <div className="flex gap-1">
          {me.data?.isAdmin && (
            <Button variant="ghost" size="icon" asChild aria-label="Administración">
              <Link to="/admin"><Settings /></Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión"><LogOut /></Button>
        </div>
      </header>
      <div className="mt-4 sm:mt-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Hola{me.data?.username ? `, ${me.data.username}` : ""}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Selecciona una máquina o gestiona tus trabajos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {me.data?.canReports && (
          <Link to="/partes" className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/60 transition-colors shadow-xs">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block font-medium text-foreground">Partes de trabajo</span>
              <span className="block text-xs text-muted-foreground">Consulta y redacta partes</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}
        <Link to="/trabajos" className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/60 transition-colors shadow-xs">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block font-medium text-foreground">Trabajos</span>
            <span className="block text-xs text-muted-foreground">Estado y tareas del servicio</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        {(me.data?.isAdmin || me.data?.canAverias) && (
          <Link to="/averias" className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 hover:bg-amber-500/10 transition-colors shadow-xs group">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block font-medium text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Averías / Fallos
              </span>
              <span className="block text-xs text-muted-foreground">
                {me.data?.isAdmin ? "Gestionar avisos de avería" : "Avisar de avería con fotos"}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}
      </div>

      <div className="mt-8 flex-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Máquinas disponibles</h2>
        {machines.isLoading && <p className="text-muted-foreground text-sm">Cargando máquinas…</p>}
        {machines.data?.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">No tienes máquinas asignadas todavía.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {machines.data?.map((m) => (
            <Link key={m.id} to="/maquina/$id" params={{ id: m.id }}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.98] transition hover:border-primary hover:shadow-glow">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Monitor /></span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate text-foreground">{m.name}</span>
                {m.description && <span className="block text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.description}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
      <footer className="flex flex-col items-center gap-3 pt-8 pb-4"><AboutLink /><ContactLink /></footer>
    </main>
  );
}
