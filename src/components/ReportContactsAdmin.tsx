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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("Correo no válido"); return; }
    const { error } = await supabase.from("report_contacts").upsert({ name: name.trim(), email: email.trim() }, { onConflict: "name" });
    if (error) { toast.error(error.message); return; }
    setName(""); setEmail("");
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
      <p className="text-sm text-muted-foreground">Al escribir este nombre en "Cliente" del parte, se usará este correo para enviarlo.</p>
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Nombre del cliente" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input type="email" placeholder="correo@cliente.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoCapitalize="none" />
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
