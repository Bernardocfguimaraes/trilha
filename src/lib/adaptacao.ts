// Dificuldade adaptativa dentro de uma sessão do aluno.
//
// Regra: começa no médio; 2 acertos seguidos sobe um nível, 2 erros seguidos desce um.
// Nos extremos o nível se mantém e a contagem recomeça. A adaptação é silenciosa: o aluno
// nunca vê o nível, para não ser rotulado.
//
// Funções puras, sem dependência de UI nem de rede. Hoje quem usa é o mock (src/lib/mock.ts);
// quando o backend assumir a sessão, esta é a regra a portar.
import type { EstadoAdaptacao, Nivel } from "./types";

export const NIVEIS: readonly Nivel[] = ["facil", "medio", "dificil"];
export const NIVEL_INICIAL: Nivel = "medio";
export const SEGUIDAS_PARA_MUDAR = 2;

export function estadoInicialAdaptacao(): EstadoAdaptacao {
  return { nivel: NIVEL_INICIAL, acertosSeguidos: 0, errosSeguidos: 0 };
}

function deslocar(nivel: Nivel, passo: 1 | -1): Nivel {
  const i = Math.min(NIVEIS.length - 1, Math.max(0, NIVEIS.indexOf(nivel) + passo));
  return NIVEIS[i];
}

/** Novo estado depois de uma resposta. */
export function registrarResposta(estado: EstadoAdaptacao, correta: boolean): EstadoAdaptacao {
  const acertosSeguidos = correta ? estado.acertosSeguidos + 1 : 0;
  const errosSeguidos = correta ? 0 : estado.errosSeguidos + 1;

  if (acertosSeguidos >= SEGUIDAS_PARA_MUDAR) {
    return { nivel: deslocar(estado.nivel, 1), acertosSeguidos: 0, errosSeguidos: 0 };
  }
  if (errosSeguidos >= SEGUIDAS_PARA_MUDAR) {
    return { nivel: deslocar(estado.nivel, -1), acertosSeguidos: 0, errosSeguidos: 0 };
  }
  return { nivel: estado.nivel, acertosSeguidos, errosSeguidos };
}
