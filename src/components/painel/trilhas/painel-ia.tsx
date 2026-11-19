"use client";

import { useState } from "react";
import { Check, Pencil, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Nivel, PedidoPerguntaTurma, RascunhoIa, TipoPergunta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FormPergunta, type OpcaoHabilidade } from "./form-pergunta";
import { Alternativas, CAMPO, mensagemDeErro, NIVEL_ROTULO, ROTULO, Segmentado, Selo, TIPO_ROTULO } from "./pecas";

export function PainelIa({
  turmaId,
  habilidades,
  onAdicionar,
}: {
  turmaId: string;
  habilidades: OpcaoHabilidade[];
  onAdicionar: (pedido: PedidoPerguntaTurma) => Promise<void>;
}) {
  const [habilidadeId, setHabilidadeId] = useState(habilidades[0]?.id ?? "");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState(4);
  const [nivel, setNivel] = useState<Nivel>("medio");
  const [tipo, setTipo] = useState<TipoPergunta | "misto">("misto");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<(RascunhoIa & { chave: number })[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [salvando, setSalvando] = useState<number | null>(null);
  const habilidadeValida = habilidades.some((h) => h.id === habilidadeId) ? habilidadeId : (habilidades[0]?.id ?? "");

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setGerando(true);
    setErro(null);
    try {
      const r = await api.gerarRascunhos(turmaId, { habilidadeId: habilidadeValida, descricao, quantidade, nivel, tipo });
      const base = Date.now();
      setRascunhos(r.rascunhos.map((x, i) => ({ ...x, chave: base + i })));
      if (!r.rascunhos.length) setErro("A IA não conseguiu montar perguntas boas desta vez. Tente descrever a aula com mais detalhes.");
    } catch (err) {
      setErro(mensagemDeErro(err, "A IA não respondeu agora. Tente de novo em alguns instantes ou escreva a pergunta."));
    } finally {
      setGerando(false);
    }
  }

  async function aceitar(r: RascunhoIa & { chave: number }, pedido?: PedidoPerguntaTurma) {
    setSalvando(r.chave);
    try {
      await onAdicionar(
        pedido ?? {
          tipo: r.tipo,
          habilidadeId: r.habilidadeId,
          nivel: r.nivel,
          enunciado: r.tipo === "escolha" ? r.enunciado : null,
          instrucao: r.instrucao,
          frase: r.frase,
          opcoes: r.opcoes,
          certa: r.certa,
          explicacao: r.explicacao,
          origem: "ia",
          revisao: r.revisao,
        },
      );
      setRascunhos((lista) => lista.filter((x) => x.chave !== r.chave));
      setEditando(null);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={gerar} className="space-y-4">
        <div>
          <label htmlFor="descricao-aula" className={ROTULO}>
            O que você trabalhou na aula?
          </label>
          <textarea
            id="descricao-aula"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            maxLength={600}
            required
            minLength={10}
            placeholder="Ex.: Revisei frações com uma receita de bolo: metade, um terço e um quarto da receita, comparando qual parte é maior."
            className={cn(CAMPO, "mt-1.5")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="habilidade-ia" className={ROTULO}>
              Conteúdo
            </label>
            <select id="habilidade-ia" value={habilidadeValida} onChange={(e) => setHabilidadeId(e.target.value)} className={cn(CAMPO, "mt-1.5 h-10 py-0")}>
              {habilidades.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.codigoBncc ? `${h.codigoBncc} · ` : ""}
                  {h.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quantidade-ia" className={ROTULO}>
              Quantas perguntas
            </label>
            <select id="quantidade-ia" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className={cn(CAMPO, "mt-1.5 h-10 py-0")}>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Segmentado
            rotulo="Tipo"
            nome="tipo-ia"
            valor={tipo}
            onMudar={setTipo}
            opcoes={[
              { valor: "misto", texto: "Os dois" },
              { valor: "escolha", texto: "Múltipla escolha" },
              { valor: "lacuna", texto: "Completar a frase" },
            ]}
          />
          <Segmentado
            rotulo="Nível"
            nome="nivel-ia"
            valor={nivel}
            onMudar={setNivel}
            opcoes={[
              { valor: "facil", texto: "Fácil" },
              { valor: "medio", texto: "Médio" },
              { valor: "dificil", texto: "Difícil" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={gerando || descricao.trim().length < 10 || !habilidadeValida}>
            <Sparkles className={cn(gerando && "animate-pulse")} />
            {gerando ? "Escrevendo e revisando…" : "Gerar rascunhos"}
          </Button>
          <p className="text-sm text-pedra">
            {gerando ? "Leva cerca de 20 segundos: uma IA escreve e outra confere cada resposta." : "Você revisa cada rascunho antes de entrar na trilha."}
          </p>
        </div>
        {erro && (
          <p role="alert" className="rounded-lg bg-alerta-clara px-3 py-2 text-sm font-semibold text-alerta">
            {erro}
          </p>
        )}
      </form>

      {rascunhos.length > 0 && (
        <ul className="space-y-3" aria-label="Rascunhos da IA">
          {rascunhos.map((r) => (
            <li key={r.chave} className="rounded-lg border bg-superficie p-4">
              {editando === r.chave ? (
                <FormPergunta
                  habilidades={habilidades}
                  inicial={{ ...r, enunciado: r.tipo === "escolha" ? r.enunciado : null }}
                  rotuloSalvar="Salvar e adicionar à trilha"
                  onCancelar={() => setEditando(null)}
                  onSalvar={(pedido) => aceitar(r, { ...pedido, origem: "ia", revisao: null })}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Selo tom="neutro">{TIPO_ROTULO[r.tipo]}</Selo>
                    <Selo tom="neutro">{NIVEL_ROTULO[r.nivel]}</Selo>
                    {r.revisao ? (
                      r.revisao.aprovada ? (
                        <Selo tom="ok">Conferida pela IA revisora</Selo>
                      ) : (
                        <Selo tom="alerta">A revisora discordou</Selo>
                      )
                    ) : (
                      <Selo tom="neutro">Sem revisão</Selo>
                    )}
                  </div>
                  <p className="mt-2 font-semibold text-grafite">{r.tipo === "lacuna" ? `${r.instrucao || "Complete a frase"}: ${r.frase}` : r.enunciado}</p>
                  <Alternativas opcoes={r.opcoes} certa={r.certa} respostaIa={r.revisao?.respostaIa} />
                  {r.revisao && !r.revisao.aprovada && r.revisao.problema && (
                    <p className="mt-2 text-sm text-alerta">
                      <span className="font-semibold">Revisora:</span> {r.revisao.problema}
                    </p>
                  )}
                  {r.explicacao && (
                    <p className="mt-2 text-sm text-pedra">
                      <span className="font-semibold">Por quê:</span> {r.explicacao}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => aceitar(r)} disabled={salvando === r.chave}>
                      <Check />
                      {salvando === r.chave ? "Adicionando…" : "Adicionar à trilha"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditando(r.chave)}>
                      <Pencil />
                      Editar antes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRascunhos((lista) => lista.filter((x) => x.chave !== r.chave))}>
                      <X />
                      Descartar
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
