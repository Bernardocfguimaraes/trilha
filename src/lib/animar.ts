export function semMovimento() {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

export function voltar(el: HTMLElement, dx: number, dy: number) {
  if (semMovimento() || typeof el.animate !== "function") return;
  el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
    duration: 260,
    easing: "cubic-bezier(0.3, 1.4, 0.5, 1)",
  });
}
