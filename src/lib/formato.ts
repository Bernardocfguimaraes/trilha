const dia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const diaLongo = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });

const diaEmSaoPaulo = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

export const hojeLocal = () => diaEmSaoPaulo.format(new Date());

export const somarDias = (iso: string, dias: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

export const dataCurta = (iso: string) => dia.format(new Date(iso)).replace(".", "");
export const dataLonga = (iso: string) => diaLongo.format(new Date(iso));
