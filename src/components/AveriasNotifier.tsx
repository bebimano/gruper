import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, X, Wrench, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { checkShouldReceiveAveriaAlert } from "@/lib/averias.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AveriaAlert {
  id?: string;
  clientName: string;
  machineName: string;
  title: string;
  urgency?: "normal" | "urgente" | string;
}

function playBeepSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Tono doble de alerta
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.3); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.45); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch (e) {
    // Audio bloqueado hasta interacción del usuario
  }
}

/** Real-time notifier for breakdown notices (averías) submitted by clients with visible POP-UP dialog. */
export function AveriasNotifier() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const myUsername = me.data?.username;

  const checkAlertFn = useServerFn(checkShouldReceiveAveriaAlert);
  const { data: alertPerm } = useQuery({
    queryKey: ["averia-alert-perm", me.data?.id],
    enabled: !!me.data?.id,
    queryFn: () => checkAlertFn(),
  });

  const canReceiveAlerts = !!(me.data?.isAdmin || alertPerm?.receiveAlerts);
  const [activeAlert, setActiveAlert] = useState<AveriaAlert | null>(null);

  const triggerAlert = (alert: AveriaAlert) => {
    qc.invalidateQueries({ queryKey: ["averias"] });
    qc.invalidateQueries({ queryKey: ["jobs"] });

    if (alert.clientName && alert.clientName === myUsername) return;
    if (!canReceiveAlerts) return;

    // 1. Mostrar Pop up modal
    setActiveAlert(alert);

    // 2. Tocar sonido de aviso
    playBeepSound();

    // 3. Notificación toast de soporte
    const isUrgent = alert.urgency === "urgente";
    toast.error(
      isUrgent ? "🚨 ¡AVERÍA URGENTE REPORTADA!" : "⚠️ Nueva avería de cliente",
      {
        description: `${alert.clientName} ha reportado fallo en ${alert.machineName}: "${alert.title}"`,
        duration: 15000,
        action: {
          label: "Ver avería",
          onClick: () => {
            setActiveAlert(null);
            navigate({ to: "/averias" });
          },
        },
      }
    );

    // 4. Web notification
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const n = new Notification(
          isUrgent ? `🚨 AVERÍA URGENTE: ${alert.machineName}` : `⚠️ Avería: ${alert.machineName}`,
          {
            body: `${alert.clientName}: ${alert.title}`,
            icon: "/favicon.png",
            tag: "averia-alert",
          }
        );
        n.onclick = () => {
          window.focus();
          setActiveAlert(null);
          navigate({ to: "/averias" });
        };
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!canReceiveAlerts) return;

    // 1. Escuchar canal broadcast en tiempo real
    const broadcastChannel = supabase
      .channel("gruper-averias-realtime")
      .on("broadcast", { event: "new_averia" }, (event) => {
        const p = event.payload as AveriaAlert;
        if (p) triggerAlert(p);
      })
      .subscribe();

    // 2. Escuchar inserciones en jobs que sean averías
    const jobsChannel = supabase
      .channel(`averias-jobs-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        (payload) => {
          const row = payload.new as {
            id: string;
            title: string;
            client: string;
            description: string;
            status_note?: string;
          };

          if (!row.title?.startsWith("[AVERÍA]")) return;

          let machineName = "Máquina";
          let averiaTitle = row.title.replace(/^\[AVERÍA\]\s*/i, "");
          if (averiaTitle.includes(":")) {
            const parts = averiaTitle.split(":");
            machineName = parts[0].trim();
            averiaTitle = parts.slice(1).join(":").trim();
          }

          let urgency: "normal" | "urgente" = "normal";
          try {
            if (row.description.startsWith("{")) {
              const parsed = JSON.parse(row.description);
              if (parsed.urgency === "urgente") urgency = "urgente";
            }
          } catch {}

          if (row.status_note?.includes("URGENTE")) urgency = "urgente";

          triggerAlert({
            id: row.id,
            clientName: row.client || "Cliente",
            machineName,
            title: averiaTitle,
            urgency,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(jobsChannel);
    };
  }, [canReceiveAlerts, myUsername]);

  if (!activeAlert) return null;

  const isUrgent = activeAlert.urgency === "urgente";

  return (
    <Dialog open={!!activeAlert} onOpenChange={(open) => !open && setActiveAlert(null)}>
      <DialogContent className="sm:max-w-md p-6 border-2 border-amber-500 bg-background shadow-2xl rounded-2xl animate-in zoom-in-95">
        <DialogHeader className="text-center sm:text-center">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-3 shadow-inner ${
              isUrgent ? "bg-red-500/15 text-destructive animate-pulse" : "bg-amber-500/15 text-amber-600"
            }`}
          >
            {isUrgent ? <ShieldAlert className="h-9 w-9" /> : <AlertTriangle className="h-9 w-9" />}
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            {isUrgent ? "🚨 ¡AVISO DE AVERÍA URGENTE!" : "⚠️ Nueva avería de cliente"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Se acaba de registrar una incidencia en tiempo real desde la aplicación.
          </p>
        </DialogHeader>

        <div className="my-4 space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Cliente:</span>
            <span className="font-bold text-foreground">{activeAlert.clientName}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Máquina:</span>
            <span className="font-semibold text-primary">{activeAlert.machineName}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Urgencia:</span>
            <Badge
              variant={isUrgent ? "destructive" : "secondary"}
              className={isUrgent ? "font-bold text-xs uppercase" : "text-xs"}
            >
              {isUrgent ? "⚠️ URGENTE (Producción parada)" : "Normal"}
            </Badge>
          </div>

          <div className="pt-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
              Fallo reportado:
            </span>
            <p className="font-medium text-foreground text-sm bg-background/80 p-2.5 rounded-lg border border-border">
              {activeAlert.title}
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => setActiveAlert(null)}
            className="w-full sm:w-1/2 h-11"
          >
            Cerrar aviso
          </Button>
          <Button
            onClick={() => {
              setActiveAlert(null);
              navigate({ to: "/averias" });
            }}
            className="w-full sm:w-1/2 h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-md"
          >
            <span>Ver avería</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
