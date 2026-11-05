import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
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

// Opens the machine in the phone's real browser engine (Chrome Custom Tabs / Safari),
// which shares Chrome's login and isn't blocked like an embedded frame.
async function openNative(url: string) {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, toolbarColor: "#ffffff", presentationStyle: "fullscreen" });
}

function Viewer() {
  const { id } = Route.useParams();
  const [key, setKey] = useState(0);
  const [native, setNative] = useState(false);
  const opened = useRef(false);
  const q = useQuery({
    queryKey: ["machine", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("name, url").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { setNative(Capacitor.isNativePlatform()); }, []);
  useEffect(() => {
    if (native && q.data?.url && !opened.current) {
      opened.current = true;
      void openNative(q.data.url);
    }
  }, [native, q.data?.url]);

  const openOutside = () => {
    if (!q.data) return;
    if (native) void openNative(q.data.url);
    else window.open(q.data.url, "_blank", "noopener");
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center gap-2 px-3 pb-1 safe-top">
        <Link to="/maquinas" aria-label="Volver" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /></Link>
        <span className="flex-1 truncate text-center text-sm font-semibold">{q.data?.name ?? ""}</span>
        <button onClick={openOutside} aria-label="Abrir a pantalla completa" className="rounded-full p-1.5 text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></button>
      </header>
      {q.isLoading ? (
        <p className="m-auto text-muted-foreground">Conectando…</p>
      ) : !q.data ? (
        <p className="m-auto text-muted-foreground">Máquina no disponible</p>
      ) : native ? (
        <div className="m-auto flex flex-col items-center gap-4 px-6 text-center">
          <p className="text-muted-foreground">La pantalla de la máquina se ha abierto. Ciérrala para volver aquí.</p>
          <button onClick={openOutside} className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Abrir pantalla</button>
        </div>
      ) : (
        <div key={key} className="m-auto flex flex-col items-center gap-4 px-6 text-center">
          <p className="text-muted-foreground">La pantalla se abre en el navegador, con tu sesión guardada.</p>
          <a href={q.data.url} target="_blank" rel="noopener" className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Abrir pantalla</a>
        </div>
      )}
    </div>
  );
}
