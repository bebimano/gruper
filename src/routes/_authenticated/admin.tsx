import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Trash2, KeyRound, FileText, RefreshCw, Shield } from "lucide-react";
import { checkMachinesStatus } from "@/lib/machines.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createUserAccount, deleteClientUser, resetClientPassword, setUserRole } from "@/lib/users.functions";
import { useMe } from "@/lib/useRole";
import logo from "@/assets/gruper-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ContactMessages } from "@/components/ContactMessages";
import { MaterialsAdmin } from "@/components/MaterialsAdmin";
import { ReportContactsAdmin } from "@/components/ReportContactsAdmin";
import { FixedEmailsAdmin } from "@/components/FixedEmailsAdmin";
import { NotificationSettingsAdmin } from "@/components/NotificationSettingsAdmin";
import { ClientEquipmentAdmin } from "@/components/ClientEquipmentAdmin";
import { WorkerInitialsAdmin } from "@/components/WorkerInitialsAdmin";
import { VehiclesAdmin } from "@/components/VehiclesAdmin";

function EditRequests() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["edit-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_reports").select("id, number, user_number, user_id, data").eq("edit_requested", true).order("number");
      if (error) throw error;
      return data;
    },
  });
  async function decide(id: string, ok: boolean) {
    const patch = ok ? { closed: false, edit_requested: false, edit_used: true } : { edit_requested: false, edit_used: true };
    const { error } = await supabase.from("work_reports").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(ok ? "Parte reabierto para modificar" : "Solicitud rechazada");
    qc.invalidateQueries({ queryKey: ["edit-requests"] });
    qc.invalidateQueries({ queryKey: ["work-reports"] });
  }
  if (!q.data?.length) return null;
  return (
    <div className="rounded-xl border border-primary/40 bg-background p-4 space-y-3">
      <h2 className="font-medium">Solicitudes de modificación</h2>
      {q.data.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
          <Link to="/parte/$id" params={{ id: r.id }} className="flex-1 font-medium hover:text-primary">
            Parte Nº {r.user_number ?? r.number} — {String((r.data as { cliente?: string })?.cliente ?? "")}
          </Link>
          <Button size="sm" onClick={() => decide(r.id, true)}>Permitir</Button>
          <Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Rechazar</Button>
        </div>
      ))}
    </div>
  );
}

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
    <main className="min-h-screen bg-hero px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-12">
      <header className="py-3">
        <div className="flex items-center justify-between">
          <img src={logo.url} alt="Gruper" width={1076} height={343} className="h-8 sm:h-9 w-auto" />
          <Link to="/maquinas" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Máquinas</Link>
        </div>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold">Administración</h1>
      </header>
      <Tabs defaultValue="machines" className="mt-2">
        <TabsList className="w-full h-auto flex-wrap">
          <TabsTrigger value="machines" className="flex-1">Máquinas</TabsTrigger>
          <TabsTrigger value="clients" className="flex-1">Usuarios</TabsTrigger>
          <TabsTrigger value="equipment" className="flex-1">Equipos</TabsTrigger>
          <TabsTrigger value="opens" className="flex-1">Accesos</TabsTrigger>
          <TabsTrigger value="messages" className="flex-1">Mensajes</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">Partes</TabsTrigger>
          <TabsTrigger value="vehicles" className="flex-1">Vehículos</TabsTrigger>
          <TabsTrigger value="stock" className="flex-1">Stock</TabsTrigger>
          <TabsTrigger value="notify" className="flex-1">Avisos</TabsTrigger>
        </TabsList>
        <TabsContent value="machines"><MachinesAdmin /></TabsContent>
        <TabsContent value="clients">
          <ClientsAdmin myId={me.data.id} />
          <div className="mt-6">
            <WorkerInitialsAdmin />
          </div>
        </TabsContent>
        <TabsContent value="equipment"><div className="mt-4"><ClientEquipmentAdmin /></div></TabsContent>
        <TabsContent value="opens"><OpensLog /></TabsContent>
        <TabsContent value="messages"><ContactMessages /></TabsContent>
        <TabsContent value="reports">
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Activa "Partes de trabajo" en cada cliente desde la pestaña Usuarios. Los administradores tienen acceso automático a todos los partes.</p>
              <Button asChild variant="outline" className="w-full"><Link to="/partes"><FileText /> Ver todos los partes</Link></Button>
            </div>
            <VehiclesAdmin />
            <WorkerInitialsAdmin />
            <EditRequests />
            <FixedEmailsAdmin />
            <ReportContactsAdmin />
          </div>
        </TabsContent>
        <TabsContent value="vehicles">
          <div className="mt-4">
            <VehiclesAdmin />
          </div>
        </TabsContent>
        <TabsContent value="stock"><MaterialsAdmin /></TabsContent>
        <TabsContent value="notify"><NotificationSettingsAdmin /></TabsContent>
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
  const [assign, setAssign] = useState<Set<string>>(new Set());
  const clientList = useQuery({
    queryKey: ["admin-client-list"],
    queryFn: async () => {
      const [{ data: p }, { data: admins }] = await Promise.all([
        supabase.from("profiles").select("id, username").order("username"),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const a = new Set((admins ?? []).map((x) => x.user_id));
      return (p ?? []).filter((x) => !a.has(x.id));
    },
  });

  const statusFn = useServerFn(checkMachinesStatus);
  const status = useQuery({ queryKey: ["machine-status"], queryFn: () => statusFn(), refetchInterval: 60000 });
  const access = useQuery({
    queryKey: ["admin-access"],
    queryFn: async () => (await supabase.from("machine_access").select("user_id, machine_id")).data ?? [],
  });
  async function toggleAccess(userId: string, machineId: string, on: boolean) {
    const { error } = on
      ? await supabase.from("machine_access").insert({ user_id: userId, machine_id: machineId })
      : await supabase.from("machine_access").delete().eq("user_id", userId).eq("machine_id", machineId);
    if (error) { err(error); return; }
    qc.invalidateQueries({ queryKey: ["admin-access"] });
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https:\/\//i.test(url.trim())) { toast.error("El enlace debe empezar por https://"); return; }
    const { data: m, error } = await supabase.from("machines").insert({ name: name.trim(), description: description.trim() || null, url: url.trim() }).select("id").single();
    if (error) { err(error); return; }
    if (assign.size) {
      const { error: e2 } = await supabase.from("machine_access").insert([...assign].map((user_id) => ({ user_id, machine_id: m.id })));
      if (e2) err(e2);
    }
    setName(""); setDescription(""); setUrl(""); setAssign(new Set());
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
      <form onSubmit={add} className="space-y-3 rounded-xl border border-border bg-background p-4">
        <h2 className="font-medium">Nueva máquina</h2>
        <Input placeholder="Nombre (ej. Depuradora 1)" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        <Input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} />
        <Input placeholder="https://… enlace noVNC" value={url} onChange={(e) => setUrl(e.target.value)} required autoCapitalize="none" />
        {!!clientList.data?.length && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground">Asignar a clientes</p>
            <div className="flex flex-wrap gap-2">
              {clientList.data.map((c) => {
                const on = assign.has(c.id);
                return (
                  <button type="button" key={c.id} aria-pressed={on}
                    onClick={() => { const n = new Set(assign); on ? n.delete(c.id) : n.add(c.id); setAssign(n); }}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted"}`}>
                    {c.username}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <Button type="submit" className="w-full">Añadir máquina</Button>
      </form>
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Máquinas</h2>
        <Button size="sm" variant="outline" onClick={() => status.refetch()} disabled={status.isFetching}>
          <RefreshCw className={status.isFetching ? "animate-spin" : ""} /> Comprobar conexión
        </Button>
      </div>
      {machines.data?.map((m) => {
        const st = status.data?.[m.id];
        const users = access.data?.filter((a) => a.machine_id === m.id).map((a) => a.user_id) ?? [];
        return (
          <div key={m.id} className="rounded-xl border border-border bg-background p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span title={st === undefined ? "Comprobando" : st ? "Conectada" : "Sin conexión"}
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${st === undefined ? "bg-muted-foreground/40 animate-pulse" : st ? "bg-success" : "bg-destructive"}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{m.name} <span className="ml-1 text-xs font-normal text-muted-foreground">{st === undefined ? "comprobando…" : st ? "conectada" : "sin conexión"}</span></p>
                <p className="text-xs text-muted-foreground truncate">{m.url}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(m.id)} aria-label="Eliminar"><Trash2 /></Button>
            </div>
            {!!clientList.data?.length && (
              <div className="flex flex-wrap gap-2">
                {clientList.data.map((c) => {
                  const on = users.includes(c.id);
                  return (
                    <button type="button" key={c.id} aria-pressed={on} onClick={() => toggleAccess(c.id, m.id, !on)}
                      className={`rounded-md border px-3 py-1 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-muted"}`}>
                      {c.username}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OpensLog() {
  const q = useQuery({
    queryKey: ["machine-opens"],
    queryFn: async () => {
      const [{ data: opens, error }, { data: profiles }, { data: machines }] = await Promise.all([
        supabase.from("machine_opens").select("id, user_id, machine_id, opened_at").order("opened_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("id, username"),
        supabase.from("machines").select("id, name"),
      ]);
      if (error) throw error;
      const u = new Map((profiles ?? []).map((p) => [p.id, p.username]));
      const m = new Map((machines ?? []).map((x) => [x.id, x.name]));
      return (opens ?? []).map((o) => ({ ...o, user: u.get(o.user_id) ?? "—", machine: m.get(o.machine_id) ?? "—" }));
    },
  });
  const [filter, setFilter] = useState("");
  const rows = (q.data ?? []).filter((r) => !filter || r.machine === filter);
  const names = [...new Set((q.data ?? []).map((r) => r.machine))];
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-medium">Quién abre cada máquina</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todas</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!q.isLoading && !rows.length && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Todavía no hay accesos registrados.</p>}
      <div className="divide-y divide-border rounded-xl border border-border bg-background">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex-1 font-medium">{r.user}</span>
            <span className="text-muted-foreground">{r.machine}</span>
            <span className="w-32 text-right text-xs text-muted-foreground">{new Date(r.opened_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientsAdmin({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const machines = useMachines();
  const createFn = useServerFn(createUserAccount);
  const deleteFn = useServerFn(deleteClientUser);
  const resetFn = useServerFn(resetClientPassword);
  const setRoleFn = useServerFn(setUserRole);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "client">("client");

  const clients = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const [{ data: profiles }, { data: access }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("username"),
        supabase.from("machine_access").select("user_id, machine_id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).filter((p) => p.id !== myId).map((p) => {
        const item = p as any;
        return {
          ...item,
          can_view_all_reports: !!item.can_view_all_reports,
          role: (roleMap.get(item.id) as "admin" | "client") ?? "client",
          isAdmin: roleMap.get(item.id) === "admin",
          machineIds: new Set((access ?? []).filter((a) => a.user_id === item.id).map((a) => a.machine_id)),
        };
      });
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createFn({ data: { username, password, role: newRole } });
      toast.success(`Usuario ${username} creado como ${newRole === "admin" ? "Administrador" : "Cliente"}`);
      setUsername(""); setPassword(""); setNewRole("client");
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["admin-client-list"] });
    } catch (e) { err(e); }
  }
  async function toggleRole(id: string, name: string, targetRole: "admin" | "client") {
    const isPromoting = targetRole === "admin";
    if (
      !confirm(
        isPromoting
          ? `¿Dar acceso total de Administrador a "${name}"?\nTendrá acceso completo a todas las opciones, máquinas, partes y administración.`
          : `¿Cambiar a "${name}" a rol Cliente?\nPerderá el acceso de administrador y sus máquinas se asignarán individualmente.`,
      )
    )
      return;
    try {
      await setRoleFn({ data: { id, role: targetRole } });
      toast.success(`${name} ahora es ${isPromoting ? "Administrador" : "Cliente"}`);
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["admin-client-list"] });
    } catch (e) {
      err(e);
    }
  }
  async function toggle(userId: string, machineId: string, on: boolean) {
    const { error } = on
      ? await supabase.from("machine_access").insert({ user_id: userId, machine_id: machineId })
      : await supabase.from("machine_access").delete().eq("user_id", userId).eq("machine_id", machineId);
    if (error) { err(error); return; }
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
  }
  async function toggleReports(id: string, on: boolean) {
    const { error } = await supabase.from("profiles").update({ can_work_reports: on }).eq("id", id);
    if (error) { err(error); return; }
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
  }
  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar al usuario ${name}?`)) return;
    try {
      await deleteFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["admin-client-list"] });
    } catch (e) { err(e); }
  }
  async function reset(id: string) {
    const pw = prompt("Nueva contraseña (mínimo 6 caracteres)");
    if (!pw) return;
    try { await resetFn({ data: { id, password: pw } }); toast.success("Contraseña cambiada"); } catch (e) { err(e); }
  }

  return (
    <div className="space-y-4 mt-4">
      <form onSubmit={add} className="space-y-3 rounded-xl border border-border bg-background p-4">
        <h2 className="font-medium">Nuevo usuario</h2>
        <Input placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} required autoCapitalize="none" />
        <Input placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo de cuenta / Nivel de acceso:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNewRole("client")}
              className={`rounded-lg border p-2.5 text-left text-sm transition-colors ${
                newRole === "client"
                  ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <div className="font-medium text-foreground">Cliente / Operario</div>
              <div className="text-xs text-muted-foreground">Acceso solo a opciones y máquinas asignadas</div>
            </button>
            <button
              type="button"
              onClick={() => setNewRole("admin")}
              className={`rounded-lg border p-2.5 text-left text-sm transition-colors ${
                newRole === "admin"
                  ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Shield className="h-3.5 w-3.5 text-primary" /> Administrador
              </div>
              <div className="text-xs text-muted-foreground">Acceso total a todas las opciones de la app</div>
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full">Crear usuario</Button>
      </form>
      {clients.data?.map((c) => (
        <div key={c.id} className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <p className="font-medium">{c.username}</p>
              <Badge variant={c.isAdmin ? "default" : "outline"} className={c.isAdmin ? "bg-primary text-primary-foreground gap-1" : ""}>
                {c.isAdmin && <Shield className="h-3 w-3" />}
                {c.isAdmin ? "Administrador" : "Cliente"}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={() => reset(c.id)} aria-label="Cambiar contraseña"><KeyRound /></Button>
            <Button variant="ghost" size="icon" onClick={() => remove(c.id, c.username)} aria-label="Eliminar"><Trash2 /></Button>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Shield className="h-4 w-4 text-primary" />
              <span>Acceso de Administrador (todas las opciones)</span>
            </div>
            <Switch
              checked={c.isAdmin}
              onCheckedChange={(v) => toggleRole(c.id, c.username, v ? "admin" : "client")}
            />
          </label>

          {c.isAdmin ? (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              ✨ Este usuario es <strong>Administrador</strong>: tiene acceso automático y completo a todas las máquinas, todos los partes de trabajo, stock, avisos y gestión de la app.
            </p>
          ) : (
            <>
              <label className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Partes de trabajo</span>
                <Switch checked={c.can_work_reports} onCheckedChange={(v) => toggleReports(c.id, v)} />
              </label>
              {c.can_work_reports && (
                <>
                  <label className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <span>Puede pedir modificar un parte cerrado</span>
                    <Switch checked={c.can_request_edit} onCheckedChange={async (v) => {
                      const { error } = await supabase.from("profiles").update({ can_request_edit: v }).eq("id", c.id);
                      if (error) { err(error); return; }
                      qc.invalidateQueries({ queryKey: ["admin-clients"] });
                    }} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <div>
                      <span className="block font-medium">Ver partes de otros trabajadores</span>
                      <span className="block text-xs text-muted-foreground">Permite ver los partes de todos los clientes creados por otros compañeros</span>
                    </div>
                    <Switch checked={c.can_view_all_reports} onCheckedChange={async (v) => {
                      const { error } = await supabase.from("profiles").update({ can_view_all_reports: v } as any).eq("id", c.id);
                      if (error) {
                        err(error);
                        return;
                      }
                      toast.success(v ? "Permiso para ver todos los partes concedido" : "Permiso revocado");
                      qc.invalidateQueries({ queryKey: ["admin-clients"] });
                    }} />
                  </label>
                </>
              )}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground">Máquinas asignadas:</p>
                {machines.data?.length === 0 && <p className="text-sm text-muted-foreground">Añade máquinas primero.</p>}
                {machines.data?.map((m) => (
                  <label key={m.id} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={c.machineIds.has(m.id)} onCheckedChange={(v) => toggle(c.id, m.id, v === true)} />
                    {m.name}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
