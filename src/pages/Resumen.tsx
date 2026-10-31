import { useCallback, useEffect, useState } from "react";
import { api, ErrorBlink, type ResumenOperativo } from "../lib/api";
import { Aviso } from "../components/Aviso";
import { bs, entero } from "../lib/formato";

interface Props {
  token: string;
  alVencer: () => void;
}

export function Resumen({ token, alVencer }: Props) {
  const [datos, setDatos] = useState<ResumenOperativo | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setDatos(await api.resumen(token));
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "sesion") return alVencer();
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [token, alVencer]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <>
      <header className="cabecera">
        <div>
          <h1>Resumen operativo</h1>
          <p>Inventario, recargas y recaudación de la red.</p>
        </div>
        <button className="boton boton--secundario" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      {datos ? (
        <>
          <section className="seccion">
            <h2>Tarjetas</h2>
            <p className="seccion__nota">Inventario completo del sistema.</p>
            <div className="rejilla">
              <Metrica etiqueta="Total" valor={entero(datos.tarjetas.total)} />
              <Metrica etiqueta="Fabricadas / sin dueño" valor={entero(datos.tarjetas.fabricadas)} />
              <Metrica etiqueta="Activas" valor={entero(datos.tarjetas.activas)} />
              <Metrica etiqueta="Asignadas" valor={entero(datos.tarjetas.asignadas)} />
              <Metrica etiqueta="Sin enrolar" valor={entero(datos.tarjetas.sinEnrolar)} />
              <Metrica etiqueta="Mermas (SCRAP)" valor={entero(datos.tarjetas.desechadas)} />
              <Metrica etiqueta="Saldo en circulación" valor={bs(datos.tarjetas.saldoTotal)} />
            </div>
          </section>

          <section className="seccion">
            <h2>Mermas</h2>
            <p className="seccion__nota">
              Rechazos de fábrica y fallas de grabado registrados en la bitácora.
            </p>
            <div className="rejilla">
              <Metrica etiqueta="Total" valor={entero(datos.mermas.total)} />
              <Metrica etiqueta="Defecto físico (RFPGC)" valor={entero(datos.mermas.fabricante)} />
              <Metrica etiqueta="Error de grabado (CHIP_ERR)" valor={entero(datos.mermas.grabado)} />
            </div>
          </section>

          <section className="seccion">
            <h2>Recargas</h2>
            <p className="seccion__nota">Pago Móvil reportado por los pasajeros.</p>
            <div className="rejilla">
              <Metrica etiqueta="Pendientes" valor={entero(datos.recargas.pendientes)} />
              <Metrica etiqueta="Monto pendiente" valor={bs(datos.recargas.montoPendiente)} />
              <Metrica
                etiqueta="Aprobadas por enviar al chip"
                valor={entero(datos.recargas.porSincronizar)}
              />
            </div>
          </section>

          <section className="seccion">
            <h2>Hoy</h2>
            <p className="seccion__nota">Pasajes cobrados por los validadores.</p>
            <div className="rejilla">
              <Metrica etiqueta="Pasajes" valor={entero(datos.hoy.pasajes)} />
              <Metrica etiqueta="Recaudado" valor={bs(datos.hoy.recaudado)} />
              <Metrica etiqueta="Por liquidar" valor={bs(datos.hoy.porLiquidar)} />
              <Metrica etiqueta="Unidades activas" valor={entero(datos.flota.unidades)} />
              <Metrica etiqueta="Rutas activas" valor={entero(datos.flota.rutas)} />
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="metrica">
      <div className="metrica__etiqueta">{etiqueta}</div>
      <div className="metrica__valor">{valor}</div>
    </div>
  );
}
