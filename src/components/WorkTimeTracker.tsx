import { useState } from "react";
import { Car, MapPin, CheckCircle2, Clock, Gauge, Calendar, Home, LogOut } from "lucide-react";
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

type ModalType = "salida_ida" | "llegada_cliente" | "salida_cliente" | "llegada_vuelta" | null;

export function WorkTimeTracker({ dias = [], onChange, disabled = false }: WorkTimeTrackerProps) {
  const [modalType, setModalType] = useState<ModalType>(null);
  const [tempTime, setTempTime] = useState("");
  const [tempKm, setTempKm] = useState("");

  const currentDayIndex = dias.length > 0 ? dias.length - 1 : 0;
  const currentDay: Dia | undefined = dias[currentDayIndex];

  // Calculate current totals
  const fakeReport: WorkReport = { dias } as WorkReport;
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

  const updateField = (field: keyof Dia, val: string) => {
    const list = getEnsuredDias();
    const idx = list.length - 1;
    list[idx] = { ...list[idx]!, [field]: val };
    onChange(list);
  };

  const openModal = (type: ModalType) => {
    if (disabled) return;
    const nowTime = getCurrentTimeStr();
    setTempTime(nowTime);

    if (type === "salida_ida") {
      setTempKm(currentDay?.kmIda || "");
    } else if (type === "salida_cliente") {
      setTempKm(currentDay?.kmVuelta || currentDay?.kmIda || "");
    } else if (type === "llegada_vuelta") {
      setTempKm(currentDay?.kmVuelta || currentDay?.kmIda || "");
    } else {
      setTempKm("");
    }

    setModalType(type);
  };

  const handleConfirm = () => {
    const list = getEnsuredDias();
    const idx = list.length - 1;
    const day = { ...list[idx]! };
    if (!day.fecha) day.fecha = getTodayDateStr();

    if (modalType === "salida_ida") {
      day.idaDe = tempTime;
      if (tempKm.trim()) day.kmIda = tempKm.trim();
      list[idx] = day;
      onChange(list);
      toast.success(`🚗 Salida hacia cliente registrada a las ${tempTime}`);
    } else if (modalType === "llegada_cliente") {
      day.idaA = tempTime;
      // Start work time at arrival if not yet set
      const [h] = tempTime.split(":").map(Number);
      if (h !== undefined && h >= 14) {
        if (!day.tardeDe) day.tardeDe = tempTime;
      } else {
        if (!day.mananaDe) day.mananaDe = tempTime;
      }
      list[idx] = day;
      onChange(list);
      toast.success(`📍 Llegada al cliente registrada a las ${tempTime}. ¡Mano de obra iniciada!`);
    } else if (modalType === "salida_cliente") {
      // End work time
      const [h] = tempTime.split(":").map(Number);
      if (day.tardeDe || (h !== undefined && h >= 14)) {
        if (!day.tardeA) day.tardeA = tempTime;
      } else {
        if (!day.mananaA) day.mananaA = tempTime;
      }
      // Start return trip
      day.vueltaDe = tempTime;
      if (tempKm.trim()) day.kmVuelta = tempKm.trim();

      list[idx] = day;
      onChange(list);
      toast.success(`🚪 Fin de trabajo y salida del cliente registrados a las ${tempTime}. ¡Buen viaje de vuelta!`);
    } else if (modalType === "llegada_vuelta") {
      // Arrived back at base/home
      day.vueltaA = tempTime;
      if (tempKm.trim()) day.kmVuelta = tempKm.trim();

      list[idx] = day;
      onChange(list);

      const newTotals = calculateReportTotals({ dias: list } as WorkReport);
      toast.success(
        `🏁 Llegada de vuelta registrada a las ${tempTime}. Total: ${newTotals.formattedWorkHours} mano de obra y ${newTotals.totalKm} km.`
      );
    }

    setModalType(null);
  };

  const hasSalidaIda = !!currentDay?.idaDe;
  const hasLlegadaCliente = !!currentDay?.idaA;
  const hasSalidaCliente = !!currentDay?.vueltaDe;
  const hasLlegadaVuelta = !!currentDay?.vueltaA;

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 shadow-xs print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Control de Horas de Trabajo y Desplazamientos
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Registro automático o manual de ida, trabajo y vuelta
        </span>
      </div>

      {/* FECHA DE TRABAJO */}
      <div className="bg-background p-3 rounded-xl border border-border">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-primary" /> Fecha de trabajo
        </label>
        <Input
          type="date"
          value={currentDay?.fecha || getTodayDateStr()}
          disabled={disabled}
          onChange={(e) => updateField("fecha", e.target.value)}
          className="h-10 text-sm max-w-xs"
        />
      </div>

      {/* BOTONES DE CONTROL DE TIEMPO RÁPIDO (4 FASES DEL SERVICIO) */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          Botones de registro rápido en tiempo real (o rellena las horas abajo):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* FASE 1: SALIDA HACIA CLIENTE */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => openModal("salida_ida")}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
              hasSalidaIda
                ? "border-primary/40 bg-background shadow-xs hover:border-primary"
                : "border-primary/30 bg-background/90 hover:bg-background hover:border-primary shadow-xs"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">1. Salida a cliente</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {hasSalidaIda ? `Salida: ${currentDay?.idaDe}` : "Pulsar al salir"}
                </p>
              </div>
            </div>
            {hasSalidaIda && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
          </button>

          {/* FASE 2: LLEGADA AL CLIENTE */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => openModal("llegada_cliente")}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
              hasLlegadaCliente
                ? "border-emerald-500/40 bg-background shadow-xs hover:border-emerald-500"
                : "border-emerald-500/30 bg-background/90 hover:bg-background hover:border-emerald-500 shadow-xs"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">2. Llegada cliente</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {hasLlegadaCliente ? `Llegada: ${currentDay?.idaA}` : "Inicia trabajo"}
                </p>
              </div>
            </div>
            {hasLlegadaCliente && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
          </button>

          {/* FASE 3: SALIDA DEL CLIENTE (FIN TRABAJO) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => openModal("salida_cliente")}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
              hasSalidaCliente
                ? "border-amber-500/40 bg-background shadow-xs hover:border-amber-500"
                : "border-amber-500/30 bg-background/90 hover:bg-background hover:border-amber-500 shadow-xs"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">3. Salida de cliente</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {hasSalidaCliente ? `Salida: ${currentDay?.vueltaDe}` : "Fin trabajo y viaje vuelta"}
                </p>
              </div>
            </div>
            {hasSalidaCliente && <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
          </button>

          {/* FASE 4: LLEGADA DE VUELTA */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => openModal("llegada_vuelta")}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
              hasLlegadaVuelta
                ? "border-purple-500/40 bg-background shadow-xs hover:border-purple-500"
                : "border-purple-500/30 bg-background/90 hover:bg-background hover:border-purple-500 shadow-xs"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Home className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">4. Llegada de vuelta</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {hasLlegadaVuelta ? `Llegada: ${currentDay?.vueltaA}` : "Fin de desplazamiento"}
                </p>
              </div>
            </div>
            {hasLlegadaVuelta && <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />}
          </button>
        </div>
      </div>

      {/* DETALLE EDITABLE DE HORAS Y KILÓMETROS */}
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-muted-foreground">
          Detalle y ajuste manual de horas (Ida, Mano de Obra y Vuelta):
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* BLOQUE 1: VIAJE DE IDA */}
          <div className="bg-background rounded-xl p-3 border border-border space-y-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-primary border-b border-border/60 pb-1.5">
              <Car className="h-3.5 w-3.5" /> Viaje de Ida
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Hora Salida:</label>
                <Input
                  type="time"
                  value={currentDay?.idaDe || ""}
                  disabled={disabled}
                  onChange={(e) => updateField("idaDe", e.target.value)}
                  className="h-8 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Hora Llegada:</label>
                <Input
                  type="time"
                  value={currentDay?.idaA || ""}
                  disabled={disabled}
                  onChange={(e) => updateField("idaA", e.target.value)}
                  className="h-8 text-xs font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Km Ida:</label>
              <Input
                type="text"
                placeholder="Ej. 45"
                value={currentDay?.kmIda || ""}
                disabled={disabled}
                onChange={(e) => updateField("kmIda", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* BLOQUE 2: MANO DE OBRA EN CLIENTE */}
          <div className="bg-background rounded-xl p-3 border border-border space-y-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-600 dark:text-emerald-400 border-b border-border/60 pb-1.5">
              <Clock className="h-3.5 w-3.5" /> Mano de Obra en Cliente
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Hora Inicio:</label>
                <Input
                  type="time"
                  value={currentDay?.mananaDe || currentDay?.tardeDe || ""}
                  disabled={disabled}
                  onChange={(e) => {
                    const val = e.target.value;
                    const [h] = val.split(":").map(Number);
                    if (h !== undefined && h >= 14) {
                      updateField("tardeDe", val);
                    } else {
                      updateField("mananaDe", val);
                    }
                  }}
                  className="h-8 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Hora Fin:</label>
                <Input
                  type="time"
                  value={currentDay?.mananaA || currentDay?.tardeA || ""}
                  disabled={disabled}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (currentDay?.tardeDe) {
                      updateField("tardeA", val);
                    } else {
                      updateField("mananaA", val);
                    }
                  }}
                  className="h-8 text-xs font-medium"
                />
              </div>
            </div>
            <div className="pt-1">
              <span className="block text-[11px] text-muted-foreground">Total mano de obra:</span>
              <span className="text-xs font-bold text-foreground">
                {totals.formattedWorkHours || "0 min"}
              </span>
            </div>
          </div>

          {/* BLOQUE 3: VIAJE DE VUELTA */}
          <div className="bg-background rounded-xl p-3 border border-border space-y-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-600 dark:text-amber-400 border-b border-border/60 pb-1.5">
              <Home className="h-3.5 w-3.5" /> Viaje de Vuelta (Regreso)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Salida cliente:</label>
                <Input
                  type="time"
                  value={currentDay?.vueltaDe || ""}
                  disabled={disabled}
                  onChange={(e) => updateField("vueltaDe", e.target.value)}
                  className="h-8 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Llegada vuelta:</label>
                <Input
                  type="time"
                  value={currentDay?.vueltaA || ""}
                  disabled={disabled}
                  onChange={(e) => updateField("vueltaA", e.target.value)}
                  className="h-8 text-xs font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Km Vuelta:</label>
              <Input
                type="text"
                placeholder="Ej. 45"
                value={currentDay?.kmVuelta || ""}
                disabled={disabled}
                onChange={(e) => updateField("kmVuelta", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RESUMEN DE TOTALES CALCULADOS AUTOMÁTICAMENTE */}
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

      {/* MODAL RÁPIDO PARA CONFIRMAR HORA Y KILÓMETROS */}
      <Dialog open={modalType !== null} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              {modalType === "salida_ida" && <Car className="h-5 w-5 text-primary" />}
              {modalType === "llegada_cliente" && <MapPin className="h-5 w-5 text-emerald-600" />}
              {modalType === "salida_cliente" && <LogOut className="h-5 w-5 text-amber-600" />}
              {modalType === "llegada_vuelta" && <Home className="h-5 w-5 text-purple-600" />}
              <span>
                {modalType === "salida_ida" && "Registrar salida hacia cliente"}
                {modalType === "llegada_cliente" && "Registrar llegada al cliente"}
                {modalType === "salida_cliente" && "Registrar salida del cliente (Fin de trabajo)"}
                {modalType === "llegada_vuelta" && "Registrar llegada de vuelta (Fin de viaje)"}
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

            {modalType === "salida_ida" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kilómetros de ida (distancia al cliente):
                </label>
                <Input
                  type="text"
                  placeholder="Ej. 45"
                  value={tempKm}
                  onChange={(e) => setTempKm(e.target.value)}
                  className="text-base h-11"
                />
              </div>
            )}

            {modalType === "llegada_cliente" && (
              <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg">
                Al confirmar la llegada al cliente, la mano de obra empezará a computar automáticamente desde esta hora.
              </p>
            )}

            {modalType === "salida_cliente" && (
              <div>
                <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-lg mb-2">
                  Al salir del cliente, se registra el fin del tiempo de trabajo y se inicia el tiempo de viaje de vuelta.
                </p>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kilómetros de vuelta:
                </label>
                <Input
                  type="text"
                  placeholder="Ej. 45"
                  value={tempKm}
                  onChange={(e) => setTempKm(e.target.value)}
                  className="text-base h-11"
                />
              </div>
            )}

            {modalType === "llegada_vuelta" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kilómetros de vuelta:
                </label>
                <Input
                  type="text"
                  placeholder="Ej. 45"
                  value={tempKm}
                  onChange={(e) => setTempKm(e.target.value)}
                  className="text-base h-11"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Se sugiere la misma distancia que la ida ({currentDay?.kmIda || "—"} Km).
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
