import type { SVGProps } from "react";

/**
 * Icono de Panel HMI Industrial (Human-Machine Interface)
 * Inspirado en los paneles táctiles industriales de automatización (Siemens Simatic HMI, Weintek, Schneider Magelis)
 * con chasis de montaje en cuadro, marco biselado, pantalla táctil LCD activa, sinóptico de proceso y pilotos LED.
 */
export function IndustrialHmiIcon({
  className = "h-6 w-6",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Chasis exterior del panel HMI para empotrar en cuadro eléctrico */}
      <rect
        x="3"
        y="5"
        width="42"
        height="38"
        rx="5"
        className="fill-card stroke-foreground/70"
        strokeWidth="2.4"
      />

      {/* Bisel interior de fijación metálica */}
      <rect
        x="6"
        y="8"
        width="36"
        height="30"
        rx="3.5"
        className="fill-muted/80 stroke-border"
        strokeWidth="1.2"
      />

      {/* Pantalla táctil activa con retroiluminación azul corporativo #259FFD */}
      <rect
        x="8.5"
        y="10.5"
        width="31"
        height="23"
        rx="2"
        fill="#259FFD"
        fillOpacity="0.12"
        stroke="#259FFD"
        strokeWidth="1.6"
      />

      {/* Barra de título / menú superior del HMI */}
      <rect x="10.5" y="12" width="27" height="3" rx="1" fill="#259FFD" fillOpacity="0.45" />

      {/* Gráficos de proceso en pantalla táctil */}
      {/* Botón o indicador principal */}
      <rect x="11" y="17" width="10" height="5" rx="1" fill="#259FFD" fillOpacity="0.85" />
      {/* Barras de datos / parámetros */}
      <rect x="23" y="17" width="14" height="2" rx="0.5" fill="#259FFD" fillOpacity="0.6" />
      <rect x="23" y="20" width="9" height="2" rx="0.5" fill="#259FFD" fillOpacity="0.4" />

      {/* Curva / gráfico de tendencia en tiempo real */}
      <path
        d="M11 29 L16 25 L21 27 L27 22 L33 26 L37 23"
        stroke="#259FFD"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Piloto LED activo de alimentación/comunicación en el marco inferior */}
      <circle cx="38" cy="40" r="1.5" fill="#259FFD" />
      {/* Pilotos auxiliares de estado */}
      <circle cx="9" cy="40" r="1.2" className="fill-foreground/40" />
      <circle cx="13" cy="40" r="1.2" className="fill-foreground/40" />
    </svg>
  );
}
