export const NOME_SITE = "Trilha";

export const DESCRICAO_SITE =
  "Atividades curtas e interativas para o 4º ao 9º ano, alinhadas à BNCC. O aluno aprende no seu ritmo, o professor vê onde a turma precisa de apoio e a família acompanha o progresso.";

const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const URL_SITE = new URL(producao ? `https://${producao}` : "http://localhost:3000");
