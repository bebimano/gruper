import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

// Abre la máquina en visor nativo a pantalla completa sin salir de la app
async function openNative(url: string, onClose?: () => void) {
  try {
    const { InAppBrowser, DefaultWebViewOptions } = await import("@capacitor/inappbrowser");
    if (onClose) {
      try {
        await InAppBrowser.addListener("close", onClose);
      } catch {}
    }
    await InAppBrowser.openInWebView({
      url,
      options: {
        ...DefaultWebViewOptions,
        showURL: false,
        showToolbar: true,
        closeButtonText: "Volver",
      },
    });
    // Al cerrarse el visor en webview
    if (onClose) onClose();
  } catch (err) {
    console.error("Error al abrir visor nativo:", err);
  }
}

async function logOpen(machineId: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("machine_opens").insert({ machine_id: machineId, user_id: data.user.id });
  window.__lovableEvents?.track?.("project.machine_opened", { machine_id: machineId });
}

function Viewer() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
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
  const logged = useRef(false);
  useEffect(() => {
    if (q.data && !logged.current) { logged.current = true; void logOpen(id); }
  }, [q.data, id]);

  const returnToMachines = () => {
    navigate({ to: "/maquinas" });
  };

  useEffect(() => {
    if (native && q.data?.url && !opened.current) {
      opened.current = true;
      void openNative(q.data.url, returnToMachines);
    }
  }, [native, q.data?.url]);

  // Si el usuario regresa al foco de la app tras cerrar el VNC, volver a máquinas automáticamente
  useEffect(() => {
    const handleFocus = () => {
      if (opened.current) {
        navigate({ to: "/maquinas" });
      }
    };
    window.addEventListener("focus", handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && opened.current) {
        navigate({ to: "/maquinas" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [navigate]);

  const openOutside = () => {
    if (!q.data) return;
    if (native) void openNative(q.data.url, returnToMachines);
    else window.open(q.data.url, "_blank", "noopener");
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-card/60 backdrop-blur-md safe-top">
        <Link
          to="/maquinas"
          aria-label="Volver a máquinas"
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs sm:text-sm font-semibold text-foreground/90 shadow-2xs transition-all hover:bg-muted hover:border-primary/50 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-primary" />
          <span>Máquinas</span>
        </Link>
        <span className="flex-1 truncate text-center text-sm sm:text-base font-bold text-foreground">
          {q.data?.name ?? ""}
        </span>
        <button
          onClick={openOutside}
          aria-label="Abrir a pantalla completa"
          title="Abrir a pantalla completa"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground/80 shadow-2xs transition-all hover:bg-muted hover:border-primary/50 hover:text-primary active:scale-95"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </header>

      {q.isLoading ? (
        <div className="m-auto flex flex-col items-center gap-3 px-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
            <Monitor className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Conectando con la máquina…</p>
        </div>
      ) : !q.data ? (
        <div className="m-auto flex flex-col items-center gap-3 px-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">Máquina no disponible</p>
          <Button variant="outline" size="sm" asChild className="rounded-xl">
            <Link to="/maquinas">
              <ArrowLeft className="h-4 w-4 mr-1.5 text-primary" /> Volver a máquinas
            </Link>
          </Button>
        </div>
      ) : (
        <div className="m-auto flex flex-col items-center gap-3 px-6 text-center max-w-sm">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner animate-pulse">
            <Monitor className="h-7 w-7" />
          </div>
          <p className="font-bold text-foreground text-base sm:text-lg">
            {opened.current ? "Volviendo a máquinas…" : "Conectando con la máquina…"}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {opened.current
              ? "Sesión de pantalla remota cerrada."
              : "Iniciando visor remoto seguro de Gruper."}
          </p>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="mt-3 rounded-xl border-border/80 px-4 py-2 text-xs font-semibold gap-1.5 shadow-2xs hover:bg-muted active:scale-95 transition-all"
          >
            <Link to="/maquinas">
              <ArrowLeft className="h-3.5 w-3.5 text-primary" /> Volver a máquinas
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
