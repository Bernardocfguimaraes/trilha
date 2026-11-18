import type { MetadataRoute } from "next";
import { URL_SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/painel", "/api/", "/backend/", "/responsavel/progresso", "/responsavel/sessao"],
    },
    sitemap: new URL("/sitemap.xml", URL_SITE).toString(),
  };
}
