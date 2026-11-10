"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Volume2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type {
  AlunoPublico,
  DisciplinaPublica,
  Pergunta,
  ResultadoResposta,
  ResultadoSessao,
  TurmaPublica,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { extrairLacuna, fraseCompleta } from "@/lib/lacuna";
import { extrairTocar } from "@/lib/tocar";
import { Sabia } from "@/components/marca";
import { VoltarAluno } from "@/components/voltar";
import { BotaoTema } from "@/components/tema";
import { BotaoGrande, classesBotaoGrande } from "./botao-grande";
import { CartaoDisciplina, IconeDisciplina } from "./disciplinas";
import { EntradaPin } from "./entrada-pin";
import { QuestaoLacuna } from "./questao-lacuna";
import { QuestaoTocar } from "./questao-tocar";
import { Brilhos, Estrela, TrilhaProgresso, type Marco } from "./trilha-progresso";

// `acesso` é a credencial devolvida pelo PIN; sem ela o backend não abre sessão.
type Etapa =
  | { tipo: "quem" }
  | { tipo: "pin"; aluno: AlunoPublico }
  | { tipo: "disciplina"; aluno: AlunoPublico; acesso: string }
  | { tipo: "inicio"; aluno: AlunoPublico; acesso: string; disciplina: DisciplinaPublica }
  | {
      tipo: "pergunta";
      aluno: AlunoPublico;
      acesso: string;
      disciplina: DisciplinaPublica;
      sessaoId: string;
      perguntas: Pergunta[];
    }
  | { tipo: "fim"; aluno: AlunoPublico; acesso: string; resultado: ResultadoSessao; marcos: Marco[] };

const CORES_AVATAR = ["bg-broto", "bg-sol", "bg-coral", "bg-[#4bb3e6]", "bg-[#9b7fe6]"];

export function Jornada({ turma }: { turma: TurmaPublica }) {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "quem" });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function comecar(aluno: AlunoPublico, acesso: string, disciplina: DisciplinaPublica) {
    setCarregando(true);
    setErro(null);
    try {
      const sessao = await api.iniciarSessao(turma.codigo, aluno.id, { acesso, disciplinaId: disciplina.id });
      setEtapa({ tipo: "pergunta", aluno, acesso, disciplina, sessaoId: sessao.sessaoId, perguntas: sessao.perguntas });
    } catch (e) {
      // PIN trocado pelo professor no meio do caminho: pede o número de novo.
      if (e instanceof ApiError && e.status === 401) setEtapa({ tipo: "pin", aluno });
      // 503 traz o motivo (ex.: na demonstração sem backend, turma sem atividades): tentar
      // de novo não adianta, então mostramos o motivo em vez de "aperte de novo".
      else if (e instanceof ApiError && e.status === 503 && e.message) setErro(e.message);
      else setErro("A trilha não carregou. Aperte o botão de novo.");
    } finally {
      setCarregando(false);
    }
  }

  if (etapa.tipo === "quem") {
    return (
      <Tela key={etapa.tipo} voltar={<VoltarAluno href="/aluno" rotulo="Voltar e trocar o código da turma" />}>
        <div className="flex items-center gap-4">
          <Sabia humor="pensando" className="size-20 shrink-0" />
          <h1 className="font-display text-4xl leading-none font-extrabold text-grafite">Quem é você?</h1>
        </div>
        <p className="mt-2 font-display text-lg text-pedra">Turma {turma.nome}</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {turma.alunos.map((a, i) => (
            <li
              key={a.id}
              className="animate-in fade-in zoom-in-95 fill-mode-backwards duration-300"
              style={{ animationDelay: `${80 + i * 30}ms` }}
            >
              <button
                onClick={() => setEtapa({ tipo: "pin", aluno: a })}
                className="flex w-full flex-col items-center gap-2 rounded-2xl bg-superficie p-4 shadow-[0_4px_0_var(--color-ceu-forte)] ring-2 ring-ceu-forte transition-[transform,box-shadow] duration-150 outline-none hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--color-ceu-forte)] focus-visible:ring-4 focus-visible:ring-grafite/40 active:translate-y-1 active:shadow-none active:duration-75"
              >
                <span
                  className={cn(
                    "grid size-14 place-items-center rounded-full font-display text-3xl font-extrabold text-white",
                    CORES_AVATAR[i % CORES_AVATAR.length],
                  )}
                  aria-hidden
                >
                  {a.nome[0]}
                </span>
                <span className="font-display text-xl leading-tight font-bold text-grafite">{a.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      </Tela>
    );
  }

  if (etapa.tipo === "pin") {
    return (
      <ConfirmarPin
        aluno={etapa.aluno}
        onEntrar={(acesso) => setEtapa({ tipo: "disciplina", aluno: etapa.aluno, acesso })}
        onVoltar={() => setEtapa({ tipo: "quem" })}
      />
    );
  }

  if (etapa.tipo === "disciplina") {
    const primeiroNome = etapa.aluno.nome.split(" ")[0];
    return (
      <Tela key={etapa.tipo} voltar={<VoltarAluno onClick={() => setEtapa({ tipo: "quem" })} rotulo="Voltar para a lista de nomes" />}>
        <div className="flex items-center gap-4">
          <Sabia humor="feliz" className="size-20 shrink-0" />
          <h1 className="font-display text-4xl leading-none font-extrabold text-grafite">
            O que vamos estudar, {primeiroNome}?
          </h1>
        </div>
        {turma.disciplinas.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-superficie px-5 py-4 font-display text-xl font-semibold text-grafite">
            Seu professor ainda não liberou nenhuma matéria. Volte daqui a pouco!
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {turma.disciplinas.map((d, i) => (
              <li
                key={d.id}
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards duration-300"
                style={{ animationDelay: `${80 + i * 60}ms` }}
              >
                <CartaoDisciplina
                  disciplina={d}
                  onEscolher={() => setEtapa({ tipo: "inicio", aluno: etapa.aluno, acesso: etapa.acesso, disciplina: d })}
                />
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setEtapa({ tipo: "quem" })}
          className="mx-auto mt-8 rounded-lg px-3 py-2 font-display text-lg font-semibold text-pedra underline-offset-4 hover:underline"
        >
          Não sou {primeiroNome}
        </button>
      </Tela>
    );
  }

  if (etapa.tipo === "inicio") {
    return (
      <Tela key={etapa.tipo}
        centro
        voltar={
          <VoltarAluno
            onClick={() => setEtapa({ tipo: "disciplina", aluno: etapa.aluno, acesso: etapa.acesso })}
            rotulo="Voltar e escolher outra matéria"
          />
        }
      >
        <div className="relative">
          <Sabia humor="feliz" className="size-40" />
          <IconeDisciplina id={etapa.disciplina.id} className="absolute -right-6 -bottom-2 size-16 -rotate-6" />
        </div>
        <h1 className="mt-4 font-display text-5xl leading-[0.95] font-extrabold text-grafite">
          Vamos de {etapa.disciplina.nome}!
        </h1>
        <p className="mt-3 max-w-[24ch] font-display text-2xl font-medium text-pedra">
          Hoje a trilha tem algumas perguntas. Vamos juntos?
        </p>
        {erro && (
          <p role="alert" className="mt-4 rounded-xl bg-coral-claro px-4 py-2 font-display text-lg text-grafite">
            {erro}
          </p>
        )}
        <BotaoGrande className="mt-8 w-full max-w-xs" disabled={carregando} onClick={() => comecar(etapa.aluno, etapa.acesso, etapa.disciplina)}>
          {carregando ? "Abrindo…" : "Começar"}
        </BotaoGrande>
        <button
          onClick={() => setEtapa({ tipo: "disciplina", aluno: etapa.aluno, acesso: etapa.acesso })}
          className="mt-5 rounded-lg px-3 py-2 font-display text-lg font-semibold text-pedra underline-offset-4 hover:underline"
        >
          Escolher outra matéria
        </button>
      </Tela>
    );
  }

  if (etapa.tipo === "pergunta") {
    return (
      <Quiz
        sessaoId={etapa.sessaoId}
        perguntas={etapa.perguntas}
        onSair={() => setEtapa({ tipo: "disciplina", aluno: etapa.aluno, acesso: etapa.acesso })}
        onFim={(resultado, marcos) =>
          setEtapa({ tipo: "fim", aluno: etapa.aluno, acesso: etapa.acesso, resultado, marcos })
        }
      />
    );
  }

  return (
    <Tela key={etapa.tipo}
      centro
      voltar={
        <VoltarAluno
          onClick={() => setEtapa({ tipo: "disciplina", aluno: etapa.aluno, acesso: etapa.acesso })}
          rotulo="Voltar para as matérias"
        />
      }
    >
      <TrilhaProgresso marcos={etapa.marcos} atual={etapa.marcos.length} comemorando className="mb-10 max-w-md" />
      <Sabia humor="festa" className="size-36 animate-pulo" />
      <h1 className="mt-4 max-w-[16ch] font-display text-4xl leading-none font-extrabold text-grafite sm:text-5xl">
        {etapa.resultado.mensagem}
      </h1>
      <div className="mt-6 flex flex-wrap justify-center gap-1" aria-label={`${etapa.resultado.estrelas} estrelas de ${etapa.resultado.total}`}>
        {Array.from({ length: etapa.resultado.total }, (_, i) => (
          <span
            key={i}
            // As estrelas ganhas "acendem" uma de cada vez, depois que a tela aparece.
            className={cn(
              "grid size-12 place-items-center rounded-full animate-in zoom-in-50 fade-in fill-mode-backwards duration-300",
              i < etapa.resultado.estrelas ? "bg-sol" : "bg-superficie",
            )}
            style={{ animationDelay: `${300 + i * 120}ms` }}
          >
            <Estrela className="size-7" apagada={i >= etapa.resultado.estrelas} />
          </span>
        ))}
      </div>
      <p className="mt-3 font-display text-2xl font-bold text-grafite">
        {etapa.resultado.estrelas} {etapa.resultado.estrelas === 1 ? "estrela" : "estrelas"}
      </p>
      <Link href="/aluno" className={classesBotaoGrande("broto", "mt-8 w-full max-w-xs")}>
        Terminar
      </Link>
      <BotaoGrande
        cor="branco"
        className="mt-4 w-full max-w-xs"
        onClick={() => setEtapa({ tipo: "disciplina", aluno: etapa.aluno, acesso: etapa.acesso })}
      >
        Outra matéria
      </BotaoGrande>
    </Tela>
  );
}

type ErroPin = "errado" | "bloqueado" | "rede" | null;

const MENSAGENS_PIN: Record<Exclude<ErroPin, null>, string> = {
  errado: "Esse não é o seu número secreto. Tente de novo!",
  bloqueado: "Foram muitas tentativas. Espere um minutinho ou chame seu professor para ajudar.",
  rede: "Não deu para conferir agora. Digite de novo.",
};

function ConfirmarPin({
  aluno,
  onEntrar,
  onVoltar,
}: {
  aluno: AlunoPublico;
  onEntrar: (acesso: string) => void;
  onVoltar: () => void;
}) {
  const [conferindo, setConferindo] = useState(false);
  const [erroPin, setErroPin] = useState<ErroPin>(null);
  const [tentativa, setTentativa] = useState(0);
  const primeiroNome = aluno.nome.split(" ")[0];

  async function conferir(pin: string) {
    setConferindo(true);
    setErroPin(null);
    try {
      const r = await api.validarPin(aluno.id, pin);
      if (r.valido && r.acesso) return onEntrar(r.acesso);
      setErroPin(r.bloqueado ? "bloqueado" : "errado");
    } catch {
      setErroPin("rede");
    }
    setTentativa((t) => t + 1);
    setConferindo(false);
  }

  return (
    <Tela centro voltar={<VoltarAluno onClick={onVoltar} rotulo="Voltar para a lista de nomes" />}>
      <Sabia humor={erroPin ? "triste" : "pensando"} className="size-24" />
      <h1 className="mt-3 font-display text-4xl leading-none font-extrabold text-grafite">Oi, {primeiroNome}!</h1>
      <p className="mt-2 max-w-[22ch] font-display text-2xl font-medium text-pedra">Digite o seu número secreto.</p>

      <div className="mt-6 flex w-full justify-center">
        <EntradaPin key={tentativa} onCompleto={conferir} desabilitado={conferindo} errou={!!erroPin} />
      </div>

      <p role="alert" className="mt-5 min-h-8 max-w-sm font-display text-xl font-semibold text-grafite">
        {conferindo ? "Conferindo…" : erroPin && <span className="inline-block rounded-xl bg-coral-claro px-4 py-2">{MENSAGENS_PIN[erroPin]}</span>}
      </p>

      <button
        onClick={onVoltar}
        className="mt-2 rounded-lg px-3 py-2 font-display text-lg font-semibold text-pedra underline-offset-4 hover:underline"
      >
        Não sou {primeiroNome}
      </button>
    </Tela>
  );
}

function Tela({ children, centro, voltar }: { children: React.ReactNode; centro?: boolean; voltar?: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col bg-ceu px-4 pt-4 pb-8">
      <div className="mx-auto mb-2 flex w-full max-w-xl items-center justify-between">
        {voltar ?? <span />}
        <BotaoTema variante="aluno" />
      </div>
      <div
        className={cn(
          "mx-auto flex w-full max-w-xl flex-1 flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out",
          centro && "items-center justify-center text-center",
        )}
      >
        {children}
      </div>
    </main>
  );
}

// Quem confere as respostas: a API de verdade, ou um substituto (página de prévia).
type ClienteSessao = Pick<typeof api, "responder" | "concluirSessao">;

export function Quiz({
  sessaoId,
  perguntas,
  onSair,
  onFim,
  cliente = api,
}: {
  sessaoId: string;
  perguntas: Pergunta[];
  onSair: () => void;
  onFim: (r: ResultadoSessao, marcos: Marco[]) => void;
  cliente?: ClienteSessao;
}) {
  // A lista começa como veio da sessão; a adaptação de dificuldade (backend/mock) pode
  // trocar a próxima pergunta a cada resposta, via `proxima`.
  const [lista, setLista] = useState(perguntas);
  const [indice, setIndice] = useState(0);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoResposta | null>(null);
  const [marcos, setMarcos] = useState<Marco[]>(() => perguntas.map(() => "pendente"));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const fala = useFala();
  // Só pede confirmação se já respondeu alguma coisa: antes disso, voltar não perde nada.
  const comecou = marcos.some((m) => m !== "pendente");

  const pergunta = lista[indice];
  const estrelas = marcos.filter((m) => m === "acerto").length;
  const curtas = pergunta.opcoes.every((o) => o.texto.length <= 8);
  // Frase com buraco vira peça de encaixar; texto cujas opções são palavras dele vira
  // "toque na palavra"; o resto continua múltipla escolha.
  const lacuna = extrairLacuna(pergunta);
  const tocar = lacuna ? null : extrairTocar(pergunta);
  const enunciado = lacuna?.instrucao ?? tocar?.instrucao ?? pergunta.enunciado;
  const paraOuvir = lacuna ? `${lacuna.instrucao} ${fraseCompleta(lacuna, undefined, "…")}` : pergunta.enunciado;

  const { parar } = fala;
  useEffect(() => () => parar(), [indice, parar]);

  async function conferir() {
    if (!escolha) return;
    setEnviando(true);
    setErro(false);
    try {
      const r = await cliente.responder(sessaoId, pergunta.id, escolha);
      setResultado(r);
      setMarcos((ms) => ms.map((m, i) => (i === indice ? (r.correta ? "acerto" : "erro") : m)));
      const proxima = r.proxima;
      if (proxima && indice + 1 < lista.length) setLista((l) => l.map((p, i) => (i === indice + 1 ? proxima : p)));
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  async function continuar() {
    if (indice + 1 < perguntas.length) {
      setIndice(indice + 1);
      setEscolha(null);
      setResultado(null);
      return;
    }
    setEnviando(true);
    try {
      onFim(await cliente.concluirSessao(sessaoId), marcos);
    } catch {
      setErro(true);
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-ceu">
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-4">
        <button
          onClick={() => (comecou ? setConfirmarSaida(true) : onSair())}
          aria-label="Voltar para as matérias"
          title="Voltar para as matérias"
          className="grid size-11 shrink-0 place-items-center rounded-full text-pedra outline-none hover:bg-superficie/70 focus-visible:ring-4 focus-visible:ring-grafite/30"
        >
          <ArrowLeft className="size-7" strokeWidth={3} />
        </button>
        <TrilhaProgresso
          marcos={marcos}
          atual={resultado ? indice + 1 : indice}
          comemorando={resultado?.correta}
          className="mt-6"
        />
        <span
          className="flex shrink-0 items-center gap-1 rounded-full bg-superficie px-3 py-1 font-display text-xl font-bold text-grafite"
          aria-label={`${estrelas} estrelas`}
        >
          <span className="grid size-6 place-items-center rounded-full bg-sol">
            <Estrela className="size-4" />
          </span>
          {estrelas}
        </span>
      </header>

      {/* A chave troca a cada pergunta: o conteúdo novo entra deslizando da direita,
          como quem anda mais um passo na trilha. */}
      <section
        key={indice}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-6 pb-56 animate-in fade-in slide-in-from-right-8 duration-300 ease-out"
      >
        <div className="flex items-start gap-3">
          <span key={resultado ? (resultado.correta ? "festa" : "triste") : "pensando"} className={cn("shrink-0", resultado?.correta && "animate-pulo")}>
            <Sabia humor={resultado ? (resultado.correta ? "festa" : "triste") : "pensando"} className="size-20" />
          </span>
          <div className="relative flex-1 rounded-2xl bg-superficie p-4 shadow-[0_4px_0_var(--color-ceu-forte)]">
            <span className="absolute top-6 -left-2 size-4 rotate-45 bg-superficie" aria-hidden />
            <h1 className="relative font-display text-2xl leading-snug font-bold text-grafite sm:text-[1.75rem]">
              {enunciado}
            </h1>
            {fala.disponivel && (
              <button
                onClick={() => fala.falar(paraOuvir)}
                className="relative mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 font-display text-lg font-semibold text-agua outline-none hover:bg-ceu focus-visible:ring-4 focus-visible:ring-agua/30"
              >
                <Volume2 className="size-5" strokeWidth={2.5} />
                Ouvir
              </button>
            )}
          </div>
        </div>

        {pergunta.apoio && (
          <p className="mt-6 rounded-2xl bg-superficie/60 px-4 py-5 text-center text-4xl leading-relaxed tracking-wide" aria-hidden>
            {pergunta.apoio}
          </p>
        )}

        {lacuna ? (
          <QuestaoLacuna
            key={pergunta.id}
            lacuna={lacuna}
            opcoes={pergunta.opcoes}
            escolha={escolha}
            onEscolher={setEscolha}
            resultado={resultado}
          />
        ) : tocar ? (
          <QuestaoTocar tocar={tocar} escolha={escolha} onEscolher={setEscolha} resultado={resultado} />
        ) : (
        <div
          role="radiogroup"
          aria-label="Respostas"
          className={cn("mt-6 grid gap-3", curtas ? "grid-cols-2" : "grid-cols-1")}
        >
          {pergunta.opcoes.map((o, i) => {
            const marcada = escolha === o.id;
            const certa = resultado?.opcaoCorretaId === o.id;
            const errada = resultado && marcada && !resultado.correta;
            return (
              <button
                key={o.id}
                role="radio"
                aria-checked={marcada}
                disabled={!!resultado}
                onClick={() => setEscolha(o.id)}
                // As opções chegam uma depois da outra (só na entrada da pergunta).
                style={resultado ? undefined : { animationDelay: `${120 + i * 50}ms` }}
                className={cn(
                  "relative min-h-16 rounded-2xl border-[3px] bg-superficie px-4 py-3 font-display font-bold text-grafite outline-none",
                  "transition-[transform,box-shadow,background-color,border-color] duration-75 focus-visible:ring-4 focus-visible:ring-grafite/30",
                  curtas ? "text-4xl" : "text-left text-2xl leading-tight",
                  !resultado && "animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards duration-300 active:translate-y-1 active:shadow-none",
                  marcada && !resultado
                    ? "border-agua bg-agua-clara shadow-[0_4px_0_var(--color-agua)]"
                    : "border-ceu-forte shadow-[0_4px_0_var(--color-ceu-forte)]",
                  certa && "border-broto bg-broto-clara shadow-[0_4px_0_var(--color-broto-escuro)]",
                  // Acertou: a certa "pula". Errou: ela pula um instante depois do balanço da
                  // errada, para levar o olho até a resposta.
                  certa && (resultado?.correta ? "animate-estoura" : "animate-estoura [animation-delay:450ms]"),
                  errada && "animate-balanca border-coral bg-coral-claro shadow-[0_4px_0_var(--color-coral-escuro)]",
                  resultado && !certa && !errada && "opacity-50",
                )}
              >
                {o.texto}
                {certa && resultado?.correta && <Brilhos />}
              </button>
            );
          })}
        </div>
        )}
      </section>

      <footer
        className={cn(
          "fixed inset-x-0 bottom-0 border-t-2 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          !resultado && "border-ceu-forte bg-ceu",
          resultado?.correta && "animate-sobe border-broto bg-broto-clara",
          resultado && !resultado.correta && "animate-sobe border-coral bg-coral-claro",
        )}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {resultado && (
            <p role="status" className="font-display text-2xl font-extrabold text-grafite">
              {resultado.mensagem}
            </p>
          )}
          {erro && !resultado && (
            <p role="alert" className="font-display text-lg font-semibold text-grafite">
              Não deu para conferir agora. Aperte de novo.
            </p>
          )}
          {resultado ? (
            <BotaoGrande
              cor={resultado.correta ? "broto" : "coral"}
              onClick={continuar}
              disabled={enviando}
              autoFocus
              className="sm:min-w-56"
            >
              {indice + 1 < perguntas.length ? "Continuar" : "Ver resultado"}
            </BotaoGrande>
          ) : (
            <BotaoGrande onClick={conferir} disabled={!escolha || enviando} className="w-full sm:ml-auto sm:w-auto sm:min-w-56">
              {enviando ? "Conferindo…" : "Conferir"}
            </BotaoGrande>
          )}
        </div>
      </footer>

      {confirmarSaida && <ConfirmarSaida onFicar={() => setConfirmarSaida(false)} onSair={onSair} />}
    </main>
  );
}

/** "Quer mesmo sair?" — evita perder a rodada com um toque sem querer na seta. */
function ConfirmarSaida({ onFicar, onSair }: { onFicar: () => void; onSair: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFicar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFicar]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-grafite/40 px-4 animate-in fade-in duration-150">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sair-titulo"
        aria-describedby="sair-texto"
        className="w-full max-w-sm rounded-3xl bg-superficie p-6 text-center shadow-[0_6px_0_var(--color-ceu-forte)] animate-in zoom-in-95 duration-200"
      >
        <Sabia humor="pensando" className="mx-auto size-20" />
        <h2 id="sair-titulo" className="mt-2 font-display text-3xl leading-tight font-extrabold text-grafite">
          Quer sair da trilha?
        </h2>
        <p id="sair-texto" className="mt-2 font-display text-xl text-pedra">
          Esta rodada fica pela metade. Você pode começar outra depois.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <BotaoGrande onClick={onFicar} autoFocus>
            Continuar a trilha
          </BotaoGrande>
          <BotaoGrande cor="branco" onClick={onSair}>
            Sair
          </BotaoGrande>
        </div>
      </div>
    </div>
  );
}

const assinarNada = () => () => {};

/** Leitura em voz alta, para quem ainda está ganhando fluência na leitura. */
function useFala() {
  const disponivel = useSyncExternalStore(
    assinarNada,
    () => "speechSynthesis" in window,
    () => false,
  );
  const [fala] = useState(() => ({
    falar(texto: string) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "pt-BR";
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    },
    parar() {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
  }));
  return { disponivel, ...fala };
}
