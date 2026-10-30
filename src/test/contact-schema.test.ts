import { describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/contact-schema";

const input = { name: "Ana", company: "Empresa de prueba", phone: "+34 600 000 000", message: "Consulta sobre una máquina" };

describe("Contact required fields", () => {
  it.each(["name", "company", "phone", "message"])("requires %s", (field) => {
    expect(contactSchema.safeParse({ ...input, [field]: "   " }).success).toBe(false);
  });
  it("accepts all four requested fields", () => {
    expect(contactSchema.parse(input)).toEqual(input);
  });
  it("rejects a non-phone value", () => {
    expect(contactSchema.safeParse({ ...input, phone: "not-a-number" }).success).toBe(false);
  });
});