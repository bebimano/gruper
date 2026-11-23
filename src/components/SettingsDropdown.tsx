import { useState, useEffect } from "react";
import {
  Settings,
  ChevronDown,
  Cpu,
  Users,
  CalendarCheck,
  Boxes,
  Building2,
  FileText,
  AlertTriangle,
  Truck,
  Package,
  ShieldCheck,
  Mail,
  Bell,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useMe } from "@/lib/useRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SettingsSubmenuItem {
  value: string;
  label: string;
  description: string;
  icon: typeof Settings;
  category: "equipos" | "partes" | "sistema";
}

export const SETTINGS_SUBMENUS: SettingsSubmenuItem[] = [
  // Equipos y Clientes
  {
    value: "machines",
    label: "Máquinas",
    description: "Parque de máquinas y acceso HMI",
    icon: Cpu,
    category: "equipos",
  },
  {
    value: "clients",
    label: "Usuarios",
    description: "Cuentas, clientes y trabajadores",
    icon: Users,
    category: "equipos",
  },
  {
    value: "equipment",
    label: "Equipos",
    description: "Asignación de máquinas por cliente",
    icon: Boxes,
    category: "equipos",
  },
  {
    value: "vehicles",
    label: "Vehículos",
    description: "Flota SAT y matrículas",
    icon: Truck,
    category: "equipos",
  },
  {
    value: "stock",
    label: "Stock",
    description: "Materiales y repuestos",
    icon: Package,
    category: "equipos",
  },

  // Partes y Operaciones
  {
    value: "daily_jobs",
    label: "Trabajos al día",
    description: "Calendario y tareas diarias",
    icon: CalendarCheck,
    category: "partes",
  },
  {
    value: "client_reports",
    label: "Partes por cliente",
    description: "Historial agrupado por empresa",
    icon: Building2,
    category: "partes",
  },
  {
    value: "reports",
    label: "Partes",
    description: "Todos los partes de trabajo SAT",
    icon: FileText,
    category: "partes",
  },
  {
    value: "averias",
    label: "Averías",
    description: "Notificaciones de incidencias",
    icon: AlertTriangle,
    category: "partes",
  },

  // Sistema y Avisos
  {
    value: "opens",
    label: "Accesos",
    description: "Registro de accesos a máquinas",
    icon: ShieldCheck,
    category: "sistema",
  },
  {
    value: "messages",
    label: "Mensajes",
    description: "Consultas de contacto recibidas",
    icon: Mail,
    category: "sistema",
  },
  {
    value: "notify",
    label: "Avisos",
    description: "Configuración de notificaciones push",
    icon: Bell,
    category: "sistema",
  },
];

interface SettingsDropdownProps {
  className?: string;
  activeTab?: string;
  onTabSelect?: (tab: string) => void;
}

export function SettingsDropdown({
  className,
  activeTab,
  onTabSelect,
}: SettingsDropdownProps) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname);
    }
  }, [open]);

  // Solo visible para administradores
  if (!me.data?.isAdmin) return null;

  const isCurrentAdminPage = currentPath === "/admin";

  const handleSelectTab = (tabValue: string) => {
    setOpen(false);

    // Notificar cambio inmediato en la página si estamos en /admin
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("gruper:switch-admin-tab", { detail: tabValue })
      );

      if (window.location.pathname === "/admin") {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tabValue);
        window.history.replaceState({}, "", url.toString());
      } else {
        window.location.href = `/admin?tab=${encodeURIComponent(tabValue)}`;
        return;
      }
    }

    if (onTabSelect) {
      onTabSelect(tabValue);
    }
  };

  const renderCategory = (
    title: string,
    category: "equipos" | "partes" | "sistema"
  ) => {
    const items = SETTINGS_SUBMENUS.filter((s) => s.category === category);
    return (
      <DropdownMenuGroup key={category} className="space-y-0.5">
        <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
          {title}
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          const isSelected = isCurrentAdminPage && activeTab === item.value;
          return (
            <DropdownMenuItem
              key={item.value}
              onClick={() => handleSelectTab(item.value)}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer text-xs transition-colors",
                isSelected
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-foreground hover:bg-muted/80 hover:text-primary"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-lg shrink-0 transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:text-primary"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block font-semibold leading-tight truncate">
                  {item.label}
                </span>
                <span className="block text-[10px] text-muted-foreground leading-tight truncate">
                  {item.description}
                </span>
              </div>
              {isSelected && (
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label="Menú de ajustes y administración"
          title="Ajustes y administración"
          className={cn(
            "group rounded-xl border border-border/80 bg-card h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs sm:text-sm font-semibold shadow-2xs hover:border-primary/50 hover:bg-muted hover:text-primary active:scale-95 transition-all cursor-pointer gap-1.5 sm:gap-2 inline-flex items-center shrink-0",
            open && "border-primary/50 bg-muted/80 text-primary shadow-xs",
            className
          )}
        >
          <Settings className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary group-hover:rotate-45 transition-transform duration-300" />
          <span className="hidden xs:inline sm:inline">Ajustes</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180 text-primary"
            )}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-72 sm:w-80 max-h-[82vh] overflow-y-auto p-1.5 rounded-2xl border border-border/90 bg-card/95 backdrop-blur-md shadow-xl z-50 animate-in fade-in-0 zoom-in-95 scrollbar-thin"
      >
        {/* Cabecera del desplegable */}
        <div className="px-2.5 py-2 flex items-center justify-between border-b border-border/60 mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="block font-bold text-xs text-foreground">
                Panel de Ajustes
              </span>
              <span className="block text-[10px] text-muted-foreground">
                Selecciona la sección
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20 px-2 py-0.5 rounded-md"
          >
            Admin
          </Badge>
        </div>

        {/* Categorías de Ajustes */}
        {renderCategory("Equipos y Clientes", "equipos")}
        <DropdownMenuSeparator className="my-1.5 opacity-60" />
        {renderCategory("Partes y Operaciones", "partes")}
        <DropdownMenuSeparator className="my-1.5 opacity-60" />
        {renderCategory("Sistema y Avisos", "sistema")}

        <DropdownMenuSeparator className="my-1.5 opacity-60" />

        {/* Acceso general a todo el panel */}
        <DropdownMenuItem
          onClick={() => handleSelectTab("machines")}
          className="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
        >
          <span>Ver panel general</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
