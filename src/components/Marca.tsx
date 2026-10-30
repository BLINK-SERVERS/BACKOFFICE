export function Marca({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="marca">
      <span className="marca__logo" aria-hidden="true">
        B
      </span>
      <span className="marca__texto">
        <strong>BLINK</strong>
        <span>{subtitulo}</span>
      </span>
    </div>
  );
}
