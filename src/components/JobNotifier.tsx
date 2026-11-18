import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { statusInfo } from "@/lib/jobs";

function playAveriaBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.3);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch {}
}

/** Real-time notifier for jobs: triggers toast popups and web notifications when workers update job status or when new jobs arrive. */
export function JobNotifier() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const myId = me.data?.id;
  const isAdmin = !!me.data?.isAdmin;

  useEffect(() => {
    if (!myId) return;

    // Helper to send browser notification if allowed
    const sendWebNotification = (title: string, body: string, link = "/trabajos") => {
      try {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          const n = new Notification(title, {
            body,
            icon: "/favicon.png",
            badge: "/favicon.png",
            tag: "job-alert",
          });
          n.onclick = () => {
            window.focus();
            navigate({ to: link });
          };
        }
      } catch (err) {
        console.error("Web notification error:", err);
      }
    };

    const channel = supabase
      .channel(`realtime-jobs-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        async (payload) => {
          qc.invalidateQueries({ queryKey: ["jobs"] });
          qc.invalidateQueries({ queryKey: ["averias"] });
          const row = payload.new as {
            id: string;
            title: string;
            client: string;
            assigned_to: string | null;
            status: string;
            status_note: string;
          };

          const isAveria = row.title?.startsWith("[AVERÍA]");
          if (isAveria) {
            toast.info(`Avería actualizada: ${row.title.replace(/^\[AVERÍA\]\s*/i, "")}`, {
              description: row.status_note || `Estado: ${row.status}`,
              duration: 10000,
              action: {
                label: "Ver avería",
                onClick: () => navigate({ to: "/averias" }),
              },
            });
            return;
          }

          // Find who is assigned
          let workerName = "El trabajador";
          if (row.assigned_to) {
            const { data: p } = await supabase.from("profiles").select("username").eq("id", row.assigned_to).maybeSingle();
            if (p?.username) workerName = p.username;
          }

          const st = statusInfo(row.status);
          const desc = `${workerName} cambió el estado a ${st.label}${row.status_note ? ` · "${row.status_note}"` : ""}`;

          // Notify admins always; or notify the worker assigned
          if (isAdmin || row.assigned_to === myId) {
            toast.info(`Trabajo: ${row.title}`, {
              description: desc,
              duration: 12000,
              action: {
                label: "Ver",
                onClick: () => navigate({ to: "/trabajos" }),
              },
            });
            sendWebNotification(`Trabajo: ${row.title}`, desc, "/trabajos");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        async (payload) => {
          qc.invalidateQueries({ queryKey: ["jobs"] });
          qc.invalidateQueries({ queryKey: ["averias"] });
          const row = payload.new as {
            id: string;
            title: string;
            client: string;
            description?: string;
            status_note?: string;
            assigned_to: string | null;
          };

          const isAveria = row.title?.startsWith("[AVERÍA]");

          // Manejo prioritario de Avisos de Avería de clientes
          if (isAveria) {
            let machineName = "Máquina";
            let averiaTitle = row.title.replace(/^\[AVERÍA\]\s*/i, "");
            if (averiaTitle.includes(":")) {
              const parts = averiaTitle.split(":");
              machineName = parts[0].trim();
              averiaTitle = parts.slice(1).join(":").trim();
            }

            const isUrgent =
              row.status_note?.includes("URGENTE") ||
              (row.description && row.description.includes('"urgente"'));

            // Tocar alarma sonora de aviso
            playAveriaBeep();

            // Notificación flotante de alta visibilidad
            toast.error(
              isUrgent ? "🚨 ¡AVERÍA URGENTE REPORTADA!" : "⚠️ Nueva avería de cliente",
              {
                description: `${row.client ? `Cliente: ${row.client} · ` : ""}Máquina: ${machineName} · "${averiaTitle}"`,
                duration: 15000,
                action: {
                  label: "Ver avería",
                  onClick: () => navigate({ to: "/averias" }),
                },
              }
            );

            // Web notification en escritorio / móvil
            sendWebNotification(
              isUrgent ? `🚨 AVERÍA URGENTE: ${machineName}` : `⚠️ Avería: ${machineName}`,
              `${row.client ? `${row.client}: ` : ""}${averiaTitle}`,
              "/averias"
            );

            // Disparar evento para abrir modal Pop-Up si está montado
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("gruper:averia-alert", {
                  detail: {
                    id: row.id,
                    clientName: row.client || "Cliente",
                    machineName,
                    title: averiaTitle,
                    urgency: isUrgent ? "urgente" : "normal",
                  },
                })
              );
            }
            return;
          }

          // Notify assigned worker or admin para trabajos estándar
          if (isAdmin || row.assigned_to === myId) {
            const desc = `${row.client ? `Cliente: ${row.client} · ` : ""}Tienes un nuevo trabajo registrado`;
            toast.info(`Nuevo trabajo: ${row.title}`, {
              description: desc,
              duration: 12000,
              action: {
                label: "Ver",
                onClick: () => navigate({ to: "/trabajos" }),
              },
            });
            sendWebNotification(`Nuevo trabajo: ${row.title}`, desc, "/trabajos");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, isAdmin, qc, navigate]);

  return null;
}
