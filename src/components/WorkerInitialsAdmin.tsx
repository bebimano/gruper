import { useState, useEffect } from "react";
import { User, Check, Save, Hash } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkerInitials, saveWorkerInitials, formatReportNumber } from "@/lib/worker-initials";
import { saveWorkerInitialsServer } from "@/lib/reports.functions";

export function WorkerInitialsAdmin() {
  const qc = useQueryClient();
  const { workerList, isLoading } = useWorkerInitials();
  const saveInitialsFn = useServerFn(saveWorkerInitialsServer);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (workerList.length > 0) {
      const initDrafts: Record<string, string> = {};
      for (const w of workerList) {
        initDrafts[w.id] = w.initials;
      }
      setDrafts(initDrafts);
    }
  }, [workerList]);

  const handleChange = (userId: string, val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5);
    setDrafts((prev) => ({ ...prev, [userId]: cleaned }));
  };

  const handleSave = async (userId: string, username: string) => {
    const val = drafts[userId]?.trim() || "";
    setSavingId(userId);
    try {
      await saveWorkerInitials(userId, val, saveInitialsFn);
      toast.success(`Iniciales para ${username} guardadas: "${val}"`);
      qc.invalidateQueries({ queryKey: ["worker-initials"] });
    } catch (e) {
      toast.error("Error al guardar las iniciales");
    } finally {
      setSavingId(null);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-border/60 pb-3">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
            <Hash className="h-4 w-4 text-primary" />
            Iniciales de Trabajadores y Numeración de Partes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura las iniciales de cada trabajador. Los partes se numerarán automáticamente con el formato{" "}
            <strong className="text-foreground">[INICIALES][AA][0001]</strong> (ej: BM260001)
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-2">Cargando trabajadores...</p>}

      {!isLoading && workerList.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No hay trabajadores registrados.</p>
      )}

      <div className="space-y-3">
        {workerList.map((w) => {
          const currentVal = drafts[w.id] !== undefined ? drafts[w.id] : w.initials;
          const previewNum = formatReportNumber(currentVal || w.username.slice(0, 2), currentYear, 1);
          const hasChanged = currentVal !== w.initials;

          return (
            <div
              key={w.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-background hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                  {currentVal || w.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="block font-medium text-sm text-foreground truncate flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {w.username}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Ejemplo de parte:{" "}
                    <code className="font-mono font-semibold text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[11px]">
                      Parte Nº {previewNum}
                    </code>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Iniciales:</span>
                  <Input
                    type="text"
                    value={currentVal || ""}
                    placeholder={w.username.slice(0, 2).toUpperCase()}
                    maxLength={5}
                    onChange={(e) => handleChange(w.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(w.id, w.username);
                    }}
                    className="w-20 h-9 font-mono font-bold text-center uppercase tracking-wider text-sm"
                  />
                </div>

                <Button
                  size="sm"
                  variant={hasChanged ? "default" : "outline"}
                  disabled={savingId === w.id || !hasChanged}
                  onClick={() => handleSave(w.id, w.username)}
                  className="h-9 px-3 gap-1.5"
                >
                  {savingId === w.id ? (
                    <Check className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Guardar</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
