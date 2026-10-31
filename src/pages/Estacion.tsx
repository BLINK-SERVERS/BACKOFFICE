import { useEffect, useRef, useState } from "react";
import { api, ErrorBlink, type LoteResumen, type SiguienteSerial } from "../lib/api";
import { Aviso } from "../components/Aviso";
import { Selector } from "../components/Campo";
import { LectorSerial, serialWebDisponible, type MensajeLector } from "../lib/serial";
import { entero } from "../lib/formato";

interface Props {
  token: string;
  alVencer: () => void;
}

interface Fila {
  serial: string;
  uid: string;
  ok: boolean;
  motivo?: string;
}

interface Siguiente {
  serial: string;
  tarifa: number;
}

// La estación no pide serial ni UID a mano: el lector entrega el UID, la
// nube entrega el siguiente serial del lote y el ESP32 graba el chip.
// Cada ENROLADA se registra sola y arma de inmediato la tarjeta siguiente.
export function Estacion({ token, alVencer }: Props) {
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [lote, setLote] = useState("");
  const [conectado, setConectado] = useState(false);
  const [mensajeLector, setMensajeLector] = useState("Sin lector conectado.");
  const [activo, setActivo] = useState(false);
  const [siguiente, setSiguiente] = useState<Siguiente | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState("");
  const [enroladas, setEnroladas] = useState(0);
  const [rechazadas, setRechazadas] = useState(0);

  const lector = useRef<LectorSerial | null>(null);
  const activoRef = useRef(false);
  const loteRef = useRef("");
  const serialRef = useRef<string | null>(null);
  const registrando = useRef(false);
  const manejarRef = useRef<(mensaje: MensajeLector) => void>(() => {});

  const alVencerRef = useRef(alVencer);
  alVencerRef.current = alVencer;

  const detener = (mensaje: string, conError = true) => {
    activoRef.current = false;
    serialRef.current = null;
    setActivo(false);
    setSiguiente(null);
    setMensajeLector(mensaje);
    if (conError) setError(mensaje);
  };

  const armarSiguiente = async (): Promise<void> => {
    if (!activoRef.current || !lector.current) return;
    try {
      const sig: SiguienteSerial = await api.siguiente(token, loteRef.current || null);
      if (sig.fin || !sig.serial) {
        detener("Lote completo: no quedan tarjetas sin enrolar.", false);
        return;
      }
      const item = { serial: sig.serial, tarifa: sig.tarifa ?? 1 };
      serialRef.current = item.serial;
      setSiguiente(item);
      await lector.current.comando(`ENROLAR,${item.serial},0,${item.tarifa}`);
      setMensajeLector(`Armado ${item.serial}. Acerca una tarjeta en blanco.`);
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "sesion") return alVencerRef.current();
      detener(err.message);
    }
  };

  const registrar = async (serial: string, uid: string): Promise<void> => {
    if (registrando.current) return;
    registrando.current = true;
    try {
      const datos = await api.enrolar(token, loteRef.current || null, [{ serial, uid }]);
      if (datos.errores.length > 0) {
        const motivo = datos.errores[0].motivo;
        setFilas((f) => [{ serial, uid, ok: false, motivo }, ...f].slice(0, 100));
        setRechazadas((n) => n + 1);
        detener(`Chip grabado, pero la nube rechazó ${serial}: ${motivo}`);
        return;
      }

      setFilas((f) => [{ serial, uid, ok: true }, ...f].slice(0, 100));
      setEnroladas((n) => n + 1);
      setMensajeLector(`Enrolada ${serial} · ${uid}`);
      serialRef.current = null;
      if (activoRef.current) await armarSiguiente();
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "sesion") return alVencerRef.current();
      setFilas((f) =>
        [{ serial, uid, ok: false, motivo: err.message }, ...f].slice(0, 100)
      );
      setRechazadas((n) => n + 1);
      detener(`Chip grabado, pero no se registró ${serial}: ${err.message}`);
    } finally {
      registrando.current = false;
    }
  };

  const registrarFallo = (motivo: string) => {
    const serial = serialRef.current ?? "";
    setFilas((f) => [{ serial, uid: "", ok: false, motivo }, ...f].slice(0, 100));
    setRechazadas((n) => n + 1);
    detener(`No se grabó ${serial || "la tarjeta"}: ${motivo || "error del lector"}.`);
  };

  manejarRef.current = (mensaje: MensajeLector) => {
    if (mensaje.tipo === "listo") {
      setMensajeLector(`Lector listo · firmware ${mensaje.version || "BLINK"}`);
    } else if (mensaje.tipo === "pong") {
      setMensajeLector("Lector responde (PONG).");
    } else if (mensaje.tipo === "armado") {
      setMensajeLector(`Armado ${mensaje.serial}. Acerca una tarjeta en blanco.`);
    } else if (mensaje.tipo === "enrolada") {
      void registrar(mensaje.serial, mensaje.uid);
    } else if (mensaje.tipo === "errorEnrolado") {
      registrarFallo(mensaje.motivo);
    } else if (mensaje.tipo === "tiempoEnrolar") {
      detener("La ventana de grabado venció (60 s). La secuencia quedó en pausa.");
    } else if (mensaje.tipo === "tarjeta") {
      setMensajeLector(`El lector vio ${mensaje.uid}, una tarjeta ya grabada.`);
    } else if (mensaje.tipo === "tap" && !mensaje.ok) {
      setMensajeLector(`Toque descartado (${mensaje.motivo}) · ${mensaje.uid}`);
    }
  };

  useEffect(() => {
    api
      .lotes(token, 60)
      .then((datos) => {
        setLotes(datos);
        const conPendientes = datos.find((l) => l.fabricadas > 0);
        const inicial = conPendientes?.id ?? datos[0]?.id ?? "";
        setLote((actual) => actual || inicial);
        loteRef.current = loteRef.current || inicial;
      })
      .catch((fallo: ErrorBlink) => {
        if (fallo.codigo === "sesion") alVencerRef.current();
        else setError(fallo.message);
      });
  }, [token]);

  useEffect(() => {
    return () => {
      void lector.current?.desconectar();
    };
  }, []);

  const conectar = async () => {
    setError("");
    if (!serialWebDisponible()) {
      setError(
        "Este navegador no expone Web Serial. Usa Chrome o Edge de escritorio y sirve la página por HTTPS."
      );
      return;
    }
    try {
      const nuevo = new LectorSerial();
      await nuevo.conectar((mensaje) => manejarRef.current(mensaje));
      lector.current = nuevo;
      setConectado(true);
      setMensajeLector("Lector conectado. Elige el lote y pulsa Iniciar.");
    } catch {
      setError("No se pudo abrir el puerto del lector.");
    }
  };

  const desconectar = async () => {
    if (activoRef.current) {
      await lector.current?.comando("ENROLAR_OFF");
      activoRef.current = false;
      setActivo(false);
      setSiguiente(null);
    }
    await lector.current?.desconectar();
    lector.current = null;
    setConectado(false);
    setMensajeLector("Sin lector conectado.");
  };

  const cambiarLote = (valor: string) => {
    setLote(valor);
    loteRef.current = valor;
  };

  const iniciar = async () => {
    setError("");
    if (!conectado || !lector.current) {
      setError("Conecta el lector antes de empezar.");
      return;
    }
    activoRef.current = true;
    setActivo(true);
    await armarSiguiente();
  };

  const detenerManual = async () => {
    await lector.current?.comando("ENROLAR_OFF");
    detener("Secuencia detenida. El equipo ya no graba tarjetas hasta que reanudes.", false);
  };

  return (
    <>
      <header className="cabecera">
        <div>
          <h1>Estación de enrolado</h1>
          <p>
            El lector toma el UID y la nube entrega el siguiente serial del lote. Tú solo acercas
            los plásticos en blanco.
          </p>
        </div>
      </header>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {lotes.length === 0 ? (
        <Aviso tipo="aviso">
          No hay lotes. Crea uno en <strong>Lotes</strong> para que la estación tenga seriales que
          repartir.
        </Aviso>
      ) : null}

      <section className="seccion">
        <h2>Lector</h2>
        <p className="seccion__nota">
          Protocolo del firmware BLINK: READY, CARD,&lt;uid&gt;, ENROLAR y ENROLADA a 115200
          baudios.
        </p>
        <div className="lector">
          <span className={conectado ? "punto punto--vivo" : "punto"} aria-hidden="true" />
          <span style={{ flex: 1 }}>{mensajeLector}</span>
          {conectado ? (
            <>
              <button
                className="boton boton--fantasma"
                onClick={() => void lector.current?.ping()}
                disabled={activo}
              >
                Probar (PING)
              </button>
              <button className="boton boton--secundario" onClick={() => void desconectar()}>
                Desconectar
              </button>
            </>
          ) : (
            <button className="boton boton--primario" onClick={() => void conectar()}>
              Conectar lector
            </button>
          )}
        </div>
      </section>

      <section className="seccion">
        <h2>Secuencia automática</h2>
        <div className="fila-campos">
          <Selector
            id="lote-estacion"
            etiqueta="Lote"
            valor={lote}
            onChange={cambiarLote}
            disabled={activo}
            opciones={[
              { valor: "", texto: "Cualquier lote" },
              ...lotes.map((l) => ({
                valor: l.id,
                texto: `${l.numero} · ${entero(l.fabricadas)} sin enrolar`,
              })),
            ]}
          />
        </div>

        <div className="acciones" style={{ marginTop: 14 }}>
          {activo ? (
            <button className="boton boton--secundario" onClick={() => void detenerManual()}>
              Detener
            </button>
          ) : (
            <button
              className="boton boton--primario"
              onClick={() => void iniciar()}
              disabled={!conectado}
            >
              Iniciar secuencia
            </button>
          )}
          <span className="texto-ayuda">
            {enroladas} enroladas · {rechazadas} rechazadas
          </span>
        </div>

        {siguiente ? (
          <div className="lector" style={{ marginTop: 14 }}>
            <span className="punto punto--vivo" aria-hidden="true" />
            <span style={{ flex: 1 }}>
              Siguiente: <span className="mono">{siguiente.serial}</span> · tarifa{" "}
              {siguiente.tarifa} · acerca la tarjeta
            </span>
          </div>
        ) : null}

        {filas.length > 0 ? (
          <div className="lista-captura">
            {filas.map((f, i) => (
              <div className="captura" key={`${f.serial}-${f.uid}-${i}`}>
                <span className="captura__n">{filas.length - i}</span>
                <span className="mono">{f.serial || "—"}</span>
                <span className="mono">{f.uid || "—"}</span>
                <span className={`pastilla ${f.ok ? "pastilla--verde" : "pastilla--rojo"}`}>
                  {f.ok ? "Enrolada" : f.motivo || "Rechazada"}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
