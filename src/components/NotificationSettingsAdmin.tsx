import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

const EVENTS = [
  { event: "new_report", label: "Parte nuevo", hint: "Cuando alguien crea un parte de trabajo." },
  { event: "new_job", label: "Nuevo trabajo", hint: "Cuando se crea un trabajo (el trabajador asignado siempre lo recibe)." },
  { event: "job_status", label: "Cambio de estado de un trabajo", hint: "Cuando un trabajador actualiza el estado." },
] as const;

export function NotificationSettingsAdmin() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async () => (await supabase.from("notification_settings").select("*")).data ?? [],
  });
  const users = useQuery({
    queryKey: ["profile-list"],
    queryFn: async () => (await supabase.from("profiles").select("id, username").order("username")).data ?? [],
  });
  async function save(event: string, patch: { enabled?: boolean; recipients?: string[] }) {
    const cur = settings.data?.find((s) => s.event === event) ?? { enabled: true, recipients: [] as string[] };
    const { error } = await supabase.from("notification_settings").upsert({ event, enabled: cur.enabled, recipients: cur.recipients, ...patch });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notification-settings"] });
  }
  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Avisos en el móvil, también con la app cerrada. Cada persona debe abrir la app instalada una vez y aceptar los avisos.</p>
      {EVENTS.map((e) => {
        const s = settings.data?.find((x) => x.event === e.event);
        const enabled = s?.enabled ?? true;
        const rec = s?.recipients ?? [];
        return (
          <div key={e.event} className="rounded-xl border border-border bg-background p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1"><p className="font-medium">{e.label}</p><p className="text-xs text-muted-foreground">{e.hint}</p></div>
              <Switch checked={enabled} onCheckedChange={(v) => save(e.event, { enabled: v })} aria-label={`Activar ${e.label}`} />
            </div>
            {enabled && (
              <div className="flex flex-wrap gap-2">
                {users.data?.map((u) => {
                  const on = rec.includes(u.id);
                  return (
                    <button key={u.id} type="button" onClick={() => save(e.event, { recipients: on ? rec.filter((x) => x !== u.id) : [...rec, u.id] })}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                      {u.username}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
