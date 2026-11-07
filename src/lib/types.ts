// Contrato com a API (backend Python). O frontend só apresenta esses dados
// e envia respostas — diagnóstico, pontuação e IA ficam todos no backend.

export type Status = "ok" | "atencao" | "alerta";

export type Papel = "professor" | "responsavel";

export interface HabilidadeStatus {
  habilidadeId: string; // código BNCC (ex.: "EF04LP01") nas disciplinas que já têm caminho
  nome: string;
  disciplina: string;
  codigoBncc: string | null; // null = catálogo antigo, ainda sem caminho BNCC
  status: Status;
  // false = este aluno ainda não chegou nesta habilidade do caminho (status vem "ok" só
  // para preencher; a matriz mostra a célula neutra e ela não conta em alertas)
  iniciada: boolean;
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

// Progresso do aluno no caminho BNCC de uma disciplina (ordem definida pelo caminho).
// Concluída = diagnóstico "ok" com pelo menos 3 dias de prática na habilidade.
export interface ProgressoCaminho {
  disciplinaId: string;
  disciplina: string;
  ano: number;
  total: number; // habilidades avaliáveis e ativas no caminho
  concluidas: number;
  atual: HabilidadeRef | null; // primeira pendente; null = caminho concluído
  proximas: HabilidadeRef[];
}

export interface AlunoDetalhe extends AlunoResumo {
  recomendacoes: Recomendacao[];
  caminhos: ProgressoCaminho[]; // só disciplinas que já têm caminho BNCC
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
  ano: number; // ano escolar (4º–9º); define o catálogo BNCC da turma
}

export interface HabilidadeConfig {
  id: string;
  nome: string;
  descricao: string; // texto oficial da BNCC quando há código
  ativa: boolean;
  codigoBncc: string | null;
  unidade: string | null; // unidade do caminho (ex.: "Leitura e compreensão")
  // false = trabalhada em sala (produção, oralidade): aparece no caminho, mas não entra
  // no quiz nem no diagnóstico, e não dá para ativar
  avaliavel: boolean;
}

export interface DisciplinaConfig {
  id: string; // "por" | "mat" | "geo" | "cie" | "ing"
  nome: string;
  ativa: boolean; // desligada: some para os alunos e sai do diagnóstico
  caminhoBncc: boolean; // true = habilidades vêm do caminho BNCC do ano, na ordem do caminho
  habilidades: HabilidadeConfig[];
}

// Corpo de PUT /turma/configuracao
export interface PedidoTurmaConfig {
  habilidadesAtivas: string[];
  disciplinasAtivas?: string[]; // ausente = mantém as disciplinas como estão
}

// Diagnóstico explicado (GET /alunos/{id}/diagnostico): a decisão do modelo de ML para
// cada habilidade praticada, a confiança e os indicadores que ele usou.
export interface DiagnosticoHabilidade {
  habilidadeId: string;
  nome: string;
  disciplina: string;
  status: Status;
  modelo: "ml" | "regra";
  confianca: number | null; // probabilidade da classe escolhida (0–1)
  probabilidades: Record<Status, number> | null;
  indicadores: Record<string, number>;
  motivos: string[];
  avaliacaoProfessor: Status | null; // o que o professor disse que é (rótulo real), se já avaliou
}

export interface MetricasClassificacao {
  acuracia: number;
  f1Macro: number;
  porClasse: Record<Status, { precisao: number; recall: number; f1: number; suporte: number }>;
  matriz: number[][]; // linhas = real, colunas = previsto, na ordem de `classes`
}

// Métricas do último treino do modelo (GET /modelo), geradas por backend/ml/treinar.py.
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
  // Dados reais usados no último treino (avaliações de professores exportadas do banco).
  reais: {
    amostras: number;
    distribuicao: Record<string, number>;
    incluidosNoModelo: boolean;
    concordanciaModeloSintetico?: number;
    validacaoSoSinteticos?: MetricasClassificacao;
    validacaoComReais?: MetricasClassificacao;
    observacao?: string;
  } | null;
  // Ao vivo: quanto o modelo atual concorda com as avaliações dos professores no banco.
  professores: { avaliacoes: number; concordancia: number | null };
}

// Turmas do professor (GET /turmas). Cada professor vê só as próprias.
export interface TurmaResumo {
  id: string;
  nome: string;
  codigo: string;
  ano: number;
  alunos: number; // quantos alunos cadastrados
}

// Anos em que já dá para criar turma, com as disciplinas que têm atividades (GET /anos).
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

// Exercício de reforço gerado sob demanda (POST /exercicios/gerar).
// O backend gera via LLM e valida; se falhar ou a IA não estiver disponível, devolve
// uma questão do banco curado. `origem` diz de onde veio.
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
  indiceCorreta: number; // posição da opção correta (0 a 3)
  explicacao: string;
  apoio: string | null; // apoio visual (emoji), quando vem do banco
  origem: "ia" | "banco";
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

// Professor: login com e-mail + senha (a conta vem do .env do backend).
export interface PedidoLogin {
  email: string;
  senha: string;
}

export interface RespostaLogin {
  token: string;
  nome: string;
  email: string;
  expiraEm: number; // epoch em segundos
}

// Responsável: entra com o código da turma + PIN do filho e só lê o progresso dele.
export interface PedidoProgresso {
  acesso: string;
}

export interface ProgressoResponsavel {
  aluno: AlunoDetalhe;
  historico: HistoricoHabilidade[];
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
