import { useCallback, useEffect, useState } from "react";
import { api, ErrorBlink, type Inventario as Inv, type LoteResumen } from "../lib/api";
import { Aviso } from "../components/Aviso";
import { Campo, Selector } from "../components/Campo";
import { bs, descargarCsv, entero, fecha } from "../lib/formato";

interface Props {
  token: string;
  alVencer: () => void;
  loteInicial: string | null;
}

export function Inventario({ token, alVencer, loteInicial }: Props) {
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [lote, setLote] = useState<string>(loteInicial ?? "");
  const [buscar, setBuscar] = useState("");
  const [estado, setEstado] = useState("");
  const [datos, setDatos] = useState<Inv | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const consultar = useCallback(
    async (filtros: { lote: string; buscar: string; estado: string }) => {
      setCargando(true);
      setError("");
      try {
        const respuesta = await api.tarjetas(token, {
          lote: filtros.lote || null,
          buscar: filtros.buscar,
          estado: filtros.estado || null,
          limite: 300,
        });
        setDatos(respuesta);
      } catch (fallo) {
        const err = fallo as ErrorBlink;
        if (err.codigo === "sesion") return alVencer();
        setError(err.message);
      } finally {
        setCargando(false);
      }
    },
    [token, alVencer]
  );

  useEffect(() => {
    api
      .lotes(token, 100)
      .then(setLotes)
      .catch((fallo: ErrorBlink) => {
        if (fallo.codigo === "sesion") alVencer();
      });
  }, [token, alVencer]);

  useEffect(() => {
    void consultar({ lote, buscar, estado });
    // El texto se aplica con el botón Buscar; el lote y el estado, al cambiar.
  }, [lote, estado]);

  const numeroLote = (id: string | null) =>
    id ? (lotes.find((l) => l.id === id)?.numero ?? id.slice(0, 8)) : "—";

  const exportar = () => {
    if (!datos) return;
    descargarCsv("inventario-blink", [
      ["serial", "uid", "estado", "titular", "cedula", "saldo", "enrolada", "asignada"],
      ...datos.tarjetas.map((t) => [
        t.serial,
        t.uid,
        t.estado,
        t.titular ?? "",
        t.cedula ?? "",
        t.saldo,
        fecha(t.enrolada),
        fecha(t.asignada),
      ]),
    ]);
  };

  return (
    <>
      <header className="cabecera">
        <div>
          <h1>Inventario</h1>
          <p>Consulta el estado, el UID y el titular de cualquier tarjeta.</p>
        </div>
        <button className="boton boton--secundario" onClick={exportar} disabled={!datos}>
          Exportar CSV
        </button>
      </header>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <section className="seccion">
        <div className="fila-campos">
          <Selector
            id="lote"
            etiqueta="Lote"
            valor={lote}
            onChange={setLote}
            opciones={[
              { valor: "", texto: "Todos los lotes" },
              ...lotes.map((l) => ({
                valor: l.id,
                texto: `${l.numero} · ${entero(l.cantidad)} tarjetas`,
              })),
            ]}
          />
          <Campo
            id="buscar"
            etiqueta="Buscar"
            valor={buscar}
            onChange={setBuscar}
            placeholder="Serial, UID, nombre o cédula"
          />
          <Selector
            id="estado"
            etiqueta="Estado"
            valor={estado}
            onChange={setEstado}
            opciones={[
              { valor: "", texto: "Todos" },
              { valor: "FABRICADA", texto: "Fabricada" },
              { valor: "ACTIVE", texto: "Activa" },
              { valor: "BLOCKED", texto: "Bloqueada" },
              { valor: "LOST", texto: "Perdida" },
            ]}
          />
        </div>
        <div className="acciones">
          <button
            className="boton boton--primario"
            onClick={() => void consultar({ lote, buscar, estado })}
            disabled={cargando}
          >
            {cargando ? "Buscando…" : "Buscar"}
          </button>
          <span className="campo__pista">
            {datos ? `${entero(datos.total)} tarjetas coinciden (se listan hasta 300).` : ""}
          </span>
        </div>
      </section>

      <section className="seccion">
        {!datos ? (
          <Aviso tipo="info">Cargando inventario…</Aviso>
        ) : datos.tarjetas.length === 0 ? (
          <Aviso tipo="info">Ninguna tarjeta coincide con el filtro.</Aviso>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>UID</th>
                  <th>Estado</th>
                  <th>Titular</th>
                  <th>Lote</th>
                  <th>Saldo</th>
                  <th>Asignada</th>
                </tr>
              </thead>
              <tbody>
                {datos.tarjetas.map((t) => (
                  <tr key={t.serial}>
                    <td className="mono">{t.serial}</td>
                    <td className="mono">{t.uid || "sin enrolar"}</td>
                    <td>
                      <span
                        className={
                          t.estado === "ACTIVE"
                            ? "pastilla pastilla--verde"
                            : t.estado === "LOST" || t.estado === "BLOCKED"
                              ? "pastilla pastilla--rojo"
                              : "pastilla pastilla--neutro"
                        }
                      >
                        {t.estado}
                      </span>
                    </td>
                    <td>
                      {t.titular ?? "—"}
                      {t.cedula ? <span className="campo__pista"> · {t.cedula}</span> : null}
                    </td>
                    <td className="mono">{numeroLote(t.lote)}</td>
                    <td className="mono">{bs(t.saldo)}</td>
                    <td>{fecha(t.asignada)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
