import { createClient } from "@/lib/supabase/server";
import { TestimonialsClient } from "./testimonials-client";

export async function Testimonials() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("testimonials")
    .select("id, quote, name, role, team, rating")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return <TestimonialsClient testimonials={data ?? []} />;
}
