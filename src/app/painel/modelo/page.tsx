import type { Metadata } from "next";
import { LinkVoltar } from "@/components/voltar";
import { rotuloStatus } from "@/components/marca";
import { api } from "@/lib/api";
import { getProfessor } from "@/lib/auth";
import { dataLonga } from "@/lib/formato";
import type { AvaliacaoLlm, MetricasClassificacao, MetricasModelo, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Como o diagnóstico funciona" };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const dec = (v: number) => v.toFixed(2).replace(".", ",");

const PASSOS = [
  {
    titulo: "Cada sessão vira dado",
    texto: "Ao terminar a trilha do dia, o desempenho de 0 a 100 em cada habilidade praticada é gravado no histórico do aluno.",
  },
  {
    titulo: "O histórico vira indicadores",
    texto: "Para cada habilidade, calculamos sete indicadores: média geral, média recente, média inicial, tendência, oscilação, pior dia e dias de atividade.",
  },
  {
    titulo: "O modelo decide",
    texto: "Um Random Forest com 200 árvores de decisão vota: cada árvore dá sua probabilidade para ok, atenção e alerta, e vence o status mais provável.",
  },
  {
    titulo: "A decisão vira ação",
    texto: "O painel põe primeiro quem precisa de ajuda, e o LLM transforma o diagnóstico em recomendação e exercício de reforço.",
  },
];

export default async function ModeloPage() {
  const professor = await getProfessor();
  const m = await api.metricasModelo(professor.token);
  const { implantado: atual, antesDoAjuste: antes, baseline } = m;

  return (
    <div className="mx-auto max-w-5xl">
      <LinkVoltar href="/painel">Alunos</LinkVoltar>
      <header className="mt-4">
        <h1 className="text-3xl font-bold text-grafite">Como o diagnóstico funciona</h1>
        <p className="mt-2 max-w-prose text-lg text-pedra">
          O status de cada habilidade (ok, atenção ou alerta) não é uma regra fixa: vem de um modelo de Machine Learning
          que olha para a trajetória do aluno, não só para a última nota.
        </p>
      </header>

      <section className="mt-10" aria-labelledby="passos">
        <h2 id="passos" className="text-xl font-bold text-grafite">
          Do toque do aluno à decisão
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="rounded-lg border bg-superficie p-5">
              <span className="grid size-8 place-items-center rounded-full bg-mata-clara font-bold text-mata-escura" aria-hidden>
                {i + 1}
              </span>
              <h3 className="mt-3 font-bold text-grafite">{p.titulo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-pedra">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="resultado">
        <h2 id="resultado" className="text-xl font-bold text-grafite">
          Quanto ele acerta
        </h2>
        <p className="mt-1 max-w-prose text-pedra">
          Avaliado em {m.dados.teste.toLocaleString("pt-BR")} casos que o modelo não viu no treino, comparado com a regra
          antiga ({baseline.descricao.toLowerCase()}).
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <Indicador
            rotulo="F1 macro"
            valor={dec(atual.f1Macro)}
            comparacao={`regra antiga: ${dec(baseline.f1Macro)}`}
            nota="Média do acerto nas três classes, sem deixar a menor sumir."
          />
          <Indicador
            rotulo="Acurácia"
            valor={pct(atual.acuracia)}
            comparacao={`regra antiga: ${pct(baseline.acuracia)}`}
            nota="Casos classificados no status certo."
          />
          <Indicador
            rotulo="Alunos em atenção encontrados"
            valor={pct(atual.porClasse.atencao.recall)}
            comparacao={`antes do ajuste: ${pct(antes.porClasse.atencao.recall)}`}
            nota="Recall da classe atenção, a mais difícil e a que mais ganha com ajuda cedo."
          />
        </dl>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="matriz">
          <h2 id="matriz" className="text-xl font-bold text-grafite">
            Onde ele acerta e onde confunde
          </h2>
          <p className="mt-1 text-pedra">
            Cada linha é o status real; cada coluna, o que o modelo disse. A diagonal são os acertos. As confusões
            acontecem entre vizinhos, quase nunca entre ok e alerta.
          </p>
          <MatrizConfusao m={m} />
        </section>

        <section aria-labelledby="importancia">
          <h2 id="importancia" className="text-xl font-bold text-grafite">
            O que ele mais leva em conta
          </h2>
          <p className="mt-1 text-pedra">
            Importância de cada indicador nas decisões das árvores. A tendência quase empata com a média recente: é o
            que a regra antiga não enxergava.
          </p>
          <Importancias m={m} />
        </section>
      </div>

      <section className="mt-12" aria-labelledby="comparacao">
        <h2 id="comparacao" className="text-xl font-bold text-grafite">
          Modelos comparados
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-pedra">
                <th className="px-4 py-2.5 font-semibold">Modelo</th>
                <th className="px-4 py-2.5 text-right font-semibold">F1 macro</th>
                <th className="px-4 py-2.5 text-right font-semibold">Acurácia</th>
                <th className="px-4 py-2.5 text-right font-semibold">Atenção encontrados</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Regra de limiar (antiga)", baseline],
                  ["Árvore de decisão", m.arvoreDeDecisao],
                  ["Random Forest, primeira versão", antes],
                  ["Random Forest ajustado (em uso)", atual],
                ] as [string, MetricasClassificacao][]
              ).map(([nome, r], i, lista) => (
                <tr key={nome} className={cn("border-b last:border-b-0", i === lista.length - 1 && "bg-mata-clara/50 font-semibold")}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-grafite">
                    {nome}
                  </th>
                  <td className="px-4 py-2.5 text-right text-grafite tabular-nums">{dec(r.f1Macro)}</td>
                  <td className="px-4 py-2.5 text-right text-grafite tabular-nums">{pct(r.acuracia)}</td>
                  <td className="px-4 py-2.5 text-right text-grafite tabular-nums">{pct(r.porClasse.atencao.recall)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-pedra">
          O ajuste usou classes balanceadas e escolheu os hiperparâmetros por validação cruzada de 5 dobras (
          {Object.entries(m.modelo.parametros)
            .map(([k, v]) => `${k} = ${v}`)
            .join(", ")}
          ).
        </p>
      </section>

      {m.risco && (
        <section className="mt-12" aria-labelledby="previsao">
          <h2 id="previsao" className="text-xl font-bold text-grafite">
            Previsão: quem pode cair para alerta
          </h2>
          <p className="mt-1 max-w-prose text-pedra">
            Um segundo modelo olha para a frente. Para habilidades que hoje ainda não estão em alerta, ele estima a chance de a
            média das próximas 3 sessões ficar abaixo de 55. Quando passa de {pct(m.risco.modelo.limiar)}, o painel avisa
            “Pode cair para alerta”: dá para agir antes de o aluno travar.
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <Indicador
              rotulo="Quedas avisadas antes"
              valor={pct(m.risco.implantado.recall)}
              comparacao={`regra simples: ${pct(m.risco.baseline.recall)}`}
              nota="Das habilidades que de fato caíram, quantas o modelo apontou."
            />
            <Indicador
              rotulo="Avisos que se confirmaram"
              valor={pct(m.risco.implantado.precisao)}
              comparacao={`regra simples: ${pct(m.risco.baseline.precisao)}`}
              nota={`Quedas são raras (${pct(m.risco.dados.taxaDeQueda)} dos casos): um aviso em dois se confirmar já é bem acima do acaso.`}
            />
            <Indicador
              rotulo="AUC ROC"
              valor={dec(m.risco.implantado.aucRoc)}
              comparacao={`validação cruzada: ${dec(m.risco.modelo.validacaoCruzadaAuc)}`}
              nota="Quanto o modelo separa quem vai cair de quem não vai (0,5 = acaso, 1 = perfeito)."
            />
          </dl>
          <p className="mt-2 text-sm text-pedra">
            Regra simples comparada: {m.risco.baseline.descricao.toLowerCase()}. O ponto de corte foi escolhido por validação
            cruzada, priorizando não deixar passar quem vai cair.
          </p>
        </section>
      )}

      <section className="mt-12" aria-labelledby="reais">
        <h2 id="reais" className="text-xl font-bold text-grafite">
          Com dados reais da escola
        </h2>
        <p className="mt-1 max-w-prose text-pedra">
          Na página de cada aluno, o professor responde se o diagnóstico está certo. Cada resposta vira um caso real
          rotulado: serve para medir o modelo e para retreiná-lo.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-superficie p-5">
            <p className="text-sm font-semibold text-pedra">Concordância com os professores, agora</p>
            {m.professores.avaliacoes === 0 ? (
              <p className="mt-2 text-grafite">
                Ainda não há avaliações. Elas aparecem quando um professor responde “O diagnóstico está certo?” em “Por que está
                em…”, na página de um aluno.
              </p>
            ) : (
              <>
                <p className="mt-1 text-4xl font-bold text-grafite tabular-nums">{pct(m.professores.concordancia ?? 0)}</p>
                <p className="mt-1 text-sm text-pedra">
                  em {m.professores.avaliacoes} {m.professores.avaliacoes === 1 ? "avaliação" : "avaliações"} de professores
                </p>
              </>
            )}
          </div>
          <div className="rounded-lg border bg-superficie p-5">
            <p className="text-sm font-semibold text-pedra">No último treino</p>
            {!m.reais ? (
              <p className="mt-2 text-grafite">O modelo em uso foi treinado só com dados simulados.</p>
            ) : m.reais.validacaoSoSinteticos && m.reais.validacaoComReais ? (
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">Validação cruzada nos casos reais</caption>
                <thead>
                  <tr className="text-left text-pedra">
                    <th className="py-1 font-semibold">Treinado com</th>
                    <th className="py-1 text-right font-semibold">F1 macro</th>
                    <th className="py-1 text-right font-semibold">Acurácia</th>
                  </tr>
                </thead>
                <tbody className="text-grafite">
                  <tr>
                    <th scope="row" className="py-1 text-left font-medium">Só simulados</th>
                    <td className="py-1 text-right tabular-nums">{dec(m.reais.validacaoSoSinteticos.f1Macro)}</td>
                    <td className="py-1 text-right tabular-nums">{pct(m.reais.validacaoSoSinteticos.acuracia)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <th scope="row" className="py-1 text-left">Simulados + {m.reais.amostras} reais</th>
                    <td className="py-1 text-right tabular-nums">{dec(m.reais.validacaoComReais.f1Macro)}</td>
                    <td className="py-1 text-right tabular-nums">{pct(m.reais.validacaoComReais.acuracia)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-grafite">
                {m.reais.amostras} casos reais medidos
                {m.reais.concordanciaModeloSintetico !== undefined && ` (concordância ${pct(m.reais.concordanciaModeloSintetico)})`}.{" "}
                {m.reais.observacao}
              </p>
            )}
            <p className="mt-3 text-xs text-pedra">
              Medido por validação cruzada só nos casos reais: o modelo nunca é testado num caso que viu no treino.
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-pedra">
          Para retreinar: <code className="rounded bg-secondary px-1 py-0.5 text-xs">python -m ml.exportar_reais</code> e depois{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-xs">python -m ml.treinar</code>, na pasta do backend.
        </p>
      </section>

      {m.llm && <SecaoLlm a={m.llm} />}

      <section className="mt-12 rounded-lg border bg-superficie p-6" aria-labelledby="limites">
        <h2 id="limites" className="text-xl font-bold text-grafite">
          Dados e limites
        </h2>
        <ul className="mt-3 max-w-prose space-y-2 text-pedra">
          <li>
            Treinado com {m.dados.amostras.toLocaleString("pt-BR")} trajetórias de desempenho (dados {m.dados.origem}). Como a Trilha ainda não tem
            anos de dados de alunos reais, as trajetórias foram simuladas: cada aluno tem um nível e uma tendência ocultos, e o
            desempenho de cada dia vem com ruído. O modelo só vê o desempenho, nunca o nível oculto.
          </li>
          <li>Cada sessão real fica gravada no histórico; com as avaliações dos professores, ela vira dado de treino.</li>
          <li>O diagnóstico apoia o professor: ele aponta onde olhar, e a decisão pedagógica continua sendo de quem conhece o aluno.</li>
        </ul>
        <p className="mt-4 text-sm text-pedra">Último treino em {dataLonga(m.treinadoEm)}.</p>
      </section>
    </div>
  );
}

const pctOu = (v: number | null) => (v === null ? "—" : pct(v));

/** Avaliação do revisor de questões geradas por IA (ml/avaliar_llm.py). */
function SecaoLlm({ a }: { a: AvaliacaoLlm }) {
  const nome = (modelo: string) => modelo.split("/").pop();
  const linhas: { rotulo: string; nota: string; chave: "errosPegos" | "boasRecusadas" | "erroEntreAprovadas"; melhorAlto: boolean }[] = [
    { rotulo: "Erros pegos", nota: "das questões com gabarito errado, quantas reprovou", chave: "errosPegos", melhorAlto: true },
    { rotulo: "Questões boas recusadas", nota: "das questões corretas, quantas recusou à toa", chave: "boasRecusadas", melhorAlto: false },
    { rotulo: "Erro entre as aprovadas", nota: "o que chegaria ao aluno com erro", chave: "erroEntreAprovadas", melhorAlto: false },
  ];
  const g = a.geracao;
  return (
    <section className="mt-12" aria-labelledby="ia">
      <h2 id="ia" className="text-xl font-bold text-grafite">
        A IA que cria exercícios também é avaliada
      </h2>
      <p className="mt-1 max-w-prose text-pedra">
        O professor pode pedir exercícios novos, gerados por IA ({nome(a.modelos.gerador)}). Antes de chegar ao aluno, cada
        questão passa por um checador de formato e por um revisor que resolve a questão sem ver o gabarito. Na geração do
        banco de questões, quando o próprio gerador revisava o que tinha feito, cerca de 30% das aprovadas ainda tinham erro
        na conferência manual. Por isso o revisor passou a ser um modelo de outra família ({nome(a.modelos.revisor)}), que
        também tem cota gratuita própria.
      </p>
      <p className="mt-2 max-w-prose text-pedra">
        Para medir, usamos {a.metodo.amostra} questões do banco curado (gabarito conhecido) e as mesmas questões com o gabarito
        trocado de propósito. Os dois revisores recebem as mesmas instruções; só muda o modelo.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border bg-superficie">
        <table className="w-full text-sm">
          <caption className="sr-only">Revisor do próprio modelo comparado com revisor de outro modelo</caption>
          <thead>
            <tr className="border-b text-left text-pedra">
              <th scope="col" className="px-4 py-3 font-semibold">Medida</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Próprio gerador <span className="block text-xs font-normal">{nome(a.modelos.gerador)}</span>
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Outro modelo (em uso) <span className="block text-xs font-normal">{nome(a.modelos.revisor)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const va = a.autoRevisao[l.chave];
              const vo = a.outroModelo[l.chave];
              const melhor = va !== null && vo !== null && va !== vo ? ((vo > va) === l.melhorAlto ? "outro" : "auto") : null;
              return (
                <tr key={l.chave} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal text-grafite">
                    {l.rotulo}
                    <span className="block text-xs text-pedra">{l.nota}</span>
                  </th>
                  <td className={cn("px-4 py-3 text-right text-grafite tabular-nums", melhor === "auto" && "font-bold")}>{pctOu(va)}</td>
                  <td className={cn("px-4 py-3 text-right text-grafite tabular-nums", melhor === "outro" && "font-bold")}>{pctOu(vo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {a.autoRevisao.errosPegos !== null && a.autoRevisao.errosPegos === a.outroModelo.errosPegos && (
        <p className="mt-3 max-w-prose text-sm text-pedra">
          Neste teste os dois revisores empataram: gabarito trocado é um erro fácil de pegar. A diferença aparece nos erros
          sutis das questões novas, como duas respostas defensáveis ou uma rima imperfeita, e medir isso exige conferir à mão
          uma amostra de questões geradas. Esse é o próximo passo da avaliação.
        </p>
      )}
      {g.validasFormato > 0 && (
        <p className="mt-3 max-w-prose text-sm text-pedra">
          Geração ao vivo: das {g.pedidas} questões pedidas à IA, {g.validasFormato} passaram no checador de formato. O próprio
          gerador aprovaria {g.aprovadasAuto} e o revisor de outro modelo aprovou {g.aprovadasOutro}: ele é mais rigoroso e,
          às vezes, recusa uma questão aceitável. Os dois discordaram em {g.discordancias}.
        </p>
      )}
      <p className="mt-2 text-sm text-pedra">
        Amostra pequena (plano gratuito da IA), reproduzível com <code className="text-xs">python -m ml.avaliar_llm</code>.
        Avaliado em {dataLonga(a.avaliadoEm)}.
        {a.interrompido && " A cota diária acabou no meio: parte dos casos ficou de fora."}
      </p>
    </section>
  );
}

function Indicador({ rotulo, valor, comparacao, nota }: { rotulo: string; valor: string; comparacao: string; nota: string }) {
  return (
    <div className="rounded-lg border bg-superficie p-5">
      <dt className="text-sm font-semibold text-pedra">{rotulo}</dt>
      <dd className="mt-1">
        <span className="text-4xl font-bold tracking-tight text-grafite tabular-nums">{valor}</span>
        <span className="mt-1 block text-sm font-semibold text-mata">{comparacao}</span>
        <span className="mt-2 block text-sm leading-snug text-pedra">{nota}</span>
      </dd>
    </div>
  );
}

/** Mapa de calor em um tom só: a intensidade é a fração da linha (de cada status real). */
function MatrizConfusao({ m }: { m: MetricasModelo }) {
  const { classes } = m;
  const matriz = m.implantado.matriz;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-sm">
        <caption className="sr-only">Matriz de confusão do modelo em uso: linhas são o status real, colunas o previsto</caption>
        <thead>
          <tr>
            <th className="w-28" />
            {classes.map((c) => (
              <th key={c} scope="col" className="pb-1 text-center text-xs font-semibold text-pedra">
                previu {rotuloStatus(c as Status).toLowerCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matriz.map((linha, i) => {
            const total = linha.reduce((a, b) => a + b, 0) || 1;
            return (
              <tr key={classes[i]}>
                <th scope="row" className="pr-2 text-left text-xs font-semibold text-pedra">
                  era {rotuloStatus(classes[i] as Status).toLowerCase()}
                </th>
                {linha.map((n, j) => {
                  const f = n / total;
                  const forte = f >= 0.45;
                  return (
                    <td
                      key={j}
                      title={`Era ${rotuloStatus(classes[i] as Status).toLowerCase()}, previu ${rotuloStatus(classes[j] as Status).toLowerCase()}: ${n} casos (${pct(f)} da linha)`}
                      className={cn("h-16 rounded-md text-center align-middle", forte ? "text-sobre-mata" : "text-grafite")}
                      style={{ background: `color-mix(in oklab, var(--color-mata) ${Math.round(8 + f * 82)}%, var(--color-superficie))` }}
                    >
                      <span className="block text-base font-bold tabular-nums">{pct(f)}</span>
                      <span className={cn("block text-xs tabular-nums", forte ? "opacity-90" : "text-pedra")}>{n} casos</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Barras horizontais ordenadas, um tom só, valor na ponta. */
function Importancias({ m }: { m: MetricasModelo }) {
  const max = Math.max(...m.importancias.map((i) => i.valor));
  return (
    <ul className="mt-4 space-y-3">
      {m.importancias.map((i) => (
        <li key={i.feature} title={`${i.nome}: ${pct(i.valor)} das decisões`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-grafite">{i.nome}</span>
            <span className="font-semibold text-grafite tabular-nums">{pct(i.valor)}</span>
          </div>
          <div className="mt-1 h-3 rounded-r-[4px] bg-secondary">
            <div className="h-full animate-cresce rounded-r-[4px] bg-mata" style={{ width: `${(i.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
