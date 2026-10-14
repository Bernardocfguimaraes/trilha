const dia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const diaLongo = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });

export const dataCurta = (iso: string) => dia.format(new Date(iso)).replace(".", "");
export const dataLonga = (iso: string) => diaLongo.format(new Date(iso));
