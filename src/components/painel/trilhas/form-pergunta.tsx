"use client";

import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Nivel, PedidoPerguntaTurma, TipoPergunta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CAMPO, LETRAS, mensagemDeErro, ROTULO, Segmentado } from "./pecas";

export interface OpcaoHabilidade {
  id: string;
  nome: string;
  codigoBncc: string | null;
}

const LACUNA = "___";

export function FormPergunta({
  habilidades,
  inicial,
  rotuloSalvar,
  onSalvar,
  onCancelar,
}: {
  habilidades: OpcaoHabilidade[];
  inicial?: Partial<PedidoPerguntaTurma>;
  rotuloSalvar: string;
  onSalvar: (pedido: PedidoPerguntaTurma) => Promise<string[] | void>;
  onCancelar?: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPergunta>(inicial?.tipo ?? "escolha");
  const [habilidadeId, setHabilidadeId] = useState(inicial?.habilidadeId ?? habilidades[0]?.id ?? "");
  const [nivel, setNivel] = useState<Nivel>(inicial?.nivel ?? "medio");
  const [enunciado, setEnunciado] = useState(inicial?.tipo === "escolha" ? (inicial.enunciado ?? "") : "");
  const [instrucao, setInstrucao] = useState(inicial?.instrucao ?? "");
  const [frase, setFrase] = useState(inicial?.frase ?? "");
  const [opcoes, setOpcoes] = useState<string[]>(() => {
    const base = inicial?.opcoes?.length ? [...inicial.opcoes] : [];
    const minimo = (inicial?.tipo ?? "escolha") === "escolha" ? 4 : 3;
    while (base.length < minimo) base.push("");
    return base;
  });
  const [certa, setCerta] = useState(inicial?.certa ?? 0);
  const [explicacao, setExplicacao] = useState(inicial?.explicacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const fraseRef = useRef<HTMLTextAreaElement>(null);

  function mudarTipo(novo: TipoPergunta) {
    setTipo(novo);
    setOpcoes((atual) => {
      if (novo === "escolha") {
        const completo = [...atual];
        while (completo.length < 4) completo.push("");
        return completo.slice(0, 4);
      }
      const preenchidas = atual.filter((o) => o.trim()).slice(0, 4);
      while (preenchidas.length < 3) preenchidas.push("");
      return preenchidas;
    });
    setCerta((c) => Math.min(c, 3));
  }

  function inserirLacuna() {
    const el = fraseRef.current;
    const inicio = el?.selectionStart ?? frase.length;
    const fim = el?.selectionEnd ?? frase.length;
    const antes = frase.slice(0, inicio);
    const depois = frase.slice(fim);
    const espacoAntes = antes && !antes.endsWith(" ") ? " " : "";
    const espacoDepois = depois && !/^[\s.,!?;:]/.test(depois) ? " " : "";
    const nova = `${antes}${espacoAntes}${LACUNA}${espacoDepois}${depois}`;
    setFrase(nova);
    requestAnimationFrame(() => {
      const pos = antes.length + espacoAntes.length + LACUNA.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function mudarOpcao(i: number, texto: string) {
    setOpcoes((atual) => atual.map((o, j) => (j === i ? texto : o)));
  }

  function removerOpcao(i: number) {
    setOpcoes((atual) => atual.filter((_, j) => j !== i));
    setCerta((c) => (c === i ? 0 : c > i ? c - 1 : c));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setAvisos([]);
    try {
      const resultado = await onSalvar({
        tipo,
        habilidadeId,
        nivel,
        enunciado: tipo === "escolha" ? enunciado : null,
        instrucao: tipo === "lacuna" ? instrucao : null,
        frase: tipo === "lacuna" ? frase : null,
        opcoes: opcoes.map((o) => o.trim()),
        certa,
        explicacao,
      });
      if (resultado && resultado.length) setAvisos(resultado);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar. Confira os campos e tente de novo."));
    } finally {
      setSalvando(false);
    }
  }

  const buracos = tipo === "lacuna" ? frase.split(/_{2,}/).length - 1 : 0;

  return (
    <form onSubmit={salvar} className="space-y-5">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <Segmentado
          rotulo="Tipo"
          nome="tipo-pergunta"
          valor={tipo}
          onMudar={mudarTipo}
          opcoes={[
            { valor: "escolha", texto: "Múltipla escolha" },
            { valor: "lacuna", texto: "Completar a frase" },
          ]}
        />
        <Segmentado
          rotulo="Nível"
          nome="nivel-pergunta"
          valor={nivel}
          onMudar={setNivel}
          opcoes={[
            { valor: "facil", texto: "Fácil" },
            { valor: "medio", texto: "Médio" },
            { valor: "dificil", texto: "Difícil" },
          ]}
        />
      </div>

      <div>
        <label htmlFor="habilidade-pergunta" className={ROTULO}>
          Conteúdo (habilidade da BNCC)
        </label>
        <select id="habilidade-pergunta" value={habilidadeId} onChange={(e) => setHabilidadeId(e.target.value)} className={cn(CAMPO, "mt-1.5 h-10 py-0")}>
          {habilidades.map((h) => (
            <option key={h.id} value={h.id}>
              {h.codigoBncc ? `${h.codigoBncc} · ` : ""}
              {h.nome}
            </option>
          ))}
        </select>
      </div>

      {tipo === "escolha" ? (
        <div>
          <label htmlFor="enunciado-pergunta" className={ROTULO}>
            Pergunta
          </label>
          <textarea
            id="enunciado-pergunta"
            value={enunciado}
            onChange={(e) => setEnunciado(e.target.value)}
            rows={3}
            maxLength={700}
            required
            placeholder="Ex.: Uma receita usa 1/2 xícara de açúcar. Para fazer duas receitas, quanto açúcar é preciso?"
            className={cn(CAMPO, "mt-1.5")}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="instrucao-pergunta" className={ROTULO}>
              Comando <span className="font-normal text-pedra">(opcional)</span>
            </label>
            <input
              id="instrucao-pergunta"
              value={instrucao}
              onChange={(e) => setInstrucao(e.target.value)}
              maxLength={160}
              placeholder="Complete a frase"
              className={cn(CAMPO, "mt-1.5 h-10")}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label htmlFor="frase-pergunta" className={ROTULO}>
                Frase com a lacuna
              </label>
              <Button type="button" size="sm" variant="outline" onClick={inserirLacuna}>
                Inserir lacuna ___
              </Button>
            </div>
            <textarea
              id="frase-pergunta"
              ref={fraseRef}
              value={frase}
              onChange={(e) => setFrase(e.target.value)}
              rows={2}
              maxLength={300}
              required
              aria-describedby="frase-dica"
              placeholder="Ex.: Metade de uma pizza é ___ da pizza."
              className={cn(CAMPO, "mt-1.5")}
            />
            <p id="frase-dica" className="mt-1 text-sm text-pedra">
              Use três sublinhados (___) onde o aluno vai encaixar a peça.
              {buracos > 1 && " Com mais de uma lacuna, escreva cada peça com as partes separadas por “ / ”."}
            </p>
          </div>
        </div>
      )}

      <fieldset>
        <legend className={ROTULO}>{tipo === "escolha" ? "Alternativas" : "Peças para encaixar"}</legend>
        <p className="text-sm text-pedra">Marque a resposta certa.</p>
        <ul className="mt-2 space-y-2">
          {opcoes.map((o, i) => (
            <li key={i} className="flex items-center gap-2">
              <label
                className={cn(
                  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-bold has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  certa === i ? "border-mata bg-mata text-primary-foreground" : "border-input text-pedra hover:border-mata",
                )}
              >
                <input type="radio" name="certa" className="sr-only" checked={certa === i} onChange={() => setCerta(i)} aria-label={`Alternativa ${LETRAS[i]} é a certa`} />
                {LETRAS[i]}
              </label>
              <input
                value={o}
                onChange={(e) => mudarOpcao(i, e.target.value)}
                maxLength={160}
                required
                aria-label={`Alternativa ${LETRAS[i]}`}
                placeholder={tipo === "escolha" ? `Alternativa ${LETRAS[i]}` : `Peça ${i + 1}`}
                className={cn(CAMPO, "h-10")}
              />
              {tipo === "lacuna" && opcoes.length > 2 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removerOpcao(i)} aria-label={`Remover peça ${i + 1}`}>
                  <Minus />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {tipo === "lacuna" && opcoes.length < 4 && (
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setOpcoes((a) => [...a, ""])}>
            <Plus />
            Adicionar peça
          </Button>
        )}
      </fieldset>

      <div>
        <label htmlFor="explicacao-pergunta" className={ROTULO}>
          Explicação <span className="font-normal text-pedra">(opcional, aparece para você)</span>
        </label>
        <input
          id="explicacao-pergunta"
          value={explicacao}
          onChange={(e) => setExplicacao(e.target.value)}
          maxLength={400}
          placeholder="Por que a resposta certa está certa"
          className={cn(CAMPO, "mt-1.5 h-10")}
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-alerta-clara px-3 py-2 text-sm font-semibold text-alerta">
          {erro}
        </p>
      )}
      {avisos.length > 0 && (
        <ul role="status" className="space-y-1 rounded-lg bg-atencao-clara px-3 py-2 text-sm text-atencao-texto">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={salvando || !habilidadeId}>
          {salvando ? "Salvando…" : rotuloSalvar}
        </Button>
        {onCancelar && (
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
