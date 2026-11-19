import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Hash, Pencil, X, Check, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getAllReportsForNumberingServer,
  changeReportNumberServer,
} from "@/lib/change-report-number.functions";
import { useWorkerInitials, formatReportNumber } from "@/lib/worker-initials";

type Report = {
  id: string;
  number: number;
  user_number: number | null;
  created_at: string;
  cliente: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ReportNumberAdmin() {
  const qc = useQueryClient();
  const getAllFn = useServerFn(getAllReportsForNumberingServer);
  const changeFn = useServerFn(changeReportNumberServer);
  const { data: initials } = useWorkerInitials();

  const [search, setSearch] = useState("");
  // editingId → the report being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const reportsQuery = useQuery({
    queryKey: ["admin-report-numbering"],
    queryFn: () => getAllFn(),
  });

  const reports: Report[] = reportsQuery.data?.reports ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter(
      (r) =>
        r.cliente.toLowerCase().includes(q) ||
        String(r.user_number ?? r.number).includes(q)
    );
  }, [reports, search]);

  function startEdit(r: Report) {
    setEditingId(r.id);
    setEditValue(String(r.user_number ?? r.number));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveEdit(r: Report) {
    const newNum = parseInt(editValue, 10);
    if (isNaN(newNum) || newNum <= 0) {
      toast.error("El número debe ser un entero positivo");
      return;
    }
    const currentNum = r.user_number ?? r.number;
    if (newNum === currentNum) {
      cancelEdit();
      return;
    }

    // Confirm dialog
    const confirmed = window.confirm(
      `¿Seguro que quieres cambiar el número del parte de "${r.cliente || "(sin cliente)"}" de ${currentNum} a ${newNum}?`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const result = await changeFn({ data: { id: r.id, newNumber: newNum } });

      if (result.conflict) {
        toast.error(
          `El número ${result.conflictNum} ya está en uso por el parte de "${result.conflictCliente || "(sin cliente)"}". Elige otro número.`,
          { duration: 6000 }
        );
        return;
      }

      toast.success(`Número del parte actualizado a ${newNum}`);
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["admin-report-numbering"] });
      qc.invalidateQueries({ queryKey: ["work-reports"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al cambiar el número");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Hash className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Numeración de Partes
            </h2>
            <p className="text-xs text-muted-foreground">
              Cambia el número visible de cualquier parte. Si el número elegido ya está en uso,
              se te avisará antes de aplicar el cambio.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente o número…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 text-sm"
        />
      </div>

      {/* Loading */}
      {reportsQuery.isLoading && (
        <p className="text-sm text-muted-foreground text-center py-6">Cargando partes…</p>
      )}

      {/* Table */}
      {!reportsQuery.isLoading && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "No hay partes que coincidan con la búsqueda." : "No hay partes de trabajo."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((r) => {
                const displayNum = r.user_number ?? r.number;
                const formatted = formatReportNumber(initials, r.created_at, displayNum);
                const isEditing = editingId === r.id;

                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Number badge */}
                    <div className="shrink-0">
                      {r.user_number !== null ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 font-mono text-xs font-semibold">
                          {formatted}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono text-xs font-semibold text-muted-foreground">
                          {formatted}
                        </Badge>
                      )}
                    </div>

                    {/* Client & date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {r.cliente || <span className="text-muted-foreground italic">Sin cliente</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                    </div>

                    {/* Edit controls */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number"
                          min={1}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8 w-24 text-sm font-mono text-center"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(r);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                          disabled={isSaving}
                        />
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shrink-0"
                          onClick={() => saveEdit(r)}
                          disabled={isSaving}
                          title="Guardar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 rounded-lg shrink-0"
                          onClick={cancelEdit}
                          disabled={isSaving}
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => startEdit(r)}
                        title="Cambiar número"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Los partes con número en <span className="font-semibold text-primary">azul</span> tienen un número personalizado.
          Los que aparecen en gris usan el número automático del sistema.
          Al cambiar un número, si ya está ocupado por otro parte se te avisará antes de aplicar ningún cambio.
        </p>
      </div>
    </div>
  );
}
