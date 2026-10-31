export type Dia = {
  fecha: string; idaDe: string; idaA: string; kmIda: string;
  mananaDe: string; mananaA: string; tardeDe: string; tardeA: string;
  vueltaDe: string; vueltaA: string; kmVuelta: string;
};
export type Linea = { codigo: string; descripcion: string; cantidad: string };

export type WorkReport = {
  cliente: string; de: string; tecnico: string; vehiculo: string;
  codigoMaquina: string; numSerie: string; reparacion: string; suministro: string;
  materiales: string; instalacion: string;
  dias: Dia[]; trabajos: Linea[]; materialesLista: Linea[];
  solicitadoPor: string; observaciones: string;
};

export const emptyDia = (): Dia => ({ fecha: "", idaDe: "", idaA: "", kmIda: "", mananaDe: "", mananaA: "", tardeDe: "", tardeA: "", vueltaDe: "", vueltaA: "", kmVuelta: "" });
export const emptyLinea = (): Linea => ({ codigo: "", descripcion: "", cantidad: "" });

export function emptyReport(tecnico = ""): WorkReport {
  return {
    cliente: "", de: "", tecnico, vehiculo: "", codigoMaquina: "", numSerie: "",
    reparacion: "", suministro: "", materiales: "", instalacion: "",
    dias: [emptyDia()], trabajos: [emptyLinea()], materialesLista: [emptyLinea()],
    solicitadoPor: "", observaciones: "",
  };
}

export function normalizeReport(d: unknown): WorkReport {
  const base = emptyReport();
  const o = (d && typeof d === "object" ? d : {}) as Partial<WorkReport>;
  return { ...base, ...o, dias: o.dias?.length ? o.dias : base.dias, trabajos: o.trabajos?.length ? o.trabajos : base.trabajos, materialesLista: o.materialesLista?.length ? o.materialesLista : base.materialesLista };
}
