import { useState } from "react";
import { Car, MapPin, CheckCircle2, Clock, Gauge, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Dia, WorkReport } from "@/lib/work-report";
import {
  calculateReportTotals,
  getCurrentTimeStr,
  getTodayDateStr,
} from "@/lib/time-calculator";

interface WorkTimeTrackerProps {
  dias: Dia[];
  onChange: (dias: Dia[]) => void;
  disabled?: boolean;
}

type ModalType = "salida" | "llegada" | "fin" | null;

export function WorkTimeTracker({ dias = [], onChange, disabled = false }: WorkTimeTrackerProps) {
  const [modalType, setModalType] = useState<ModalType>(null);
  const [tempTime, setTempTime] = useState("");
  const [tempKm, setTempKm] = useState("");

  const currentDayIndex = dias.length > 0 ? dias.length - 1 : 0;
  const currentDay: Dia | undefined = dias[currentDayIndex];

  // Calculate current totals
  const fakeReport: WorkReport = { dias } as WorkReport;
  const totals = calculateReportTotals(fakeReport);

  const openModal = (type: ModalType) => {
    if (disabled) return;
    const nowTime = getCurrentTimeStr();
    setTempTime(nowTime);

    if (type === "salida") {
      setTempKm(currentDay?.kmIda || "");
    } else if (type === "fin") {
      setTempKm(currentDay?.kmVuelta || currentDay?.kmIda || "");
    } else {
      setTempKm("");
    }

    setModalType(type);
  };

  const handleConfirm = () => {
    const today = getTodayDateStr();
    const updatedDias: Dia[] = [...dias];

    // Ensure at least one day exists
    if (updatedDias.length === 0) {
      updatedDias.push({
        fecha: today,
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
      });
    }

    const idx = updatedDias.length - 1;
    const day = { ...updatedDias[idx]! };
    if (!day.fecha) day.fecha = today;

    if (modalType === "salida") {
      day.idaDe = tempTime;
      if (tempKm.trim()) day.kmIda = tempKm.trim();
      updatedDias[idx] = day;
      onChange(updatedDias);
      toast.success(`🚗 Salida hacia cliente registrada a las ${tempTime}`);
    } else if (modalType === "llegada") {
      day.idaA = tempTime;
      // Start working in client
      const [h] = tempTime.split(":").map(Number);
      if (h !== undefined && h >= 14) {
        if (!day.tardeDe) day.tardeDe = tempTime;
      } else {
        if (!day.mananaDe) day.mananaDe = tempTime;
      }
      updatedDias[idx] = day;
      onChange(updatedDias);
      toast.success(`📍 Llegada registrada a las ${tempTime}. ¡Mano de obra iniciada!`);
    } else if (modalType === "fin") {
      // End work time
      const [h] = tempTime.split(":").map(Number);
      if (day.tardeDe || (h !== undefined && h >= 14)) {
        day.tardeA = tempTime;
      } else {
        day.mananaA = tempTime;
      }
      // Start return trip
      day.vueltaDe = tempTime;
      if (tempKm.trim()) day.kmVuelta = tempKm.trim();

      updatedDias[idx] = day;
      onChange(updatedDias);

      const newTotals = calculateReportTotals({ dias: updatedDias } as WorkReport);
      toast.success(
        `🏁 Fin de trabajo registrado a las ${tempTime}. Total: ${newTotals.formattedWorkHours} y ${newTotals.totalKm} km.`
      );
    }

    setModalType(null);
  };

  const hasSalida = !!currentDay?.idaDe;
  const hasLlegada = !!currentDay?.idaA;
  const hasFin = !!(currentDay?.tardeA || currentDay?.mananaA || currentDay?.vueltaDe);

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 pb-2.5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Control de Tiempos y Desplazamiento
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Pulsa cada botón para registrar horas y kilómetros en tiempo real
        </span>
      </div>

      {/* BOTONES DE CONTROL DE TIEMPO RÁPIDO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* BOTÓN 1: SALIDA HACIA CLIENTE */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => openModal("salida")}
          className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
            hasSalida
              ? "border-primary/40 bg-background shadow-xs hover:border-primary"
              : "border-primary/30 bg-background/90 hover:bg-background hover:border-primary shadow-xs"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">1. Salida hacia cliente</p>
              <p className="text-[11px] text-muted-foreground">
                {hasSalida ? `Salida: ${currentDay?.idaDe}` : "Toca para registrar salida"}
              </p>
            </div>
          </div>
          {hasSalida && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
        </button>

        {/* BOTÓN 2: LLEGADA A CLIENTE */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => openModal("llegada")}
          className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
            hasLlegada
              ? "border-primary/40 bg-background shadow-xs hover:border-primary"
              : "border-primary/30 bg-background/90 hover:bg-background hover:border-primary shadow-xs"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">2. Llegada a cliente</p>
              <p className="text-[11px] text-muted-foreground">
                {hasLlegada ? `Llegada: ${currentDay?.idaA}` : "Inicia mano de obra"}
              </p>
            </div>
          </div>
          {hasLlegada && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
        </button>

        {/* BOTÓN 3: FIN DE TRABAJO */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => openModal("fin")}
          className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
            hasFin
              ? "border-primary/40 bg-background shadow-xs hover:border-primary"
              : "border-primary/30 bg-background/90 hover:bg-background hover:border-primary shadow-xs"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">3. Fin de trabajo</p>
              <p className="text-[11px] text-muted-foreground">
                {hasFin
                  ? `Fin: ${currentDay?.tardeA || currentDay?.mananaA || currentDay?.vueltaDe}`
                  : "Cierra horas y calcula"}
              </p>
            </div>
          </div>
          {hasFin && <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
        </button>
      </div>

      {/* RESUMEN DE TOTALES CALCULADOS AUTOMÁTICAMENTE */}
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg bg-background p-3 border border-border/80">
        <div>
          <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary" /> Mano de obra
          </span>
          <span className="text-base font-bold text-foreground">
            {totals.formattedWorkHours || "0 h"}
          </span>
        </div>

        <div>
          <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
            <Gauge className="h-3 w-3 text-primary" /> Kilómetros totales
          </span>
          <span className="text-base font-bold text-foreground">
            {totals.totalKm} Km
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
            <Car className="h-3 w-3 text-primary" /> Tiempo viaje (Ida+Vuelta)
          </span>
          <span className="text-base font-bold text-foreground">
            {totals.formattedTravelHours || "0 min"}
          </span>
        </div>
      </div>

      {/* DIÁLOGO / MODAL RÁPIDO PARA CONFIRMAR O AJUSTAR HORA Y KM */}
      <Dialog open={modalType !== null} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              {modalType === "salida" && <Car className="h-5 w-5 text-primary" />}
              {modalType === "llegada" && <MapPin className="h-5 w-5 text-emerald-600" />}
              {modalType === "fin" && <Clock className="h-5 w-5 text-amber-600" />}
              <span>
                {modalType === "salida" && "Registrar salida hacia cliente"}
                {modalType === "llegada" && "Registrar llegada al cliente"}
                {modalType === "fin" && "Registrar fin de trabajo y regreso"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Hora de {modalType === "salida" ? "salida" : modalType === "llegada" ? "llegada" : "finalización"}:
              </label>
              <Input
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                className="text-base font-medium"
              />
            </div>

            {modalType === "salida" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kilómetros de ida (distancia al cliente):
                </label>
                <Input
                  type="text"
                  placeholder="Ej. 45"
                  value={tempKm}
                  onChange={(e) => setTempKm(e.target.value)}
                  className="text-base"
                />
              </div>
            )}

            {modalType === "llegada" && (
              <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg">
                Al confirmar la llegada, el tiempo de mano de obra en el cliente empezará a computar automáticamente desde esta hora.
              </p>
            )}

            {modalType === "fin" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kilómetros de vuelta:
                </label>
                <Input
                  type="text"
                  placeholder="Ej. 45"
                  value={tempKm}
                  onChange={(e) => setTempKm(e.target.value)}
                  className="text-base"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Se ha sugerido automáticamente la misma distancia de ida ({currentDay?.kmIda || "—"} Km).
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalType(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} className="font-semibold">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
