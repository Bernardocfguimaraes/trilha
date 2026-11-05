// Área do responsável: entra com o código da turma + PIN do filho e só lê o progresso dele.
// A credencial devolvida pelo PIN fica num cookie httpOnly (o JavaScript da página não a
// lê) e só é enviada ao backend pelo servidor do Next.

export const COOKIE_RESPONSAVEL = "trilha_responsavel";

/** `secure` segue o protocolo da requisição: só HTTPS em produção, e o app continua
 * funcionando em http://localhost na apresentação. */
export function opcoesCookieResponsavel(https: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: https,
    path: "/",
    maxAge: 60 * 60 * 8, // um dia de uso, igual à validade da credencial no backend
  };
}
