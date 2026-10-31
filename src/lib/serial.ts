// Protocolo del lector BLINK (firmware BLINK_Validador v5). Una línea por
// mensaje, 115200 baudios:
//   READY,BLINK,5,<pendientes>,<log>
//   CARD,3981BF06
//   PONG
//   ENROLAR_LISTO,serial=23-1-0000001-9,uid=cualquiera
//   ENROLADA,serial=23-1-0000001-9,uid=3981BF06
//   ENROLAR_TIMEUP
//   ERROR,enrolado,<motivo>
//   TAP,ok=0,motivo=no-enrolada,uid=...,serial=
//
// La estación escribe ENROLAR,<serial>,0,<tarifa> y el equipo graba el chip
// cuando aparece la tarjeta; luego confirma con ENROLADA.

export type MensajeLector =
  | { tipo: "listo"; version: string }
  | { tipo: "tarjeta"; uid: string }
  | { tipo: "pong" }
  | { tipo: "armado"; serial: string }
  | { tipo: "enrolada"; serial: string; uid: string }
  | { tipo: "errorEnrolado"; motivo: string }
  | { tipo: "tiempoEnrolar" }
  | { tipo: "tap"; ok: boolean; motivo: string; uid: string; serial: string }
  | { tipo: "desconocido"; texto: string };

const UID_VALIDO = /^[0-9A-F]{4,20}$/;

function campos(texto: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const parte of texto.split(",")) {
    const corte = parte.indexOf("=");
    if (corte > 0) salida[parte.slice(0, corte)] = parte.slice(corte + 1);
  }
  return salida;
}

export function parsearLinea(linea: string): MensajeLector | null {
  const texto = linea.replace(/\r/g, "").trim();
  if (!texto) return null;

  if (texto === "PONG") return { tipo: "pong" };
  if (texto === "ENROLAR_TIMEUP") return { tipo: "tiempoEnrolar" };

  const [cabecera, ...resto] = texto.split(",");

  if (cabecera === "READY") return { tipo: "listo", version: resto.join(",") };

  if (cabecera === "CARD") {
    const uid = (resto[0] ?? "").trim().toUpperCase();
    if (UID_VALIDO.test(uid)) return { tipo: "tarjeta", uid };
    return { tipo: "desconocido", texto };
  }

  if (cabecera === "ENROLAR_LISTO") {
    const datos = campos(texto.slice(cabecera.length + 1));
    return { tipo: "armado", serial: datos.serial ?? "" };
  }

  if (cabecera === "ENROLADA") {
    const datos = campos(texto.slice(cabecera.length + 1));
    const uid = (datos.uid ?? "").toUpperCase();
    if (datos.serial && UID_VALIDO.test(uid)) {
      return { tipo: "enrolada", serial: datos.serial, uid };
    }
    return { tipo: "desconocido", texto };
  }

  if (cabecera === "ERROR" && resto[0] === "enrolado") {
    return { tipo: "errorEnrolado", motivo: resto[1] ?? "" };
  }

  if (cabecera === "TAP") {
    const datos = campos(texto.slice(cabecera.length + 1));
    return {
      tipo: "tap",
      ok: datos.ok === "1",
      motivo: datos.motivo ?? "",
      uid: (datos.uid ?? "").toUpperCase(),
      serial: datos.serial ?? "",
    };
  }

  return { tipo: "desconocido", texto };
}

export function serialWebDisponible() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export class LectorSerial {
  private puerto: SerialPort | null = null;
  private lector: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private escritor: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private tareaLectura: Promise<void> | null = null;
  private cancelado = false;

  get conectado() {
    return this.puerto !== null;
  }

  async conectar(alRecibir: (mensaje: MensajeLector) => void): Promise<void> {
    const puerto = await navigator.serial.requestPort();
    await puerto.open({ baudRate: 115200 });
    this.puerto = puerto;
    this.cancelado = false;

    if (puerto.writable) {
      this.escritor = puerto.writable.getWriter();
    }

    this.tareaLectura = this.leer(alRecibir);
  }

  private async leer(alRecibir: (mensaje: MensajeLector) => void) {
    const puerto = this.puerto;
    if (!puerto?.readable) return;

    const lector = puerto.readable.getReader();
    this.lector = lector;
    const decoder = new TextDecoder();
    let pendiente = "";

    try {
      while (!this.cancelado) {
        const { value, done } = await lector.read();
        if (done) break;
        pendiente += decoder.decode(value, { stream: true });

        let corte = pendiente.indexOf("\n");
        while (corte >= 0) {
          const linea = pendiente.slice(0, corte);
          pendiente = pendiente.slice(corte + 1);
          const mensaje = parsearLinea(linea);
          if (mensaje) alRecibir(mensaje);
          corte = pendiente.indexOf("\n");
        }
      }
    } catch {
      // La placa se desconectó o se cerró el puerto.
    } finally {
      lector.releaseLock();
      if (this.lector === lector) this.lector = null;
    }
  }

  async comando(linea: string): Promise<void> {
    await this.escritor?.write(new TextEncoder().encode(`${linea}\n`));
  }

  async ping(): Promise<void> {
    await this.comando("PING");
  }

  async desconectar(): Promise<void> {
    this.cancelado = true;
    try {
      await this.lector?.cancel();
    } catch {
      /* ya cerrado */
    }
    await this.tareaLectura;
    this.tareaLectura = null;

    try {
      this.escritor?.releaseLock();
    } catch {
      /* con una escritura pendiente */
    }
    this.escritor = null;

    const puerto = this.puerto;
    this.puerto = null;
    try {
      await puerto?.close();
    } catch {
      /* el dispositivo ya no estaba */
    }
  }
}
