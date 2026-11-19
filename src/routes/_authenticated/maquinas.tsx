import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Monitor,
  LogOut,
  Settings,
  ChevronRight,
  FileText,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { Button } from "@/components/ui/button";
import { AboutLink } from "@/components/AboutLink";
import { ContactLink } from "@/components/ContactLink";
import { IndustrialHmiIcon } from "@/components/IndustrialHmiIcon";
import { GreetingWeatherCard } from "@/components/GreetingWeatherCard";
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
      const { data, error } = await supabase
        .from("machines")
        .select("id, name, description")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const machinesList = machines.data ?? [];
  const machinesCount = machinesList.length;

  return (
    <main className="min-h-screen bg-hero px-4 sm:px-6 md:px-8 safe-top safe-bottom flex flex-col max-w-5xl w-full mx-auto pb-10">
      {/* Cabecera con logo y acciones grandes */}
      <header className="flex items-center justify-between py-3">
        <img src={logo.url} alt="Gruper" width={1076} height={343} className="h-9 sm:h-11 w-auto" />
        <div className="flex items-center gap-2 sm:gap-2.5">
          {me.data?.isAdmin && (
            <Button
              variant="outline"
              asChild
              aria-label="Administración y ajustes"
              className="rounded-xl border border-border/80 bg-card h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-2xs hover:border-primary/50 hover:bg-muted hover:text-primary active:scale-95 transition-all cursor-pointer gap-2"
            >
              <Link to="/admin">
                <Settings className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
                <span>Ajustes</span>
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={logout}
            aria-label="Cerrar sesión"
            className="rounded-xl border border-border/80 bg-card h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-2xs hover:border-destructive/40 hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all text-muted-foreground cursor-pointer gap-2"
          >
            <LogOut className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            <span>Salir</span>
          </Button>
        </div>
      </header>

      {/* Saludo dinámico con temperatura, hora y humedad centrado en la esquina */}
      <div className="mt-4 sm:mt-6">
        <GreetingWeatherCard
          userName={me.data?.username}
          subtitle={
            machinesCount === 0 && !machines.isLoading
              ? "Actualmente no tienes máquinas con pantalla remota asignadas a tu cuenta."
              : machinesCount === 1
              ? "Tienes 1 máquina disponible para acceso y control remoto en tiempo real."
              : machinesCount > 1
              ? `Tienes ${machinesCount} máquinas disponibles para acceso y control en tiempo real.`
              : "Selecciona una máquina o gestiona tus trabajos e incidencias."
          }
        />
      </div>

      {/* Accesos directos limpios y en azul uniforme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 sm:mt-5">
        {me.data?.canReports && (
          <Link
            to="/partes"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:bg-muted/60 transition-colors shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block font-semibold text-sm text-foreground">Partes de trabajo</span>
              <span className="block text-xs text-muted-foreground">Consulta y redacta partes</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        )}
        <Link
          to="/trabajos"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:bg-muted/60 transition-colors shadow-xs active:scale-[0.99] cursor-pointer"
        >
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block font-semibold text-sm text-foreground">Trabajos</span>
            <span className="block text-xs text-muted-foreground">Estado y tareas del servicio</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
        {(me.data?.isAdmin || me.data?.canAverias) && (
          <Link
            to="/averias"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-primary/40 hover:bg-muted/60 transition-colors shadow-xs group active:scale-[0.99] cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                Averías / Fallos
              </span>
              <span className="block text-xs text-muted-foreground">
                {me.data?.isAdmin ? "Gestionar avisos de avería" : "Avisar de avería con fotos"}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        )}
      </div>

      {/* Sección de máquinas con encuadre automático */}
      <div className="mt-7 sm:mt-8 flex-1">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {machinesCount === 0 ? "Máquinas disponibles" : `Máquinas disponibles (${machinesCount})`}
          </h2>
          {machinesCount > 0 && (
            <span className="text-[11px] text-muted-foreground">
              Toca para abrir la pantalla remota
            </span>
          )}
        </div>

        {machines.isLoading && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-xs">
            <p className="text-sm">Cargando máquinas…</p>
          </div>
        )}

        {!machines.isLoading && machinesCount === 0 && (
          <div className="rounded-3xl border border-dashed border-border/90 bg-card/70 backdrop-blur p-7 sm:p-9 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3.5">
              <IndustrialHmiIcon className="h-8 w-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              Sin máquinas remotas asignadas
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Tu cuenta está activa en Gruper Remote. Cuando los técnicos configuren tus equipos con pantalla remota, aparecerán aquí para conectarte.
            </p>
            {(me.data?.isAdmin || me.data?.canAverias) && (
              <Button
                asChild
                className="mt-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm h-10 px-4 shadow-xs cursor-pointer"
              >
                <Link to="/averias">
                  <Wrench className="h-4 w-4 mr-2" /> Dar aviso de avería en maquinaria
                </Link>
              </Button>
            )}
          </div>
        )}

        {!machines.isLoading && machinesCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {machinesList.map((m) => (
              <Link
                key={m.id}
                to="/maquina/$id"
                params={{ id: m.id }}
                className="group flex items-center gap-3.5 sm:gap-4 rounded-2xl border border-border bg-card p-4 sm:p-4.5 shadow-xs active:scale-[0.98] transition hover:border-primary/80 hover:shadow-md cursor-pointer"
              >
                {/* Icono HMI Industrial */}
                <span className="grid h-13 w-13 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary/20 transition-colors shadow-2xs">
                  <IndustrialHmiIcon className="h-8 w-8 sm:h-9 sm:w-9" />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm sm:text-base truncate text-foreground group-hover:text-primary transition-colors">
                    {m.name}
                  </span>

                  {/* Piloto LED azul del logo y texto de estado conexión activa */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary shadow-[0_0_8px_#259ffd]"></span>
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold text-foreground/90">
                      Estado: <span className="text-primary font-bold">Conexión activa</span>
                    </span>
                  </div>

                  {m.description && (
                    <span className="block text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {m.description}
                    </span>
                  )}
                </span>

                <span className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                  <span className="hidden sm:inline">Abrir</span>
                  <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="flex flex-col items-center gap-3 pt-8 pb-4">
        <AboutLink />
        <ContactLink />
      </footer>
    </main>
  );
}
