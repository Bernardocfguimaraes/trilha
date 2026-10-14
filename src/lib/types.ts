// Contrato com a API (backend Python). O frontend só apresenta esses dados
// e envia respostas — diagnóstico, pontuação e IA ficam todos no backend.

export type Status = "ok" | "atencao" | "alerta";

export type Papel = "professor" | "responsavel";

export interface HabilidadeStatus {
  habilidadeId: string;
  nome: string;
  disciplina: string;
  status: Status;
}

export interface AlunoResumo {
  id: string;
  nome: string;
  turma: string;
  ultimaAtividade: string | null;
  habilidades: HabilidadeStatus[];
}

export interface Recomendacao {
  habilidadeId: string;
  habilidade: string;
  status: Status;
  texto: string;
  geradaEm: string;
}

export interface AlunoDetalhe extends AlunoResumo {
  recomendacoes: Recomendacao[];
}

export interface PontoHistorico {
  data: string;
  desempenho: number; // 0–100, calculado pelo backend
}

export interface HistoricoHabilidade {
  habilidadeId: string;
  nome: string;
  disciplina: string;
  pontos: PontoHistorico[];
}

export interface Turma {
  id: string;
  nome: string;
  codigo: string;
}

export interface HabilidadeConfig {
  id: string;
  nome: string;
  descricao: string;
  ativa: boolean;
}

export interface DisciplinaConfig {
  id: string;
  nome: string;
  habilidades: HabilidadeConfig[];
}

export interface TurmaConfig {
  turma: Turma;
  ciclo: string;
  disciplinas: DisciplinaConfig[];
}

// Lado do aluno

export interface AlunoPublico {
  id: string;
  nome: string;
}

export interface TurmaPublica {
  codigo: string;
  nome: string;
  alunos: AlunoPublico[];
}

export interface Opcao {
  id: string;
  texto: string;
}

export interface Pergunta {
  id: string;
  disciplina: string;
  enunciado: string;
  apoio?: string; // texto visual de apoio, ex.: "🍎🍎🍎 + 🍎🍎"
  opcoes: Opcao[];
}

export interface Sessao {
  sessaoId: string;
  perguntas: Pergunta[];
}

export interface ResultadoResposta {
  correta: boolean;
  mensagem: string;
  opcaoCorretaId: string;
}

export interface ResultadoSessao {
  estrelas: number;
  total: number;
  mensagem: string;
}
