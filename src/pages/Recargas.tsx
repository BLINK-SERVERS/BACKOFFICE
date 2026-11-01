import { useCallback, useEffect, useState } from "react";
import {
  api,
  ErrorBlink,
  type BandejaRecargas,
  type RecargaPendiente,
} from "../lib/api";
import { Aviso } from "../components/Aviso";
import { Campo } from "../components/Campo";
import { bs, entero, fecha } from "../lib/formato";

interface Props {
  token: string;
  alVencer: () => void;
}

interface Confirmacion {
  recarga: RecargaPendiente;
  aprobar: boolean;
}

export function Recargas({ token, alVencer }: Props) {
  const [datos, setDatos] = useState<BandejaRecargas | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [motivo, setMotivo] = useState("");

  const cargar = useCallback(
    async (conservarMensaje = false) => {
      setCargando(true);
      if (!conservarMensaje) setError("");
      try {
        setDatos(await api.recargas(token));
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
    void cargar();
  }, [cargar]);

  const pedir = (recarga: RecargaPendiente, aprobar: boolean) => {
    setError("");
    setAviso("");
    setMotivo("");
    setConfirmacion({ recarga, aprobar });
  };

  const resolver = async () => {
    if (!confirmacion) return;
    const { recarga, aprobar } = confirmacion;
    if (!aprobar && !motivo.trim()) {
      setError("Escribe el motivo del rechazo.");
      return;
    }

    setResolviendo(recarga.recarga);
    setError("");
    try {
      const resultado = await api.resolverRecarga(
        token,
        recarga.recarga,
        aprobar,
        motivo
      );
      const saldo = resultado.saldo ?? recarga.saldo + recarga.monto;
      setAviso(
        aprobar
          ? `Recarga de ${bs(recarga.monto)} aprobada. Saldo nuevo de la tarjeta: ${bs(saldo)}.`
          : `Recarga de ${bs(recarga.monto)} rechazada. El saldo no cambió.`
      );
      setConfirmacion(null);
      setMotivo("");
      await cargar();
    } catch (fallo) {
      const err = fallo as ErrorBlink;
      if (err.codigo === "sesion") return alVencer();
      setError(err.message);
      if (err.codigo === "datos") {
        // Otro operador resolvió la recarga: se cierra la confirmación y se
        // refresca la lista sin borrar el mensaje que devolvió el servidor.
        setConfirmacion(null);
        setMotivo("");
        await cargar(true);
      }
    } finally {
      setResolviendo(null);
    }
  };

  const total = datos?.total ?? 0;
  const listadas = datos?.recargas.length ?? 0;

  return (
    <>
      <header className="cabecera">
        <div>
          <h1>Recargas</h1>
          <p>Revisa el Pago Móvil y acredita el saldo de la tarjeta.</p>
        </div>
        <button
          className="boton boton--secundario"
          onClick={() => void cargar()}
          disabled={cargando || resolviendo !== null}
        >
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {aviso ? <Aviso tipo="ok">{aviso}</Aviso> : null}

      {confirmacion ? (
        <section className="seccion seccion--confirmacion" aria-live="polite">
          <h2>
            {confirmacion.aprobar ? "Aprobar recarga" : "Rechazar recarga"}
          </h2>
          <p className="seccion__nota">
            {bs(confirmacion.recarga.monto)} · {confirmacion.recarga.serial} ·{" "}
            {confirmacion.recarga.titular}
          </p>
          {confirmacion.aprobar ? (
            <Aviso tipo="aviso">
              Aprobar es irreversible: el saldo virtual sube ahora y el chip lo recibe en la
              próxima sincronización del validador. Verifica antes en el banco que coincidan
              monto, banco, teléfono y los últimos 4 dígitos de la referencia.
            </Aviso>
          ) : (
            <Campo
              id="motivo-rechazo"
              etiqueta="Motivo del rechazo"
              valor={motivo}
              onChange={setMotivo}
              placeholder="No coincide la referencia"
            />
          )}
          <div className="acciones">
            <button
              className={
                confirmacion.aprobar ? "boton boton--primario" : "boton boton--peligro"
              }
              onClick={() => void resolver()}
              disabled={resolviendo !== null}
            >
              {resolviendo
                ? "Resolviendo…"
                : confirmacion.aprobar
                  ? "Confirmar aprobación"
                  : "Confirmar rechazo"}
            </button>
            <button
              className="boton boton--secundario"
              onClick={() => setConfirmacion(null)}
              disabled={resolviendo !== null}
            >
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      <section className="seccion">
        <p className="seccion__nota">
          Comprueba en el estado de cuenta del banco el monto, el banco, el teléfono emisor y
          los últimos 4 dígitos de la referencia. El portal solo guarda esos 4 dígitos.
        </p>
        <div className="rejilla">
          <div className="metrica">
            <div className="metrica__etiqueta">Pendientes</div>
            <div className="metrica__valor">{entero(total)}</div>
          </div>
          <div className="metrica">
            <div className="metrica__etiqueta">Monto pendiente</div>
            <div className="metrica__valor">{bs(datos?.monto ?? 0)}</div>
          </div>
        </div>
      </section>

      <section className="seccion">
        {!datos ? (
          <Aviso tipo="info">Cargando recargas…</Aviso>
        ) : listadas === 0 ? (
          <Aviso tipo="info">
            No hay recargas pendientes. Cuando un pasajero reporte un Pago Móvil aparecerá
            aquí para revisarlo.
          </Aviso>
        ) : (
          <>
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Reportada</th>
                    <th>Tarjeta</th>
                    <th>Monto</th>
                    <th>Pago Móvil</th>
                    <th>Saldo actual</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.recargas.map((r) => (
                    <tr key={r.recarga}>
                      <td>{fecha(r.reportada)}</td>
                      <td>
                        <span className="mono">{r.serial}</span>
                        <div className="recarga__titular">
                          {r.titular}
                          {r.cedula ? <span className="campo__pista"> · {r.cedula}</span> : null}
                        </div>
                      </td>
                      <td className="mono recarga__monto">{bs(r.monto)}</td>
                      <td>
                        <div>{r.banco}</div>
                        <div className="campo__pista">
                          Ref. ···{r.referencia}
                          {r.telefono ? <span className="mono"> · {r.telefono}</span> : null}
                        </div>
                      </td>
                      <td className="mono">{bs(r.saldo)}</td>
                      <td>
                        <div className="recarga__acciones">
                          <button
                            className="boton boton--fantasma"
                            onClick={() => pedir(r, true)}
                            disabled={resolviendo !== null}
                          >
                            Aprobar
                          </button>
                          <button
                            className="boton boton--fantasma recarga__rechazar"
                            onClick={() => pedir(r, false)}
                            disabled={resolviendo !== null}
                          >
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > listadas ? (
              <p className="seccion__nota recarga__pie">
                Se muestran las {entero(listadas)} recargas más antiguas de {entero(total)}.
                Resuelve estas para ver las siguientes.
              </p>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
