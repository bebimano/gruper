import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      ]);
      const isAdmin = !!roles?.some((r) => r.role === "admin");
      const p = profile as any;
      return {
        id: u.user.id,
        username: p?.username ?? "",
        isAdmin,
        canReports: isAdmin || !!p?.can_work_reports,
        canRequestEdit: !!p?.can_request_edit,
        canViewAllReports: isAdmin || !!p?.can_view_all_reports,
      };
    },
  });
}
