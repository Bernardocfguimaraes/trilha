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
  id: string; // "por" | "mat" | "geo" | "cie" | "ing"
  nome: string;
  ativa: boolean; // desligada: some para os alunos e sai do diagnóstico
  habilidades: HabilidadeConfig[];
}

// Corpo de PUT /turma/configuracao
export interface PedidoTurmaConfig {
  habilidadesAtivas: string[];
  disciplinasAtivas?: string[]; // ausente = mantém as disciplinas como estão
}

export interface TurmaConfig {
  turma: Turma;
  ciclo: string;
  disciplinas: DisciplinaConfig[];
}

// Conversa do professor sobre a turma (POST /turmas/{turmaId}/chat).
// A resposta real vem do backend (LLM com os dados da turma); o frontend só exibe.
export type AutorMensagem = "professor" | "assistente";

export interface MensagemChat {
  id: string;
  autor: AutorMensagem;
  texto: string;
  enviadaEm: string; // ISO
}

export interface PedidoChatTurma {
  pergunta: string;
  historico: MensagemChat[]; // conversa até aqui, para o backend manter o contexto
}

// Lado do aluno

export interface AlunoPublico {
  id: string;
  nome: string;
}

export interface DisciplinaPublica {
  id: string;
  nome: string;
}

export interface TurmaPublica {
  codigo: string;
  nome: string;
  alunos: AlunoPublico[]; // lista pública: só id e nome, nunca o PIN
  disciplinas: DisciplinaPublica[]; // só as que o professor ativou (e têm habilidade ativa)
}

// Identificação do aluno por PIN de 4 dígitos (POST /acesso/pin)
export interface PedidoPin {
  alunoId: string;
  pin: string;
}

export interface ResultadoPin {
  valido: boolean;
  acesso: string | null; // credencial curta exigida para abrir sessões como esse aluno
  bloqueado: boolean; // muitas tentativas erradas seguidas; o aluno precisa esperar ou chamar o professor
}

// Corpo de POST /sessoes
export interface PedidoSessao {
  codigo: string;
  alunoId: string;
  acesso?: string;
  disciplinaId?: string; // ausente = todas as disciplinas ativas
}

// Lado do professor: cadastro do aluno com o PIN visível
export interface AlunoCadastro {
  id: string;
  nome: string;
  pin: string;
}

export interface Opcao {
  id: string;
  texto: string;
}

// Dificuldade da pergunta. Usada pela adaptação; nunca é mostrada ao aluno.
export type Nivel = "facil" | "medio" | "dificil";

export interface Pergunta {
  id: string;
  disciplina: string;
  habilidadeId: string;
  nivel: Nivel;
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
  // Próxima pergunta, já no nível escolhido pela adaptação. Quando vem, substitui a
  // próxima da lista da sessão; ausente na última pergunta.
  proxima?: Pergunta;
}

// Estado da dificuldade adaptativa dentro de uma sessão (ver src/lib/adaptacao.ts)
export interface EstadoAdaptacao {
  nivel: Nivel;
  acertosSeguidos: number;
  errosSeguidos: number;
}

export interface ResultadoSessao {
  estrelas: number;
  total: number;
  mensagem: string;
}
