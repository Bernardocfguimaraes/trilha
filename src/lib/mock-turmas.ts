// Turmas extras do mock (além da turma de demonstração, que fica em mock.ts): a turma de
// teste do 8º ano e as turmas que o professor cria na demonstração sem backend. Só o lado
// do professor (cadastro, PINs, configuração, painel vazio) e o acesso do responsável; as
// atividades dos alunos dessas turmas precisam do backend.
import { ApiError } from "./api";
import oficialEf from "../../backend/app/bncc/oficial_ef.json";
import c04_his from "../../backend/app/bncc/caminhos/04-his.json";
import c04_por from "../../backend/app/bncc/caminhos/04-por.json";
import c05_cie from "../../backend/app/bncc/caminhos/05-cie.json";
import c05_geo from "../../backend/app/bncc/caminhos/05-geo.json";
import c05_his from "../../backend/app/bncc/caminhos/05-his.json";
import c05_mat from "../../backend/app/bncc/caminhos/05-mat.json";
import c05_por from "../../backend/app/bncc/caminhos/05-por.json";
import c06_cie from "../../backend/app/bncc/caminhos/06-cie.json";
import c06_geo from "../../backend/app/bncc/caminhos/06-geo.json";
import c06_his from "../../backend/app/bncc/caminhos/06-his.json";
import c06_ing from "../../backend/app/bncc/caminhos/06-ing.json";
import c06_mat from "../../backend/app/bncc/caminhos/06-mat.json";
import c06_por from "../../backend/app/bncc/caminhos/06-por.json";
import c07_cie from "../../backend/app/bncc/caminhos/07-cie.json";
import c07_geo from "../../backend/app/bncc/caminhos/07-geo.json";
import c07_his from "../../backend/app/bncc/caminhos/07-his.json";
import c07_ing from "../../backend/app/bncc/caminhos/07-ing.json";
import c07_mat from "../../backend/app/bncc/caminhos/07-mat.json";
import c07_por from "../../backend/app/bncc/caminhos/07-por.json";
import c08_cie from "../../backend/app/bncc/caminhos/08-cie.json";
import c08_geo from "../../backend/app/bncc/caminhos/08-geo.json";
import c08_his from "../../backend/app/bncc/caminhos/08-his.json";
import c08_ing from "../../backend/app/bncc/caminhos/08-ing.json";
import c08_mat from "../../backend/app/bncc/caminhos/08-mat.json";
import c08_por from "../../backend/app/bncc/caminhos/08-por.json";
import c09_cie from "../../backend/app/bncc/caminhos/09-cie.json";
import c09_geo from "../../backend/app/bncc/caminhos/09-geo.json";
import c09_his from "../../backend/app/bncc/caminhos/09-his.json";
import c09_ing from "../../backend/app/bncc/caminhos/09-ing.json";
import c09_mat from "../../backend/app/bncc/caminhos/09-mat.json";
import c09_por from "../../backend/app/bncc/caminhos/09-por.json";
import type {
  AlunoCadastro,
  AlunoDetalhe,
  AlunoResumo,
  AnoDisponivel,
  DisciplinaConfig,
  ProgressoCaminho,
  TurmaConfig,
  TurmaPublica,
  TurmaResumo,
} from "./types";

interface ArquivoCaminho {
  unidades: { nome: string; habilidades: { codigo: string; nome: string; avaliavel?: boolean }[] }[];
}

// Caminhos BNCC de todos os anos, pelo nome do arquivo (AA-disc), como no backend.
const CAMINHOS: Record<string, ArquivoCaminho> = {
  "04-his": c04_his,
  "04-por": c04_por,
  "05-cie": c05_cie,
  "05-geo": c05_geo,
  "05-his": c05_his,
  "05-mat": c05_mat,
  "05-por": c05_por,
  "06-cie": c06_cie,
  "06-geo": c06_geo,
  "06-his": c06_his,
  "06-ing": c06_ing,
  "06-mat": c06_mat,
  "06-por": c06_por,
  "07-cie": c07_cie,
  "07-geo": c07_geo,
  "07-his": c07_his,
  "07-ing": c07_ing,
  "07-mat": c07_mat,
  "07-por": c07_por,
  "08-cie": c08_cie,
  "08-geo": c08_geo,
  "08-his": c08_his,
  "08-ing": c08_ing,
  "08-mat": c08_mat,
  "08-por": c08_por,
  "09-cie": c09_cie,
  "09-geo": c09_geo,
  "09-his": c09_his,
  "09-ing": c09_ing,
  "09-mat": c09_mat,
  "09-por": c09_por,
};
const OFICIAL: Record<string, string> = oficialEf.habilidades;

export const DISCIPLINAS_TODAS = [
  { id: "por", nome: "Português" },
  { id: "mat", nome: "Matemática" },
  { id: "geo", nome: "Geografia" },
  { id: "cie", nome: "Ciências" },
  { id: "his", nome: "História" },
  { id: "ing", nome: "Inglês" },
];
const nomeDisciplina = (id: string) => DISCIPLINAS_TODAS.find((d) => d.id === id)!.nome;

// Catálogo — mesma montagem do backend (dados.py + catalogo.py): disciplina com caminho
// BNCC vem dos JSONs do backend; no 4º ano, Matemática, Geografia, Ciências e Inglês
// ainda usam o catálogo antigo, escrito à mão.
export interface HabilidadeCatalogo {
  id: string;
  codigoBncc: string | null;
  nome: string;
  disciplina: string;
  descricao: string;
  unidade: string | null;
  avaliavel: boolean; // false = "em sala": fica fora do quiz e do diagnóstico
}

const legado = (id: string, nome: string, disciplina: string, descricao: string): HabilidadeCatalogo => ({
  id, codigoBncc: null, nome, disciplina, descricao, unidade: null, avaliavel: true,
});

export const LEGADO: Record<string, HabilidadeCatalogo[]> = {
  mat: [
    legado("mat-adicao", "Adição e subtração", "Matemática", "Cálculos com números até 1.000, com e sem reagrupamento."),
    legado("mat-mult", "Multiplicação", "Matemática", "Tabuada e multiplicação por um algarismo."),
    legado("mat-fracoes", "Frações simples", "Matemática", "Metade, terço e quarto em situações do dia a dia."),
    legado("mat-problemas", "Resolução de problemas", "Matemática", "Interpretar o enunciado e escolher a operação."),
  ],
  geo: [
    legado("geo-orientacao", "Orientação e mapas", "Geografia", "Pontos cardeais, legenda e escala em mapas simples."),
    legado("geo-paisagem", "Paisagem e lugar", "Geografia", "Elementos naturais e construídos; campo e cidade."),
  ],
  cie: [
    legado("cie-seres-vivos", "Seres vivos", "Ciências", "Características de plantas e animais e cadeias alimentares."),
    legado("cie-materia", "Água e materiais", "Ciências", "Estados físicos da água e propriedades dos materiais."),
  ],
  ing: [
    legado("ing-vocabulario", "Vocabulário", "Inglês", "Cores, números, animais e alimentos."),
    legado("ing-frases", "Frases do dia a dia", "Inglês", "Cumprimentos e perguntas simples sobre si mesmo."),
  ],
};

export function caminhoDoAno(ano: number, disciplinaId: string): ArquivoCaminho | undefined {
  return CAMINHOS[`${String(ano).padStart(2, "0")}-${disciplinaId}`];
}

/** Habilidades de um ano/disciplina: do caminho BNCC ou, no 4º ano, do catálogo antigo. */
export function habilidadesDoAno(ano: number, disciplinaId: string): HabilidadeCatalogo[] {
  const c = caminhoDoAno(ano, disciplinaId);
  if (!c) return ano === 4 ? (LEGADO[disciplinaId] ?? []) : [];
  return c.unidades.flatMap((u) =>
    u.habilidades.map((h) => ({
      id: h.codigo,
      codigoBncc: h.codigo,
      nome: h.nome,
      disciplina: nomeDisciplina(disciplinaId),
      descricao: OFICIAL[h.codigo],
      unidade: u.nome,
      avaliavel: h.avaliavel ?? true,
    })),
  );
}

const disciplinasDoAno = (ano: number) => DISCIPLINAS_TODAS.filter((d) => habilidadesDoAno(ano, d.id).length > 0);

export const ANOS = [4, 5, 6, 7, 8, 9];
export const anosDisponiveis = (): AnoDisponivel[] =>
  ANOS.map((ano) => ({ ano, disciplinas: disciplinasDoAno(ano).map((d) => d.nome) }));

// --- Estado das turmas extras -----------------------------------------------------

export interface TurmaExtra {
  id: string;
  nome: string;
  codigo: string;
  ano: number;
  alunos: { id: string; nome: string }[];
  ativas: Set<string>;
  disciplinasAtivas: Set<string>;
}

const novaTurma = (id: string, nome: string, codigo: string, ano: number, alunos: { id: string; nome: string }[]): TurmaExtra => ({
  id,
  nome,
  codigo,
  ano,
  alunos,
  ativas: new Set(DISCIPLINAS_TODAS.flatMap((d) => habilidadesDoAno(ano, d.id).filter((h) => h.avaliavel).map((h) => h.id))),
  disciplinasAtivas: new Set(disciplinasDoAno(ano).map((d) => d.id)),
});

// Turma de teste do 8º ano, igual à do backend (dados.py): começa sem histórico.
const ALUNOS_8 = [
  { id: "b1", nome: "Beatriz Gomes", pin: "4821" },
  { id: "b2", nome: "Larissa Campos", pin: "3175" },
  { id: "b3", nome: "Lucas Andrade", pin: "9064" },
  { id: "b4", nome: "Mariana Ribeiro", pin: "2738" },
  { id: "b5", nome: "Rafael Teixeira", pin: "5912" },
  { id: "b6", nome: "Thiago Moreira", pin: "6340" },
];
export const PINS_EXTRAS: Record<string, string> = Object.fromEntries(ALUNOS_8.map((a) => [a.id, a.pin]));

// Fica em globalThis pelo mesmo motivo do estado de mock.ts (route handler e Server
// Components veem os mesmos dados).
const VERSAO = 1;
const g = globalThis as typeof globalThis & { __trilhaMockTurmas?: { versao: number; turmas: Map<string, TurmaExtra> } };
if (g.__trilhaMockTurmas?.versao !== VERSAO) {
  const t8 = novaTurma("t8", "8º ano A", "TUCANO8", 8, ALUNOS_8.map(({ id, nome }) => ({ id, nome })));
  g.__trilhaMockTurmas = { versao: VERSAO, turmas: new Map([[t8.id, t8]]) };
}
const turmas = g.__trilhaMockTurmas.turmas;

export const turmaExtra = (id: string) => turmas.get(id);
export const turmaExtraPorCodigo = (codigo: string) => [...turmas.values()].find((t) => t.codigo === codigo.toUpperCase());
export const turmaDoAlunoExtra = (alunoId: string) => [...turmas.values()].find((t) => t.alunos.some((a) => a.id === alunoId));
export const alunoExtra = (alunoId: string) => turmaDoAlunoExtra(alunoId)?.alunos.find((a) => a.id === alunoId);
export const resumosTurmasExtras = (): TurmaResumo[] =>
  [...turmas.values()].map((t) => ({ id: t.id, nome: t.nome, codigo: t.codigo, ano: t.ano, alunos: t.alunos.length }));

const AVES = ["SABIA", "ARARA", "CORUJA", "TUCANO", "GARCA", "PARDAL", "TIE", "CARCARA", "JACU", "SANHACO", "SAIRA", "BEIJA"];

/** Cria uma turma na demonstração (fica na memória do servidor até reiniciar). */
export function criarTurmaExtra(
  nome: string,
  ano: number,
  nomes: string[],
  ocupados: string[],
  novoPin: () => string,
  pins: Map<string, string>,
): TurmaResumo {
  if (!nome?.trim() || nome.trim().length > 40) throw new ApiError(422, "Dê um nome à turma (até 40 letras).");
  if (!ANOS.includes(ano)) throw new ApiError(422, "Ainda não há atividades para este ano.");
  const usados = new Set([...ocupados, ...[...turmas.values()].map((t) => t.codigo)]);
  const codigo = AVES.map((a) => `${a}${ano}`).find((c) => !usados.has(c) && c.length <= 8) ?? `AVE${ano}${turmas.size}`;
  const t = novaTurma(`t${crypto.randomUUID().slice(0, 10)}`, nome.trim(), codigo, ano, []);
  turmas.set(t.id, t);
  for (const n of (nomes ?? []).filter((x) => x.trim()).slice(0, 60)) adicionarAlunoExtra(t.id, n, novoPin, pins);
  return resumosTurmasExtras().find((r) => r.id === t.id)!;
}

export function adicionarAlunoExtra(turmaId: string, nome: string, novoPin: () => string, pins: Map<string, string>): AlunoCadastro {
  const t = turmas.get(turmaId);
  if (!t) throw new ApiError(404, "Turma não encontrada");
  if (!nome?.trim() || nome.trim().length > 60) throw new ApiError(422, "Informe o nome do aluno.");
  const aluno = { id: `n${crypto.randomUUID().slice(0, 10)}`, nome: nome.trim() };
  t.alunos.push(aluno);
  pins.set(aluno.id, novoPin());
  return { ...aluno, pin: pins.get(aluno.id)! };
}

// --- Respostas das rotas para as turmas extras (todas ainda sem atividades) --------

export const resumoAlunoExtra = (t: TurmaExtra, a: { id: string; nome: string }): AlunoResumo => ({
  id: a.id,
  nome: a.nome,
  turma: t.nome,
  ultimaAtividade: null,
  habilidades: [],
});

export function detalheAlunoExtra(alunoId: string): AlunoDetalhe {
  const t = turmaDoAlunoExtra(alunoId)!;
  const a = t.alunos.find((x) => x.id === alunoId)!;
  const ref = (h: HabilidadeCatalogo) => ({ habilidadeId: h.id, nome: h.nome, codigoBncc: h.codigoBncc });
  const caminhos: ProgressoCaminho[] = disciplinasDoAno(t.ano)
    .filter((d) => caminhoDoAno(t.ano, d.id) && t.disciplinasAtivas.has(d.id))
    .map((d) => {
      const ordem = habilidadesDoAno(t.ano, d.id).filter((h) => h.avaliavel && t.ativas.has(h.id));
      return {
        disciplinaId: d.id,
        disciplina: d.nome,
        ano: t.ano,
        total: ordem.length,
        concluidas: 0,
        atual: ordem[0] ? ref(ordem[0]) : null,
        proximas: ordem.slice(1, 3).map(ref),
      };
    });
  return { ...resumoAlunoExtra(t, a), recomendacoes: [], caminhos };
}

export function configExtra(t: TurmaExtra): TurmaConfig {
  const disciplinas: DisciplinaConfig[] = disciplinasDoAno(t.ano).map((d) => ({
    id: d.id,
    nome: d.nome,
    ativa: t.disciplinasAtivas.has(d.id),
    caminhoBncc: Boolean(caminhoDoAno(t.ano, d.id)),
    habilidades: habilidadesDoAno(t.ano, d.id).map((h) => ({
      id: h.id,
      nome: h.nome,
      descricao: h.descricao,
      ativa: h.avaliavel && t.ativas.has(h.id),
      codigoBncc: h.codigoBncc,
      unidade: h.unidade,
      avaliavel: h.avaliavel,
    })),
  }));
  return { turma: { id: t.id, nome: t.nome, codigo: t.codigo, ano: t.ano }, ciclo: "4º bimestre de 2026", disciplinas };
}

export function salvarConfigExtra(t: TurmaExtra, habilidadesAtivas: string[], disciplinasAtivas?: string[]) {
  const validas = new Set(
    DISCIPLINAS_TODAS.flatMap((d) => habilidadesDoAno(t.ano, d.id).filter((h) => h.avaliavel).map((h) => h.id)),
  );
  t.ativas = new Set(habilidadesAtivas.filter((id) => validas.has(id)));
  if (disciplinasAtivas) t.disciplinasAtivas = new Set(disciplinasAtivas);
}

export function turmaPublicaExtra(t: TurmaExtra): TurmaPublica {
  return {
    codigo: t.codigo,
    nome: t.nome,
    alunos: t.alunos.map((a) => ({ id: a.id, nome: a.nome.split(" ")[0] + " " + (a.nome.split(" ").at(-1)?.[0] ?? "") + "." })),
    disciplinas: disciplinasDoAno(t.ano).filter((d) => t.disciplinasAtivas.has(d.id)),
  };
}

export const SEM_ATIVIDADES_NO_MOCK =
  "As atividades desta turma precisam do backend. Na demonstração sem backend, pratique com a turma SABIA4.";
