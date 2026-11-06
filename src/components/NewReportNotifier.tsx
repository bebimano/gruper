import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";

/** Admin only: popup whenever any user creates a new work report. */
export function NewReportNotifier() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = !!me.data?.isAdmin;
  const myId = me.data?.id;

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel(`new-reports-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "work_reports" }, async (payload) => {
        const row = payload.new as { id: string; number: number; user_id: string; data: { cliente?: string } };
        qc.invalidateQueries({ queryKey: ["work-reports"] });
        if (row.user_id === myId) return;
        const { data: p } = await supabase.from("profiles").select("username").eq("id", row.user_id).maybeSingle();
        toast.info(`Nuevo parte Nº ${row.number}`, {
          description: `${p?.username ?? "Un usuario"}${row.data?.cliente ? ` · ${row.data.cliente}` : ""}`,
          duration: 10000,
          action: { label: "Ver", onClick: () => navigate({ to: "/parte/$id", params: { id: row.id } }) },
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, myId, qc, navigate]);

  return null;
}
