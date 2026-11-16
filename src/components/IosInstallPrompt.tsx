import { useEffect, useState } from "react";
import { Share, PlusSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only in browser environment
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    // Detect iOS (iPhone, iPad, iPod)
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Detect if already installed as standalone PWA
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

    // Check if dismissed previously in this session/browser
    const dismissed = localStorage.getItem("gruper-ios-prompt-dismissed");

    if (isIos && !isStandalone && !dismissed) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem("gruper-ios-prompt-dismissed", "true");
    setShow(false);
  };

  return (
    <aside
      aria-label="Instalar app en iPhone"
      className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-4 print:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-sm">
            G
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Instala Gruper en tu iPhone</h2>
            <p className="text-xs text-muted-foreground">Para recibir avisos y alertas en tiempo real</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={dismiss} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 space-y-2 rounded-xl bg-muted/60 p-3 text-xs text-foreground/90">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
            1
          </span>
          <span>
            Pulsa el botón de <strong>Compartir</strong> <Share className="inline h-3.5 w-3.5 mx-0.5 text-primary" /> (cuadrado con flecha hacia arriba).
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
            2
          </span>
          <span>
            Baja y pulsa en <PlusSquare className="inline h-3.5 w-3.5 mx-0.5 text-primary" /> <strong>«Añadir a pantalla de inicio»</strong>.
          </span>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="default" className="text-xs h-8 px-4" onClick={dismiss}>
          Entendido
        </Button>
      </div>
    </aside>
  );
}
