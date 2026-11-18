import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getReportFilename } from "./report-pdf";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const hdr = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

/** Sends a work report PDF from the linked Gmail to the client's email + fixed emails. */
export const sendReportEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), pdf: z.string().min(10).max(15_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: caller must be able to see this report.
    const { data: rep } = await context.supabase
      .from("work_reports")
      .select("number, user_number, user_id, data")
      .eq("id", data.id)
      .maybeSingle();
    if (!rep) throw new Error("Parte no encontrado");

    const num = rep.user_number ?? rep.number;
    const cliente = String((rep.data as { cliente?: string })?.cliente ?? "").trim();

    // Fetch creator profile username
    const { data: creatorProfile } = await context.supabase
      .from("profiles")
      .select("username")
      .eq("id", rep.user_id)
      .maybeSingle();
    const creatorName = creatorProfile?.username ? creatorProfile.username.trim() : "";

    const repData = (rep.data as { cliente?: string; tipo?: "trabajo" | "taller" }) ?? {};
    const isTaller = repData.tipo === "taller";
    const reportTypeTitle = isTaller ? "Parte de taller" : "Parte de trabajo";

    const [{ data: contacts }, { data: fixed }] = await Promise.all([
      context.supabase.from("report_contacts").select("name, email"),
      context.supabase.from("report_fixed_emails").select("email"),
    ]);

    const fixedEmailsList = (fixed ?? []).map((f) => f.email).filter(Boolean);
    const allFixed = fixedEmailsList.flatMap((f) =>
      f.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
    );
    let to: string[] = [];

    if (isTaller) {
      // Parte de taller: NO se envía al cliente, SOLO a correos fijos
      to = [...new Set(allFixed)];
      if (!to.length) throw new Error("No hay correos fijos configurados para enviar partes de taller");
    } else {
      // Parte de trabajo normal: cliente (puede tener múltiples correos) + correos fijos
      const c = contacts?.find((x) => x.name.trim().toLowerCase() === cliente.toLowerCase());
      const clientEmails = c?.email
        ? c.email.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
        : [];
      to = [...new Set([...clientEmails, ...allFixed])];
      if (!to.length) throw new Error("No hay correos asociados a este cliente ni correos fijos");
    }

    const key = process.env["LOVABLE_API_KEY"],
      conn = process.env["GOOGLE_MAIL_API_KEY"];
    if (!key || !conn) throw new Error("Gmail no está configurado");

    const boundary = "gruper" + crypto.randomUUID();
    const file = getReportFilename(num, creatorName, cliente, isTaller ? "taller" : "trabajo");
    const pdf = data.pdf.replace(/(.{76})/g, "$1\r\n");

    const subjectStr = `${reportTypeTitle} Nº ${num}${creatorName ? ` (${creatorName})` : ""}${cliente ? ` — ${cliente}` : ""} — Gruper`;
    const bodyStr = `Hola,\n\nAdjuntamos el ${reportTypeTitle.toLowerCase()} Nº ${num}${cliente ? ` correspondiente a ${cliente}` : ""}${creatorName ? ` realizado por ${creatorName}` : ""} firmado.\n\nUn saludo,\nGruper`;

    const mime = [
      `To: ${to.join(", ")}`,
      `Subject: ${hdr(subjectStr)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      b64(bodyStr),
      "",
      `--${boundary}`,
      `Content-Type: application/pdf; name="${file}"`,
      `Content-Disposition: attachment; filename="${file}"`,
      "Content-Transfer-Encoding: base64",
      "",
      pdf,
      `--${boundary}--`,
    ].join("\r\n");
    const raw = btoa(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const res = await fetch(`${GATEWAY}/users/me/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": conn, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`Gmail send failed [${res.status}]: ${t}`);
      throw new Error(`No se pudo enviar (${res.status})`);
    }
    return { to };
  });
