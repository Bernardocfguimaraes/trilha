"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Opcao } from "@/lib/types";
import { fraseCompleta, type Lacuna } from "@/lib/lacuna";
import { voarDe, voltar } from "@/lib/animar";
import { cn } from "@/lib/utils";
import { Brilhos } from "./trilha-progresso";

const ARRASTE_MINIMO = 8; // px antes de um toque virar arraste

interface Resultado {
  correta: boolean;
  opcaoCorretaId: string;
}

/**
 * "Complete a frase": o aluno leva uma peça até o buraco da frase, tocando nela ou
 * arrastando. A frase mostra a escolha no lugar antes de conferir, e o feedback acontece
 * dentro da própria frase. Teclado: Tab até a peça e Enter/Espaço para colocar ou tirar.
 */
export function QuestaoLacuna({
  lacuna,
  opcoes,
  escolha,
  onEscolher,
  resultado,
}: {
  lacuna: Lacuna;
  opcoes: Opcao[];
  escolha: string | null;
  onEscolher: (id: string | null) => void;
  resultado: Resultado | null;
}) {
  const fraseRef = useRef<HTMLDivElement>(null);
  const bancoRef = useRef<HTMLDivElement>(null);
  // De onde a peça saiu, para ela "voar" até o lugar novo depois que o React desenhar.
  const voo = useRef<{ id: string; rect: DOMRect; para: "frase" | "banco" } | null>(null);
  const arraste = useRef<{ id: string; x: number; y: number; ativo: boolean } | null>(null);
  const ignorarClique = useRef(false);
  const [sobreFrase, setSobreFrase] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);

  // Errou: primeiro a frase balança com a escolha do aluno; depois a resposta certa
  // "vira" no lugar, para ele ver a frase correta.
  const [mostrarCerta, setMostrarCerta] = useState(false);
  useEffect(() => {
    if (!resultado || resultado.correta) return;
    const t = setTimeout(() => setMostrarCerta(true), 900);
    return () => clearTimeout(t);
  }, [resultado]);

  const naFrase = resultado && !resultado.correta && mostrarCerta ? resultado.opcaoCorretaId : escolha;
  const opcaoNaFrase = opcoes.find((o) => o.id === naFrase);
  const partesEscolha = escolha ? lacuna.partes[escolha] : null;
  const partesCertas = resultado ? lacuna.partes[resultado.opcaoCorretaId] : null;

  // Cada buraco é julgado sozinho: em "alunos / animada", "alunos" está certo e só
  // "animada" fica vermelho (e só ele vira para a resposta certa depois).
  function estadoDoBuraco(i: number): EstadoBuraco {
    if (!resultado) return "aberto";
    if (resultado.correta) return "acerto";
    if (partesEscolha?.[i] === partesCertas?.[i]) return "parcial";
    return mostrarCerta ? "corrigido" : "erro";
  }

  useLayoutEffect(() => {
    const v = voo.current;
    if (!v) return;
    voo.current = null;
    const alvos =
      v.para === "frase"
        ? fraseRef.current?.querySelectorAll("[data-parte]")
        : bancoRef.current?.querySelectorAll(`[data-peca="${CSS.escape(v.id)}"]`);
    alvos?.forEach((el) => voarDe(el, v.rect));
  }, [escolha]);

  function colocar(id: string, rect: DOMRect) {
    if (resultado) return;
    voo.current = { id, rect, para: "frase" };
    onEscolher(id);
  }

  function tirar() {
    if (resultado || !escolha) return;
    const parte = fraseRef.current?.querySelector("[data-parte]");
    if (parte) voo.current = { id: escolha, rect: parte.getBoundingClientRect(), para: "banco" };
    onEscolher(null);
  }

  function dentroDaFrase(x: number, y: number) {
    const r = fraseRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top - 24 && y <= r.bottom + 24;
  }

  const travado = !!resultado;
  const anuncio = escolha ? `Frase: ${fraseCompleta(lacuna, opcoes.find((o) => o.id === escolha))}` : "";

  return (
    <>
      <div
        ref={fraseRef}
        className={cn(
          "relative mt-6 rounded-2xl border-[3px] bg-white px-5 py-6 font-display text-3xl leading-[1.9] font-bold text-grafite",
          "transition-[border-color,background-color] duration-150",
          !resultado && (sobreFrase ? "border-dashed border-[#2a8fc4] bg-[#f1f9fd]" : "border-transparent"),
          resultado?.correta && "border-broto",
          resultado && !resultado.correta && (mostrarCerta ? "border-broto" : "border-coral"),
        )}
      >
        <p aria-hidden>
          {lacuna.trechos.map((trecho, i) => (
            <span key={i}>
              {i > 0 && (
                <Buraco
                  texto={opcaoNaFrase ? lacuna.partes[opcaoNaFrase.id][i - 1] : null}
                  estado={estadoDoBuraco(i - 1)}
                  onTirar={tirar}
                />
              )}
              {trecho}
            </span>
          ))}
        </p>
        {/* O que o leitor de tela ouve no lugar da frase desenhada. */}
        <p className="sr-only">
          {resultado && !resultado.correta
            ? `A frase certa é: ${fraseCompleta(lacuna, opcoes.find((o) => o.id === resultado.opcaoCorretaId))}`
            : `Frase: ${fraseCompleta(lacuna, opcaoNaFrase)}`}
        </p>
        {escolha && !resultado && (
          <button
            onClick={tirar}
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:rounded-lg focus:bg-ceu focus:px-3 focus:py-1 focus:text-lg"
          >
            Tirar a peça da frase
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>

      <p className="mt-6 text-center font-display text-lg font-semibold text-pedra" aria-hidden={travado}>
        {travado ? " " : "Toque numa peça ou arraste até a frase"}
      </p>
      <div
        ref={bancoRef}
        role="radiogroup"
        aria-label="Peças para completar a frase"
        className="mt-3 flex flex-wrap justify-center gap-3"
      >
        {opcoes.map((o) => {
          const usada = escolha === o.id;
          const certa = resultado?.opcaoCorretaId === o.id;
          const errada = !!resultado && usada && !resultado.correta;
          const texto = lacuna.partes[o.id].join(" · ");
          return (
            <button
              key={o.id}
              data-peca={o.id}
              role="radio"
              aria-checked={usada}
              aria-label={usada && !resultado ? `${texto}, está na frase` : texto}
              disabled={travado}
              onClick={(e) => {
                if (ignorarClique.current) {
                  ignorarClique.current = false;
                  return;
                }
                if (usada) tirar();
                else colocar(o.id, e.currentTarget.getBoundingClientRect());
              }}
              onPointerDown={(e) => {
                if (travado || e.button !== 0) return;
                arraste.current = { id: o.id, x: e.clientX, y: e.clientY, ativo: false };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const a = arraste.current;
                if (!a || a.id !== o.id) return;
                const dx = e.clientX - a.x;
                const dy = e.clientY - a.y;
                if (!a.ativo) {
                  if (Math.hypot(dx, dy) < ARRASTE_MINIMO) return;
                  a.ativo = true;
                  setArrastando(o.id);
                }
                // Direto no estilo, sem re-render a cada movimento do dedo.
                e.currentTarget.style.transform = `translate(${dx}px, ${dy}px) scale(1.08) rotate(-2deg)`;
                const sobre = dentroDaFrase(e.clientX, e.clientY);
                setSobreFrase((s) => (s === sobre ? s : sobre));
              }}
              onPointerUp={(e) => {
                const a = arraste.current;
                arraste.current = null;
                if (!a?.ativo) return;
                ignorarClique.current = true;
                const el = e.currentTarget;
                const rect = el.getBoundingClientRect();
                el.style.transform = "";
                setArrastando(null);
                setSobreFrase(false);
                if (dentroDaFrase(e.clientX, e.clientY)) colocar(o.id, rect);
                else voltar(el, e.clientX - a.x, e.clientY - a.y);
              }}
              onPointerCancel={(e) => {
                arraste.current = null;
                e.currentTarget.style.transform = "";
                setArrastando(null);
                setSobreFrase(false);
              }}
              className={cn(
                "relative min-h-16 touch-none rounded-2xl border-[3px] px-5 py-2 font-display text-2xl font-bold text-grafite outline-none select-none",
                "transition-[box-shadow,background-color,border-color,opacity] duration-100 focus-visible:ring-4 focus-visible:ring-grafite/30",
                arrastando === o.id && "z-10 cursor-grabbing shadow-[0_10px_20px_rgb(30_42_37/0.18)] transition-none",
                !resultado && !usada && "cursor-grab border-ceu-forte bg-white shadow-[0_4px_0_var(--color-ceu-forte)] active:shadow-none",
                // Peça já na frase: fica o "molde" pontilhado no banco, sem pular o layout.
                usada && !resultado && "border-dashed border-ceu-forte bg-transparent text-transparent shadow-none",
                certa && "border-broto bg-[#d6f5e6] shadow-[0_4px_0_var(--color-broto-escuro)]",
                errada && "border-coral bg-coral-claro text-grafite line-through decoration-coral decoration-[3px] shadow-[0_4px_0_#d9583a]",
                resultado && !certa && !errada && "border-ceu-forte bg-white opacity-50 shadow-[0_4px_0_var(--color-ceu-forte)]",
              )}
            >
              {texto}
            </button>
          );
        })}
      </div>
    </>
  );
}

type EstadoBuraco = "aberto" | "acerto" | "parcial" | "erro" | "corrigido";

function Buraco({
  texto,
  estado,
  onTirar,
}: {
  texto: string | null;
  estado: EstadoBuraco;
  onTirar: () => void;
}) {
  if (!texto) {
    return (
      <span className="inline-block h-[1.15em] w-[4.5ch] translate-y-[0.2em] rounded-lg border-[3px] border-dashed border-[#2a8fc4]/60 bg-ceu/60 align-baseline" />
    );
  }
  return (
    <span
      data-parte
      // A "chave" muda quando a resposta certa entra no lugar, para a animação de virar rodar.
      key={`${estado === "corrigido"}-${texto}`}
      onClick={estado === "aberto" ? onTirar : undefined}
      className={cn(
        "relative inline-block rounded-xl border-[3px] px-2 leading-tight",
        estado === "aberto" && "cursor-pointer border-[#2a8fc4] bg-[#d8effa] text-grafite",
        estado === "acerto" && "animate-estoura border-broto bg-[#d6f5e6]",
        estado === "erro" && "animate-balanca border-coral bg-coral-claro",
        estado === "parcial" && "border-broto bg-[#d6f5e6]",
        estado === "corrigido" && "animate-vira border-broto bg-[#d6f5e6]",
      )}
    >
      {texto}
      {estado === "acerto" && <Brilhos />}
    </span>
  );
}
