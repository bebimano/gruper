import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function ContactMessages() {
  const messages = useQuery({
    queryKey: ["contact-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_submissions").select("id, created_at, name, company, phone, message").order("created_at", { ascending: false });
      if (error) throw new Error("No se pudieron cargar los mensajes");
      return data;
    },
  });
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Mensajes recibidos</h2><Button variant="ghost" size="icon" aria-label="Actualizar mensajes" disabled={messages.isFetching} onClick={() => messages.refetch()}><RefreshCw className="size-4" /></Button></div>
      {messages.isPending && <p className="text-muted-foreground">Cargando…</p>}
      {messages.isError && <p role="alert" className="text-destructive">No se pudieron cargar los mensajes.</p>}
      {messages.data?.length === 0 && <p className="text-muted-foreground">Todavía no hay mensajes.</p>}
      {messages.data?.map((message) => <article key={message.id} className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold break-words">{message.name}</h3><time className="text-xs text-muted-foreground">{new Date(message.created_at).toLocaleString("es-ES")}</time></div>
        <p className="text-sm break-words">{message.company}</p>
        <p className="mt-1 text-sm text-primary">{message.phone}</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm">{message.message}</p>
      </article>)}
    </div>
  );
}