import type { Metadata } from "next";
import { FormAuth } from "@/components/form-auth";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-grafite">Criar conta</h1>
      <p className="mt-2 mb-8 text-pedra">
        Alunos não precisam de conta: eles entram com o código da turma.
      </p>
      <FormAuth modo="cadastro" />
    </>
  );
}
