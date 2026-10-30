import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createClientUser, deleteClientUser, resetClientPassword } from "@/lib/users.functions";
import { useMe } from "@/lib/useRole";
import logo from "@/assets/gruper-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactMessages } from "@/components/ContactMessages";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración — Gruper Remote" },
      { name: "description", content: "Gestiona clientes y máquinas de Gruper Remote." },
      { property: "og:title", content: "Administración — Gruper Remote" },
      { property: "og:description", content: "Gestiona clientes y máquinas de Gruper Remote." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "Error");

function Admin() {
  const me = useMe();
  if (me.isLoading) return null;
  if (!me.data?.isAdmin) return <p className="p-8 text-center text-muted-foreground">No autorizado</p>;
  return (
    <main className="min-h-screen bg-hero px-5 safe-top safe-bottom max-w-2xl mx-auto">
      <header className="py-3">
        <div className="flex items-center justify-between">
          <img src={logo.url} alt="Gruper" width={1076} height={343} className="h-8 w-auto" />
          <Link to="/maquinas" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Máquinas</Link>
        </div>
        <h1 className="mt-4 text-2xl font-bold">Administración</h1>
      </header>
      <Tabs defaultValue="machines" className="mt-2">
        <TabsList className="w-full">
          <TabsTrigger value="machines" className="flex-1">Máquinas</TabsTrigger>
          <TabsTrigger value="clients" className="flex-1">Clientes</TabsTrigger>
          <TabsTrigger value="messages" className="flex-1">Mensajes</TabsTrigger>
        </TabsList>
        <TabsContent value="machines"><MachinesAdmin /></TabsContent>
        <TabsContent value="clients"><ClientsAdmin myId={me.data.id} /></TabsContent>
        <TabsContent value="messages"><ContactMessages /></TabsContent>
      </Tabs>
    </main>
  );
}

function useMachines() {
  return useQuery({
    queryKey: ["admin-machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

function MachinesAdmin() {
  const qc = useQueryClient();
  const machines = useMachines();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https:\/\//i.test(url.trim())) { toast.error("El enlace debe empezar por https://"); return; }
    const { error } = await supabase.from("machines").insert({ name: name.trim(), description: description.trim() || null, url: url.trim() });
    if (error) { err(error); return; }
    setName(""); setDescription(""); setUrl("");
    toast.success("Máquina añadida");
    qc.invalidateQueries();
  }
  async function remove(id: string) {
    if (!confirm("¿Eliminar esta máquina?")) return;
    const { error } = await supabase.from("machines").delete().eq("id", id);
    if (error) { err(error); return; }
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-4 mt-4">
      <form onSubmit={add} className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">Nueva máquina</h2>
        <Input placeholder="Nombre (ej. Depuradora 1)" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        <Input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} />
        <Input placeholder="https://… enlace noVNC" value={url} onChange={(e) => setUrl(e.target.value)} required autoCapitalize="none" />
        <Button type="submit" className="w-full">Añadir</Button>
      </form>
      {machines.data?.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium">{m.name}</p>
            <p className="text-xs text-muted-foreground truncate">{m.url}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => remove(m.id)} aria-label="Eliminar"><Trash2 /></Button>
        </div>
      ))}
    </div>
  );
}

function ClientsAdmin({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const machines = useMachines();
  const createFn = useServerFn(createClientUser);
  const deleteFn = useServerFn(deleteClientUser);
  const resetFn = useServerFn(resetClientPassword);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const clients = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const [{ data: profiles }, { data: access }] = await Promise.all([
        supabase.from("profiles").select("id, username").order("username"),
        supabase.from("machine_access").select("user_id, machine_id"),
      ]);
      return (profiles ?? []).filter((p) => p.id !== myId).map((p) => ({
        ...p,
        machineIds: new Set((access ?? []).filter((a) => a.user_id === p.id).map((a) => a.machine_id)),
      }));
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createFn({ data: { username, password } });
      toast.success(`Cliente ${username} creado`);
      setUsername(""); setPassword("");
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (e) { err(e); }
  }
  async function toggle(userId: string, machineId: string, on: boolean) {
    const { error } = on
      ? await supabase.from("machine_access").insert({ user_id: userId, machine_id: machineId })
      : await supabase.from("machine_access").delete().eq("user_id", userId).eq("machine_id", machineId);
    if (error) { err(error); return; }
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
  }
  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar al cliente ${name}?`)) return;
    try { await deleteFn({ data: { id } }); qc.invalidateQueries({ queryKey: ["admin-clients"] }); } catch (e) { err(e); }
  }
  async function reset(id: string) {
    const pw = prompt("Nueva contraseña (mínimo 6 caracteres)");
    if (!pw) return;
    try { await resetFn({ data: { id, password: pw } }); toast.success("Contraseña cambiada"); } catch (e) { err(e); }
  }

  return (
    <div className="space-y-4 mt-4">
      <form onSubmit={add} className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">Nuevo cliente</h2>
        <Input placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} required autoCapitalize="none" />
        <Input placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full">Crear cliente</Button>
      </form>
      {clients.data?.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 font-medium">{c.username}</p>
            <Button variant="ghost" size="icon" onClick={() => reset(c.id)} aria-label="Cambiar contraseña"><KeyRound /></Button>
            <Button variant="ghost" size="icon" onClick={() => remove(c.id, c.username)} aria-label="Eliminar"><Trash2 /></Button>
          </div>
          <div className="space-y-2">
            {machines.data?.length === 0 && <p className="text-sm text-muted-foreground">Añade máquinas primero.</p>}
            {machines.data?.map((m) => (
              <label key={m.id} className="flex items-center gap-3 text-sm">
                <Checkbox checked={c.machineIds.has(m.id)} onCheckedChange={(v) => toggle(c.id, m.id, v === true)} />
                {m.name}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
