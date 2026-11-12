# Changelog

Todos los cambios notables de este repositorio se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
el versionado [SemVer](https://semver.org/lang/es/).

## [No publicado]

### Corregido

- **Carrera al detener la estación de enrolado** (`src/pages/Estacion.tsx`).
  Si el operador pulsaba *Detener* o desconectaba el cable mientras la nube
  buscaba el siguiente serial, la respuesta rearmaba la escritura y el ESP32
  seguía grabando tarjetas con la interfaz diciendo «secuencia detenida». Ahora
  `activoRef` se marca en falso **antes** de mandar `ENROLAR_OFF` y se
  comprueba de nuevo al regresar la respuesta (B-69, BLINK-DOC-09).
- **El back-office no dejaba entrar** (`src/lib/api.ts`). El API gateway de
  Supabase pasó a exponer por defecto el esquema `api`, vacío en este proyecto,
  y toda RPC respondía 404 con `PGRST202`; el cliente lo traducía en el aviso
  genérico «BLINK no está disponible en este momento. Intenta más tarde.» Las
  llamadas ahora fijan `Accept-Profile` y `Content-Profile` a `public`, como ya
  hacía el validador. Verificado en navegador el 2026-11-11: el acceso con
  credenciales reales llega hasta *Verificación en dos pasos* y `bt_admin_resumen`
  responde con su error de dominio (`bt:mfa`) en lugar del aviso de red.

## [1.3.0] — 2026-11-01

### Añadido

- **Desglose de pasajes en la bandeja de recargas.** Cada fila muestra cuántos
  pasajes se compraron, su tarifa, el monto transferido y la línea «acredita»
  con el monto base. Las métricas pasan a **Pendientes**, **Monto por
  conciliar** (bruto), **A acreditar** (monto base) y **Pasajes**.
- La confirmación de aprobación resume «N pasajes · transfirió Bs … · acredita
  Bs …» y el aviso final informa el saldo nuevo.
- Compatible con recargas anteriores a `0019`: muestran «—» en pasajes y
  acreditan su importe original.

### Documentación

- La consola ya no incluye taquilla: el alta de una tarjeta a nombre de un
  pasajero se hace reclamando el serial desde el portal.
- README alineado con el alcance vigente (TARJETA + back-office), las
  migraciones `0001`–`0020` y la simulación local (`../simulacion`).
- BLINK PASAJES se retiró; su dominio redirige a TARJETA mediante
  `PASAJES-REDIRECT`.

## [1.2.0] — 2026-11-01

### Añadido

- **Bandeja de recargas.** Nueva sección **Recargas** con el total pendiente y
  el monto en revisión, la lista del más antiguo al más reciente (reporte,
  tarjeta, titular, monto, banco, referencia, teléfono y saldo actual) y las
  acciones **Aprobar** y **Rechazar**. Aprobar abre una confirmación que avisa
  que es irreversible; rechazar exige un motivo. El panel refresca la bandeja
  después de cada resolución.
- Consume `bt_admin_recargas` y `bt_admin_resolver_recarga` (migración `0018`),
  que validan sesión y TOTP, bloquean la fila y delegan en las funciones de
  recarga existentes. Un operador sin segundo factor recibe `bt:mfa`.

## [1.1.0] — 2026-10-30

### Cambiado

- La estación y la taquilla aceptan seriales de la serie nueva de siete dígitos
  (`23-1-0000123-4`) además de la heredada de seis (`23-1-000123-4`), en el
  mensaje de error y en el marcador del campo.

### Dependencias

- Requiere la migración `0009_serie_siete_digitos.sql` para generar y enrolar la
  serie nueva desde el panel.

## [1.0.0] — 2026-10-29

### Añadido

- Back-office separado del portal del pasajero, publicado en GitHub Pages con
  base `/BACKOFFICE/`.
- Acceso con cédula (V/E) + PIN de 6 dígitos contra `bt_admin_entrar`; solo
  roles `ADMIN` y `TAQUILLA`.
- Inscripción y activación del segundo factor TOTP (RFC 6238) con código QR
  generado en el navegador; el secreto se verifica en Postgres.
- Módulo de lotes: emisión en estado `FABRICADA`, resumen `desde`/`hasta` y
  exportación CSV.
- Inventario con filtros por lote, estado y texto (serial, UID, nombre o
  cédula) y exportación CSV.
- Estación de asignación por Web Serial: captura del UID del ESP32, emparejado
  con el serial impreso y carga en bloque con reporte de rechazos por tarjeta.
- Taquilla: asignación de una tarjeta enrolada a una cuenta por cédula.
- Resumen operativo (inventario, recargas, recaudación del día, flota).
- El cliente REST solo usa la llave publicable: el navegador nunca lleva
  `service_role`.

### Seguridad

- Toda operación de inventario exige sesión con segundo factor activo
  (`bt:mfa` en caso contrario).
- La sesión vive en `sessionStorage` y se invalida al caducar en el servidor
  (12 h).
- `noindex, nofollow` en el HTML del panel.

### Dependencias

- Requiere las migraciones `0007_backoffice_mfa.sql` y
  `0008_backoffice_lectura.sql` aplicadas en el proyecto de Supabase.
