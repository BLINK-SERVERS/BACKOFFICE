import type {
  Catalogo,
  CuentaAdmin,
  Entrada,
  EstadoAdmin,
  LoteCreado,
  ResultadoEnrolado,
  ResultadoMerma,
} from "./tipos";

export type {
  Catalogo,
  CuentaAdmin,
  Entrada,
  EstadoAdmin,
  LoteCreado,
  ResultadoEnrolado,
  ResultadoMerma,
};

// Cliente REST mínimo sobre PostgREST. Igual que en el portal del
// pasajero no se usa `supabase-js`: el back-office solo llama funciones
// `bt_admin_*`, y la llave que viaja al navegador es la publicable.
//
// El navegador NUNCA lleva `service_role`: las funciones de
// aprovisionamiento crudo (`bt_generar_lote`, `bt_estacion_*`) están
// cerradas para `anon` y solo se alcanzan a través de los envoltorios
// con token de sesión.

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const LLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const nubeConfigurada = Boolean(URL_BASE && LLAVE);

export type CodigoError =
  | "credenciales"
  | "mfa"
  | "sesion"
  | "permiso"
  | "datos"
  | "sin-tarjeta"
  | "sin-enrolar"
  | "sin-cuenta"
  | "bloqueada"
  | "duplicada"
  | "ya-activada"
  | "red";

const CODIGOS: CodigoError[] = [
  "credenciales",
  "mfa",
  "sesion",
  "permiso",
  "datos",
  "sin-tarjeta",
  "sin-enrolar",
  "sin-cuenta",
  "bloqueada",
  "duplicada",
  "ya-activada",
  "red",
];

export class ErrorBlink extends Error {
  codigo: CodigoError;

  constructor(codigo: CodigoError, mensaje: string) {
    super(mensaje);
    this.name = "ErrorBlink";
    this.codigo = codigo;
  }
}

interface ErrorRpc {
  code?: string;
  message?: string;
}

interface ErrorDeDominio {
  error: string;
  mensaje?: string;
}

function esErrorDeDominio(valor: unknown): valor is ErrorDeDominio {
  return (
    typeof valor === "object" &&
    valor !== null &&
    "error" in valor &&
    typeof (valor as ErrorDeDominio).error === "string"
  );
}

async function rpc<T>(funcion: string, argumentos: Record<string, unknown>): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}/rest/v1/rpc/${funcion}`, {
      method: "POST",
      headers: {
        apikey: LLAVE,
        Authorization: `Bearer ${LLAVE}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(argumentos),
    });
  } catch {
    throw new ErrorBlink("red", "Sin conexión con BLINK. Revisa la red e inténtalo otra vez.");
  }

  if (!respuesta.ok) {
    const detalle = (await respuesta.json().catch(() => ({}))) as ErrorRpc;
    const mensaje = detalle.message ?? "";
    const codigo = CODIGOS.find((c) => mensaje.includes(`bt:${c}`));
    if (codigo) {
      throw new ErrorBlink(codigo, mensaje.replace(`bt:${codigo}:`, "").trim());
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorBlink("permiso", "Esta operación no está permitida para tu sesión.");
    }
    throw new ErrorBlink("red", "BLINK no está disponible en este momento. Intenta más tarde.");
  }

  const datos = (await respuesta.json()) as unknown;

  // El login devuelve los fallos como dato para que la función pueda
  // confirmar la escritura del contador de intentos.
  if (esErrorDeDominio(datos)) {
    const codigo = CODIGOS.find((c) => c === datos.error);
    throw new ErrorBlink(
      codigo ?? "red",
      datos.mensaje ?? "BLINK no está disponible en este momento."
    );
  }

  return datos as T;
}

export const api = {
  entrar(cedula: string, pin: string, codigo = "") {
    return rpc<Entrada>("bt_admin_entrar", {
      p_cedula: cedula,
      p_pin: pin,
      p_codigo: codigo,
    });
  },

  estado(token: string) {
    return rpc<EstadoAdmin>("bt_admin_estado", { p_token: token });
  },

  mfaInscribir(token: string) {
    return rpc<{ secreto: string; uri: string }>("bt_admin_mfa_inscribir", { p_token: token });
  },

  mfaActivar(token: string, codigo: string) {
    return rpc<{ ok: boolean }>("bt_admin_mfa_activar", { p_token: token, p_codigo: codigo });
  },

  resumen(token: string) {
    return rpc<ResumenOperativo>("bt_admin_resumen", { p_token: token });
  },

  lote(
    token: string,
    opciones: {
      cantidad: number;
      patrocinante?: string;
      estado?: number;
      tarifa?: number;
      origen?: "FABRICANTE" | "ESTACION";
    }
  ) {
    return rpc<LoteCreado>("bt_admin_lote", {
      p_token: token,
      p_cantidad: opciones.cantidad,
      p_patrocinante: opciones.patrocinante || null,
      p_estado: opciones.estado ?? 23,
      p_tarifa: opciones.tarifa ?? 1,
      p_origen: opciones.origen ?? "FABRICANTE",
    });
  },

  catalogo(token: string, lote: string) {
    return rpc<Catalogo>("bt_admin_catalogo", { p_token: token, p_lote: lote });
  },

  enrolar(token: string, lote: string | null, items: { serial: string; uid: string }[]) {
    return rpc<ResultadoEnrolado>("bt_admin_enrolar", {
      p_token: token,
      p_lote: lote,
      p_items: items,
    });
  },

  merma(token: string, serial: string, tipo: "RFPGC" | "CHIP_ERR", motivo = "") {
    return rpc<ResultadoMerma>("bt_admin_merma", {
      p_token: token,
      p_serial: serial,
      p_tipo: tipo,
      p_motivo: motivo,
    });
  },

  lotes(token: string, limite = 20) {
    return rpc<LoteResumen[]>("bt_admin_lotes", { p_token: token, p_limite: limite });
  },

  siguiente(token: string, lote: string | null) {
    return rpc<SiguienteSerial>("bt_admin_siguiente", { p_token: token, p_lote: lote });
  },

  tarjetas(
    token: string,
    filtros: { lote?: string | null; buscar?: string; estado?: string | null; limite?: number }
  ) {
    return rpc<Inventario>("bt_admin_tarjetas", {
      p_token: token,
      p_lote: filtros.lote ?? null,
      p_buscar: filtros.buscar ?? "",
      p_estado: filtros.estado ?? null,
      p_limite: filtros.limite ?? 200,
    });
  },

  recargas(token: string, limite = 100) {
    return rpc<BandejaRecargas>("bt_admin_recargas", {
      p_token: token,
      p_limite: limite,
    });
  },

  resolverRecarga(
    token: string,
    recarga: string,
    aprobar: boolean,
    motivo = ""
  ) {
    return rpc<ResolucionRecarga>("bt_admin_resolver_recarga", {
      p_token: token,
      p_recarga: recarga,
      p_aprobar: aprobar,
      p_motivo: aprobar ? null : motivo.trim() || null,
    });
  },
};

export interface LoteResumen {
  id: string;
  numero: number;
  patrocinante: string | null;
  cantidad: number;
  origen: string;
  creado: string;
  enroladas: number;
  asignadas: number;
  fabricadas: number;
  desechadas: number;
  sinEnrolar: number;
}

export interface SiguienteSerial {
  fin: boolean;
  serial?: string;
  tarifa?: number;
  lote?: string | null;
}

export interface TarjetaInventario {
  serial: string;
  uid: string;
  estado: string;
  enrolada: string | null;
  asignada: string | null;
  titular: string | null;
  cedula: string | null;
  lote: string | null;
  saldo: number;
}

export interface Inventario {
  total: number;
  tarjetas: TarjetaInventario[];
}

export interface RecargaPendiente {
  recarga: string;
  movimiento: string | null;
  serial: string;
  titular: string;
  cedula: string;
  /** Monto bruto transferido por Pago Móvil. */
  monto: number;
  /** Bs que se acreditan a la tarjeta (N × tarifa). */
  montoBase: number;
  /** NULL en recargas anteriores a la migración 0019. */
  pasajes: number | null;
  tarifaBase: number | null;
  telefono: string;
  banco: string;
  referencia: string;
  estado: string;
  reportada: string;
  saldo: number;
}

export interface BandejaRecargas {
  total: number;
  monto: number;
  /** Total de Bs que se acreditarán al aprobar la bandeja. */
  base: number;
  pasajes: number;
  recargas: RecargaPendiente[];
  operador: string;
}

export interface ResolucionRecarga {
  ok: boolean;
  recarga: string;
  aprobada: boolean;
  operador: string;
  saldo?: number;
  acreditado?: number;
  pasajes?: number | null;
}

export interface ResumenOperativo {
  tarjetas: {
    total: number;
    fabricadas: number;
    activas: number;
    bloqueadas: number;
    perdidas: number;
    desechadas: number;
    asignadas: number;
    sinEnrolar: number;
    saldoTotal: number;
  };
  mermas: { total: number; fabricante: number; grabado: number };
  recargas: { pendientes: number; montoPendiente: number; porSincronizar: number };
  hoy: { pasajes: number; recaudado: number; porLiquidar: number };
  flota: { unidades: number; rutas: number };
}

