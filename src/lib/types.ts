export type Status = "ok" | "atencao" | "alerta";

export type Papel = "professor" | "responsavel";

export interface HabilidadeStatus {
  habilidadeId: string;
  nome: string;
  disciplina: string;
  codigoBncc: string | null;
  status: Status;
  iniciada: boolean;
  emRisco?: boolean;
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

export interface HabilidadeRef {
  habilidadeId: string;
  nome: string;
  codigoBncc: string | null;
}

export interface ProgressoCaminho {
  disciplinaId: string;
  disciplina: string;
  ano: number;
  total: number;
  concluidas: number;
  atual: HabilidadeRef | null;
  proximas: HabilidadeRef[];
}

export interface AlunoDetalhe extends AlunoResumo {
  recomendacoes: Recomendacao[];
  caminhos: ProgressoCaminho[];
}

export interface PontoHistorico {
  data: string;
  desempenho: number;
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
  ano: number;
}

export interface HabilidadeConfig {
  id: string;
  nome: string;
  descricao: string;
  ativa: boolean;
  codigoBncc: string | null;
  unidade: string | null;
  avaliavel: boolean;
}

export interface DisciplinaConfig {
  id: string;
  nome: string;
  ativa: boolean;
  caminhoBncc: boolean;
  habilidades: HabilidadeConfig[];
}

export interface PedidoTurmaConfig {
  habilidadesAtivas: string[];
  disciplinasAtivas?: string[];
}

export interface DiagnosticoHabilidade {
  habilidadeId: string;
  nome: string;
  disciplina: string;
  status: Status;
  modelo: "ml" | "regra";
  confianca: number | null;
  probabilidades: Record<Status, number> | null;
  indicadores: Record<string, number>;
  motivos: string[];
  avaliacaoProfessor: Status | null;
  risco: { probabilidade: number; emRisco: boolean } | null;
}

export interface MetricasRisco {
  pergunta: string;
  recorte: string;
  dados: { amostras: number; taxaDeQueda: number };
  modelo: { limiar: number; validacaoCruzadaAuc: number };
  implantado: { aucRoc: number; precisao: number; recall: number; acuracia: number };
  baseline: { descricao: string; precisao: number; recall: number; acuracia: number };
}

export interface MetricasClassificacao {
  acuracia: number;
  f1Macro: number;
  porClasse: Record<Status, { precisao: number; recall: number; f1: number; suporte: number }>;
  matriz: number[][];
}

export interface MetricasModelo {
  treinadoEm: string;
  dados: { origem: string; amostras: number; treino: number; teste: number; distribuicao: Record<string, number> };
  modelo: { nome: string; arvores: number; parametros: Record<string, string | number | null>; validacaoCruzadaF1Macro: number };
  classes: Status[];
  implantado: MetricasClassificacao;
  antesDoAjuste: MetricasClassificacao;
  arvoreDeDecisao: MetricasClassificacao;
  baseline: MetricasClassificacao & { descricao: string };
  importancias: { feature: string; nome: string; valor: number }[];
  reais: {
    amostras: number;
    distribuicao: Record<string, number>;
    incluidosNoModelo: boolean;
    concordanciaModeloSintetico?: number;
    validacaoSoSinteticos?: MetricasClassificacao;
    validacaoComReais?: MetricasClassificacao;
    observacao?: string;
  } | null;
  professores: { avaliacoes: number; concordancia: number | null };
  risco: MetricasRisco | null;
  llm: AvaliacaoLlm | null;
}

export interface ResumoRevisor {
  avaliadas: number;
  errosPegos: number | null;
  boasRecusadas: number | null;
  erroEntreAprovadas: number | null;
  nCorretas: number;
  nErros: number;
}

export interface AvaliacaoLlm {
  avaliadoEm: string;
  modelos: { gerador: string; revisor: string };
  metodo: { amostra: number; descricao: string };
  autoRevisao: ResumoRevisor;
  outroModelo: ResumoRevisor;
  geracao: { pedidas: number; validasFormato: number; aprovadasAuto: number; aprovadasOutro: number; discordancias: number };
  interrompido: string | null;
}

export interface GrupoReforco {
  nome: string;
  alunos: { id: string; nome: string }[];
  foco: { habilidadeId: string; nome: string; disciplina: string; mediaGrupo: number; mediaTurma: number }[];
  mediaGeral: number;
}

export interface GruposTurma {
  turma: string;
  grupos: GrupoReforco[];
  k: number;
  silhueta: number | null;
  alunosConsiderados: number;
  observacao: string | null;
}

export interface TurmaResumo {
  id: string;
  nome: string;
  codigo: string;
  ano: number;
  alunos: number;
}

export interface AnoDisponivel {
  ano: number;
  disciplinas: string[];
}

export interface PedidoNovaTurma {
  nome: string;
  ano: number;
  alunos: string[];
}

export interface TurmaConfig {
  turma: Turma;
  ciclo: string;
  disciplinas: DisciplinaConfig[];
}

export type AutorMensagem = "professor" | "assistente";

export interface MensagemChat {
  id: string;
  autor: AutorMensagem;
  texto: string;
  enviadaEm: string;
}

export interface PedidoChatTurma {
  pergunta: string;
  historico: MensagemChat[];
}

export interface PedidoExercicio {
  habilidadeId: string;
  nivel?: Nivel;
}

export interface Exercicio {
  habilidadeId: string;
  habilidade: string;
  disciplina: string;
  codigoBncc: string | null;
  nivel: Nivel;
  enunciado: string;
  opcoes: string[];
  indiceCorreta: number;
  explicacao: string;
  apoio: string | null;
  origem: "ia" | "banco";
}

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
  alunos: AlunoPublico[];
  disciplinas: DisciplinaPublica[];
}

export interface PedidoPin {
  alunoId: string;
  pin: string;
}

export interface PedidoLogin {
  email: string;
  senha: string;
}

export interface RespostaLogin {
  token: string;
  nome: string;
  email: string;
  expiraEm: number;
}

export interface PedidoProgresso {
  acesso: string;
}

export interface ProgressoResponsavel {
  aluno: AlunoDetalhe;
  historico: HistoricoHabilidade[];
}

export interface ResultadoPin {
  valido: boolean;
  acesso: string | null;
  bloqueado: boolean;
}

export interface PedidoSessao {
  codigo: string;
  alunoId: string;
  acesso?: string;
  disciplinaId?: string;
}

export interface AlunoCadastro {
  id: string;
  nome: string;
  pin: string;
}

export interface Opcao {
  id: string;
  texto: string;
}

export type Nivel = "facil" | "medio" | "dificil";

export interface Pergunta {
  id: string;
  disciplina: string;
  habilidadeId: string;
  nivel: Nivel;
  enunciado: string;
  apoio?: string;
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
  proxima?: Pergunta;
}

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
