export const CHAVE_TEMA = "trilha-tema";

export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${CHAVE_TEMA}");var d=t?t==="escuro":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
