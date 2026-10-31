import { useState } from "react";
import { api, ErrorBlink } from "../lib/api";
import { guardarSesion, type SesionGuardada } from "../lib/sesion";
import { Aviso } from "../components/Aviso";
import { Campo } from "../components/Campo";
import { Marca } from "../components/Marca";
import { soloDigitos } from "../lib/formato";

export function Acceso({ onEntrar }: { onEntrar: (sesion: SesionGuardada) => void }) {
  const [prefijo, setPrefijo] = useState<"V" | "E">("V");
  const [cedula, setCedula] = useState("");
  const [pin, setPin] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pideCodigo, setPideCodigo] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (cedula.length < 6) {
      setError("Escribe la cédula completa, sin puntos.");
      return;
    }
    if (pin.length !== 6) {
      setError("El PIN tiene 6 dígitos.");
      return;
    }
    if (pideCodigo && codigo.length !== 6) {
      setError("Escribe el código de 6 dígitos de tu autenticador.");
      return;
    }

    setCargando(true);
    try {
      const datos = await api.entrar(`${prefijo}-${cedula}`, pin, pideCodigo ? codigo : "");
      const sesion: SesionGuardada = {
        token: datos.token,
        rol: datos.rol,
        mfa: datos.mfa,
        cuenta: datos.cuenta,
      };
      guardarSesion(sesion);
      onEntrar(sesion);
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "mfa") {
        setPideCodigo(true);
        setError(codigo ? err.message : "Esta cuenta usa verificación en dos pasos. Escribe el código.");
      } else {
        setError(err.message);
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="acceso">
      <form className="acceso__caja" onSubmit={entrar}>
        <Marca subtitulo="Back-office" />
        <h1 className="titulo-pantalla">Entrar al panel</h1>
        <p className="texto-ayuda">
          Solo cuentas con rol <strong>Administrador</strong>.
        </p>

        {error ? <Aviso tipo="error">{error}</Aviso> : null}

        <Campo
          id="cedula"
          etiqueta="Cédula"
          valor={cedula}
          onChange={(v) => setCedula(soloDigitos(v).slice(0, 8))}
          inputMode="numeric"
          placeholder="12345678"
          autoFocus
          prefijo={
            <select
              aria-label="Tipo de cédula"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value as "V" | "E")}
              style={{ border: 0, background: "transparent", fontWeight: 700, padding: "4px 0" }}
            >
              <option value="V">V</option>
              <option value="E">E</option>
            </select>
          }
        />

        <div className="campo__control campo__control--pin" style={{ marginBottom: 16 }}>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="PIN de 6 dígitos"
            aria-label="PIN de 6 dígitos"
            value={pin}
            maxLength={6}
            onChange={(e) => setPin(soloDigitos(e.target.value).slice(0, 6))}
          />
        </div>

        {pideCodigo ? (
          <Campo
            id="codigo"
            etiqueta="Código del autenticador"
            valor={codigo}
            onChange={(v) => setCodigo(soloDigitos(v).slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            pista="Se renueva cada 30 segundos."
          />
        ) : null}

        <button className="boton boton--primario boton--ancho" type="submit" disabled={cargando}>
          {cargando ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
