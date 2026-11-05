export default function Carregando() {
  return (
    <div className="mx-auto mt-10 w-full max-w-5xl animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="h-9 w-56 rounded-md bg-border" />
      <div className="mt-3 h-5 w-96 max-w-full rounded-md bg-border/70" />
      <div className="mt-10 h-64 rounded-lg border bg-superficie" />
    </div>
  );
}
