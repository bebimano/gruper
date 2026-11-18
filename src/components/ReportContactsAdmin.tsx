import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Edit2, X, Users, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function useReportContacts() {
  return useQuery({
    queryKey: ["report-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_contacts").select("id, name, email").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function ReportContactsAdmin() {
  const qc = useQueryClient();
  const list = useReportContacts();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (c: { id: string; name: string; email: string }) => {
    setName(c.name);
    setEmail(c.email);
    setEditingId(c.id);
  };

  const cancelEdit = () => {
    setName("");
    setEmail("");
    setEditingId(null);
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const rawList = email.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!rawList.length) {
      toast.error("Introduce al menos un correo electrónico");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = rawList.find((em) => !emailRegex.test(em));
    if (invalid) {
      toast.error(`El correo "${invalid}" no tiene un formato válido`);
      return;
    }
    const finalEmailStr = rawList.join(", ");

    const { error } = await supabase
      .from("report_contacts")
      .upsert({ name: name.trim(), email: finalEmailStr }, { onConflict: "name" });
    if (error) { toast.error(error.message); return; }
    
    toast.success(`Correos para "${name.trim()}" guardados correctamente.`);
    cancelEdit();
    qc.invalidateQueries({ queryKey: ["report-contacts"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("report_contacts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["report-contacts"] });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div>
        <h2 className="font-medium flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Correos de clientes
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Al escribir el nombre en "Cliente" del parte, se enviará automáticamente a todos los correos indicados (puedes poner varios separados por comas).
        </p>
      </div>

      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
        <Input
          placeholder="Nombre del cliente"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          type="text"
          placeholder="correo1@cliente.com, correo2@cliente.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoCapitalize="none"
        />
        <div className="flex gap-1.5">
          <Button type="submit">{editingId ? "Actualizar" : "Guardar"}</Button>
          {editingId && (
            <Button type="button" variant="outline" size="icon" onClick={cancelEdit} title="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      <div className="space-y-2 pt-1">
        {list.data?.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/70 bg-card hover:border-primary/40 transition-colors text-sm">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-foreground block truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground block truncate mt-0.5">{c.email}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => startEdit(c)} aria-label="Editar" title="Editar correos" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Eliminar" title="Eliminar cliente" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
