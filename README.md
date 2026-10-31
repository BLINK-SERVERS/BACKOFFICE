# BLINK BACK-OFFICE

Consola corporativa de BLINK: emisión de lotes de tarjetas y estación de
asignación física (ESP32 + lector RFID). Es una
aplicación **separada** del portal del pasajero ([BLINK
TARJETA](https://github.com/BLINK-SERVERS/TARJETA)) y del punto de venta, pero
ambas hablan con la misma base central de Postgres por TLS.

Publicada en: <https://blink-servers.github.io/BACKOFFICE/>

## Qué hace

| Módulo | Función |
| --- | --- |
| **Resumen** | Inventario, recargas pendientes, recaudación del día y flota. |
| **Lotes** | Fase 1 del aprovisionamiento: genera N tarjetas en estado `FABRICADA` con serial Luhn. |
| **Inventario** | Busca cualquier tarjeta por serial, UID, nombre o cédula; exporta CSV. |
| **Estación** | Lee el UID con el ESP32, lo empareja con el serial del lote y lo sube a la base. |

## Modelo de seguridad

- **Sin `service_role` en el navegador.** El back-office solo llama funciones
  `bt_admin_*` (migración `0007`), que reciben el token de la sesión y lo
  validan en Postgres antes de delegar en las funciones de aprovisionamiento.
  Esas funciones crudas (`bt_generar_lote`, `bt_estacion_enrolar`,
  `bt_estacion_asignar`, `bt_resumen_operativo`) están cerradas para `anon`.
- **RBAC.** Solo las cuentas con rol `ADMIN` o `TAQUILLA` pueden iniciar sesión;
  un pasajero recibe `permiso` aunque su PIN sea correcto.
- **Segundo factor (TOTP RFC 6238).** Se verifica en el servidor
  (`extensions.hmac` + SHA-1, ventana de ±30 s). El secreto sale una sola vez,
  al inscribir el dispositivo, y nunca se guarda en el cliente. Sin el segundo
  factor activo, las operaciones de inventario se rechazan con `bt:mfa`.
- **Sesión.** Un `uuid` en `account_sessions` con caducidad de 12 h, guardado en
  `sessionStorage` (se borra al cerrar la pestaña).
- **PIN.** 6 dígitos, verificado con bcrypt en el servidor; 5 fallos bloquean la
  cuenta 5 minutos.
- **Transporte.** HTTPS/TLS en Pages y en Supabase; la conexión de la base es
  `sslmode=require`.

## Desarrollo

```bash
npm install
VITE_SUPABASE_URL=https://<proyecto>.supabase.co \
VITE_SUPABASE_ANON_KEY=<llave publicable> \
npm run dev          # http://localhost:5176
```

Sin esas dos variables la app compila pero muestra el aviso de configuración: el
back-office **no** tiene modo local ni datos de demostración. Para probarlo
contra la pila local, ejecuta `../simulacion/backoffice.sh` (portal y panel
comparten el backend simulado).

### Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (5176). |
| `npm run build` | Compila a `dist/`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run preview` | Sirve `dist/` en 4176. |
| `npm run deploy` | Compila con `--base=/BACKOFFICE/` y publica en la rama `gh-pages`. |

## Despliegue

El flujo oficial es `.github/workflows/pages.yml`: en cada push a `main` compila
con `--base=/BACKOFFICE/` y publica con GitHub Pages. Las credenciales se leen
de las **variables** del repositorio (Settings → Secrets and variables →
Actions → Variables):

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<proyecto>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | llave publicable del proyecto |

La llave publicable viaja al navegador por diseño; lo que protege el panel es el
RBAC, el PIN y el TOTP, no el secreto de la llave.

## Estación de asignación

- Requiere **Chrome o Edge de escritorio** servido por HTTPS (Web Serial no
  existe en móviles ni en Firefox/Safari).
- Habla el protocolo del firmware BLINK a 115200 baudios, una línea por mensaje:
  `READY,BLINK,1`, `CARD,<uid>`, `PONG`.
- Flujo: conectar lector → acercar tarjeta (el UID y el serial del lote se
  rellenan solos, en orden) → **Añadir** → repetir → **Enrolar**.
- La base rechaza seriales con Luhn inválido, UIDs repetidos, seriales de otro
  lote y tarjetas ya enroladas con otro UID; cada rechazo vuelve con su motivo.

## Relación con los otros repositorios

```
BLINK-TARJETA (pasajero)  ─┐
BLINK-BACKOFFICE (panel)  ─┼─→  Postgres central (Supabase, TLS)
BLINK POS (comercio)      ─┘
```

El esquema y las migraciones (`0001`–`0016`) viven en
[BLINK-SERVERS/TARJETA](https://github.com/BLINK-SERVERS/TARJETA/tree/main/supabase/migrations);
este repositorio solo consume las RPC. La documentación ISO del ecosistema
(BLINK-DOC-00 … 14) está en `TARJETA/docs/`. BLINK PASAJES está retirado: su
dominio redirige a TARJETA mediante `PASAJES-REDIRECT`.

## Estructura

```
src/
  lib/api.ts      Cliente REST de las RPC bt_admin_*
  lib/serial.ts   Protocolo del lector (Web Serial)
  lib/sesion.ts   Token en sessionStorage
  pages/          Acceso, MFA, Resumen, Lotes, Inventario, Estación
  styles/         Tokens de marca BLINK + consola de escritorio
```
