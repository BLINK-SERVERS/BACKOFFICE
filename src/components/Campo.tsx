import type { ReactNode } from "react";

interface Props {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  tipo?: "text" | "password" | "number";
  placeholder?: string;
  pista?: string;
  autoFocus?: boolean;
  prefijo?: ReactNode;
  inputMode?: "text" | "numeric" | "tel";
  maxLength?: number;
  disabled?: boolean;
  min?: number;
  max?: number;
}

export function Campo({
  id,
  etiqueta,
  valor,
  onChange,
  tipo = "text",
  placeholder,
  pista,
  autoFocus,
  prefijo,
  inputMode,
  maxLength,
  disabled,
  min,
  max,
}: Props) {
  return (
    <label className="campo" htmlFor={id}>
      <span className="campo__etiqueta">{etiqueta}</span>
      <span className="campo__control">
        {prefijo ? <span className="campo__prefijo">{prefijo}</span> : null}
        <input
          id={id}
          type={tipo}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          inputMode={inputMode}
          maxLength={maxLength}
          disabled={disabled}
          min={min}
          max={max}
          autoComplete="off"
          spellCheck={false}
        />
      </span>
      {pista ? <span className="campo__pista">{pista}</span> : null}
    </label>
  );
}

interface PropsSelect {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  opciones: { valor: string; texto: string }[];
  disabled?: boolean;
}

export function Selector({ id, etiqueta, valor, onChange, opciones, disabled }: PropsSelect) {
  return (
    <label className="campo" htmlFor={id}>
      <span className="campo__etiqueta">{etiqueta}</span>
      <span className="campo__control">
        <select
          id={id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
