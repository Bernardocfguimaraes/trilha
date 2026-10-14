import { cn } from "@/lib/utils";

type Cor = "broto" | "sol" | "branco" | "coral";

const CORES: Record<Cor, string> = {
  broto: "bg-broto text-white shadow-[0_5px_0_var(--color-broto-escuro)]",
  sol: "bg-sol text-grafite shadow-[0_5px_0_var(--color-sol-escuro)]",
  coral: "bg-coral text-white shadow-[0_5px_0_#d9583a]",
  branco: "bg-white text-grafite shadow-[0_5px_0_var(--color-ceu-forte)] ring-2 ring-ceu-forte",
};

/** Botão "de apertar": grande, com sombra sólida que afunda ao toque. */
export function classesBotaoGrande(cor: Cor = "broto", className?: string) {
  return cn(
    "inline-flex min-h-16 items-center justify-center gap-3 rounded-2xl px-8 font-display text-2xl font-bold",
    "transition-[transform,box-shadow] duration-75 active:translate-y-[5px] active:shadow-none",
    "outline-none focus-visible:ring-4 focus-visible:ring-grafite/40",
    "disabled:cursor-not-allowed disabled:bg-[#d5dde0] disabled:text-[#8a979c] disabled:shadow-[0_5px_0_#b9c4c8] disabled:active:translate-y-0",
    CORES[cor],
    className,
  );
}

export function BotaoGrande({
  cor = "broto",
  className,
  ...props
}: React.ComponentProps<"button"> & { cor?: Cor }) {
  return <button className={classesBotaoGrande(cor, className)} {...props} />;
}
