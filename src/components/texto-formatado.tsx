import { Fragment } from "react";
import { formatarTexto, type Trecho } from "@/lib/texto-formatado";
import { cn } from "@/lib/utils";

function Linha({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) =>
        t.negrito ? (
          <strong key={i} className="font-semibold text-grafite">
            {t.texto}
          </strong>
        ) : (
          <Fragment key={i}>{t.texto}</Fragment>
        ),
      )}
    </>
  );
}

export function TextoFormatado({ texto, className }: { texto: string; className?: string }) {
  const blocos = formatarTexto(texto);
  return (
    <div className={cn("space-y-2", className)}>
      {blocos.map((b, i) =>
        b.tipo === "paragrafo" ? (
          <p key={i}>
            {b.linhas.map((linha, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Linha trechos={linha} />
              </Fragment>
            ))}
          </p>
        ) : b.ordenada ? (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {b.itens.map((it, j) => (
              <li key={j} value={it.numero ?? undefined}>
                <Linha trechos={it.trechos} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-pedra">
            {b.itens.map((it, j) => (
              <li key={j}>
                <Linha trechos={it.trechos} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
