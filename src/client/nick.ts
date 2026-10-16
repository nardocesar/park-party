const NICK = "sunset:nick";
const AUTO = "sunset:autojoin";

/** Armazenamento pode estar bloqueado (aba privada): sem ele, só não lembra. */
const read = (s: () => Storage, k: string) => {
  try {
    return s().getItem(k);
  } catch {
    return null;
  }
};
const write = (s: () => Storage, k: string, v: string | null) => {
  try {
    if (v === null) s().removeItem(k);
    else s().setItem(k, v);
  } catch {
    // sem armazenamento: segue sem lembrar
  }
};

export const loadNick = () => read(() => localStorage, NICK) ?? "";
export const saveNick = (nick: string) => write(() => localStorage, NICK, nick.trim());
/** A tela título já pediu o apelido: a sala entra direto, sem perguntar de novo. */
export const markAutoJoin = (code: string) => write(() => sessionStorage, AUTO, code);
export const hasAutoJoin = (code: string) => read(() => sessionStorage, AUTO) === code;
/** Token de reconexão: por aba (sessionStorage), para duas abas serem dois jogadores. */
export const tokenKey = (code: string) => `sunset:token:${code}`;
export const loadToken = (code: string) => read(() => sessionStorage, tokenKey(code));
export const saveToken = (code: string, token: string) => write(() => sessionStorage, tokenKey(code), token);
