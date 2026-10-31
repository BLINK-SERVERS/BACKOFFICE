import { useCallback, useEffect, useState } from "react";
import { api, ErrorBlink, type LoteCreado, type LoteResumen } from "../lib/api";
import { Aviso } from "../components/Aviso";
import { Campo, Selector } from "../components/Campo";
import { descargarCsv, entero, fecha } from "../lib/formato";

interface Props {
  token: string;
  alVencer: () => void;
  alAbrirInventario: (lote: string) => void;
}

const ESTADOS = [
  { valor: "23", texto: "23 · Zulia" },
  { valor: "1", texto: "1 · Distrito Capital" },
  { valor: "2", texto: "2 · Anzoátegui" },
  { valor: "4", texto: "4 · Aragua" },
  { valor: "5", texto: "5 · Barinas" },
  { valor: "6", texto: "6 · Bolívar" },
  { valor: "7", texto: "7 · Carabobo" },
  { valor: "8", texto: "8 · Cojedes" },
  { valor: "9", texto: "9 · Falcón" },
  { valor: "10", texto: "10 · Guárico" },
  { valor: "11", texto: "11 · Lara" },
  { valor: "12", texto: "12 · Mérida" },
  { valor: "13", texto: "13 · Miranda" },
  { valor: "14", texto: "14 · Monagas" },
  { valor: "15", texto: "15 · Nueva Esparta" },
  { valor: "16", texto: "16 · Portuguesa" },
  { valor: "17", texto: "17 · Sucre" },
  { valor: "18", texto: "18 · Táchira" },
  { valor: "19", texto: "19 · Trujillo" },
  { valor: "20", texto: "20 · Yaracuy" },
  { valor: "21", texto: "21 · Amazonas" },
  { valor: "22", texto: "22 · Apure" },
  { valor: "24", texto: "24 · Vargas" },
  { valor: "25", texto: "25 · Delta Amacuro" },
];

const numeroLote = (numero: string | number) => String(numero).padStart(5, "0");

export function Lotes({ token, alVencer, alAbrirInventario }: Props) {  const [cantidad, setCantidad] = useState("100");
  const [patrocinante, setPatrocinante] = useState("");
  const [estado, setEstado] = useState("23");
  const [tarifa, setTarifa] = useState("1");
  const [origen, setOrigen] = useState<"FABRICANTE" | "ESTACION">("FABRICANTE");

  const [creado, setCreado] = useState<LoteCreado | null>(null);
  const [error, setError] = useState("");
  const [generando, setGenerando] = useState(false);

  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);

  const cargarLotes = useCallback(async () => {
    setCargandoLista(true);
    try {
      setLotes(await api.lotes(token, 40));
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "sesion") return alVencer();
      setError(err.message);
    } finally {
      setCargandoLista(false);
    }
  }, [token, alVencer]);

  useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  const generar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreado(null);

    const n = Number(cantidad);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      setError("La cantidad debe estar entre 1 y 999 tarjetas (una unidad por número de 3 dígitos).");
      return;
    }

    setGenerando(true);
    try {
      const datos = await api.lote(token, {
        cantidad: n,
        patrocinante: patrocinante.trim(),
        estado: Number(estado),
        tarifa: Number(tarifa),
        origen,
      });
      setCreado(datos);
      await cargarLotes();
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "sesion") return alVencer();
      setError(err.message);
    } finally {
      setGenerando(false);
    }
  };

  const exportar = () => {
    if (!creado) return;
    descargarCsv(`lote-${numeroLote(creado.lote.numero)}`, [
      ["serial", "codigo_barras", "estado", "lote", "patrocinante"],
      ...creado.tarjetas.map((t) => [
        t.serial,
        t.barcode,
        t.estado,
        creado.lote.numero,
        creado.lote.patrocinante ?? "",
      ]),
    ]);
  };

  return (
    <>
      <header className="cabecera">
        <div>
          <h1>Emisión de lotes</h1>
          <p>
            Fase 1 del aprovisionamiento: las tarjetas se crean en estado
            <strong> FABRICADA</strong>, sin dueño, listas para la estación o para el reclamo.
          </p>
        </div>
      </header>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <section className="seccion">
        <h2>Nuevo lote</h2>
        <p className="seccion__nota">
          Los seriales siguen la serie <span className="mono">T-LLLLL-UUU-V</span>: tarifa, lote de
          5 dígitos, unidad de 3 dígitos y letra verificadora (Luhn mod 23).
        </p>
        <form onSubmit={generar}>
          <div className="fila-campos">
            <Campo
              id="cantidad"
              etiqueta="Cantidad"
              valor={cantidad}
              onChange={setCantidad}
              tipo="number"
              min={1}
              max={999}
            />
            <Campo
              id="patrocinante"
              etiqueta="Patrocinante (opcional)"
              valor={patrocinante}
              onChange={setPatrocinante}
              placeholder="Comercial, C.A."
            />
            <Selector id="estado" etiqueta="Entidad federal" valor={estado} onChange={setEstado} opciones={ESTADOS} />
            <Selector
              id="tarifa"
              etiqueta="Tarifa"
              valor={tarifa}
              onChange={setTarifa}
              opciones={[
                { valor: "1", texto: "1 · General" },
                { valor: "2", texto: "2 · Estudiante / tercera edad" },
              ]}
            />
            <Selector
              id="origen"
              etiqueta="Origen"
              valor={origen}
              onChange={(v) => setOrigen(v as "FABRICANTE" | "ESTACION")}
              opciones={[
                { valor: "FABRICANTE", texto: "Fabricante (pre-mapeado)" },
                { valor: "ESTACION", texto: "Estación (enrolado local)" },
              ]}
            />
          </div>
          <div className="acciones" style={{ marginTop: 8 }}>
            <button className="boton boton--primario" type="submit" disabled={generando}>
              {generando ? "Generando…" : "Generar lote"}
            </button>
          </div>
        </form>

        {creado ? (
          <div style={{ marginTop: 20 }}>
            <Aviso tipo="ok">
              Lote <strong>{numeroLote(creado.lote.numero)}</strong> creado con{" "}
              {entero(creado.lote.cantidad)} tarjetas, de{" "}
              <span className="mono">{creado.lote.desde}</span> a{" "}
              <span className="mono">{creado.lote.hasta}</span>.
            </Aviso>
            <div className="acciones">
              <button className="boton boton--secundario" onClick={exportar}>
                Descargar CSV
              </button>
              <button
                className="boton boton--fantasma"
                onClick={() => alAbrirInventario(creado.lote.id)}
              >
                Ver tarjetas del lote
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="seccion">
        <h2>Lotes emitidos</h2>
        <p className="seccion__nota">Avance de enrolado y asignación de cada lote.</p>

        {cargandoLista ? (
          <Aviso tipo="info">Cargando lotes…</Aviso>
        ) : lotes.length === 0 ? (
          <Aviso tipo="info">Todavía no hay lotes emitidos.</Aviso>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Patrocinante</th>
                  <th>Origen</th>
                  <th>Cantidad</th>
                  <th>Enroladas</th>
                  <th>Asignadas</th>
                  <th>Creado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{numeroLote(l.numero)}</td>
                    <td>{l.patrocinante ?? "—"}</td>
                    <td>
                      <span className="pastilla pastilla--neutro">{l.origen}</span>
                    </td>
                    <td className="mono">{entero(l.cantidad)}</td>
                    <td className="mono">{entero(l.enroladas)}</td>
                    <td className="mono">{entero(l.asignadas)}</td>
                    <td>{fecha(l.creado)}</td>
                    <td>
                      <button
                        className="boton boton--fantasma"
                        onClick={() => alAbrirInventario(l.id)}
                      >
                        Abrir
                      </button>
                    </td>
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
