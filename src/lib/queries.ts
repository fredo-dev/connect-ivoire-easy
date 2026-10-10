import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Non connecté");
    const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    if (error) throw error;
    return { email: u.user.email ?? "", id: u.user.id, profile: data };
  },
});

export const plansQuery = queryOptions({
  queryKey: ["plans"],
  queryFn: async () => {
    const { data, error } = await supabase.from("plans").select("*").order("price");
    if (error) throw error;
    return data;
  },
});

export const transactionsQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("transactions").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  },
});
