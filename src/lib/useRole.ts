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
        supabase.from("profiles").select("username").eq("id", u.user.id).maybeSingle(),
      ]);
      return {
        id: u.user.id,
        username: profile?.username ?? "",
        isAdmin: !!roles?.some((r) => r.role === "admin"),
      };
    },
  });
}
