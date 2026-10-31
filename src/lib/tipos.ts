// Contrato de datos del back-office. Espeja las respuestas de las RPC
// `bt_admin_*` (migración 0007). El navegador nunca recibe secretos: el
// segundo factor lo verifica Postgres.

export type Rol = "ADMIN" | "TAQUILLA" | "PASAJERO";

export interface CuentaAdmin {
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono: string;
  correo: string;
  rol: Rol;
}

export interface Entrada {
  token: string;
  rol: Rol;
  mfa: boolean;
  mfaPendiente: boolean;
  cuenta: CuentaAdmin;
}

export interface EstadoAdmin {
  rol: Rol;
  mfa: boolean;
  mfaPendiente: boolean;
  cuenta: CuentaAdmin;
}

export interface Lote {
  id: string;
  numero: number;
  patrocinante: string | null;
  cantidad: number;
  origen: string;
  desde: string;
  hasta: string;
}

export interface LoteCreado {
  lote: Lote;
  tarjetas: { serial: string; barcode: string; estado: string }[];
  creadoPor?: string;
}

export interface TarjetaCatalogo {
  serial: string;
  uid: string;
  estado: string;
  asignada: string | null;
}

export interface Catalogo {
  lote: {
    id: string;
    numero: number;
    patrocinante: string | null;
    cantidad: number;
    origen: string;
    creado: string;
  };
  tarjetas: TarjetaCatalogo[];
}

export interface ResultadoEnrolado {
  ok: boolean;
  enroladas: number;
  rechazadas: number;
  errores: { serial: string; uid: string; motivo: string }[];
}

export interface ResultadoMerma {
  ok: boolean;
  serial: string;
  tipo: "RFPGC" | "CHIP_ERR";
  estado: string;
}
