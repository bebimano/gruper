import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/maquina/$id")({
  head: () => ({
    meta: [
      { title: "Pantalla remota — Gruper Remote" },
      { name: "description", content: "Visualización remota de tu máquina Gruper." },
      { property: "og:title", content: "Pantalla remota — Gruper Remote" },
      { property: "og:description", content: "Visualización remota de tu máquina Gruper." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
      <header className="flex items-center gap-2 px-3 pb-1 safe-top">
        <Link to="/maquinas" aria-label="Volver" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /></Link>
        <span className="flex-1 truncate text-center text-sm font-semibold">{q.data?.name ?? ""}</span>
        <button onClick={() => setKey((k) => k + 1)} aria-label="Recargar" className="rounded-full p-1.5 text-muted-foreground hover:text-primary"><RotateCw className="h-4 w-4" /></button>
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
