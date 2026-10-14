import Link from "next/link";
import { Logo } from "@/components/marca";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-papel px-4 py-6 sm:px-10">
      <Link href="/" className="self-start rounded-md text-grafite outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Logo />
      </Link>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
      <p className="text-center text-sm text-pedra">
        É aluno?{" "}
        <Link href="/aluno" className="font-semibold text-mata underline-offset-4 hover:underline">
          Entre com o código da turma
        </Link>
      </p>
    </div>
  );
}
