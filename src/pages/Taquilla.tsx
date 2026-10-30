import { useState } from "react";
import { api, ErrorBlink } from "../lib/api";
import { Aviso } from "../components/Aviso";
import { Campo } from "../components/Campo";
import { soloDigitos } from "../lib/formato";

interface Props {
  token: string;
  alVencer: () => void;
}

interface Billetera {
  cuenta?: { nombres?: string; apellidos?: string; cedula?: string };
  tarjetas?: unknown[];
}

export function Taquilla({ token, alVencer }: Props) {
  const [serial, setSerial] = useState("");
  const [prefijo, setPrefijo] = useState<"V" | "E">("V");
  const [cedula, setCedula] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [enviando, setEnviando] = useState(false);

  const asignar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setExito("");

    const serialLimpio = serial.trim().toUpperCase();
    if (!/^\d{2}-\d-\d{6,7}-\d$/.test(serialLimpio)) {
      setError("El serial tiene el formato 23-1-0000123-4.");
      return;
    }
    if (cedula.length < 6) {
      setError("Escribe la cédula del titular, sin puntos.");
      return;
    }

    setEnviando(true);
    try {
      const datos = (await api.asignar(
        token,
        serialLimpio,
        `${prefijo}-${cedula}`
      )) as Billetera;
      const titular = datos.cuenta
        ? `${datos.cuenta.nombres ?? ""} ${datos.cuenta.apellidos ?? ""}`.trim()
        : "la cuenta";
      setExito(`Tarjeta ${serialLimpio} asignada a ${titular}.`);
      setSerial("");
      setCedula("");
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "sesion") return alVencer();
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <header className="cabecera">
        <div>
          <h1>Taquilla</h1>
          <p>
            Fase 2 del aprovisionamiento: la tarjeta ya enrolada pasa a la billetera de una cuenta
            verificada.
          </p>
        </div>
      </header>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {exito ? <Aviso tipo="ok">{exito}</Aviso> : null}

      <section className="seccion">
        <h2>Asignar tarjeta</h2>
        <p className="seccion__nota">
          La tarjeta debe estar enrolada y sin dueño. Al asignarla queda activa y aparece en el
          portal del pasajero.
        </p>
        <form onSubmit={asignar}>
          <div className="fila-campos">
            <Campo
              id="serial-taquilla"
              etiqueta="Serial"
              valor={serial}
              onChange={(v) => setSerial(v.toUpperCase())}
              placeholder="23-1-0000123-4"
            />
            <Campo
              id="cedula-taquilla"
              etiqueta="Cédula del titular"
              valor={cedula}
              onChange={(v) => setCedula(soloDigitos(v).slice(0, 8))}
              inputMode="numeric"
              placeholder="12345678"
              prefijo={
                <select
                  aria-label="Tipo de cédula"
                  value={prefijo}
                  onChange={(e) => setPrefijo(e.target.value as "V" | "E")}
                  style={{
                    border: 0,
                    background: "transparent",
                    fontWeight: 700,
                    padding: "4px 0",
                  }}
                >
                  <option value="V">V</option>
                  <option value="E">E</option>
                </select>
              }
            />
          </div>
          <div className="acciones">
            <button className="boton boton--primario" type="submit" disabled={enviando}>
              {enviando ? "Asignando…" : "Asignar"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
