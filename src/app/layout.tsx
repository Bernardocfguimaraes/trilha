import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Baloo_2 } from "next/font/google";
import { DESCRICAO_SITE, NOME_SITE, URL_SITE } from "@/lib/site";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  adjustFontFallback: false,
  fallback: ["Verdana", "system-ui", "sans-serif"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: URL_SITE,
  title: {
    default: "Trilha · Cada criança no seu passo",
    template: "%s | Trilha",
  },
  description: DESCRICAO_SITE,
  applicationName: NOME_SITE,
  keywords: ["BNCC", "ensino fundamental", "atividades educativas", "reforço escolar", "diagnóstico de aprendizagem", "professor", "família"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: NOME_SITE,
    title: "Trilha · Cada criança no seu passo",
    description: DESCRICAO_SITE,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trilha · Cada criança no seu passo",
    description: DESCRICAO_SITE,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e3f4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1613" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${atkinson.variable} ${baloo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
