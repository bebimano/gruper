import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/gruper-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gruper Remote — Acceso clientes" },
      { name: "description", content: "Accede a tus máquinas Gruper de forma remota y segura." },
      { property: "og:title", content: "Gruper Remote — Acceso clientes" },
      { property: "og:description", content: "Accede a tus máquinas Gruper de forma remota y segura." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/maquinas" });
    });
    supabase.rpc("admin_exists").then(({ data }) => setNeedsSetup(data === false));
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    setLoading(false);
    if (error) return setError("Usuario o contraseña incorrectos");
    navigate({ to: "/maquinas" });
  }

  return (
    <main className="min-h-screen bg-hero flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <img src={logo} alt="Gruper — Shaping the Future of Water" width={904} height={269} className="w-64 h-auto mb-12" />
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-2xl bg-card/70 backdrop-blur p-6 border border-border">
        <h1 className="text-xl font-semibold">Acceso clientes</h1>
        <div className="space-y-2">
          <Label htmlFor="u">Usuario</Label>
          <Input id="u" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p">Contraseña</Label>
          <Input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full h-12 text-base shadow-glow">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      {needsSetup && (
        <Link to="/setup" className="mt-6 text-sm text-primary underline">Configuración inicial: crear administrador</Link>
      )}
    </main>
  );
}
