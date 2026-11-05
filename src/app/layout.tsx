import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Baloo_2 } from "next/font/google";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Trilha",
    template: "%s | Trilha",
  },
  description:
    "Atividades para alunos dos anos iniciais e recomendações pedagógicas para quem acompanha cada um deles.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${atkinson.variable} ${baloo.variable} h-full antialiased`}
      // O script de tema troca a classe .dark antes da hidratação.
      suppressHydrationWarning
    >
      <head>
        {/* Aplica o tema salvo antes de pintar, para o modo escuro não "piscar" branco. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
