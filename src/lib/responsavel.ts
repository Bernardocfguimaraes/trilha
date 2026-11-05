// Área do responsável: entra com o código da turma + PIN do filho e só lê o progresso dele.
// A credencial devolvida pelo PIN fica num cookie httpOnly (o JavaScript da página não a
// lê) e só é enviada ao backend pelo servidor do Next.

export const COOKIE_RESPONSAVEL = "trilha_responsavel";

export const OPCOES_COOKIE_RESPONSAVEL = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8, // um dia de uso; depois pede o PIN de novo
};
