import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/maquina/$id")({
  head: () => ({
    meta: [
      { title: "Pantalla remota — Gruper Remote" },
      { name: "description", content: "Visualización remota de tu máquina Gruper." },
      { property: "og:title", content: "Pantalla remota — Gruper Remote" },
      { property: "og:description", content: "Visualización remota de tu máquina Gruper." },
    ],
  }),
  component: Viewer,
});

function Viewer() {
  const { id } = Route.useParams();
  const [key, setKey] = useState(0);
  const q = useQuery({
    queryKey: ["machine", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("name, url").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center gap-2 px-2 pb-2 safe-top border-b border-border bg-card">
        <Button variant="ghost" size="icon" asChild aria-label="Volver"><Link to="/maquinas"><ArrowLeft /></Link></Button>
        <span className="flex-1 truncate font-medium">{q.data?.name ?? ""}</span>
        <Button variant="ghost" size="icon" onClick={() => setKey((k) => k + 1)} aria-label="Recargar"><RotateCw /></Button>
      </header>
      {q.isLoading ? (
        <p className="m-auto text-muted-foreground">Conectando…</p>
      ) : !q.data ? (
        <p className="m-auto text-muted-foreground">Máquina no disponible</p>
      ) : (
        <iframe key={key} src={q.data.url} title={q.data.name} className="flex-1 w-full border-0"
          allow="fullscreen; clipboard-read; clipboard-write" />
      )}
    </div>
  );
}
