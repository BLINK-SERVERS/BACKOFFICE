import type { ReactNode } from "react";

type Tipo = "error" | "ok" | "info" | "aviso";

const ICONO: Record<Tipo, string> = {
  error: "✕",
  ok: "✓",
  info: "i",
  aviso: "!",
};

export function Aviso({ tipo = "info", children }: { tipo?: Tipo; children: ReactNode }) {
  return (
    <div className={`aviso aviso--${tipo}`} role={tipo === "error" ? "alert" : "status"}>
      <span aria-hidden="true">{ICONO[tipo]}</span>
      <span>{children}</span>
    </div>
  );
}
