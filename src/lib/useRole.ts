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
        supabase.from("profiles").select("username, can_work_reports, can_request_edit").eq("id", u.user.id).maybeSingle(),
      ]);
      const isAdmin = !!roles?.some((r) => r.role === "admin");
      return {
        id: u.user.id,
        username: profile?.username ?? "",
        isAdmin,
        canReports: isAdmin || !!profile?.can_work_reports,
        canRequestEdit: !!profile?.can_request_edit,
      };
    },
  });
}
