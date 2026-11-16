import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { statusInfo } from "@/lib/jobs";

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
          const row = payload.new as {
            id: string;
            title: string;
            client: string;
            assigned_to: string | null;
            status: string;
            status_note: string;
          };

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
          const row = payload.new as {
            id: string;
            title: string;
            client: string;
            assigned_to: string | null;
          };

          // Notify assigned worker or admin
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
