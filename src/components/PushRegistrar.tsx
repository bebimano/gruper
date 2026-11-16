import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";

/** Registers push notification tokens on native devices (Capacitor) and registers service worker on web / PWA. */
export function PushRegistrar() {
  const me = useMe();
  const navigate = useNavigate();
  const uid = me.data?.id;

  useEffect(() => {
    if (!uid) return;

    // 1. Native platform (Capacitor Android / iOS App)
    if (Capacitor.isNativePlatform()) {
      let off: (() => void) | undefined;
      (async () => {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;
        const a = await PushNotifications.addListener("registration", async (t) => {
          await supabase.from("push_tokens").upsert({
            token: t.value,
            user_id: uid,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          });
        });
        const b = await PushNotifications.addListener("pushNotificationActionPerformed", (n) => {
          const link = n.notification.data?.link as string | undefined;
          if (link?.startsWith("/")) navigate({ to: link });
        });
        await PushNotifications.register();
        off = () => {
          a.remove();
          b.remove();
        };
      })().catch(console.error);
      return () => off?.();
    }

    // 2. Web browser / iPhone PWA (Safari / Chrome)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          // If browser notifications are supported
          if ("Notification" in window) {
            if (Notification.permission === "default") {
              // Request permission politely
              try {
                const res = await Notification.requestPermission();
                if (res === "granted") {
                  console.log("Web notification permission granted");
                }
              } catch (e) {
                console.error("Error requesting notification permission:", e);
              }
            }
          }
        })
        .catch((err) => {
          console.error("ServiceWorker registration failed:", err);
        });
    }
  }, [uid, navigate]);

  return null;
}
