import { Utensils, Moon, Coffee, Plus, Minus, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DietasGastos } from "@/lib/work-report";
import { emptyDietas } from "@/lib/work-report";

interface DietasGastosSelectorProps {
  dietas?: DietasGastos;
  onChange: (dietas: DietasGastos) => void;
  disabled?: boolean;
}

type DietaKey = keyof DietasGastos;

interface DietaItemDef {
  key: DietaKey;
  label: string;
  icon: typeof Coffee;
}

const ITEMS_ESP: DietaItemDef[] = [
  { key: "desayunoEsp", label: "Desayuno España", icon: Coffee },
  { key: "comidaEsp", label: "Comida España", icon: Utensils },
  { key: "cenaEsp", label: "Cena España", icon: Utensils },
  { key: "pernoctaEsp", label: "Pernocta España", icon: Moon },
];

const ITEMS_EXT: DietaItemDef[] = [
  { key: "desayunoExt", label: "Desayuno Extranjero", icon: Coffee },
  { key: "comidaExt", label: "Comida Extranjero", icon: Utensils },
  { key: "cenaExt", label: "Cena Extranjero", icon: Utensils },
  { key: "pernoctaExt", label: "Pernocta Extranjera", icon: Moon },
];

export function DietasGastosSelector({
  dietas = emptyDietas(),
  onChange,
  disabled = false,
}: DietasGastosSelectorProps) {
  const current = { ...emptyDietas(), ...(dietas || {}) };

  const setQty = (key: DietaKey, qty: number) => {
    if (disabled) return;
    const cleanQty = Math.max(0, Math.floor(qty));
    onChange({ ...current, [key]: cleanQty });
  };

  const toggleChecked = (key: DietaKey) => {
    if (disabled) return;
    const isCurrentlyActive = (current[key] || 0) > 0;
    setQty(key, isCurrentlyActive ? 0 : 1);
  };

  const renderItem = (item: DietaItemDef, isExtranjero: boolean) => {
    const qty = current[item.key] || 0;
    const isChecked = qty > 0;
    const Icon = item.icon;

    return (
      <div
        key={item.key}
        className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 sm:p-3 transition-colors ${
          isChecked
            ? isExtranjero
              ? "border-amber-500/40 bg-amber-500/5 shadow-xs"
              : "border-primary/40 bg-primary/5 shadow-xs"
            : "border-border bg-background hover:bg-muted/40"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <label
          htmlFor={item.key}
          className={`flex items-center gap-2.5 flex-1 min-w-0 ${
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <Checkbox
            id={item.key}
            checked={isChecked}
            disabled={disabled}
            onCheckedChange={() => toggleChecked(item.key)}
            className="data-[state=checked]:bg-primary shrink-0"
          />
          <div className="flex items-center gap-1.5 truncate">
            <Icon
              className={`h-4 w-4 shrink-0 ${
                isChecked
                  ? isExtranjero
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-primary"
                  : "text-muted-foreground"
              }`}
            />
            <span
              className={`text-xs sm:text-sm font-medium truncate ${
                isChecked ? "text-foreground font-semibold" : "text-foreground/80"
              }`}
            >
              {item.label}
            </span>
          </div>
        </label>

        {/* SELECTOR DE CANTIDAD (+ / -) */}
        <div className="flex items-center gap-1 shrink-0">
          {isChecked ? (
            <div className="flex items-center gap-1 bg-background rounded-lg border border-border p-0.5 shadow-xs">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setQty(item.key, qty - 1)}
                title="Restar 1"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-xs font-bold text-foreground">
                {qty}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setQty(item.key, qty + 1)}
                title="Añadir 1"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setQty(item.key, 1)}
            >
              <Plus className="h-3 w-3 mr-1" /> 1
            </Button>
          )}
        </div>
      </div>
    );
  };

  const totalEsp =
    (current.desayunoEsp || 0) +
    (current.comidaEsp || 0) +
    (current.cenaEsp || 0) +
    (current.pernoctaEsp || 0);

  const totalExt =
    (current.desayunoExt || 0) +
    (current.comidaExt || 0) +
    (current.cenaExt || 0) +
    (current.pernoctaExt || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Marca y selecciona la cantidad de desayunos, comidas, cenas o pernoctas realizadas:
        </p>
        {(totalEsp > 0 || totalExt > 0) && (
          <Badge variant="secondary" className="text-xs font-medium">
            Total dietas: {totalEsp + totalExt}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BLOQUE ESPAÑA */}
        <div className="space-y-2 rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <span>🇪🇸</span> España (Nacional)
            </span>
            {totalEsp > 0 && (
              <Badge variant="outline" className="text-[10px] font-semibold text-primary">
                {totalEsp} registrada{totalEsp > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="space-y-2 pt-1">
            {ITEMS_ESP.map((item) => renderItem(item, false))}
          </div>
        </div>

        {/* BLOQUE EXTRANJERO */}
        <div className="space-y-2 rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <span>🌍</span> Extranjero (Internacional)
            </span>
            {totalExt > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 border-amber-500/30"
              >
                {totalExt} registrada{totalExt > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="space-y-2 pt-1">
            {ITEMS_EXT.map((item) => renderItem(item, true))}
          </div>
        </div>
      </div>
    </div>
  );
}
