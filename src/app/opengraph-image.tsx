import { ImageResponse } from "next/og";

export const alt = "Trilha: atividades do 4º ao 9º ano alinhadas à BNCC, com diagnóstico para o professor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUBTITULO = "Atividades do 4º ao 9º ano alinhadas à BNCC, diagnóstico por habilidade para o professor e acompanhamento para a família.";

const ICONE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#ffffff"/><path d="M6.5 25.5c4 0 5-4 9-4s6-4 3-7-1-5.5 2.6-5.5" fill="none" stroke="#0f6e50" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="0.1 4.8"/><rect x="21.5" y="4.5" width="4.4" height="7.5" rx="1.5" fill="#ffc23d"/></svg>',
).toString("base64")}`;

export default function Imagem() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0f6e50 0%, #0a523b 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={ICONE} width={96} height={96} alt="" />
          <span style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>trilha</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Cada criança no seu passo.</span>
          <span style={{ fontSize: 34, color: "#d6f5e6", lineHeight: 1.3, maxWidth: 960 }}>{SUBTITULO}</span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {["Aluno", "Professor", "Família"].map((papel) => (
            <span
              key={papel}
              style={{ fontSize: 26, padding: "10px 24px", borderRadius: 999, background: "rgba(255,255,255,0.14)", color: "#ffffff" }}
            >
              {papel}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
