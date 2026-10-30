import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contactSchema, type ContactInput } from "@/lib/contact-schema";
import { submitContact } from "@/lib/contact.functions";
import logo from "@/assets/gruper-logo.png.asset.json";

export const Route = createFileRoute("/contacto")({
  head: () => ({ meta: [
    { title: "Contacto — Gruper Remote" },
    { name: "description", content: "Contacta con el equipo de Gruper." },
    { property: "og:title", content: "Contacto — Gruper Remote" },
    { property: "og:description", content: "Contacta con el equipo de Gruper." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Contact,
});

function Contact() {
  const router = useRouter();
  const submit = useServerFn(submitContact);
  const [values, setValues] = useState<ContactInput>({ name: "", company: "", phone: "", message: "" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  function back() {
    if (router.history.canGoBack()) router.history.back();
    else router.navigate({ to: "/" });
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const result = contactSchema.safeParse(values);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Revisa los datos"); return; }
    setPending(true);
    try { await submit({ data: result.data }); setSaved(true); }
    catch { setError("No se ha podido guardar tu mensaje. Inténtalo de nuevo."); }
    finally { setPending(false); }
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-background px-5 safe-top safe-bottom">
      <header className="flex items-center gap-3 py-3">
        <Button variant="ghost" size="icon" aria-label="Volver" onClick={back} className="shrink-0 text-muted-foreground"><ArrowLeft className="size-4" /></Button>
        <img src={logo.url} alt="Gruper" width={1076} height={343} className="h-9 w-auto max-w-[65%] object-contain" />
      </header>
      <section className="mx-auto w-full max-w-md py-6">
        <h1 className="text-2xl font-bold">Contacto</h1>
        {saved ? <div className="py-10" role="status">
          <CheckCircle2 className="mb-4 size-10 text-success" />
          <h2 className="text-lg font-semibold">Mensaje recibido</h2>
          <p className="mt-2 text-muted-foreground">Gracias por ponerte en contacto con nosotros.</p>
          <Button variant="outline" onClick={back} className="mt-6"><ArrowLeft className="size-4" />Volver</Button>
        </div> : <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="space-y-2"><Label htmlFor="contact-name">Nombre</Label><Input id="contact-name" autoComplete="name" required maxLength={100} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="h-12" /></div>
          <div className="space-y-2"><Label htmlFor="contact-company">Empresa</Label><Input id="contact-company" autoComplete="organization" required maxLength={160} value={values.company} onChange={(e) => setValues({ ...values, company: e.target.value })} className="h-12" /></div>
          <div className="space-y-2"><Label htmlFor="contact-phone">Teléfono de contacto</Label><Input id="contact-phone" type="tel" autoComplete="tel" required minLength={6} maxLength={30} value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} className="h-12" /></div>
          <div className="space-y-2"><Label htmlFor="contact-message">Mensaje</Label><Textarea id="contact-message" required maxLength={4000} rows={5} value={values.message} onChange={(e) => setValues({ ...values, message: e.target.value })} className="resize-y" /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="h-12 w-full font-semibold"><Send className="size-4" />{pending ? "Enviando…" : "Enviar mensaje"}</Button>
        </form>}
      </section>
    </main>
  );
}