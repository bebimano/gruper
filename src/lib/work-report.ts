export type Dia = {
  fecha: string; idaDe: string; idaA: string; kmIda: string;
  mananaDe: string; mananaA: string; tardeDe: string; tardeA: string;
  vueltaDe: string; vueltaA: string; kmVuelta: string;
};
export type Linea = { codigo: string; descripcion: string; cantidad: string };

export type ReportPhoto = {
  id: string;
  tipo: "antes" | "despues" | "otro";
  titulo?: string;
  descripcion?: string;
  url: string;
};

export type DietasGastos = {
  desayunoEsp: number;
  comidaEsp: number;
  cenaEsp: number;
  pernoctaEsp: number;
  desayunoExt: number;
  comidaExt: number;
  cenaExt: number;
  pernoctaExt: number;
};

export type WorkReport = {
  cliente: string; direccion: string; de: string; tecnico: string; vehiculo: string;
  codigoMaquina: string; numSerie: string; reparacion: string; suministro: string;
  materiales: string; instalacion: string;
  dias: Dia[]; trabajos: Linea[]; materialesLista: Linea[];
  dietas?: DietasGastos;
  solicitadoPor: string; observaciones: string;
  firmaNombre: string; firma: string;
  fotos: ReportPhoto[];
};

export const emptyDia = (): Dia => ({ fecha: "", idaDe: "", idaA: "", kmIda: "", mananaDe: "", mananaA: "", tardeDe: "", tardeA: "", vueltaDe: "", vueltaA: "", kmVuelta: "" });
export const emptyLinea = (): Linea => ({ codigo: "", descripcion: "", cantidad: "" });
export const emptyDietas = (): DietasGastos => ({
  desayunoEsp: 0,
  comidaEsp: 0,
  cenaEsp: 0,
  pernoctaEsp: 0,
  desayunoExt: 0,
  comidaExt: 0,
  cenaExt: 0,
  pernoctaExt: 0,
});

export function emptyReport(tecnico = ""): WorkReport {
  return {
    cliente: "", direccion: "", de: "", tecnico, vehiculo: "", codigoMaquina: "", numSerie: "",
    reparacion: "", suministro: "", materiales: "", instalacion: "",
    dias: [emptyDia()], trabajos: [emptyLinea()], materialesLista: [emptyLinea()],
    dietas: emptyDietas(),
    solicitadoPor: "", observaciones: "", firmaNombre: "", firma: "",
    fotos: [],
  };
}

export function normalizeReport(d: unknown): WorkReport {
  const base = emptyReport();
  const o = (d && typeof d === "object" ? d : {}) as Partial<WorkReport>;
  return {
    ...base,
    ...o,
    direccion: o.direccion ?? "",
    dias: o.dias?.length ? o.dias : base.dias,
    trabajos: o.trabajos?.length ? o.trabajos : base.trabajos,
    materialesLista: o.materialesLista?.length ? o.materialesLista : base.materialesLista,
    dietas: o.dietas ? { ...emptyDietas(), ...o.dietas } : emptyDietas(),
    fotos: Array.isArray(o.fotos) ? o.fotos : [],
  };
}
