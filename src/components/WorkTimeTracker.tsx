import { useState } from "react";
import { Car, MapPin, CheckCircle2, Clock, Gauge, Calendar, Home, LogOut, Wrench, Sun, SunMedium } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Dia, WorkReport } from "@/lib/work-report";
import {
  calculateReportTotals,
  getCurrentTimeStr,
  getTodayDateStr,
  syncDayWorkIntervals,
  durationMinutes,
  formatMinutes,
} from "@/lib/time-calculator";

interface WorkTimeTrackerProps {
  dias: Dia[];
  onChange: (dias: Dia[]) => void;
  disabled?: boolean;
  isTaller?: boolean;
}

type ModalType = "salida_ida" | "llegada_cliente" | "salida_cliente" | "llegada_vuelta" | null;

export function WorkTimeTracker({ dias = [], onChange, disabled = false, isTaller = false }: WorkTimeTrackerProps) {
  const [modalType, setModalType] = useState<ModalType>(null);
  const [tempTime, setTempTime] = useState("");
  const [tempKm, setTempKm] = useState("");

  const currentDayIndex = dias.length > 0 ? dias.length - 1 : 0;
  const currentDay: Dia | undefined = dias[currentDayIndex];

  // Calculate current totals
  const fakeReport: WorkReport = { dias, tipo: isTaller ? "taller" : "trabajo" } as WorkReport;
  const totals = calculateReportTotals(fakeReport);

  const getEnsuredDias = (): Dia[] => {
    if (dias.length > 0) return [...dias];
    return [
      {
        fecha: getTodayDateStr(),
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
      },
    ];
  };

  const updateFecha = (val: string) => {
    const list = getEnsuredDias();
    const idx = list.length - 1;
    list[idx] = { ...list[idx]!, fecha: val };
    onChange(list);
  };

  const openModal = (type: ModalType) => {
    if (disabled) return;
    const nowTime = getCurrentTimeStr();

    if (isTaller) {
      if (type === "salida_ida") setTempTime(currentDay?.mananaDe || nowTime);
      else if (type === "llegada_cliente") setTempTime(currentDay?.mananaA || nowTime);
      else if (type === "salida_cliente") setTempTime(currentDay?.tardeDe || nowTime);
      else if (type === "llegada_vuelta") setTempTime(currentDay?.tardeA || nowTime);
      setTempKm("");
    } else {
      // Solo se piden kilómetros en salida a cliente y salida de cliente.
      // Si la hora ya estaba registrada previamente en ese botón, se muestra esa hora para no sobreescribirla por accidente.
      if (type === "salida_ida") {
        setTempTime(currentDay?.idaDe || nowTime);
        setTempKm(currentDay?.kmIda || "");
      } else if (type === "llegada_cliente") {
        setTempTime(currentDay?.idaA || nowTime);
        setTempKm("");
      } else if (type === "salida_cliente") {
        setTempTime(currentDay?.vueltaDe || nowTime);
        setTempKm(currentDay?.kmVuelta || currentDay?.kmIda || "");
      } else if (type === "llegada_vuelta") {
        setTempTime(currentDay?.vueltaA || nowTime);
        setTempKm("");
      }
    }

    setModalType(type);
  };

  const handleConfirm = () => {
    const list = getEnsuredDias();
    const idx = list.length - 1;
    let day = { ...list[idx]! };
    if (!day.fecha) day.fecha = getTodayDateStr();

    if (isTaller) {
      if (modalType === "salida_ida") {
        day.mananaDe = tempTime;
        toast.success(`⏰ Entrada mañana registrada a las ${tempTime}`);
      } else if (modalType === "llegada_cliente") {
        day.mananaA = tempTime;
        toast.success(`⏸️ Salida mañana registrada a las ${tempTime}`);
      } else if (modalType === "salida_cliente") {
        day.tardeDe = tempTime;
        toast.success(`⏰ Entrada tarde registrada a las ${tempTime}`);
      } else if (modalType === "llegada_vuelta") {
        day.tardeA = tempTime;
        toast.success(`🏁 Salida tarde registrada a las ${tempTime}`);
      }
      day.kmIda = "";
      day.kmVuelta = "";
      list[idx] = day;
      onChange(list);
    } else {
      if (modalType === "salida_ida") {
        day.idaDe = tempTime;
        day.kmIda = tempKm.trim();
        list[idx] = day;
        onChange(list);
        toast.success(`🚗 Salida a cliente registrada a las ${tempTime}${tempKm ? ` (${tempKm} km)` : ""}`);
      } else if (modalType === "llegada_cliente") {
        day.idaA = tempTime;
        // Sincroniza inicio de mano de obra
        day = syncDayWorkIntervals(day);
        list[idx] = day;
        onChange(list);
        toast.success(`📍 Llegada a cliente registrada a las ${tempTime}. ¡Mano de obra iniciada!`);
      } else if (modalType === "salida_cliente") {
        day.vueltaDe = tempTime;
        day.kmVuelta = tempKm.trim();
        // Sincroniza fin de mano de obra (desde llegada hasta salida de cliente)
        day = syncDayWorkIntervals(day);
        list[idx] = day;
        onChange(list);
        toast.success(`🚪 Salida de cliente registrada a las ${tempTime}${tempKm ? ` (${tempKm} km)` : ""}`);
      } else if (modalType === "llegada_vuelta") {
        // Arrived back
        day.vueltaA = tempTime;
        list[idx] = day;
        onChange(list);

        const newTotals = calculateReportTotals({ dias: list } as WorkReport);
        toast.success(
          `🏁 Llegada de vuelta registrada a las ${tempTime}. Total: ${newTotals.formattedWorkHours} mano de obra y ${newTotals.totalKm} km.`
        );
      }
    }

    setModalType(null);
  };

  const hasSalidaIda = isTaller ? !!currentDay?.mananaDe : !!currentDay?.idaDe;
  const hasLlegadaCliente = isTaller ? !!currentDay?.mananaA : !!currentDay?.idaA;
  const hasSalidaCliente = isTaller ? !!currentDay?.tardeDe : !!currentDay?.vueltaDe;
  const hasLlegadaVuelta = isTaller ? !!currentDay?.tardeA : !!currentDay?.vueltaA;

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 shadow-xs print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 pb-3">
        <div className="flex items-center gap-2">
          {isTaller ? <Wrench className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-primary" />}
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            {isTaller ? "Control de Tiempos de Taller" : "Control de Tiempos y Desplazamientos"}
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {isTaller ? "Registro de jornada en taller (sin desplazamientos ni km)" : "Registro rápido de jornada y kilómetros"}
        </span>
      </div>

      {/* FECHA DE TRABAJO */}
      <div className="bg-background p-3 rounded-xl border border-border max-w-xs">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-primary" /> Fecha de trabajo
        </label>
        <Input
          type="date"
          value={currentDay?.fecha || getTodayDateStr()}
          disabled={disabled}
          onChange={(e) => updateFecha(e.target.value)}
          className="h-10 text-sm"
        />
      </div>

      {/* LOS 4 BOTONES DE REGISTRO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* BOTÓN 1 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => openModal("salida_ida")}
          className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
            hasSalidaIda
              ? "border-primary/50 bg-background shadow-xs hover:border-primary"
              : "border-primary/30 bg-background/90 hover:bg-background hover:border-primary shadow-xs"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isTaller ? <Sun className="h-5 w-5" /> : <Car className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {isTaller ? "1. Entrada mañana" : "1. Salida a cliente"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {isTaller
                  ? (currentDay?.mananaDe ? `Entrada: ${currentDay.mananaDe}` : "Pulsar al entrar")
                  : (hasSalidaIda ? `${currentDay?.idaDe}${currentDay?.kmIda ? ` · ${currentDay.kmIda} km` : ""}` : "Pulsar al salir")}
              </p>
            </div>
          </div>
          {hasSalidaIda && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
        </button>

        {/* BOTÓN 2 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => openModal("llegada_cliente")}
          className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
            hasLlegadaCliente
              ? "border-emerald-500/50 bg-background shadow-xs hover:border-emerald-500"
              : "border-emerald-500/30 bg-background/90 hover:bg-background hover:border-emerald-500 shadow-xs"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {isTaller ? <LogOut className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {isTaller ? "2. Salida mañana" : "2. Llegada a cliente"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {isTaller
                  ? (currentDay?.mananaA ? `Salida: ${currentDay.mananaA}` : "Pausa / Fin mañana")
                  : (hasLlegadaCliente ? `Llegada: ${currentDay?.idaA}` : "Inicia trabajo")}
              </p>
            </div>
          </div>
          {hasLlegadaCliente && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
        </button>

        {/* BOTÓN 3 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => openModal("salida_cliente")}
          className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
            hasSalidaCliente
              ? "border-amber-500/50 bg-background shadow-xs hover:border-amber-500"
              : "border-amber-500/30 bg-background/90 hover:bg-background hover:border-amber-500 shadow-xs"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {isTaller ? <SunMedium className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {isTaller ? "3. Entrada tarde" : "3. Salida de cliente"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {isTaller
                  ? (currentDay?.tardeDe ? `Entrada: ${currentDay.tardeDe}` : "Reanudación tarde")
                  : (hasSalidaCliente ? `${currentDay?.vueltaDe}${currentDay?.kmVuelta ? ` · ${currentDay.kmVuelta} km` : ""}` : "Fin trabajo / vuelta")}
              </p>
            </div>
          </div>
          {hasSalidaCliente && <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
        </button>

        {/* BOTÓN 4 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => openModal("llegada_vuelta")}
          className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
            hasLlegadaVuelta
              ? "border-purple-500/50 bg-background shadow-xs hover:border-purple-500"
              : "border-purple-500/30 bg-background/90 hover:bg-background hover:border-purple-500 shadow-xs"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              {isTaller ? <CheckCircle2 className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {isTaller ? "4. Salida tarde" : "4. Llegada de vuelta"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {isTaller
                  ? (currentDay?.tardeA ? `Salida: ${currentDay.tardeA}` : "Fin de jornada")
                  : (hasLlegadaVuelta ? `Llegada: ${currentDay?.vueltaA}` : "Fin viaje de vuelta")}
              </p>
            </div>
          </div>
          {hasLlegadaVuelta && <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />}
        </button>
      </div>

      {/* RESUMEN DE TOTALES CALCULADOS */}
      {isTaller ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl bg-background p-3.5 border border-border">
          <div>
            <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
              <Wrench className="h-3 w-3 text-primary" /> Mano de obra taller
            </span>
            <span className="text-base sm:text-lg font-bold text-foreground">
              {totals.formattedWorkHours || "0 h"}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              Total tiempo trabajado
            </span>
          </div>

          <div>
            <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
              <Sun className="h-3 w-3 text-amber-500" /> Turno Mañana
            </span>
            <span className="text-base sm:text-lg font-bold text-foreground">
              {currentDay?.mananaDe && currentDay?.mananaA
                ? formatMinutes(durationMinutes(currentDay.mananaDe, currentDay.mananaA))
                : "—"}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {currentDay?.mananaDe && currentDay?.mananaA ? `${currentDay.mananaDe} a ${currentDay.mananaA}` : "Sin registrar"}
            </span>
          </div>

          <div>
            <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
              <SunMedium className="h-3 w-3 text-primary" /> Turno Tarde
            </span>
            <span className="text-base sm:text-lg font-bold text-foreground">
              {currentDay?.tardeDe && currentDay?.tardeA
                ? formatMinutes(durationMinutes(currentDay.tardeDe, currentDay.tardeA))
                : "—"}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {currentDay?.tardeDe && currentDay?.tardeA ? `${currentDay.tardeDe} a ${currentDay.tardeA}` : "Sin registrar"}
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 rounded-xl bg-background p-3.5 border border-border">
          <div>
            <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-primary" /> Mano de obra
            </span>
            <span className="text-base sm:text-lg font-bold text-foreground">
              {totals.formattedWorkHours || "0 h"}
            </span>
          </div>

          <div>
            <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3 w-3 text-primary" /> Kilómetros totales
            </span>
            <span className="text-base sm:text-lg font-bold text-foreground">
              {totals.totalKm} Km
            </span>
            <span className="block text-[10px] text-muted-foreground">
              ({currentDay?.kmIda || "0"} ida + {currentDay?.kmVuelta || "0"} vuelta)
            </span>
          </div>

          <div>
            <span className="block text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
              <Car className="h-3 w-3 text-primary" /> Tiempo viaje total
            </span>
            <span className="text-base sm:text-lg font-bold text-foreground">
              {totals.formattedTravelHours || "0 min"}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              Ida + Vuelta
            </span>
          </div>
        </div>
      )}

      {/* MODAL PARA CONFIRMAR HORA */}
      <Dialog open={modalType !== null} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              {isTaller ? (
                <>
                  <Wrench className="h-5 w-5 text-primary" />
                  <span>
                    {modalType === "salida_ida" && "Entrada mañana (Taller)"}
                    {modalType === "llegada_cliente" && "Salida mañana / Pausa"}
                    {modalType === "salida_cliente" && "Entrada tarde (Taller)"}
                    {modalType === "llegada_vuelta" && "Salida tarde (Fin jornada)"}
                  </span>
                </>
              ) : (
                <>
                  {modalType === "salida_ida" && <Car className="h-5 w-5 text-primary" />}
                  {modalType === "llegada_cliente" && <MapPin className="h-5 w-5 text-emerald-600" />}
                  {modalType === "salida_cliente" && <LogOut className="h-5 w-5 text-amber-600" />}
                  {modalType === "llegada_vuelta" && <Home className="h-5 w-5 text-purple-600" />}
                  <span>
                    {modalType === "salida_ida" && "Salida a cliente"}
                    {modalType === "llegada_cliente" && "Llegada a cliente"}
                    {modalType === "salida_cliente" && "Salida de cliente"}
                    {modalType === "llegada_vuelta" && "Llegada de vuelta"}
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {isTaller ? (
                  <>
                    {modalType === "salida_ida" && "Hora de entrada por la mañana:"}
                    {modalType === "llegada_cliente" && "Hora de salida por la mañana (pausa):"}
                    {modalType === "salida_cliente" && "Hora de entrada por la tarde:"}
                    {modalType === "llegada_vuelta" && "Hora de salida por la tarde (fin de jornada):"}
                  </>
                ) : (
                  <>
                    {modalType === "salida_ida" && "Hora de salida hacia cliente:"}
                    {modalType === "llegada_cliente" && "Hora de llegada al cliente:"}
                    {modalType === "salida_cliente" && "Hora de salida del cliente (regreso):"}
                    {modalType === "llegada_vuelta" && "Hora de llegada de vuelta (base / casa):"}
                  </>
                )}
              </label>
              <Input
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                className="text-base font-medium h-11"
              />
            </div>

            {/* SOLO se pide Kilómetros en partes normales a clientes */}
            {!isTaller && modalType === "salida_ida" && (
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

            {!isTaller && modalType === "llegada_cliente" && (
              <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg">
                Al confirmar la llegada al cliente, la mano de obra empieza a computar automáticamente a partir de esta hora.
              </p>
            )}

            {!isTaller && modalType === "salida_cliente" && (
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

            {!isTaller && modalType === "llegada_vuelta" && (
              <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg">
                Al confirmar la llegada de vuelta, finaliza el cómputo total del desplazamiento.
              </p>
            )}

            {isTaller && (
              <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg">
                {modalType === "salida_ida" && "Inicio de jornada de mañana en el taller."}
                {modalType === "llegada_cliente" && "Pausa de almuerzo o fin de turno de mañana."}
                {modalType === "salida_cliente" && "Reanudación de jornada de taller por la tarde."}
                {modalType === "llegada_vuelta" && "Fin de la jornada de trabajo en taller."}
              </p>
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
}
