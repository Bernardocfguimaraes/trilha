import Link from "next/link";
import { BookOpenCheck, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo, Sabia, StatusSelo } from "@/components/marca";
import { classesBotaoGrande } from "@/components/aluno/botao-grande";
import { TrilhaProgresso } from "@/components/aluno/trilha-progresso";
import { DemoQuestao } from "@/components/home/demo-questao";
import { BotaoTema } from "@/components/tema";
import { cn } from "@/lib/utils";

// Página inicial. Uma ideia só a carrega: a trilha pontilhada (a mesma do logo), que
// atravessa a página e liga o que a criança faz ao que o adulto vê.

const PASSOS = [
  {
    titulo: "A criança faz a trilha do dia",
    texto:
      "Seis perguntas curtas por vez, que ficam mais fáceis ou mais difíceis conforme ela responde. Dá para ouvir cada enunciado em voz alta.",
  },
  {
    titulo: "O diagnóstico mostra onde ela trava",
    texto:
      "Um modelo olha a evolução de cada habilidade, não só a média, e marca o que está em dia, pede atenção ou está em alerta.",
  },
  {
    titulo: "Quem acompanha sabe o que fazer",
    texto:
      "O professor recebe recomendações e exercícios de reforço para a turma. A família vê o progresso do filho e ideias para casa.",
  },
];

const CUIDADOS = [
  {
    icone: KeyRound,
    texto: "Crianças não criam conta nem usam e-mail: entram com o código da turma e um PIN de 4 números.",
  },
  { icone: ShieldCheck, texto: "Cada responsável vê só o próprio filho. A turma e os PINs ficam com o professor." },
  { icone: LockKeyhole, texto: "O painel da turma só abre com o login e a senha do professor." },
  {
    icone: BookOpenCheck,
    texto: "Conteúdo alinhado à BNCC, com as questões revisadas por pessoas antes de chegar ao aluno.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-papel">
      <Cabecalho />

      <main className="flex-1">
        <Hero />
        <ComoFunciona />
        <ParaQuem />
        <Cuidados />
        <Chamada />
      </main>

      <Rodape />
    </div>
  );
}

function Cabecalho() {
  return (
    <header className="bg-ceu">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Trilha, página inicial" className="rounded-md text-grafite outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo vibrante />
        </Link>
        <nav aria-label="Seções" className="ml-6 hidden items-center gap-1 text-[0.95rem] font-semibold text-pedra lg:flex">
          {[
            ["#como-funciona", "Como funciona"],
            ["#professores", "Professores"],
            ["#familias", "Famílias"],
          ].map(([href, rotulo]) => (
            <a key={href} href={href} className="rounded-md px-3 py-2 outline-none hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50">
              {rotulo}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <BotaoTema />
          <Link
            href="/entrar"
            className="hidden rounded-md px-3 py-2 text-[0.95rem] font-semibold text-grafite outline-none hover:bg-superficie/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:block"
          >
            Entrar como professor
          </Link>
          <Link
            href="/aluno"
            className="inline-flex h-10 items-center rounded-xl bg-broto px-4 font-display text-lg font-bold text-white shadow-[0_4px_0_var(--color-broto-escuro)] outline-none transition-[transform,box-shadow] duration-75 focus-visible:ring-4 focus-visible:ring-grafite/30 active:translate-y-1 active:shadow-none"
          >
            Sou aluno
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-ceu">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-24 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16 lg:pb-32">
        <div>
          <h1 className="max-w-[13ch] animate-in fade-in slide-in-from-bottom-3 font-display text-[2.9rem] leading-[0.95] font-extrabold tracking-tight text-grafite duration-500 sm:text-6xl lg:text-[4.25rem]">
            Cada criança no seu passo.
          </h1>
          <p
            className="mt-6 max-w-[46ch] animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards text-lg leading-relaxed text-pedra duration-500 sm:text-xl"
            style={{ animationDelay: "90ms" }}
          >
            Atividades curtas e interativas para o ensino fundamental, alinhadas à BNCC. A criança aprende brincando, o
            professor vê onde a turma trava e a família acompanha o próprio filho.
          </p>
          <div
            className="mt-9 flex animate-in flex-wrap items-center gap-4 fade-in slide-in-from-bottom-3 fill-mode-backwards duration-500"
            style={{ animationDelay: "180ms" }}
          >
            <Link href="/aluno" className={classesBotaoGrande("broto", "min-w-44")}>
              Sou aluno
            </Link>
            <Link href="/entrar" className={classesBotaoGrande("branco", "min-w-44")}>
              Sou professor
            </Link>
          </div>
          <p
            className="mt-5 animate-in fade-in fill-mode-backwards text-[0.95rem] text-pedra duration-500"
            style={{ animationDelay: "260ms" }}
          >
            É responsável?{" "}
            <Link href="/responsavel" className="font-semibold text-mata underline underline-offset-4 hover:no-underline">
              Veja o progresso do seu filho
            </Link>
          </p>
        </div>

        <div className="animate-in fade-in zoom-in-95 fill-mode-backwards duration-500 lg:justify-self-end" style={{ animationDelay: "140ms" }}>
          <div className="w-full max-w-md">
            <DemoQuestao />
            <p className="mt-4 px-2 text-sm text-pedra">Uma das perguntas da trilha. Experimente.</p>
          </div>
        </div>
      </div>

      {/* A trilha sai do topo e desce para o resto da página. */}
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-papel"
        aria-hidden
      >
        <path d="M0 70 C200 120 380 20 600 60 S1000 120 1200 50 V120 H0 Z" fill="currentColor" />
        <path
          d="M0 70 C200 120 380 20 600 60 S1000 120 1200 50"
          fill="none"
          stroke="var(--color-broto)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="0.5 18"
        />
      </svg>
    </section>
  );
}

function ComoFunciona() {
  return (
    <section id="como-funciona" className="scroll-mt-6 bg-papel">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8 lg:py-24">
        <h2 className="font-display text-4xl leading-tight font-extrabold text-grafite sm:text-5xl">Como funciona</h2>
        <p className="mt-3 max-w-[55ch] text-lg text-pedra">
          Do toque da criança à conversa com a família, tudo acontece em três passos.
        </p>

        <ol className="relative mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          {/* A trilha que liga os marcos (só em telas largas, onde eles ficam lado a lado). */}
          <svg
            viewBox="0 0 1000 60"
            preserveAspectRatio="none"
            className="pointer-events-none absolute top-0 left-[8%] hidden h-14 w-[84%] md:block"
            aria-hidden
          >
            <path
              d="M0 28 C150 -10 300 66 500 28 S850 -10 1000 28"
              fill="none"
              stroke="var(--color-ceu-forte)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="0.5 16"
            />
          </svg>
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="relative">
              <span
                className={cn(
                  "relative grid size-14 place-items-center rounded-full font-display text-2xl font-extrabold",
                  i === 0 && "bg-broto text-white shadow-[0_4px_0_var(--color-broto-escuro)]",
                  i === 1 && "bg-sol text-tinta shadow-[0_4px_0_var(--color-sol-escuro)]",
                  i === 2 && "bg-coral text-white shadow-[0_4px_0_var(--color-coral-escuro)]",
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <h3 className="mt-6 font-display text-2xl leading-tight font-bold text-grafite">{p.titulo}</h3>
              <p className="mt-2 max-w-[38ch] leading-relaxed text-pedra">{p.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ParaQuem() {
  return (
    <section aria-label="Para quem é a Trilha" className="bg-superficie">
      <div className="mx-auto max-w-6xl divide-y px-4 sm:px-8">
        <Linha
          id="alunos"
          titulo="Para alunos: aprender brincando"
          texto="Peças para arrastar até a frase, palavras para tocar no texto, estrelas a cada acerto e o Sabiá acompanhando o caminho. Quando erra, a criança vê a resposta certa na hora."
        >
          <div className="w-full max-w-sm rounded-[1.5rem] bg-ceu px-5 pt-3 pb-6">
            <TrilhaProgresso marcos={["acerto", "acerto", "erro", "acerto", "pendente", "pendente"]} atual={4} className="mt-8" />
            <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
              {["Complete a frase", "Toque na palavra", "Escolha a resposta"].map((t) => (
                <span key={t} className="rounded-xl bg-superficie px-3 py-1.5 font-display text-base font-bold text-grafite shadow-[0_3px_0_var(--color-ceu-forte)]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Linha>

        <Linha
          id="professores"
          titulo="Para professores: a turma num olhar"
          texto="Um cartão por aluno, com uma barra por disciplina e um traço por habilidade da BNCC. Pergunte sobre a turma em texto ou por voz e gere exercícios de reforço no nível certo."
          inverter
        >
          <div className="w-full max-w-sm rounded-xl border border-l-4 border-l-alerta bg-superficie p-5 shadow-[0_8px_24px_rgb(30_42_37/0.08)]" aria-hidden>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-grafite">Bruno Ferreira</p>
                <p className="text-sm text-pedra">Última atividade em 13 de out</p>
              </div>
              <StatusSelo status="alerta" className="text-xs" />
            </div>
            <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 text-sm">
              {[
                ["Matemática", ["ok", "alerta", "alerta", "alerta"]],
                ["Português", ["ok", "ok", "ok", "ok", "nova", "nova", "ok", "nova"]],
                ["Ciências", ["atencao", "ok"]],
              ].map(([nome, segs]) => (
                <div key={nome as string} className="contents">
                  <span className="font-medium text-grafite">{nome as string}</span>
                  <span className="flex h-2.5 gap-[3px]">
                    {(segs as string[]).map((s, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-full flex-1 rounded-sm",
                          s === "ok" && "bg-mata",
                          s === "atencao" && "bg-atencao",
                          s === "alerta" && "bg-alerta",
                          s === "nova" && "bg-border",
                        )}
                      />
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-3">
              {["Multiplicação", "Frações simples"].map((t) => (
                <span key={t} className="rounded-md bg-alerta-clara px-2 py-0.5 text-xs font-medium text-alerta">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Linha>

        <Linha
          id="familias"
          titulo="Para famílias: o seu filho, e só ele"
          texto="Com o código da turma e o PIN da criança, sem criar conta, você vê em que ponto do caminho ela está e recebe sugestões simples para apoiar em casa."
        >
          <div className="w-full max-w-sm space-y-3" aria-hidden>
            <div className="rounded-xl border bg-superficie p-5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold text-grafite">Português, 4º ano</p>
                <p className="text-sm text-pedra tabular-nums">12 de 35</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-[34%] rounded-full bg-mata" />
              </div>
              <p className="mt-3 text-sm text-pedra">Agora</p>
              <p className="text-sm font-semibold text-grafite">Informações implícitas</p>
            </div>
            <div className="rounded-xl border border-l-4 border-l-atencao bg-superficie p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-grafite">Frações simples</p>
                <StatusSelo status="atencao" className="text-xs" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-grafite">
                Divida uma pizza ou um bolo em partes iguais e conversem sobre metade, terço e quarto.
              </p>
            </div>
          </div>
        </Linha>
      </div>
    </section>
  );
}

function Linha({
  id,
  titulo,
  texto,
  inverter,
  children,
}: {
  id: string;
  titulo: string;
  texto: string;
  inverter?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="grid scroll-mt-6 items-center gap-10 py-16 md:grid-cols-2 md:gap-16 lg:py-20">
      <div className={cn(inverter && "md:order-2")}>
        <h2 className="max-w-[18ch] font-display text-3xl leading-tight font-extrabold text-grafite sm:text-4xl">{titulo}</h2>
        <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-pedra">{texto}</p>
      </div>
      <div className={cn("flex justify-center", inverter ? "md:order-1 md:justify-start" : "md:justify-end")}>{children}</div>
    </div>
  );
}

function Cuidados() {
  return (
    <section className="bg-papel">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-24">
        <div>
          <h2 className="max-w-[16ch] font-display text-4xl leading-tight font-extrabold text-grafite sm:text-5xl">
            Dados de criança tratados com cuidado
          </h2>
          <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-pedra">
            A Trilha foi pensada para a escola: cada pessoa vê só o que precisa para ajudar.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {CUIDADOS.map(({ icone: Icone, texto }) => (
            <li key={texto} className="flex gap-4 rounded-xl bg-superficie p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-mata-clara text-mata" aria-hidden>
                <Icone className="size-5" />
              </span>
              <p className="leading-relaxed text-grafite">{texto}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Chamada() {
  return (
    <section className="bg-ceu">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-20 text-center sm:px-8 md:flex-row md:text-left">
        <Sabia humor="feliz" className="size-28 shrink-0 sm:size-32" />
        <div className="flex-1">
          <h2 className="font-display text-4xl leading-tight font-extrabold text-grafite sm:text-5xl">Pronto para a trilha de hoje?</h2>
          <p className="mt-2 text-lg text-pedra">Digite o código que o professor passou para a turma.</p>
        </div>
        <form action="/aluno/entrar" className="flex w-full max-w-sm gap-3">
          <label htmlFor="codigo-home" className="sr-only">
            Código da turma
          </label>
          <input
            id="codigo-home"
            name="codigo"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={8}
            placeholder="ABC123"
            className="h-16 min-w-0 flex-1 rounded-2xl border-[3px] border-ceu-forte bg-superficie px-4 text-center font-display text-3xl font-extrabold tracking-[0.15em] text-grafite uppercase shadow-[0_5px_0_var(--color-ceu-forte)] outline-none placeholder:text-desligado-texto/60 focus:border-agua"
          />
          <button type="submit" className={classesBotaoGrande("broto", "px-6")}>
            Entrar
          </button>
        </form>
      </div>
    </section>
  );
}

function Rodape() {
  return (
    <footer className="border-t bg-papel">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo className="text-grafite" />
          <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-pedra">
            Atividades alinhadas à BNCC para o 4º, o 6º e o 8º ano, em seis matérias, com diagnóstico por habilidade para
            quem acompanha cada criança.
          </p>
        </div>
        <nav aria-label="Acessos" className="flex flex-wrap gap-x-10 gap-y-3 text-sm font-semibold">
          <Link href="/aluno" className="text-grafite hover:text-mata">
            Entrar como aluno
          </Link>
          <Link href="/entrar" className="text-grafite hover:text-mata">
            Entrar como professor
          </Link>
          <Link href="/responsavel" className="text-grafite hover:text-mata">
            Acompanhar meu filho
          </Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-pedra sm:px-8">© 2026 Trilha</p>
    </footer>
  );
}
