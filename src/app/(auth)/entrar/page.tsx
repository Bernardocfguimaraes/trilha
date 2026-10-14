import type { Metadata } from "next";
import { FormAuth } from "@/components/form-auth";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-grafite">Entrar</h1>
      <p className="mt-2 mb-8 text-pedra">Para responsáveis e professores.</p>
      <FormAuth modo="entrar" />
    </>
  );
}
