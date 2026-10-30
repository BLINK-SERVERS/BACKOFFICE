import { useEffect, useRef, useState } from "react";
import { api, ErrorBlink } from "../lib/api";
import type { SesionGuardada } from "../lib/sesion";
import { Aviso } from "../components/Aviso";
import { Marca } from "../components/Marca";
import { soloDigitos } from "../lib/formato";

interface Props {
  sesion: SesionGuardada;
  onListo: () => void;
  onSalir: () => void;
}

export function Mfa({ sesion, onListo, onSalir }: Props) {
  const [secreto, setSecreto] = useState("");
  const [uri, setUri] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [activando, setActivando] = useState(false);
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let vigente = true;
    api
      .mfaInscribir(sesion.token)
      .then((datos) => {
        if (!vigente) return;
        setSecreto(datos.secreto);
        setUri(datos.uri);
      })
      .catch((fallo: ErrorBlink) => {
        if (vigente) setError(fallo.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [sesion.token]);

  useEffect(() => {
    if (!uri || !lienzo.current) return;
    const lienzoActual = lienzo.current;
    let vigente = true;

    // bwip-js pesa más de 700 KB (incluye todas las simbologías): se carga
    // solo cuando hay que dibujar el QR de inscripción.
    void import("bwip-js/browser")
      .then(({ default: bwipjs }) => {
        if (!vigente) return;
        bwipjs.toCanvas(lienzoActual, {
          bcid: "qrcode",
          text: uri,
          scale: 5,
          paddingwidth: 0,
          paddingheight: 0,
        });
      })
      .catch(() => {
        /* si no se puede dibujar, queda el secreto en texto */
      });

    return () => {
      vigente = false;
    };
  }, [uri]);

  const activar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (codigo.length !== 6) {
      setError("Escribe los 6 dígitos que muestra la aplicación.");
      return;
    }

    setActivando(true);
    try {
      await api.mfaActivar(sesion.token, codigo);
      onListo();
    } catch (fallo) {
      setError((fallo as ErrorBlink).message);
    } finally {
      setActivando(false);
    }
  };

  return (
    <main className="acceso">
      <form className="acceso__caja" onSubmit={activar}>
        <Marca subtitulo="Back-office" />
        <h1 className="titulo-pantalla">Verificación en dos pasos</h1>
        <p className="texto-ayuda">
          Escanea el código con Google Authenticator, Authy o 1Password y confirma el primer
          código. Sin este paso no se puede emitir ni asignar tarjetas.
        </p>

        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        {cargando ? <Aviso tipo="info">Generando tu secreto…</Aviso> : null}

        {secreto ? (
          <>
            <div className="qr">
              <canvas ref={lienzo} aria-label="Código QR para el autenticador" />
            </div>
            <p className="campo__pista">Si no puedes escanear, escribe este secreto a mano:</p>
            <div className="secreto">{secreto.match(/.{1,4}/g)?.join(" ")}</div>

            <div className="campo__control campo__control--pin" style={{ marginBottom: 16 }}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Código de 6 dígitos"
                aria-label="Código de verificación"
                value={codigo}
                maxLength={6}
                autoFocus
                onChange={(e) => setCodigo(soloDigitos(e.target.value).slice(0, 6))}
              />
            </div>
          </>
        ) : null}

        <button
          className="boton boton--primario boton--ancho"
          type="submit"
          disabled={activando || !secreto}
        >
          {activando ? "Comprobando…" : "Activar y continuar"}
        </button>
        <button className="boton boton--fantasma boton--ancho" type="button" onClick={onSalir}>
          Salir
        </button>
      </form>
    </main>
  );
}
