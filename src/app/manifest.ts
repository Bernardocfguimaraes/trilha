import type { MetadataRoute } from "next";
import { DESCRICAO_SITE, NOME_SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trilha · Cada criança no seu passo",
    short_name: NOME_SITE,
    description: DESCRICAO_SITE,
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#e3f4fb",
    theme_color: "#0f6e50",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
