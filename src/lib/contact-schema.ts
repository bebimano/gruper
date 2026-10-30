import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(100),
  company: z.string().trim().min(1, "Escribe tu empresa").max(160),
  phone: z.string().trim().min(6, "Escribe un teléfono de contacto válido").max(30).regex(/^\+?[0-9\s().-]+$/, "Escribe un teléfono de contacto válido").refine((value) => value.replace(/\D/g, "").length >= 6, "Escribe un teléfono de contacto válido"),
  message: z.string().trim().min(1, "Escribe tu mensaje").max(4000),
}).strict();

export type ContactInput = z.infer<typeof contactSchema>;