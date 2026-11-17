import { useState } from "react";
import { Car, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useVehicles, addVehicle, updateVehicle, deleteVehicle, type Vehicle } from "@/lib/vehicles";

export function VehiclesAdmin() {
  const qc = useQueryClient();
  const { vehicles, isLoading } = useVehicles();

  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMatricula, setEditMatricula] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !matricula.trim()) {
      toast.error("Por favor completa el nombre del coche y la matrícula.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addVehicle(name, matricula);
      toast.success(`Vehículo "${name.trim()} (${matricula.trim().toUpperCase()})" añadido con éxito.`);
      setName("");
      setMatricula("");
      qc.invalidateQueries({ queryKey: ["company-vehicles"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al añadir vehículo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setEditName(v.name);
    setEditMatricula(v.matricula);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditMatricula("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editMatricula.trim()) {
      toast.error("Por favor completa el nombre y la matrícula.");
      return;
    }
    try {
      await updateVehicle(id, editName, editMatricula);
      toast.success("Vehículo actualizado.");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["company-vehicles"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar vehículo.");
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`¿Eliminar el vehículo "${label}"?`)) return;
    try {
      await deleteVehicle(id);
      toast.success("Vehículo eliminado.");
      qc.invalidateQueries({ queryKey: ["company-vehicles"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar vehículo.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      <div className="border-b border-border/60 pb-3">
        <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
          <Car className="h-5 w-5 text-primary" />
          Vehículos y Matrículas de Empresa
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Escribe aquí los coches con sus correspondientes matrículas. Aparecerán automáticamente en el campo
          "Vehículo" de los partes de trabajo para elegirlos con un clic o autocompletado.
        </p>
      </div>

      {/* FORMULARIO PARA AÑADIR VEHÍCULO */}
      <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-border/70 bg-background p-3.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-primary" /> Nuevo Vehículo
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_auto] gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Nombre / Modelo del coche:
            </label>
            <Input
              placeholder="Ej. Renault Kangoo, Citroën Berlingo…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-10 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Matrícula:
            </label>
            <Input
              placeholder="Ej. 1234 ABC"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value.toUpperCase())}
              required
              className="h-10 text-sm font-mono uppercase"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isSubmitting} className="h-10 font-semibold w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Añadir
            </Button>
          </div>
        </div>
      </form>

      {/* LISTA DE VEHÍCULOS REGISTRADOS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Vehículos dados de alta:</span>
          <span>{vehicles.length} vehículo{vehicles.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground py-2">Cargando vehículos...</p>}

        {!isLoading && vehicles.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
            No hay vehículos registrados todavía. Añade el primero en el formulario superior.
          </div>
        )}

        <div className="space-y-2">
          {vehicles.map((v) => {
            const isEditing = editingId === v.id;

            if (isEditing) {
              return (
                <div
                  key={v.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-primary/40 bg-primary/5"
                >
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Modelo coche"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={editMatricula}
                      onChange={(e) => setEditMatricula(e.target.value.toUpperCase())}
                      placeholder="Matrícula"
                      className="h-9 text-sm font-mono uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <Button size="sm" onClick={() => handleSaveEdit(v.id)} className="h-9">
                      <Check className="h-4 w-4 mr-1" /> Guardar
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit} className="h-9">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-background hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Car className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-semibold text-sm text-foreground truncate">{v.name}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Matrícula:{" "}
                      <Badge variant="outline" className="font-mono font-bold text-foreground text-[11px] bg-muted/60">
                        {v.matricula}
                      </Badge>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(v)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(v.id, `${v.name} (${v.matricula})`)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
