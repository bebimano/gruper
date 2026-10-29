import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { setupFirstAdmin } from "@/lib/users.functions";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Configuración inicial — Gruper Remote" },
      { name: "description", content: "Crea la cuenta de administrador de Gruper Remote." },
      { property: "og:title", content: "Configuración inicial — Gruper Remote" },
      { property: "og:description", content: "Crea la cuenta de administrador de Gruper Remote." },
    ],
  }),
  component: Setup,
});

function Setup() {
  const navigate = useNavigate();
  const setup = useServerFn(setupFirstAdmin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await setup({ data: { username, password } });
      await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
      navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-hero flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-3xl bg-card p-6 shadow-sm border border-border">
        <h1 className="text-xl font-semibold">Crear administrador</h1>
        <p className="text-sm text-muted-foreground">Solo se puede hacer una vez. Esta será tu cuenta para gestionar clientes y máquinas.</p>
        <div className="space-y-2">
          <Label htmlFor="u">Usuario</Label>
          <Input id="u" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p">Contraseña</Label>
          <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full h-12">Crear y entrar</Button>
      </form>
    </main>
  );
}
