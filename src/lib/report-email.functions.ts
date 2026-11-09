import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const hdr = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

/** Sends a work report PDF from the linked Gmail to the client's email + fixed emails. */
export const sendReportEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), pdf: z.string().min(10).max(15_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: caller must be able to see this report.
    const { data: rep } = await context.supabase.from("work_reports").select("number, data").eq("id", data.id).maybeSingle();
    if (!rep) throw new Error("Parte no encontrado");
    const cliente = String((rep.data as { cliente?: string })?.cliente ?? "").trim();
    const [{ data: contacts }, { data: fixed }] = await Promise.all([
      context.supabase.from("report_contacts").select("name, email"),
      context.supabase.from("report_fixed_emails").select("email"),
    ]);
    const c = contacts?.find((x) => x.name.trim().toLowerCase() === cliente.toLowerCase());
    const to = [...new Set([c?.email, ...(fixed ?? []).map((f) => f.email)].filter(Boolean))] as string[];
    if (!to.length) throw new Error("No hay correos asociados a este cliente");

    const key = process.env.LOVABLE_API_KEY, conn = process.env.GOOGLE_MAIL_API_KEY;
    if (!key || !conn) throw new Error("Gmail no está configurado");
    const boundary = "gruper" + crypto.randomUUID();
    const file = `Parte_${rep.number}.pdf`;
    const pdf = data.pdf.replace(/(.{76})/g, "$1\r\n");
    const mime = [
      `To: ${to.join(", ")}`,
      `Subject: ${hdr(`Parte de trabajo Nº ${rep.number} — Gruper`)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
      `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "",
      b64(`Hola,\n\nAdjuntamos el parte de trabajo Nº ${rep.number}${cliente ? ` (${cliente})` : ""} firmado.\n\nUn saludo,\nGruper`), "",
      `--${boundary}`, `Content-Type: application/pdf; name="${file}"`, `Content-Disposition: attachment; filename="${file}"`, "Content-Transfer-Encoding: base64", "",
      pdf, `--${boundary}--`,
    ].join("\r\n");
    const raw = btoa(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const res = await fetch(`${GATEWAY}/users/me/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": conn, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) { const t = await res.text(); console.error(`Gmail send failed [${res.status}]: ${t}`); throw new Error(`No se pudo enviar (${res.status})`); }
    return { to };
  });
