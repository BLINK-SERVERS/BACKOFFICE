# Changelog

Todos los cambios notables de este repositorio se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
el versionado [SemVer](https://semver.org/lang/es/).

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
