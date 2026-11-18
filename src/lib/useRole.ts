import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkMyAveriasAccess } from "@/lib/averias.functions";
import { checkMyJobCreationAccess } from "@/lib/jobs.functions";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: roles }, { data: profile }, averiasAccess, jobsAccess] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        checkMyAveriasAccess().catch((err) => {
          console.warn("Error comprobando acceso a averias:", err);
          return { canAverias: false, isAdmin: false };
        }),
        checkMyJobCreationAccess().catch((err) => {
          console.warn("Error comprobando acceso a creacion de trabajos:", err);
          return { canCreateJobs: false, isAdmin: false };
        }),
      ]);
      const isAdmin = !!roles?.some((r) => r.role === "admin") || averiasAccess.isAdmin || jobsAccess.isAdmin;
      const p = profile as any;
      const canAverias = isAdmin || averiasAccess.canAverias || !!p?.can_averias;
      const canCreateJobs = isAdmin || jobsAccess.canCreateJobs || !!p?.can_create_jobs;

      return {
        id: u.user.id,
        username: p?.username ?? "",
        isAdmin,
        canReports: isAdmin || !!p?.can_work_reports,
        canRequestEdit: !!p?.can_request_edit,
        canViewAllReports: isAdmin || !!p?.can_view_all_reports,
        canAverias,
        canCreateJobs,
      };
    },
  });
}
