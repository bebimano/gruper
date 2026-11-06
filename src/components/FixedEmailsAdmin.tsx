import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Emails always copied on every work report sent by email. */
export function useFixedEmails() {
  return useQuery({
    queryKey: ["report-fixed-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_fixed_emails").select("id, email").order("email");
      if (error) throw error;
      return data;
    },
  });
}

export function FixedEmailsAdmin() {
  const qc = useQueryClient();
  const list = useFixedEmails();
  const [email, setEmail] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast.error("Correo no válido"); return; }
    const { error } = await supabase.from("report_fixed_emails").upsert({ email: v }, { onConflict: "email" });
    if (error) { toast.error(error.message); return; }
    setEmail("");
    qc.invalidateQueries({ queryKey: ["report-fixed-emails"] });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("report_fixed_emails").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["report-fixed-emails"] });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div>
        <h2 className="font-medium flex items-center gap-2"><Pin className="h-4 w-4 text-primary" /> Correos fijos</h2>
        <p className="text-xs text-muted-foreground">Reciben siempre una copia de cada parte enviado por correo.</p>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <Input type="email" placeholder="correo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" required />
        <Button type="submit">Añadir</Button>
      </form>
      {list.data?.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-sm">
          <span className="flex-1 truncate">{c.email}</span>
          <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Quitar"><Trash2 /></Button>
        </div>
      ))}
    </div>
  );
}
