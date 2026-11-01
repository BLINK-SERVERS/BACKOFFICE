# Changelog

Todos los cambios notables de este repositorio se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
el versionado [SemVer](https://semver.org/lang/es/).

## [No publicado]

### Documentación

- La consola ya no incluye taquilla: el alta de una tarjeta a nombre de un
  pasajero se hace reclamando el serial desde el portal.
- README alineado con el alcance vigente (TARJETA + back-office), las
  migraciones `0001`–`0018` y la simulación local (`../simulacion`).
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
