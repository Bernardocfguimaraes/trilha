import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function LinkVoltar({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-pedra outline-none hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

const CLASSES_ALUNO =
  "grid size-11 shrink-0 place-items-center rounded-full text-pedra outline-none hover:bg-superficie/70 focus-visible:ring-4 focus-visible:ring-grafite/30";

export function VoltarAluno({
  rotulo,
  href,
  onClick,
  className,
}: {
  rotulo: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const icone = <ArrowLeft className="size-7" strokeWidth={3} aria-hidden />;
  if (href) {
    return (
      <Link href={href} aria-label={rotulo} title={rotulo} className={cn(CLASSES_ALUNO, className)}>
        {icone}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} title={rotulo} className={cn(CLASSES_ALUNO, className)}>
      {icone}
    </button>
  );
}
