import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";

/** Real-time notifier for breakdown notices (averías) submitted by clients. */
export function AveriasNotifier() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = !!me.data?.isAdmin;
  const isWorker = !!(me.data?.canReports || me.data?.isAdmin);
  const myUsername = me.data?.username;

  useEffect(() => {
    if (!isWorker) return;

    // Helper to send browser notification if allowed
    const sendWebNotification = (title: string, body: string) => {
      try {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          const n = new Notification(title, {
            body,
            icon: "/favicon.png",
            badge: "/favicon.png",
            tag: "averia-alert",
          });
          n.onclick = () => {
            window.focus();
            navigate({ to: "/averias" });
          };
        }
      } catch (err) {
        console.error("Web notification error:", err);
      }
    };

    // 1. Escuchar canal broadcast en tiempo real
    const broadcastChannel = supabase
      .channel("gruper-averias-realtime")
      .on("broadcast", { event: "new_averia" }, (event) => {
        const payload = event.payload as {
          clientName: string;
          machineName: string;
          title: string;
          urgency?: string;
        };

        qc.invalidateQueries({ queryKey: ["averias"] });
        qc.invalidateQueries({ queryKey: ["jobs"] });

        if (payload.clientName && payload.clientName === myUsername) return;

        const isUrgent = payload.urgency === "urgente";
        const titleText = isUrgent
          ? `🚨 ¡AVISO DE AVERÍA URGENTE!`
          : `⚠️ Nueva avería reportada`;
        const descText = `${payload.clientName} ha reportado un fallo en ${payload.machineName}: "${payload.title}"`;

        toast.error(titleText, {
          description: descText,
          duration: 15000,
          action: {
            label: "Ver avería",
            onClick: () => navigate({ to: "/averias" }),
          },
        });

        sendWebNotification(titleText, descText);
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
            title: string;
            client: string;
            description: string;
          };

          if (!row.title?.startsWith("[AVERÍA]")) return;

          qc.invalidateQueries({ queryKey: ["averias"] });
          qc.invalidateQueries({ queryKey: ["jobs"] });

          if (row.client === myUsername) return;

          let machineName = "Máquina";
          let averiaTitle = row.title.replace(/^\[AVERÍA\]\s*/i, "");
          if (averiaTitle.includes(":")) {
            const parts = averiaTitle.split(":");
            machineName = parts[0].trim();
            averiaTitle = parts.slice(1).join(":").trim();
          }

          const descText = `El cliente ${row.client || "Cliente"} ha abierto una avería de la máquina ${machineName}: "${averiaTitle}"`;

          toast.error("⚠️ Nueva avería de cliente", {
            description: descText,
            duration: 15000,
            action: {
              label: "Ver avería",
              onClick: () => navigate({ to: "/averias" }),
            },
          });

          sendWebNotification("⚠️ Avería de máquina", descText);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(jobsChannel);
    };
  }, [isWorker, myUsername, qc, navigate]);

  return null;
}
