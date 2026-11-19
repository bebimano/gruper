import { useState, useEffect } from "react";
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
  Sun,
  Sunset,
  Moon,
  Clock,
  Thermometer,
  Droplets,
} from "lucide-react";
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

/** Obtiene el saludo correspondiente a la hora del día */
function getGreetingData(): { greeting: string; period: "dia" | "tarde" | "noche" } {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) {
    return { greeting: "Buenos días", period: "dia" };
  }
  if (hour >= 14 && hour < 21) {
    return { greeting: "Buenas tardes", period: "tarde" };
  }
  return { greeting: "Buenas noches", period: "noche" };
}

/** Formatea el nombre del cliente con mayúsculas iniciales */
function formatClientName(raw?: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

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

  // Reloj en tiempo real
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Clima (temperatura y humedad)
  const [weather, setWeather] = useState<{
    temperature: number | null;
    humidity: number | null;
  }>({ temperature: null, humidity: null });

  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.current) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            humidity: Math.round(data.current.relative_humidity_2m),
          });
        }
      } catch (err) {
        console.warn("No se pudo obtener información del clima:", err);
      }
    };

    // Coordenadas base (Comunidad Valenciana / l'Alcúdia)
    fetchWeather(39.19, -0.54);

    // Si el usuario permite geolocalización precisa
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isMounted) {
            fetchWeather(pos.coords.latitude, pos.coords.longitude);
          }
        },
        () => {
          // Usa el fallback predeterminado
        },
        { timeout: 8000 }
      );
    }

    // Refrescar cada 15 minutos
    const interval = setInterval(() => {
      fetchWeather(39.19, -0.54);
    }, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const machinesList = machines.data ?? [];
  const machinesCount = machinesList.length;
  const { greeting, period } = getGreetingData();
  const clientName = formatClientName(me.data?.username);

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
      <div className="mt-4 sm:mt-6 rounded-3xl border border-border/80 bg-card/80 backdrop-blur p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0 shadow-2xs">
              {period === "dia" ? (
                <Sun className="h-6 w-6 sm:h-7 sm:w-7" />
              ) : period === "tarde" ? (
                <Sunset className="h-6 w-6 sm:h-7 sm:w-7" />
              ) : (
                <Moon className="h-6 w-6 sm:h-7 sm:w-7" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate">
                {greeting}{clientName ? `, ${clientName}` : ""}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 leading-relaxed">
                {machinesCount === 0 && !machines.isLoading
                  ? "Actualmente no tienes máquinas con pantalla remota asignadas a tu cuenta."
                  : machinesCount === 1
                  ? "Tienes 1 máquina disponible para acceso y control remoto en tiempo real."
                  : machinesCount > 1
                  ? `Tienes ${machinesCount} máquinas disponibles para acceso y control en tiempo real.`
                  : "Selecciona una máquina o gestiona tus trabajos e incidencias."}
              </p>
            </div>
          </div>

          {/* Widget en la esquina centrado: Hora, Temperatura y Humedad */}
          <div className="flex items-center justify-center shrink-0 self-center md:self-auto pt-3 md:pt-0 border-t md:border-t-0 border-border/60 w-full md:w-auto">
            <div className="flex items-center gap-3 sm:gap-4 bg-muted/40 border border-border/70 rounded-2xl px-4 py-2.5 shadow-2xs">
              {/* Hora */}
              <div className="flex flex-col items-center min-w-[54px]">
                <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3 w-3 text-primary" />
                  <span>Hora</span>
                </span>
                <span className="text-base sm:text-lg font-bold text-foreground font-mono mt-0.5">
                  {currentTime}
                </span>
              </div>

              <div className="h-7 w-px bg-border/80" />

              {/* Temperatura */}
              <div className="flex flex-col items-center min-w-[54px]">
                <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Thermometer className="h-3 w-3 text-primary" />
                  <span>Temp.</span>
                </span>
                <span className="text-base sm:text-lg font-bold text-foreground mt-0.5">
                  {weather.temperature !== null ? `${weather.temperature}°C` : "--°C"}
                </span>
              </div>

              <div className="h-7 w-px bg-border/80" />

              {/* Humedad */}
              <div className="flex flex-col items-center min-w-[54px]">
                <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Droplets className="h-3 w-3 text-primary" />
                  <span>Humedad</span>
                </span>
                <span className="text-base sm:text-lg font-bold text-foreground mt-0.5">
                  {weather.humidity !== null ? `${weather.humidity}%` : "--%"}
                </span>
              </div>
            </div>
          </div>
        </div>
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
              <Monitor className="h-7 w-7" />
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
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:p-4.5 shadow-xs active:scale-[0.98] transition hover:border-primary/60 hover:shadow-md cursor-pointer"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Monitor className="h-6 w-6" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm sm:text-base truncate text-foreground group-hover:text-primary transition-colors">
                    {m.name}
                  </span>
                  {m.description ? (
                    <span className="block text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {m.description}
                    </span>
                  ) : (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Conexión remota VNC activa
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
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
