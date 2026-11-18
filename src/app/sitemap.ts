import type { MetadataRoute } from "next";
import { URL_SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paginas: { caminho: string; prioridade: number }[] = [
    { caminho: "/", prioridade: 1 },
    { caminho: "/aluno", prioridade: 0.8 },
    { caminho: "/responsavel", prioridade: 0.6 },
    { caminho: "/entrar", prioridade: 0.5 },
  ];
  return paginas.map(({ caminho, prioridade }) => ({
    url: new URL(caminho, URL_SITE).toString(),
    changeFrequency: "monthly",
    priority: prioridade,
  }));
}
