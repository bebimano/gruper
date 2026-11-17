import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const rawList = email.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!rawList.length) {
      toast.error("Introduce al menos un correo electrónico");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = rawList.find((e) => !emailRegex.test(e));
    if (invalid) {
      toast.error(`El correo "${invalid}" no tiene un formato válido`);
      return;
    }
    const finalEmailStr = rawList.join(", ");

    const { error } = await supabase.from("report_contacts").upsert(
      { name: name.trim(), email: finalEmailStr },
      { onConflict: "name" }
    );
    if (error) { toast.error(error.message); return; }
    setName(""); setEmail("");
    toast.success(`Correos para "${name.trim()}" guardados correctamente.`);
    qc.invalidateQueries({ queryKey: ["report-contacts"] });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("report_contacts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["report-contacts"] });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <h2 className="font-medium">Correos de clientes</h2>
      <p className="text-sm text-muted-foreground">
        Al escribir este nombre en "Cliente" del parte, se enviará automáticamente a estos correos. Puedes poner varios correos separados por coma.
      </p>
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
        <Input placeholder="Nombre del cliente" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          type="text"
          placeholder="correo1@cliente.com, correo2@cliente.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoCapitalize="none"
        />
        <Button type="submit">Guardar</Button>
      </form>
      {list.data?.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-sm">
          <span className="flex-1 font-medium">{c.name}</span>
          <span className="text-muted-foreground truncate">{c.email}</span>
          <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Eliminar"><Trash2 /></Button>
        </div>
      ))}
    </div>
  );
}
