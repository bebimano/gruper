import { createServerFn } from "@tanstack/react-start";
import { contactSchema } from "./contact-schema";

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    // Public contact intake: server-only insertion, no public read permission.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_submissions").insert(data);
    if (error) throw new Error("No se ha podido guardar tu mensaje. Inténtalo de nuevo.");
    return { saved: true };
  });