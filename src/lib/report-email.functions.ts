import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getReportFilename } from "./report-pdf";

/** Formats report number server-side: initials + 2-digit year + 4-digit seq → e.g. BM260001 */
function fmtNum(initials: string, createdAt: string | null | undefined, num: number | string): string {
  const n = typeof num === "number" ? num : parseInt(String(num), 10);
  if (isNaN(n)) return String(num);
  let year = new Date().getFullYear();
  if (createdAt) {
    const p = new Date(createdAt);
    if (!isNaN(p.getTime()) && p.getFullYear() > 1900) year = p.getFullYear();
  }
  const clean = (initials || "").trim().toUpperCase();
  const y2 = String(year).slice(-2);
  const seq = String(n).padStart(4, "0");
  return clean ? `${clean}${y2}${seq}` : `${y2}${seq}`;
}

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
      .select("number, user_number, user_id, created_at, data")
      .eq("id", data.id)
      .maybeSingle();
    if (!rep) throw new Error("Parte no encontrado");

    const num = rep.user_number ?? rep.number;
    const cliente = String((rep.data as { cliente?: string })?.cliente ?? "").trim();

    // Fetch creator profile username + initials
    const { data: creatorProfile } = await context.supabase
      .from("profiles")
      .select("username, initials")
      .eq("id", rep.user_id)
      .maybeSingle();
    const creatorName = creatorProfile?.username ? creatorProfile.username.trim() : "";
    const initials = ((creatorProfile as any)?.initials?.trim() || creatorName.slice(0, 2)).toUpperCase();

    // Número formateado con iniciales: BM260001
    const formattedNum = fmtNum(initials, rep.created_at ?? null, num);

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
    const file = getReportFilename(formattedNum, creatorName, cliente, isTaller ? "taller" : "trabajo");
    const pdf = data.pdf.replace(/(.{76})/g, "$1\r\n");

    const subjectStr = `${reportTypeTitle} Nº ${formattedNum}${creatorName ? ` (${creatorName})` : ""}${cliente ? ` — ${cliente}` : ""} — Gruper`;
    const bodyStr = `Hola,\n\nAdjuntamos el ${reportTypeTitle.toLowerCase()} Nº ${formattedNum}${cliente ? ` correspondiente a ${cliente}` : ""}${creatorName ? ` realizado por ${creatorName}` : ""} firmado.\n\nUn saludo,\nGruper`;

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
