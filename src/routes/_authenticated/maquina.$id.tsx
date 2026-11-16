import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, RotateCw, Maximize2, Loader2 } from "lucide-react";
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

// Opens the machine in a full-screen web view INSIDE the app (no Chrome). It is a
// top-level page, so portals that block frames (MB Connect) work and keep their login.
async function openNative(url: string) {
  const { InAppBrowser, DefaultWebViewOptions } = await import("@capacitor/inappbrowser");
  await InAppBrowser.openInWebView({
    url,
    options: { ...DefaultWebViewOptions, showURL: false, showToolbar: true, closeButtonText: "Volver" },
  });
}

async function logOpen(machineId: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("machine_opens").insert({ machine_id: machineId, user_id: data.user.id });
  window.__lovableEvents?.track?.("project.machine_opened", { machine_id: machineId });
}

function Viewer() {
  const { id } = Route.useParams();
  const [key, setKey] = useState(0);
  const [native, setNative] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
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
  const logged = useRef(false);
  useEffect(() => {
    if (q.data && !logged.current) { logged.current = true; void logOpen(id); }
  }, [q.data, id]);
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 flex flex-col bg-background z-50">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background safe-top z-20">
        <Link
          to="/maquinas"
          aria-label="Volver a mis máquinas"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Máquinas</span>
        </Link>
        <span className="flex-1 truncate text-center text-sm font-semibold">{q.data?.name ?? ""}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setIframeLoading(true);
              setKey((k) => k + 1);
            }}
            aria-label="Recargar pantalla"
            title="Recargar pantalla"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label="Pantalla completa"
            title="Pantalla completa"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={openOutside}
            aria-label="Abrir en pestaña nueva"
            title="Abrir en pestaña nueva"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </header>

      {q.isLoading ? (
        <div className="m-auto flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Conectando a la máquina…</p>
        </div>
      ) : !q.data ? (
        <p className="m-auto text-muted-foreground">Máquina no disponible</p>
      ) : native ? (
        <div className="m-auto flex flex-col items-center gap-4 px-6 text-center">
          <p className="text-muted-foreground">La pantalla de la máquina se ha abierto. Ciérrala para volver aquí.</p>
          <button onClick={openOutside} className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Abrir pantalla</button>
        </div>
      ) : (
        <div className="relative flex-1 w-full h-full bg-black overflow-hidden flex flex-col">
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 z-10 gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Conectando a {q.data.name}...</p>
              <p className="text-xs text-muted-foreground">Cargando visor VNC integrado</p>
            </div>
          )}
          <iframe
            key={key}
            src={q.data.url}
            title={q.data.name}
            className="flex-1 w-full h-full border-0"
            allow="fullscreen; clipboard-read; clipboard-write; autoplay; camera; microphone"
            allowFullScreen
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      )}
    </div>
  );
}
