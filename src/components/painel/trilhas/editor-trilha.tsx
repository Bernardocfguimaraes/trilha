"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarDays, Eye, Pencil, Rocket, ScanSearch, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { dataLonga, hojeLocal, somarDias } from "@/lib/formato";
import type { ConteudosTurma, PedidoPerguntaTurma, PedidoTrilha, PerguntaProfessora, TrilhaDetalhe } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FormPergunta, type OpcaoHabilidade } from "./form-pergunta";
import { PainelIa } from "./painel-ia";
import { Alternativas, CAMPO, mensagemDeErro, NIVEL_ROTULO, ROTULO, Selo, SeloOrigem, TIPO_ROTULO } from "./pecas";
import { PreviaAluno } from "./previa-aluno";
import { SeletorPerguntas } from "./seletor-perguntas";

type Aba = "escrever" | "ia" | "salvas" | "banco";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "ia", rotulo: "Pedir à IA" },
  { id: "escrever", rotulo: "Escrever" },
  { id: "salvas", rotulo: "Suas perguntas salvas" },
  { id: "banco", rotulo: "Do banco" },
];

const MAX_PERGUNTAS = 20;

export function EditorTrilha({ turmaId, conteudos, inicial }: { turmaId: string; conteudos: ConteudosTurma; inicial: TrilhaDetalhe | null }) {
  const router = useRouter();
  const hoje = hojeLocal();
  const [trilha, setTrilha] = useState<TrilhaDetalhe | null>(inicial);
  const [disciplinaId, setDisciplinaId] = useState(inicial?.disciplinaId ?? conteudos.disciplinas[0]?.id ?? "");
  const [foco, setFoco] = useState<string[]>(inicial?.habilidades.map((h) => h.id) ?? []);
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [tituloTocado, setTituloTocado] = useState(Boolean(inicial));
  const [fim, setFim] = useState(inicial?.fim ?? somarDias(hoje, 7));
  const [perguntas, setPerguntas] = useState<PerguntaProfessora[]>(inicial?.perguntas ?? []);
  const [aba, setAba] = useState<Aba>("ia");
  const [editando, setEditando] = useState<string | null>(null);
  const [revisando, setRevisando] = useState<string | null>(null);
  const [previa, setPrevia] = useState(false);
  const [salvando, setSalvando] = useState<null | "salvar" | "lancar" | "encerrar">(null);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro" | "aviso"; texto: string } | null>(null);

  const disciplina = conteudos.disciplinas.find((d) => d.id === disciplinaId);
  const todasDaDisciplina = useMemo<OpcaoHabilidade[]>(
    () => disciplina?.unidades.flatMap((u) => u.habilidades.map((h) => ({ id: h.id, nome: h.nome, codigoBncc: h.codigoBncc }))) ?? [],
    [disciplina],
  );
  const opcoesHabilidade = foco.length ? todasDaDisciplina.filter((h) => foco.includes(h.id)) : todasDaDisciplina;
  const naTrilha = useMemo(() => new Set(perguntas.map((p) => p.id)), [perguntas]);
  const situacao = trilha?.situacao ?? "rascunho";
  const encerrada = situacao === "encerrada";

  function avisar(tom: "ok" | "erro" | "aviso", texto: string) {
    setMensagem({ tom, texto });
  }

  function trocarDisciplina(id: string) {
    if (id === disciplinaId) return;
    if (perguntas.length && !window.confirm("Trocar a matéria tira da trilha as perguntas já escolhidas. Continuar?")) return;
    setDisciplinaId(id);
    setFoco([]);
    setPerguntas([]);
    if (!tituloTocado) setTitulo("");
  }

  function alternarFoco(id: string) {
    const novo = foco.includes(id) ? foco.filter((x) => x !== id) : [...foco, id];
    setFoco(novo);
    if (!tituloTocado) setTitulo(todasDaDisciplina.find((h) => h.id === novo[0])?.nome ?? "");
  }

  function adicionar(p: PerguntaProfessora) {
    if (naTrilha.has(p.id)) return;
    if (perguntas.length >= MAX_PERGUNTAS) {
      avisar("erro", `Uma trilha tem no máximo ${MAX_PERGUNTAS} perguntas.`);
      return;
    }
    setPerguntas((lista) => [...lista, p]);
    if (!foco.includes(p.habilidade.id)) setFoco((f) => [...f, p.habilidade.id]);
    avisar("ok", `Pergunta ${perguntas.length + 1} adicionada.`);
  }

  async function criarEAdicionar(pedido: PedidoPerguntaTurma) {
    const r = await api.criarPergunta(turmaId, pedido);
    adicionar(r.pergunta);
    if (r.avisos.length) avisar("aviso", `Pergunta adicionada. Atenção: ${r.avisos.join(" ")}`);
  }

  async function salvarEdicao(id: string, pedido: PedidoPerguntaTurma) {
    const r = await api.editarPergunta(id, pedido);
    setPerguntas((lista) => lista.map((p) => (p.id === id ? r.pergunta : p)));
    setEditando(null);
    avisar(r.avisos.length ? "aviso" : "ok", r.avisos.length ? `Pergunta atualizada. Atenção: ${r.avisos.join(" ")}` : "Pergunta atualizada.");
  }

  async function revisar(id: string) {
    setRevisando(id);
    try {
      const atualizada = await api.revisarPergunta(id);
      setPerguntas((lista) => lista.map((p) => (p.id === id ? atualizada : p)));
      avisar(atualizada.revisao?.aprovada ? "ok" : "aviso", atualizada.revisao?.aprovada ? "A IA revisora chegou à mesma resposta." : `A IA revisora discordou: ${atualizada.revisao?.problema}`);
    } catch (e) {
      avisar("erro", mensagemDeErro(e, "A revisão da IA não está disponível agora."));
    } finally {
      setRevisando(null);
    }
  }

  function mover(i: number, passo: number) {
    setPerguntas((lista) => {
      const j = i + passo;
      if (j < 0 || j >= lista.length) return lista;
      const nova = [...lista];
      [nova[i], nova[j]] = [nova[j], nova[i]];
      return nova;
    });
  }

  function pedido(): PedidoTrilha {
    return { disciplinaId, titulo: titulo.trim(), habilidades: foco, perguntas: perguntas.map((p) => p.id), fim };
  }

  async function salvar(acao: "salvar" | "lancar") {
    setSalvando(acao);
    setMensagem(null);
    try {
      let atual = trilha ? await api.salvarTrilha(trilha.id, pedido()) : await api.criarTrilha(turmaId, pedido());
      if (acao === "lancar") atual = await api.lancarTrilha(atual.id);
      setTrilha(atual);
      setPerguntas(atual.perguntas);
      if (!trilha) router.replace(`/painel/trilhas/${atual.id}`);
      router.refresh();
      avisar(
        "ok",
        acao === "lancar" || atual.situacao === "lancada"
          ? `Trilha disponível para os alunos até ${dataLonga(atual.fim)}.`
          : "Rascunho salvo. Os alunos ainda não veem esta trilha.",
      );
    } catch (e) {
      avisar("erro", mensagemDeErro(e, "Não foi possível salvar a trilha. Tente de novo."));
    } finally {
      setSalvando(null);
    }
  }

  async function encerrar() {
    if (!trilha || !window.confirm("Encerrar a trilha agora? Os alunos deixam de vê-la.")) return;
    setSalvando("encerrar");
    try {
      setTrilha(await api.encerrarTrilha(trilha.id));
      router.refresh();
      avisar("ok", "Trilha encerrada.");
    } catch (e) {
      avisar("erro", mensagemDeErro(e, "Não foi possível encerrar agora."));
    } finally {
      setSalvando(null);
    }
  }

  const prontaParaLancar = titulo.trim().length > 0 && (perguntas.length > 0 || foco.length > 0) && fim >= hoje;

  return (
    <div className="pb-28">
      <section aria-labelledby="passo-1" className="rounded-lg border bg-superficie p-5 sm:p-6">
        <h2 id="passo-1" className="text-lg font-bold text-grafite">
          1. Matéria e conteúdo da semana
        </h2>
        <fieldset className="mt-4" disabled={encerrada}>
          <legend className={ROTULO}>Matéria</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {conteudos.disciplinas.map((d) => (
              <label
                key={d.id}
                className={cn(
                  "cursor-pointer rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  disciplinaId === d.id ? "border-mata bg-mata-clara text-mata-escura" : "border-border text-pedra hover:border-mata/40",
                )}
              >
                <input type="radio" name="disciplina" className="sr-only" checked={disciplinaId === d.id} onChange={() => trocarDisciplina(d.id)} />
                {d.nome}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5" disabled={encerrada}>
          <legend className={ROTULO}>Conteúdo em foco</legend>
          <p className="text-sm text-pedra">A trilha da semana e o “praticar mais” ficam só nestes conteúdos.</p>
          <div className="mt-2 space-y-3">
            {disciplina?.unidades.map((u) => (
              <div key={u.nome}>
                <p className="text-xs font-semibold tracking-wide text-pedra uppercase">{u.nome}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {u.habilidades.map((h) => {
                    const ativo = foco.includes(h.id);
                    return (
                      <label
                        key={h.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                          ativo ? "border-mata bg-mata-clara text-grafite" : "border-border text-grafite hover:border-mata/40",
                        )}
                      >
                        <input type="checkbox" className="size-4 accent-mata" checked={ativo} onChange={() => alternarFoco(h.id)} />
                        <span>
                          {h.codigoBncc && <span className="mr-1 font-mono text-xs text-pedra">{h.codigoBncc}</span>}
                          {h.nome}
                        </span>
                        <span className="text-xs text-pedra">
                          {h.noBanco} no banco{h.daTurma > 0 && ` · ${h.daTurma} suas`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="titulo-trilha" className={ROTULO}>
              Nome da trilha
            </label>
            <input
              id="titulo-trilha"
              value={titulo}
              disabled={encerrada}
              onChange={(e) => {
                setTitulo(e.target.value);
                setTituloTocado(true);
              }}
              maxLength={80}
              placeholder="Ex.: Revisão de frações"
              className={cn(CAMPO, "mt-1.5 h-10")}
            />
          </div>
          <div>
            <label htmlFor="fim-trilha" className={ROTULO}>
              Disponível até
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                id="fim-trilha"
                type="date"
                value={fim}
                min={hoje}
                max={somarDias(hoje, 60)}
                disabled={encerrada}
                onChange={(e) => setFim(e.target.value)}
                className={cn(CAMPO, "h-10 w-auto")}
              />
              {[7, 14].map((d) => (
                <Button key={d} type="button" size="sm" variant="outline" disabled={encerrada} onClick={() => setFim(somarDias(hoje, d))}>
                  <CalendarDays />
                  {d === 7 ? "1 semana" : "2 semanas"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="passo-2" className="mt-6 rounded-lg border bg-superficie p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="passo-2" className="text-lg font-bold text-grafite">
            2. Perguntas da trilha <span className="font-normal text-pedra">({perguntas.length})</span>
          </h2>
          <p className="text-sm text-pedra">Cada aluno recebe estas perguntas em ordem diferente.</p>
        </div>
        {perguntas.length === 0 ? (
          <p className="mt-4 rounded-lg bg-secondary/60 px-4 py-3 text-sm text-pedra">
            Nenhuma pergunta ainda. Use o passo 3 para pedir à IA, escrever, reusar as suas ou puxar do banco. Sem perguntas, a trilha sorteia do
            banco dentro do conteúdo em foco.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {perguntas.map((p, i) => (
              <li key={p.id} className="rounded-lg border p-4">
                {editando === p.id ? (
                  <FormPergunta
                    habilidades={todasDaDisciplina}
                    inicial={{
                      tipo: p.tipo,
                      habilidadeId: p.habilidade.id,
                      nivel: p.nivel,
                      enunciado: p.tipo === "escolha" ? p.enunciado : null,
                      instrucao: p.instrucao,
                      frase: p.frase,
                      opcoes: p.opcoes,
                      certa: p.certa,
                      explicacao: p.explicacao,
                    }}
                    rotuloSalvar="Salvar pergunta"
                    onCancelar={() => setEditando(null)}
                    onSalvar={(pedidoPergunta) => salvarEdicao(p.id, pedidoPergunta)}
                  />
                ) : (
                  <div className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mata-clara text-sm font-bold text-mata-escura">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Selo tom="neutro">{TIPO_ROTULO[p.tipo]}</Selo>
                        <Selo tom="neutro">{NIVEL_ROTULO[p.nivel]}</Selo>
                        <SeloOrigem origem={p.origem} revisao={p.revisao} />
                        <span className="text-xs text-pedra">{p.habilidade.nome}</span>
                      </div>
                      <p className="mt-2 font-semibold break-words text-grafite">{p.enunciado}</p>
                      <Alternativas opcoes={p.opcoes} certa={p.certa} respostaIa={p.revisao?.respostaIa} />
                      {p.revisao && !p.revisao.aprovada && p.revisao.problema && (
                        <p className="mt-2 text-sm text-alerta">
                          <span className="font-semibold">Revisora:</span> {p.revisao.problema}
                        </p>
                      )}
                      {!encerrada && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          <Button size="icon-sm" variant="ghost" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir pergunta ${i + 1}`}>
                            <ArrowUp />
                          </Button>
                          <Button size="icon-sm" variant="ghost" onClick={() => mover(i, 1)} disabled={i === perguntas.length - 1} aria-label={`Descer pergunta ${i + 1}`}>
                            <ArrowDown />
                          </Button>
                          {p.origem !== "banco" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setEditando(p.id)}>
                                <Pencil />
                                Editar
                              </Button>
                              {!p.revisao && (
                                <Button size="sm" variant="ghost" onClick={() => revisar(p.id)} disabled={revisando === p.id}>
                                  <ScanSearch />
                                  {revisando === p.id ? "Revisando…" : "Revisar com IA"}
                                </Button>
                              )}
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setPerguntas((lista) => lista.filter((x) => x.id !== p.id))}>
                            <Trash2 />
                            Tirar da trilha
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {!encerrada && (
        <section aria-labelledby="passo-3" className="mt-6 rounded-lg border bg-superficie p-5 sm:p-6">
          <h2 id="passo-3" className="text-lg font-bold text-grafite">
            3. Adicionar perguntas
          </h2>
          <div role="tablist" aria-label="Como adicionar perguntas" className="mt-4 flex flex-wrap gap-1 border-b">
            {ABAS.map((a) => (
              <button
                key={a.id}
                role="tab"
                type="button"
                id={`aba-${a.id}`}
                aria-selected={aba === a.id}
                aria-controls={`painel-${a.id}`}
                onClick={() => setAba(a.id)}
                className={cn(
                  "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  aba === a.id ? "border-mata text-mata-escura" : "border-transparent text-pedra hover:text-grafite",
                )}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} className="pt-5">
            {aba === "ia" && <PainelIa key={disciplinaId} turmaId={turmaId} habilidades={opcoesHabilidade} onAdicionar={criarEAdicionar} />}
            {aba === "escrever" && (
              <FormPergunta key={`${disciplinaId}-${perguntas.length}`} habilidades={opcoesHabilidade} rotuloSalvar="Salvar e adicionar à trilha" onSalvar={criarEAdicionar} />
            )}
            {aba === "salvas" && (
              <SeletorPerguntas turmaId={turmaId} fonte="turma" habilidades={opcoesHabilidade.map((h) => h.id)} jaNaTrilha={naTrilha} onAdicionar={adicionar} />
            )}
            {aba === "banco" && (
              <SeletorPerguntas turmaId={turmaId} fonte="banco" habilidades={foco} jaNaTrilha={naTrilha} onAdicionar={adicionar} />
            )}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-superficie/95 px-4 py-3 backdrop-blur md:left-60 print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <p role="status" aria-live="polite" className={cn("min-w-0 flex-1 text-sm", mensagem?.tom === "erro" ? "font-semibold text-alerta" : mensagem?.tom === "aviso" ? "text-atencao-texto" : "text-pedra")}>
            {mensagem?.texto ??
              (situacao === "lancada"
                ? `Lançada · disponível até ${dataLonga(trilha!.fim)} · ${trilha!.feitos} de ${trilha!.alunos} alunos fizeram`
                : encerrada
                  ? "Trilha encerrada. Os alunos não veem mais esta trilha."
                  : "Rascunho: os alunos só veem depois de lançar.")}
          </p>
          <Button variant="outline" onClick={() => setPrevia(true)} disabled={perguntas.length === 0}>
            <Eye />
            Ver como o aluno
          </Button>
          {!encerrada && (
            <Button variant="outline" onClick={() => salvar("salvar")} disabled={salvando !== null || !titulo.trim()}>
              {salvando === "salvar" ? "Salvando…" : situacao === "lancada" ? "Salvar alterações" : "Salvar rascunho"}
            </Button>
          )}
          {situacao === "rascunho" && (
            <Button onClick={() => salvar("lancar")} disabled={salvando !== null || !prontaParaLancar}>
              <Rocket />
              {salvando === "lancar" ? "Lançando…" : "Lançar para a turma"}
            </Button>
          )}
          {situacao === "lancada" && (
            <Button variant="destructive" onClick={encerrar} disabled={salvando !== null}>
              {salvando === "encerrar" ? "Encerrando…" : "Encerrar trilha"}
            </Button>
          )}
        </div>
      </div>

      {previa && <PreviaAluno perguntas={perguntas} disciplina={disciplina?.nome ?? ""} onFechar={() => setPrevia(false)} />}
    </div>
  );
}
