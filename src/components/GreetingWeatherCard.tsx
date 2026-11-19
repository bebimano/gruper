import { useState, useEffect } from "react";
import { Sun, Sunset, Moon, Clock, Thermometer, Droplets } from "lucide-react";

interface GreetingWeatherCardProps {
  userName?: string;
  subtitle?: string;
  badge?: React.ReactNode;
}

/** Obtiene el saludo correspondiente a la hora del día */
function getGreetingData(): { greeting: string; period: "dia" | "tarde" | "noche" } {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) {
    return { greeting: "Buenos días", period: "dia" };
  }
  if (hour >= 14 && hour < 20) {
    return { greeting: "Buenas tardes", period: "tarde" };
  }
  return { greeting: "Buenas noches", period: "noche" };
}

/** Formatea el nombre con mayúsculas iniciales */
function formatName(raw?: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function GreetingWeatherCard({
  userName,
  subtitle,
  badge,
}: GreetingWeatherCardProps) {
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

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isMounted) {
            fetchWeather(pos.coords.latitude, pos.coords.longitude);
          }
        },
        () => {
          // Fallback predeterminado ya cargado
        },
        { timeout: 8000 }
      );
    }

    const interval = setInterval(() => {
      fetchWeather(39.19, -0.54);
    }, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const { greeting, period } = getGreetingData();
  const formattedName = formatName(userName);

  return (
    <div className="rounded-3xl border border-border/80 bg-card/85 backdrop-blur p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0 shadow-2xs border border-primary/20">
            {period === "dia" ? (
              <Sun className="h-6 w-6 sm:h-7 sm:w-7" />
            ) : period === "tarde" ? (
              <Sunset className="h-6 w-6 sm:h-7 sm:w-7" />
            ) : (
              <Moon className="h-6 w-6 sm:h-7 sm:w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate">
                {greeting}{formattedName ? `, ${formattedName}` : ""}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Widget en la esquina centrado: Hora, Temperatura y Humedad */}
        <div className="flex items-center justify-center shrink-0 self-center md:self-auto pt-3 md:pt-0 border-t md:border-t-0 border-border/60 w-full md:w-auto">
          <div className="flex items-center gap-3 sm:gap-4 bg-muted/40 border border-border/80 rounded-2xl px-4 py-2.5 shadow-2xs">
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
  );
}
