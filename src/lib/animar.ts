// Animações do lado do aluno sem biblioteca: CSS para o que é fixo (globals.css) e a
// Web Animations API para o que depende de posição (uma peça "voando" até o lugar).
// Só `transform`/`opacity`, que a GPU anima sem recalcular o layout: roda liso em
// tablet fraco. Quem pede menos movimento no sistema não vê nada se mexer.

export function semMovimento() {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Faz `el` sair visualmente de `origem` e deslizar até onde ele está agora (técnica FLIP). */
export function voarDe(el: Element, origem: DOMRect, duracao = 320) {
  if (semMovimento() || typeof el.animate !== "function") return;
  const destino = el.getBoundingClientRect();
  if (!destino.width) return;
  const dx = origem.left + origem.width / 2 - (destino.left + destino.width / 2);
  const dy = origem.top + origem.height / 2 - (destino.top + destino.height / 2);
  const escala = Math.min(2, Math.max(0.5, origem.width / destino.width));
  el.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${escala})` }, { transform: "none" }],
    { duration: duracao, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  );
}

/** Devolve `el` (deslocado por um arraste) ao lugar de origem. */
export function voltar(el: HTMLElement, dx: number, dy: number) {
  if (semMovimento() || typeof el.animate !== "function") return;
  el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
    duration: 260,
    easing: "cubic-bezier(0.3, 1.4, 0.5, 1)",
  });
}
