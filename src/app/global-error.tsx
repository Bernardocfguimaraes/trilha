"use client";

export default function ErroGeral({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: "Verdana, system-ui, sans-serif",
          background: "#e3f4fb",
          color: "#1e2a25",
          textAlign: "center",
        }}
      >
        <title>Algo deu errado | Trilha</title>
        <main>
          <h1 style={{ fontSize: 32, margin: 0 }}>Algo deu errado</h1>
          <p style={{ fontSize: 18, color: "#4a5852", maxWidth: 420, margin: "12px auto 28px" }}>
            O Trilha não conseguiu abrir agora. Tente de novo em alguns segundos.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              font: "inherit",
              fontSize: 20,
              fontWeight: 700,
              color: "#ffffff",
              background: "#139a66",
              border: 0,
              borderRadius: 16,
              padding: "14px 32px",
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
