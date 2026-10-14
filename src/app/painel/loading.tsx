export default function Carregando() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="h-9 w-56 rounded-md bg-border" />
      <div className="mt-3 h-5 w-96 max-w-full rounded-md bg-border/70" />
      <div className="mt-10 h-80 rounded-lg border bg-white" />
    </div>
  );
}
