import type { CuentaAdmin, Rol } from "./tipos";

// La sesión del operador vive en `sessionStorage`: se borra al cerrar la
// pestaña y no se comparte entre pestañas. El token es un uuid que la
// base valida en cada llamada contra `account_sessions.expira`.

const CLAVE = "blink.backoffice.sesion";

export interface SesionGuardada {
  token: string;
  rol: Rol;
  mfa: boolean;
  cuenta: CuentaAdmin;
}

export function leerSesion(): SesionGuardada | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as SesionGuardada;
    return datos.token ? datos : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: SesionGuardada) {
  sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
}

export function borrarSesion() {
  sessionStorage.removeItem(CLAVE);
}
