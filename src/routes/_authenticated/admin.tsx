import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowLeft,
  Trash2,
  KeyRound,
  FileText,
  RefreshCw,
  Shield,
  AlertTriangle,
  Bell,
  Wrench,
  Cpu,
  Users,
  CalendarCheck,
  Boxes,
  Building2,
  Truck,
  Package,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { GreetingWeatherCard } from "@/components/GreetingWeatherCard";
import { checkMachinesStatus } from "@/lib/machines.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createUserAccount, deleteClientUser, resetClientPassword, setUserRole } from "@/lib/users.functions";
import { useMe } from "@/lib/useRole";
import {
  getAllAllowedAveriasClients,
  setClientAveriasAccess,
  getAveriaNotifyRecipients,
  setAveriaNotifyRecipient,
} from "@/lib/averias.functions";
import {
  getJobCreatorRecipients,
  setUserCanCreateJobs,
} from "@/lib/jobs.functions";
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
import { DailyWorkSummaryAdmin } from "@/components/DailyWorkSummaryAdmin";
import { ReportNumberAdmin } from "@/components/ReportNumberAdmin";
import { ClientReportsSummaryAdmin } from "@/components/ClientReportsSummaryAdmin";
import { WorkerReportConfigAdmin } from "@/components/WorkerReportConfigAdmin";

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

const ADMIN_TABS = [
  { value: "machines", label: "Máquinas", icon: Cpu },
  { value: "clients", label: "Usuarios", icon: Users },
  { value: "daily_jobs", label: "Trabajos al día", icon: CalendarCheck },
  { value: "equipment", label: "Equipos", icon: Boxes },
  { value: "client_reports", label: "Partes por cliente", icon: Building2 },
  { value: "reports", label: "Partes", icon: FileText },
  { value: "averias", label: "Averías", icon: AlertTriangle },
  { value: "vehicles", label: "Vehículos", icon: Truck },
  { value: "stock", label: "Stock", icon: Package },
  { value: "opens", label: "Accesos", icon: ShieldCheck },
  { value: "messages", label: "Mensajes", icon: Mail },
  { value: "notify", label: "Avisos", icon: Bell },
] as const;

function Admin() {
  const me = useMe();
  const [activeTab, setActiveTab] = useState<string>("machines");

  if (me.isLoading) return null;
  if (!me.data?.isAdmin) return <p className="p-8 text-center text-muted-foreground">No autorizado</p>;
  return (
    <main className="min-h-screen bg-hero px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-12">
      <header className="flex items-center justify-between py-3">
        <img src={logo.url} alt="Gruper" width={1076} height={343} className="h-9 sm:h-11 w-auto" />
        <Button
          variant="outline"
          asChild
          className="rounded-xl border border-border/80 bg-card h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-2xs hover:border-primary/50 hover:bg-muted hover:text-primary active:scale-95 transition-all cursor-pointer gap-2"
        >
          <Link to="/maquinas">
            <ArrowLeft className="h-4 w-4 text-primary" />
            <span>Volver a máquinas</span>
          </Link>
        </Button>
      </header>

      {/* Saludo dinámico con temperatura, hora y humedad */}
      <div className="mt-4 sm:mt-5">
        <GreetingWeatherCard
          userName={me.data.username}
          subtitle="Panel de administración y supervisión técnica global de Gruper Remote."
          badge={
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
              <Shield className="h-3 w-3 mr-1 inline" /> Panel Administrador
            </Badge>
          }
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-5 space-y-4">
        {/* Selector rápido para móviles (< md) */}
        <div className="md:hidden rounded-2xl border border-border/80 bg-card/90 backdrop-blur p-2.5 shadow-2xs flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 shrink-0">
            Sección:
          </span>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="flex-1 bg-muted/60 border border-border/80 rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            {ADMIN_TABS.map((tab) => (
              <option key={tab.value} value={tab.value}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>

        {/* Menú de pestañas industrial auto-ajustable con scroll suave y píldoras táctiles */}
        <div className="w-full overflow-hidden rounded-2xl border border-border/80 bg-card/85 backdrop-blur p-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-0.5">
            {ADMIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`whitespace-nowrap px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground border border-primary/40 shadow-[0_2px_8px_rgba(37,159,253,0.35)] font-bold"
                      : "bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/40"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <TabsContent value="machines"><MachinesAdmin /></TabsContent>
        <TabsContent value="clients">
          <ClientsAdmin myId={me.data.id} />
          <div className="mt-6">
            <WorkerInitialsAdmin />
          </div>
        </TabsContent>
        <TabsContent value="daily_jobs"><DailyWorkSummaryAdmin /></TabsContent>
        <TabsContent value="equipment"><div className="mt-4"><ClientEquipmentAdmin /></div></TabsContent>
        <TabsContent value="client_reports"><div className="mt-4"><ClientReportsSummaryAdmin /></div></TabsContent>
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
            <WorkerReportConfigAdmin />
            <EditRequests />
            <FixedEmailsAdmin />
            <ReportContactsAdmin />
            <ReportNumberAdmin />
          </div>
        </TabsContent>
        <TabsContent value="vehicles">
          <div className="mt-4">
            <VehiclesAdmin />
          </div>
        </TabsContent>
        <TabsContent value="averias">
          <div className="mt-4 rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-bold">
              <Wrench className="h-5 w-5" />
              <span>Avisos de Averías y Fallos de Clientes</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Accede al panel completo de averías para consultar las notificaciones enviadas por los clientes, revisar las fotos adjuntas de la cámara, los elementos que fallan y actualizar el estado de reparación.
            </p>
            <p className="text-xs text-muted-foreground">
              Para definir qué máquinas le aparecen a cada cliente en el selector de averías, utiliza la pestaña <strong>Equipos</strong>.
            </p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl h-10 shadow-xs">
              <Link to="/averias">
                <Wrench className="h-4 w-4 mr-2" /> Ver y gestionar todas las averías
              </Link>
            </Button>
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
  const setAveriasFn = useServerFn(setClientAveriasAccess);
  const getAllAllowedFn = useServerFn(getAllAllowedAveriasClients);
  const getAveriaRecipientsFn = useServerFn(getAveriaNotifyRecipients);
  const setAveriaRecipientFn = useServerFn(setAveriaNotifyRecipient);
  const getJobCreatorsFn = useServerFn(getJobCreatorRecipients);
  const setJobCreatorFn = useServerFn(setUserCanCreateJobs);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "client">("client");

  const clients = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const [
        { data: profiles },
        { data: access },
        { data: roles },
        allowedAveriasList,
        notifyRecipientsList,
        jobCreatorsList,
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("username"),
        supabase.from("machine_access").select("user_id, machine_id"),
        supabase.from("user_roles").select("user_id, role"),
        getAllAllowedFn().catch(() => []),
        getAveriaRecipientsFn().catch(() => []),
        getJobCreatorsFn().catch(() => []),
      ]);
      const allowedAverias = new Set(allowedAveriasList ?? []);
      const notifyRecipients = new Set(notifyRecipientsList ?? []);
      const jobCreators = new Set(jobCreatorsList ?? []);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).filter((p) => p.id !== myId).map((p) => {
        const item = p as any;
        const isAdminUser = roleMap.get(item.id) === "admin";
        return {
          ...item,
          can_view_all_reports: !!item.can_view_all_reports,
          can_averias: !!item.can_averias || allowedAverias.has(item.id),
          can_create_jobs: isAdminUser || !!item.can_create_jobs || jobCreators.has(item.id),
          receives_averia_alerts: isAdminUser || notifyRecipients.has(item.id),
          role: (roleMap.get(item.id) as "admin" | "client") ?? "client",
          isAdmin: isAdminUser,
          machineIds: new Set((access ?? []).filter((a) => a.user_id === item.id).map((a) => a.machine_id)),
        };
      });
    },
  });

  async function toggleCreateJobs(id: string, on: boolean) {
    try {
      await setJobCreatorFn({ data: { userId: id, enabled: on } });
      toast.success(on ? "Permiso para crear trabajos concedido" : "Permiso para crear trabajos revocado");
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      err(e);
    }
  }

  async function toggleAverias(id: string, on: boolean) {
    try {
      await setAveriasFn({ data: { userId: id, allow: on } });
      toast.success(on ? "Acceso a Averías / Fallos activado" : "Acceso a Averías / Fallos desactivado");
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      err(e);
    }
  }

  async function toggleAveriaAlerts(id: string, on: boolean) {
    try {
      await setAveriaRecipientFn({ data: { userId: id, enabled: on } });
      toast.success(on ? "Avisos de avería activados para este usuario" : "Avisos de avería desactivados");
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (e) {
      err(e);
    }
  }

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
              <label className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <div>
                    <span className="font-medium">Crear y asignar trabajos para otros</span>
                    <span className="block text-xs text-muted-foreground">Permite al usuario crear trabajos y asignárselos a compañeros</span>
                  </div>
                </div>
                <Switch checked={c.can_create_jobs} onCheckedChange={(v) => toggleCreateJobs(c.id, v)} />
              </label>
              <label className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div>
                    <span className="font-medium">Averías / Fallos</span>
                    <span className="block text-xs text-muted-foreground">Permite al cliente dar avisos de avería con fotos y ver el estado</span>
                  </div>
                </div>
                <Switch checked={c.can_averias} onCheckedChange={(v) => toggleAverias(c.id, v)} />
              </label>
              <label className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <div>
                    <span className="font-medium">Recibir avisos de averías de clientes</span>
                    <span className="block text-xs text-muted-foreground">Ventana emergente y notificación push en el móvil (incluso con pantalla apagada)</span>
                  </div>
                </div>
                <Switch checked={c.receives_averia_alerts} onCheckedChange={(v) => toggleAveriaAlerts(c.id, v)} />
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
