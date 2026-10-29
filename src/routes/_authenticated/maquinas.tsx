import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Monitor, LogOut, Settings, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { Button } from "@/components/ui/button";
import { AboutLink } from "@/components/AboutLink";
import logo from "@/assets/gruper-logo.png";

export const Route = createFileRoute("/_authenticated/maquinas")({
  head: () => ({
    meta: [
      { title: "Mis máquinas — Gruper Remote" },
      { name: "description", content: "Elige la máquina a la que quieres acceder." },
      { property: "og:title", content: "Mis máquinas — Gruper Remote" },
      { property: "og:description", content: "Elige la máquina a la que quieres acceder." },
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
    <main className="min-h-screen bg-hero px-5 safe-top safe-bottom flex flex-col max-w-2xl mx-auto">
      <header className="flex items-center justify-between py-3">
        <img src={logo} alt="Gruper" width={904} height={269} className="h-9 w-auto" />
        <div className="flex gap-1">
          {me.data?.isAdmin && (
            <Button variant="ghost" size="icon" asChild aria-label="Administración">
              <Link to="/admin"><Settings /></Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión"><LogOut /></Button>
        </div>
      </header>
      <h1 className="mt-6 text-2xl font-bold">Hola{me.data?.username ? `, ${me.data.username}` : ""}</h1>
      <p className="text-muted-foreground">Selecciona una máquina</p>
      <div className="mt-6 space-y-3 flex-1">
        {machines.isLoading && <p className="text-muted-foreground">Cargando…</p>}
        {machines.data?.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">No tienes máquinas asignadas todavía.</p>
        )}
        {machines.data?.map((m) => (
          <Link key={m.id} to="/maquina/$id" params={{ id: m.id }}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.98] transition hover:border-primary hover:shadow-glow">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Monitor /></span>
            <span className="flex-1">
              <span className="block font-medium">{m.name}</span>
              {m.description && <span className="block text-sm text-muted-foreground">{m.description}</span>}
            </span>
            <ChevronRight className="text-muted-foreground" />
          </Link>
        ))}
      </div>
      <footer className="flex justify-center py-8"><AboutLink /></footer>
    </main>
  );
}
