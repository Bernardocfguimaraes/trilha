export const COOKIE_RESPONSAVEL = "trilha_responsavel";

export function opcoesCookieResponsavel(https: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: https,
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}
