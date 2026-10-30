const MONEDA = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function bs(monto: number | null | undefined): string {
  const valor = Number(monto ?? 0);
  return `Bs. ${MONEDA.format(Number.isFinite(valor) ? valor : 0)}`;
}

export function entero(valor: number | null | undefined): string {
  return new Intl.NumberFormat("es-VE").format(Number(valor ?? 0));
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

export function descargarCsv(nombre: string, filas: (string | number | null)[][]) {
  const contenido = filas
    .map((fila) =>
      fila
        .map((celda) => {
          const texto = String(celda ?? "");
          return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
        })
        .join(";")
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre.endsWith(".csv") ? nombre : `${nombre}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}
