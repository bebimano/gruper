import { useState, useEffect, useMemo } from "react";
import {
  Hash,
  User,
  Save,
  RotateCcw,
  Calendar,
  Settings2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getWorkerReportConfigServer,
  setWorkerReportConfigServer,
} from "@/lib/reports.functions";
import { useWorkerInitials, formatReportNumber } from "@/lib/worker-initials";

export type WorkerReportConfig = {
  userId: string;
  nextNumber: number;
  yearPrefix: number;
};

export function WorkerReportConfigAdmin() {
  const qc = useQueryClient();
  const { workerList, isLoading: loadingWorkers } = useWorkerInitials();
  const getConfigFn = useServerFn(getWorkerReportConfigServer);
  const setConfigFn = useServerFn(setWorkerReportConfigServer);

  const configQuery = useQuery({
    queryKey: ["worker-report-config"],
    queryFn: () => getConfigFn(),
  });

  // Local drafts: { [userId]: { nextNumber, yearPrefix } }
  const [drafts, setDrafts] = useState<
    Record<string, { nextNumber: string; yearPrefix: string }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  // Merge worker list with config data
  const workers = useMemo(() => {
    const configMap = new Map<string, WorkerReportConfig>();
    for (const c of configQuery.data?.configs ?? []) {
      configMap.set(c.userId, c);
    }
    return workerList.map((w) => {
      const cfg = configMap.get(w.id);
      return {
        ...w,
        nextNumber: cfg?.nextNumber ?? 1,
        yearPrefix: cfg?.yearPrefix ?? new Date().getFullYear(),
      };
    });
  }, [workerList, configQuery.data]);

  // Initialize drafts when data loads
  useEffect(() => {
    if (workers.length > 0) {
      const init: Record<string, { nextNumber: string; yearPrefix: string }> = {};
      for (const w of workers) {
        init[w.id] = {
          nextNumber: String(w.nextNumber),
          yearPrefix: String(w.yearPrefix),
        };
      }
      setDrafts(init);
    }
  }, [workers]);

  const handleSave = async (userId: string, username: string) => {
    const draft = drafts[userId];
    if (!draft) return;

    const nextNumber = parseInt(draft.nextNumber, 10);
    const yearPrefix = parseInt(draft.yearPrefix, 10);

    if (isNaN(nextNumber) || nextNumber < 0) {
      toast.error("El número debe ser un valor válido (≥ 0)");
      return;
    }
    if (isNaN(yearPrefix) || yearPrefix < 2000 || yearPrefix > 2099) {
      toast.error("El año debe estar entre 2000 y 2099");
      return;
    }

    setSavingId(userId);
    try {
      await setConfigFn({
        data: { userId, nextNumber, yearPrefix },
      });
      toast.success(
        `Configuración de ${username} guardada: próximo parte Nº ${nextNumber}, año ${yearPrefix}`
      );
      qc.invalidateQueries({ queryKey: ["worker-report-config"] });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al guardar la configuración"
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleReset = async (userId: string, username: string) => {
    if (
      !confirm(
        `¿Reiniciar la numeración de partes de "${username}"?\n\nEl próximo parte empezará desde el número 1 con el año actual (${new Date().getFullYear()}).`
      )
    )
      return;

    setResettingId(userId);
    try {
      const currentYear = new Date().getFullYear();
      await setConfigFn({
        data: { userId, nextNumber: 1, yearPrefix: currentYear },
      });

      // Update local draft
      setDrafts((prev) => ({
        ...prev,
        [userId]: {
          nextNumber: "1",
          yearPrefix: String(currentYear),
        },
      }));

      toast.success(
        `Numeración de ${username} reiniciada: próximo parte será Nº 1, año ${currentYear}`
      );
      qc.invalidateQueries({ queryKey: ["worker-report-config"] });
    } catch (e) {
      toast.error("Error al reiniciar la numeración");
    } finally {
      setResettingId(null);
    }
  };

  const isLoading = loadingWorkers || configQuery.isLoading;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-border/60 pb-3">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
            <Settings2 className="h-4 w-4 text-primary" />
            Configuración de Numeración por Trabajador
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define desde qué número empezará el próximo parte de cada trabajador
            y el año que se usa en el formato{" "}
            <strong className="text-foreground">
              [INICIALES][AÑO][NÚMERO]
            </strong>
            . Puedes reiniciar la numeración en cualquier momento.
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground py-2">
          Cargando configuración...
        </p>
      )}

      {!isLoading && workers.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">
          No hay trabajadores registrados.
        </p>
      )}

      <div className="space-y-3">
        {workers.map((w) => {
          const draft = drafts[w.id];
          if (!draft) return null;

          const nextNum = parseInt(draft.nextNumber, 10) || 0;
          const yearPfx = parseInt(draft.yearPrefix, 10) || new Date().getFullYear();
          const previewNum = formatReportNumber(w.initials, yearPfx, nextNum);
          const hasChanged =
            String(w.nextNumber) !== draft.nextNumber ||
            String(w.yearPrefix) !== draft.yearPrefix;

          return (
            <div
              key={w.id}
              className="flex flex-col gap-3 p-3 sm:p-4 rounded-xl border border-border/80 bg-background hover:border-primary/40 transition-colors"
            >
              {/* Row 1: User info + preview */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                  {w.initials || w.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-medium text-sm text-foreground truncate flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {w.username}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Próximo parte:{" "}
                    <code className="font-mono font-semibold text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[11px]">
                      Nº {previewNum}
                    </code>
                  </span>
                </div>
                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] font-bold ${
                    hasChanged
                      ? "border-amber-500/40 text-amber-600 bg-amber-500/5"
                      : "border-green-500/40 text-green-600 bg-green-500/5"
                  }`}
                >
                  {hasChanged ? (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" /> Sin guardar
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Guardado
                    </>
                  )}
                </Badge>
              </div>

              {/* Row 2: Controls */}
              <div className="flex flex-wrap items-end gap-3">
                {/* Año */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Año
                  </label>
                  <Input
                    type="number"
                    min={2000}
                    max={2099}
                    value={draft.yearPrefix}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [w.id]: { ...prev[w.id], yearPrefix: e.target.value },
                      }))
                    }
                    className="w-24 h-9 font-mono font-bold text-center text-sm"
                  />
                </div>

                {/* Número */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Próximo Nº
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.nextNumber}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [w.id]: { ...prev[w.id], nextNumber: e.target.value },
                      }))
                    }
                    className="w-24 h-9 font-mono font-bold text-center text-sm"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resettingId === w.id}
                    onClick={() => handleReset(w.id, w.username)}
                    className="h-9 px-3 gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50"
                    title="Reiniciar numeración a 1 con el año actual"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reiniciar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={hasChanged ? "default" : "outline"}
                    disabled={savingId === w.id || !hasChanged}
                    onClick={() => handleSave(w.id, w.username)}
                    className="h-9 px-3 gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Guardar</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
