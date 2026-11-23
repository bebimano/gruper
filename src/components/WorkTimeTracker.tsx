import { useState } from "react";
import {
  Car,
  MapPin,
  CheckCircle2,
  Clock,
  Gauge,
  Calendar,
  Home,
  LogOut,
  Plus,
  Trash2,
  ChevronRight,
  Sparkles,
  Sliders,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Dia, WorkReport } from "@/lib/work-report";
import {
  calculateReportTotals,
  calculateDayTotals,
  getCurrentTimeStr,
  getTodayDateStr,
  syncDayWorkIntervals,
} from "@/lib/time-calculator";

interface WorkTimeTrackerProps {
  dias: Dia[];
  onChange: (dias: Dia[]) => void;
  disabled?: boolean;
}

type ModalType = "salida_ida" | "llegada_cliente" | "salida_cliente" | "llegada_vuelta" | null;

function emptyDay(dateStr?: string): Dia {
  return {
    fecha: dateStr || getTodayDateStr(),
    idaDe: "",
    idaA: "",
    kmIda: "",
    mananaDe: "",
    mananaA: "",
    tardeDe: "",
    tardeA: "",
    vueltaDe: "",
    vueltaA: "",
    kmVuelta: "",
  };
}

function getNextDateStr(lastDateStr?: string): string {
  if (!lastDateStr) return getTodayDateStr();
  const d = new Date(lastDateStr);
  if (isNaN(d.getTime())) return getTodayDateStr();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return "Sin fecha";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

export function WorkTimeTracker({ dias = [], onChange, disabled = false }: WorkTimeTrackerProps) {
  // Ensure at least 1 day exists
  const ensuredDias: Dia[] = dias.length > 0 ? dias : [emptyDay()];

  const [activeDayIndex, setActiveDayIndex] = useState<number>(() => {
    return Math.max(0, (dias.length || 1) - 1);
  });
  const [modalType, setModalType] = useState<ModalType>(null);
  const [tempTime, setTempTime] = useState("");
  const [tempKm, setTempKm] = useState("");
  const [showManualHours, setShowManualHours] = useState(false);

  // Safe active day
  const validIndex = Math.min(Math.max(0, activeDayIndex), ensuredDias.length - 1);
  const currentDay = ensuredDias[validIndex] ?? emptyDay();

  // Calculations
  const fakeReport: WorkReport = { dias: ensuredDias } as WorkReport;
  const totals = calculateReportTotals(fakeReport);
  const currentDayTotals = calculateDayTotals(currentDay);

  const updateCurrentDay = (patch: Partial<Dia>) => {
    const list = [...ensuredDias];
    list[validIndex] = { ...list[validIndex]!, ...patch };
    onChange(list);
  };

  const handleAddDay = () => {
    if (disabled) return;
    const lastDay = ensuredDias[ensuredDias.length - 1];
    const nextDate = getNextDateStr(lastDay?.fecha);
    const newDay = emptyDay(nextDate);
    const updated = [...ensuredDias, newDay];
    onChange(updated);
    setActiveDayIndex(updated.length - 1);
    toast.success(`Día ${updated.length} añadido (${formatDateShort(nextDate)})`);
  };

  const handleRemoveDay = (indexToRemove: number) => {
    if (disabled) return;
    if (ensuredDias.length <= 1) {
      toast.error("El parte debe tener al menos un día de trabajo");
      return;
    }
    const targetDay = ensuredDias[indexToRemove];
    const dateLabel = formatDateShort(targetDay?.fecha);
    if (!confirm(`¿Eliminar el Día ${indexToRemove + 1} (${dateLabel}) de este parte?`)) {
      return;
    }

    const updated = ensuredDias.filter((_, i) => i !== indexToRemove);
    onChange(updated);
    setActiveDayIndex(Math.max(0, Math.min(validIndex, updated.length - 1)));
    toast.success(`Día eliminado`);
  };

  const openModal = (type: ModalType) => {
    if (disabled) return;
    const nowTime = getCurrentTimeStr();

    if (type === "salida_ida") {
      setTempTime(currentDay.idaDe || nowTime);
      setTempKm(currentDay.kmIda || "");
    } else if (type === "llegada_cliente") {
      setTempTime(currentDay.idaA || nowTime);
      setTempKm("");
    } else if (type === "salida_cliente") {
      setTempTime(currentDay.vueltaDe || nowTime);
      setTempKm(currentDay.kmVuelta || currentDay.kmIda || "");
    } else if (type === "llegada_vuelta") {
      setTempTime(currentDay.vueltaA || nowTime);
      setTempKm("");
    }

    setModalType(type);
  };

  const handleConfirm = () => {
    let day = { ...currentDay };
    if (!day.fecha) day.fecha = getTodayDateStr();

    if (modalType === "salida_ida") {
      day.idaDe = tempTime;
      day.kmIda = tempKm.trim();
      updateCurrentDay(day);
      toast.success(`🚗 Salida a cliente registrada a las ${tempTime}${tempKm ? ` (${tempKm} km)` : ""}`);
    } else if (modalType === "llegada_cliente") {
      day.idaA = tempTime;
      day = syncDayWorkIntervals(day);
      updateCurrentDay(day);
      toast.success(`📍 Llegada a cliente registrada a las ${tempTime}. ¡Mano de obra iniciada!`);
    } else if (modalType === "salida_cliente") {
      day.vueltaDe = tempTime;
      day.kmVuelta = tempKm.trim();
      day = syncDayWorkIntervals(day);
      updateCurrentDay(day);
      toast.success(`🚪 Salida de cliente registrada a las ${tempTime}${tempKm ? ` (${tempKm} km)` : ""}`);
    } else if (modalType === "llegada_vuelta") {
      day.vueltaA = tempTime;
      updateCurrentDay(day);
      const dayTotals = calculateDayTotals(day);
      toast.success(
        `🏁 Llegada de vuelta registrada (${tempTime}). Día ${validIndex + 1}: ${dayTotals.formattedWorkHours} y ${dayTotals.totalKm} km.`
      );
    }

    setModalType(null);
  };

  const hasSalidaIda = !!currentDay.idaDe;
  const hasLlegadaCliente = !!currentDay.idaA;
  const hasSalidaCliente = !!currentDay.vueltaDe;
  const hasLlegadaVuelta = !!currentDay.vueltaA;

  return (
    <div className="space-y-4 rounded-2xl border border-primary/25 bg-gradient-to-b from-card via-card to-primary/[0.02] p-4 sm:p-5 shadow-xs print:hidden">
      {/* CABECERA SUPERIOR MODERNA CON TÍTULO Y TOTALES GLOBALES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>Control de Tiempos y Jornadas</span>
              <Badge variant="outline" className="text-[11px] font-bold bg-primary/5 text-primary border-primary/30">
                {ensuredDias.length} {ensuredDias.length === 1 ? "día" : "días"} de trabajo
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registra los horarios y desplazamientos de cada jornada de este parte de trabajo.
            </p>
          </div>
        </div>

        {/* Botón para añadir otro día */}
        {!disabled && (
          <Button
            type="button"
            size="sm"
            onClick={handleAddDay}
            className="rounded-xl h-9 px-3.5 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Añadir día de trabajo</span>
          </Button>
        )}
      </div>

      {/* SELECTOR HORIZONTAL DE DÍAS (PESTAÑAS TÁCTILES INDUSTRIALES) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          <span>Jornadas registradas en este parte:</span>
        </label>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {ensuredDias.map((d, idx) => {
            const isActive = idx === validIndex;
            const dayTotals = calculateDayTotals(d);
            const isCompleted = d.idaDe && d.idaA && d.vueltaDe && d.vueltaA;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveDayIndex(idx)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_2px_8px_rgba(37,159,253,0.35)] scale-[1.02]"
                    : "bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground border-border/70"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isCompleted ? (
                    <CheckCircle2 className={`h-3.5 w-3.5 ${isActive ? "text-primary-foreground" : "text-emerald-500"}`} />
                  ) : (
                    <Calendar className={`h-3.5 w-3.5 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
                  )}
                  <span>Día {idx + 1}</span>
                  <span className={`font-mono text-[11px] ${isActive ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                    ({formatDateShort(d.fecha)})
                  </span>
                </div>

                {dayTotals.workMinutes > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {dayTotals.formattedWorkHours}
                  </span>
                )}
              </button>
            );
          })}

          {!disabled && (
            <button
              type="button"
              onClick={handleAddDay}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-dashed border-primary/40 text-primary hover:bg-primary/10 transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Nuevo día</span>
            </button>
          )}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL DEL DÍA ACTIVO */}
      <div className="rounded-xl border border-border/90 bg-card p-4 space-y-4 shadow-2xs">
        {/* Cabecera del día activo con selector de fecha y botón de eliminar día */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
              {validIndex + 1}
            </span>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Jornada {validIndex + 1} de {ensuredDias.length}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Mano de obra: <strong className="text-foreground">{currentDayTotals.formattedWorkHours}</strong> · Desplazamiento: <strong className="text-foreground">{currentDayTotals.totalKm} Km</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de fecha para este día */}
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border">
              <Calendar className="h-3.5 w-3.5 text-primary ml-1.5" />
              <Input
                type="date"
                value={currentDay.fecha || getTodayDateStr()}
                disabled={disabled}
                onChange={(e) => updateCurrentDay({ fecha: e.target.value })}
                className="h-8 text-xs font-semibold bg-background w-36 border-0"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => updateCurrentDay({ fecha: getTodayDateStr() })}
                  className="text-[11px] text-primary hover:underline font-bold px-2 cursor-pointer"
                  title="Poner fecha de hoy"
                >
                  Hoy
                </button>
              )}
            </div>

            {/* Eliminar día si hay más de 1 */}
            {ensuredDias.length > 1 && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveDay(validIndex)}
                className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                title={`Eliminar el Día ${validIndex + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* LOS 4 BOTONES DE REGISTRO PASO A PASO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* BOTÓN 1: SALIDA A CLIENTE */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => openModal("salida_ida")}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
              hasSalidaIda
                ? "border-primary/60 bg-primary/5 shadow-xs hover:border-primary"
                : "border-border/80 bg-background hover:border-primary/50 shadow-2xs"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Car className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">1. Salida a cliente</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {hasSalidaIda
                    ? `${currentDay.idaDe}${currentDay.kmIda ? ` · ${currentDay.kmIda} km` : ""}`
                    : "Pulsar al salir"}
                </p>
              </div>
            </div>
            {hasSalidaIda && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
          </button>

          {/* BOTÓN 2: LLEGADA A CLIENTE */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => openModal("llegada_cliente")}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
              hasLlegadaCliente
                ? "border-emerald-500/60 bg-emerald-500/5 shadow-xs hover:border-emerald-500"
                : "border-border/80 bg-background hover:border-emerald-500/50 shadow-2xs"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">2. Llegada a cliente</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {hasLlegadaCliente ? `Llegada: ${currentDay.idaA}` : "Inicia trabajo"}
                </p>
              </div>
            </div>
            {hasLlegadaCliente && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
          </button>

          {/* BOTÓN 3: SALIDA DE CLIENTE */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => openModal("salida_cliente")}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
              hasSalidaCliente
                ? "border-amber-500/60 bg-amber-500/5 shadow-xs hover:border-amber-500"
                : "border-border/80 bg-background hover:border-amber-500/50 shadow-2xs"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">3. Salida de cliente</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {hasSalidaCliente
                    ? `${currentDay.vueltaDe}${currentDay.kmVuelta ? ` · ${currentDay.kmVuelta} km` : ""}`
                    : "Fin trabajo / vuelta"}
                </p>
              </div>
            </div>
            {hasSalidaCliente && (
              <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
          </button>

          {/* BOTÓN 4: LLEGADA DE VUELTA */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => openModal("llegada_vuelta")}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
              hasLlegadaVuelta
                ? "border-purple-500/60 bg-purple-500/5 shadow-xs hover:border-purple-500"
                : "border-border/80 bg-background hover:border-purple-500/50 shadow-2xs"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Home className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">4. Llegada de vuelta</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {hasLlegadaVuelta ? `Llegada: ${currentDay.vueltaA}` : "Fin de viaje"}
                </p>
              </div>
            </div>
            {hasLlegadaVuelta && (
              <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
            )}
          </button>
        </div>

        {/* AJUSTE MANUAL OPCIONAL DE HORAS MAÑANA / TARDE */}
        <div className="border-t border-border/60 pt-2.5">
          <button
            type="button"
            onClick={() => setShowManualHours(!showManualHours)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{showManualHours ? "Ocultar desglose manual de horas" : "Ver / ajustar tramos de mañana y tarde manualmente"}</span>
          </button>

          {showManualHours && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 p-3 rounded-xl bg-muted/30 border border-border">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Mañana De</label>
                <Input
                  type="time"
                  value={currentDay.mananaDe || ""}
                  disabled={disabled}
                  onChange={(e) => updateCurrentDay({ mananaDe: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Mañana A</label>
                <Input
                  type="time"
                  value={currentDay.mananaA || ""}
                  disabled={disabled}
                  onChange={(e) => updateCurrentDay({ mananaA: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Tarde De</label>
                <Input
                  type="time"
                  value={currentDay.tardeDe || ""}
                  disabled={disabled}
                  onChange={(e) => updateCurrentDay({ tardeDe: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Tarde A</label>
                <Input
                  type="time"
                  value={currentDay.tardeA || ""}
                  disabled={disabled}
                  onChange={(e) => updateCurrentDay({ tardeA: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RESUMEN GLOBAL COMBINADO DE TODOS LOS DÍAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl bg-muted/40 p-3.5 border border-border/80">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary" /> Mano de obra total
          </span>
          <span className="text-base sm:text-lg font-bold text-foreground">
            {totals.formattedWorkHours || "0 h"}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            {ensuredDias.length} {ensuredDias.length === 1 ? "jornada" : "jornadas"}
          </span>
        </div>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Gauge className="h-3 w-3 text-primary" /> Kilómetros totales
          </span>
          <span className="text-base sm:text-lg font-bold text-foreground">
            {totals.totalKm} Km
          </span>
          <span className="block text-[10px] text-muted-foreground">
            Suma de todos los viajes
          </span>
        </div>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Car className="h-3 w-3 text-primary" /> Tiempo viaje total
          </span>
          <span className="text-base sm:text-lg font-bold text-foreground">
            {totals.formattedTravelHours || "0 min"}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            Idas y vueltas
          </span>
        </div>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-primary" /> Días en este parte
          </span>
          <span className="text-base sm:text-lg font-bold text-foreground">
            {ensuredDias.length} {ensuredDias.length === 1 ? "Día" : "Días"}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            Activo: Día {validIndex + 1}
          </span>
        </div>
      </div>

      {/* MODAL PARA CONFIRMAR HORA Y KILÓMETROS */}
      <Dialog open={modalType !== null} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              {modalType === "salida_ida" && <Car className="h-5 w-5 text-primary" />}
              {modalType === "llegada_cliente" && <MapPin className="h-5 w-5 text-emerald-600" />}
              {modalType === "salida_cliente" && <LogOut className="h-5 w-5 text-amber-600" />}
              {modalType === "llegada_vuelta" && <Home className="h-5 w-5 text-purple-600" />}
              <span>
                {modalType === "salida_ida" && `Día ${validIndex + 1} · Salida a cliente`}
                {modalType === "llegada_cliente" && `Día ${validIndex + 1} · Llegada a cliente`}
                {modalType === "salida_cliente" && `Día ${validIndex + 1} · Salida de cliente`}
                {modalType === "llegada_vuelta" && `Día ${validIndex + 1} · Llegada de vuelta`}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {modalType === "salida_ida" && "Hora de salida hacia cliente:"}
                {modalType === "llegada_cliente" && "Hora de llegada al cliente:"}
                {modalType === "salida_cliente" && "Hora de salida del cliente (regreso):"}
                {modalType === "llegada_vuelta" && "Hora de llegada de vuelta (base / casa):"}
              </label>
              <Input
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                className="text-base font-medium h-11"
              />
            </div>

            {/* SOLO se pide Kilómetros en Salida a cliente */}
            {modalType === "salida_ida" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kilómetros (Ida):
                </label>
                <Input
                  type="text"
                  placeholder="Ej. 45"
                  value={tempKm}
                  onChange={(e) => setTempKm(e.target.value)}
                  className="text-base h-11"
                  autoFocus
                />
              </div>
            )}

            {modalType === "llegada_cliente" && (
              <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg">
                Al confirmar la llegada al cliente, la mano de obra empieza a computar automáticamente a partir de esta hora.
              </p>
            )}

            {modalType === "salida_cliente" && (
              <div>
                <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg mb-2">
                  Al salir del cliente, se cierra la mano de obra y se inicia el tiempo de viaje de vuelta.
                </p>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kilómetros (Vuelta):
                </label>
                <Input
                  type="text"
                  placeholder="Ej. 45"
                  value={tempKm}
                  onChange={(e) => setTempKm(e.target.value)}
                  className="text-base h-11"
                  autoFocus
                />
              </div>
            )}

            {modalType === "llegada_vuelta" && (
              <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg">
                Al confirmar la llegada de vuelta, finaliza el cómputo total del desplazamiento de esta jornada.
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalType(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} className="font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
