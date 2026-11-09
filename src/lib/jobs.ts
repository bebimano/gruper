export const JOB_STATUSES = [
  { value: "pendiente", label: "Pendiente", cls: "bg-muted text-muted-foreground" },
  { value: "en_curso", label: "En curso", cls: "bg-primary/15 text-primary" },
  { value: "pausado", label: "Pausado", cls: "bg-accent text-accent-foreground" },
  { value: "terminado", label: "Terminado", cls: "bg-secondary text-secondary-foreground" },
] as const;
export const statusInfo = (s: string) => JOB_STATUSES.find((x) => x.value === s) ?? JOB_STATUSES[0];
