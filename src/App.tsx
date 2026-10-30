import { useCallback, useState } from "react";
import { Acceso } from "./pages/Acceso";
import { Mfa } from "./pages/Mfa";
import { Resumen } from "./pages/Resumen";
import { Lotes } from "./pages/Lotes";
import { Inventario } from "./pages/Inventario";
import { Estacion } from "./pages/Estacion";
import { Taquilla } from "./pages/Taquilla";
import { Marca } from "./components/Marca";
import { Aviso } from "./components/Aviso";
import { nubeConfigurada } from "./lib/api";
import { borrarSesion, leerSesion, guardarSesion, type SesionGuardada } from "./lib/sesion";

type Vista = "resumen" | "lotes" | "inventario" | "estacion" | "taquilla";

const MENU: { clave: Vista; texto: string; icono: string }[] = [
  { clave: "resumen", texto: "Resumen", icono: "▤" },
  { clave: "lotes", texto: "Lotes", icono: "▦" },
  { clave: "inventario", texto: "Inventario", icono: "☰" },
  { clave: "estacion", texto: "Estación", icono: "⌁" },
  { clave: "taquilla", texto: "Taquilla", icono: "◫" },
];

export default function App() {
  const [sesion, setSesion] = useState<SesionGuardada | null>(() => leerSesion());
  const [vista, setVista] = useState<Vista>("resumen");
  const [loteInventario, setLoteInventario] = useState<string | null>(null);

  const salir = useCallback(() => {
    borrarSesion();
    setSesion(null);
    setVista("resumen");
    setLoteInventario(null);
  }, []);

  const abrirInventario = useCallback((lote: string) => {
    setLoteInventario(lote);
    setVista("inventario");
  }, []);

  if (!nubeConfigurada) {
    return (
      <main className="acceso">
        <div className="acceso__caja">
          <Marca subtitulo="Back-office" />
          <h1 className="titulo-pantalla">Falta configurar el servidor</h1>
          <p className="texto-ayuda">
            Define <span className="mono">VITE_SUPABASE_URL</span> y{" "}
            <span className="mono">VITE_SUPABASE_ANON_KEY</span> al compilar (variables del
            repositorio en GitHub Actions) para que la consola hable con la base central.
          </p>
          <Aviso tipo="aviso">
            Sin esas variables la app no puede iniciar sesión: el back-office nunca trabaja con
            datos locales.
          </Aviso>
        </div>
      </main>
    );
  }

  if (!sesion) {
    return <Acceso onEntrar={setSesion} />;
  }

  if (!sesion.mfa) {
    return (
      <Mfa
        sesion={sesion}
        onSalir={salir}
        onListo={() => {
          const actualizada = { ...sesion, mfa: true };
          guardarSesion(actualizada);
          setSesion(actualizada);
        }}
      />
    );
  }

  return (
    <div className="consola">
      <aside className="barra">
        <Marca subtitulo="Back-office" />
        <nav className="menu" aria-label="Secciones">
          {MENU.map((item) => (
            <button
              key={item.clave}
              className={`menu__item${vista === item.clave ? " menu__item--activo" : ""}`}
              onClick={() => setVista(item.clave)}
              aria-current={vista === item.clave ? "page" : undefined}
            >
              <span className="menu__icono" aria-hidden="true">
                {item.icono}
              </span>
              {item.texto}
            </button>
          ))}
        </nav>

        <div className="barra__pie">
          <div className="operador">
            <strong>
              {sesion.cuenta.nombres} {sesion.cuenta.apellidos}
            </strong>
            <span>{sesion.cuenta.cedula}</span>
            <div style={{ marginTop: 6 }}>
              <span className="pastilla">{sesion.rol}</span>
            </div>
          </div>
          <button className="boton boton--secundario" onClick={salir}>
            Salir
          </button>
          <span>v{__APP_VERSION__}</span>
        </div>
      </aside>

      <main className="trabajo">
        {vista === "resumen" ? <Resumen token={sesion.token} alVencer={salir} /> : null}
        {vista === "lotes" ? (
          <Lotes token={sesion.token} alVencer={salir} alAbrirInventario={abrirInventario} />
        ) : null}
        {vista === "inventario" ? (
          <Inventario token={sesion.token} alVencer={salir} loteInicial={loteInventario} />
        ) : null}
        {vista === "estacion" ? <Estacion token={sesion.token} alVencer={salir} /> : null}
        {vista === "taquilla" ? <Taquilla token={sesion.token} alVencer={salir} /> : null}
      </main>
    </div>
  );
}
