import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";

/** On the installed phone app: asks permission and saves this phone's notification token. */
export function PushRegistrar() {
  const me = useMe();
  const navigate = useNavigate();
  const uid = me.data?.id;
  useEffect(() => {
    if (!uid || !Capacitor.isNativePlatform()) return;
    let off: (() => void) | undefined;
    (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") return;
      const a = await PushNotifications.addListener("registration", async (t) => {
        await supabase.from("push_tokens").upsert({ token: t.value, user_id: uid, platform: Capacitor.getPlatform(), updated_at: new Date().toISOString() });
      });
      const b = await PushNotifications.addListener("pushNotificationActionPerformed", (n) => {
        const link = n.notification.data?.link as string | undefined;
        if (link?.startsWith("/")) navigate({ to: link });
      });
      await PushNotifications.register();
      off = () => { a.remove(); b.remove(); };
    })().catch(console.error);
    return () => off?.();
  }, [uid, navigate]);
  return null;
}
