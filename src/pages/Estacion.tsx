import { useEffect, useRef, useState } from "react";
import { api, ErrorBlink, type LoteResumen, type ResultadoEnrolado } from "../lib/api";
import { Aviso } from "../components/Aviso";
import { Campo, Selector } from "../components/Campo";
import { LectorSerial, serialWebDisponible, type MensajeLector } from "../lib/serial";
import { entero } from "../lib/formato";

interface Props {
  token: string;
  alVencer: () => void;
}

interface Captura {
  serial: string;
  uid: string;
}

export function Estacion({ token, alVencer }: Props) {
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [lote, setLote] = useState("");
  const [serial, setSerial] = useState("");
  const [uidManual, setUidManual] = useState("");
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const [uidVivo, setUidVivo] = useState("");
  const [conectado, setConectado] = useState(false);
  const [mensajeLector, setMensajeLector] = useState("Sin lector conectado.");
  const [resultado, setResultado] = useState<ResultadoEnrolado | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const lector = useRef<LectorSerial | null>(null);

  const alVencerRef = useRef(alVencer);
  alVencerRef.current = alVencer;

  useEffect(() => {
    api
      .lotes(token, 60)
      .then((datos) => {
        setLotes(datos);
        const conPendientes = datos.find((l) => l.fabricadas > 0);
        setLote((actual) => actual || conPendientes?.id || datos[0]?.id || "");
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

  const alRecibir = (mensaje: MensajeLector) => {
    if (mensaje.tipo === "tarjeta") {
      setUidVivo(mensaje.uid);
      setUidManual(mensaje.uid);
      setMensajeLector(`Tarjeta detectada: ${mensaje.uid}`);
    } else if (mensaje.tipo === "listo") {
      setMensajeLector(`Lector listo · firmware ${mensaje.version || "BLINK"}`);
    } else if (mensaje.tipo === "pong") {
      setMensajeLector("Lector responde (PONG).");
    }
  };

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
      await nuevo.conectar(alRecibir);
      lector.current = nuevo;
      setConectado(true);
      setMensajeLector("Lector conectado. Acerca una tarjeta.");
    } catch {
      setError("No se pudo abrir el puerto del lector.");
    }
  };

  const desconectar = async () => {
    await lector.current?.desconectar();
    lector.current = null;
    setConectado(false);
    setMensajeLector("Sin lector conectado.");
  };

  const agregar = () => {
    setError("");
    const serialLimpio = serial.trim().toUpperCase();
    const uidLimpio = (uidManual || uidVivo).trim().toUpperCase();

    if (!/^\d{2}-\d-\d{6,7}-\d$/.test(serialLimpio)) {
      setError("El serial impreso tiene el formato 23-1-0000123-4.");
      return;
    }
    if (!/^[0-9A-F]{8,20}$/.test(uidLimpio)) {
      setError("El UID debe tener entre 8 y 20 caracteres hexadecimales.");
      return;
    }
    if (capturas.some((c) => c.serial === serialLimpio)) {
      setError("Ese serial ya está en la lista.");
      return;
    }
    if (capturas.some((c) => c.uid === uidLimpio)) {
      setError("Ese UID ya está en la lista.");
      return;
    }

    setCapturas([...capturas, { serial: serialLimpio, uid: uidLimpio }]);
    setSerial("");
    setUidManual("");
    setUidVivo("");
    setResultado(null);
  };

  const quitar = (indice: number) => {
    setCapturas(capturas.filter((_, i) => i !== indice));
  };

  const enviar = async () => {
    setError("");
    setResultado(null);
    if (capturas.length === 0) {
      setError("Agrega al menos una tarjeta antes de enviar.");
      return;
    }

    setEnviando(true);
    try {
      const datos = await api.enrolar(token, lote || null, capturas);
      setResultado(datos);
      if (datos.enroladas > 0) setCapturas([]);
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "sesion") return alVencerRef.current();
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <header className="cabecera">
        <div>
          <h1>Estación de asignación</h1>
          <p>
            Vincula el UID que lee el ESP32 con el serial impreso en el plástico y súbelo al
            inventario.
          </p>
        </div>
      </header>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <section className="seccion">
        <h2>Lector</h2>
        <p className="seccion__nota">
          Protocolo del firmware BLINK: READY, CARD,&lt;uid&gt; y PONG a 115200 baudios.
        </p>
        <div className="lector">
          <span className={conectado ? "punto punto--vivo" : "punto"} aria-hidden="true" />
          <span style={{ flex: 1 }}>{mensajeLector}</span>
          {conectado ? (
            <>
              <button
                className="boton boton--fantasma"
                onClick={() => void lector.current?.ping()}
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
        <h2>Captura</h2>
        <div className="fila-campos">
          <Selector
            id="lote-estacion"
            etiqueta="Lote"
            valor={lote}
            onChange={setLote}
            opciones={[
              { valor: "", texto: "Cualquier lote" },
              ...lotes.map((l) => ({
                valor: l.id,
                texto: `${l.numero} · ${entero(l.fabricadas)} sin enrolar`,
              })),
            ]}
          />
          <Campo
            id="serial-estacion"
            etiqueta="Serial impreso"
            valor={serial}
            onChange={(v) => setSerial(v.toUpperCase())}
            placeholder="23-1-0000123-4"
            pista="Escanea el Code 128 o escríbelo a mano."
          />
          <Campo
            id="uid-estacion"
            etiqueta="UID de la tarjeta"
            valor={uidManual || uidVivo}
            onChange={setUidManual}
            placeholder="3981BF06"
            pista={uidVivo ? "Tomado del lector." : "Acerca la tarjeta o escríbelo."}
          />
        </div>
        <div className="acciones">
          <button className="boton boton--secundario" onClick={agregar}>
            Añadir a la lista
          </button>
        </div>

        {capturas.length > 0 ? (
          <div className="lista-captura">
            {capturas.map((c, i) => (
              <div className="captura" key={c.serial}>
                <span className="captura__n">{i + 1}</span>
                <span className="mono">{c.serial}</span>
                <span className="mono">{c.uid}</span>
                <button className="boton boton--fantasma" onClick={() => quitar(i)}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="acciones" style={{ marginTop: 18 }}>
          <button
            className="boton boton--primario"
            onClick={() => void enviar()}
            disabled={enviando || capturas.length === 0}
          >
            {enviando ? "Enrolando…" : `Enrolar ${capturas.length || ""}`.trim()}
          </button>
        </div>
      </section>

      {resultado ? (
        <section className="seccion">
          <h2>Resultado</h2>
          <Aviso tipo={resultado.enroladas > 0 ? "ok" : "aviso"}>
            {resultado.enroladas} enroladas · {resultado.rechazadas} rechazadas.
          </Aviso>
          {resultado.errores.length > 0 ? (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>UID</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.errores.map((e, i) => (
                    <tr key={`${e.serial}-${i}`}>
                      <td className="mono">{e.serial}</td>
                      <td className="mono">{e.uid}</td>
                      <td>{e.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
