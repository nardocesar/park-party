"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMsg, ErrorCode, RoomView, ServerMsg } from "@/net/protocol";
import { connect, type Connection } from "./connection";
import { loadToken, saveToken } from "./nick";

export type StartMsg = Extract<ServerMsg, { t: "start" }>;
type Listener = (msg: ServerMsg) => void;

/**
 * Conexão com a sala. `code = "NEW"` cria uma sala; quando o servidor devolve o código,
 * a URL vira /room/CÓDIGO sem recarregar. Mensagens da partida (tick, hash, snapshot…)
 * ficam guardadas desde o último `start` para o jogo recém-montado não perder nenhuma.
 */
export function useRoom(code: string, nick: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [online, setOnline] = useState(false);
  const [start, setStart] = useState<StartMsg | null>(null);
  const conn = useRef<Connection | null>(null);
  const log = useRef<ServerMsg[]>([]);
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    let current = code === "NEW" ? null : code;
    let token: string | null = null;
    const c = connect({
      hello: () => ({ t: "join", code: current, nick, token: current ? loadToken(current) : null }),
      onOpenChange: setOnline,
      onMessage: (msg) => {
        switch (msg.t) {
          case "welcome":
            setYou(msg.you);
            token = msg.token;
            if (current) saveToken(current, token);
            return;
          case "room":
            if (!current) {
              current = msg.room.code;
              // o token vai antes da troca de URL: se a página remontar, ela reentra com ele
              if (token) saveToken(current, token);
              window.history.replaceState(null, "", `/room/${current}`);
            }
            setRoom(msg.room);
            if (msg.room.state === "lobby") {
              log.current = [];
              setStart(null);
            }
            return;
          case "error":
            setError(msg.code);
            if (msg.code === "not_found" || msg.code === "full") c.close();
            return;
          case "start":
            log.current = [];
            setStart(msg);
            return;
          case "pong":
            break;
          default:
            log.current.push(msg);
        }
        for (const l of listeners.current) l(msg);
      },
    });
    conn.current = c;
    return () => c.close();
  }, [code, nick]);

  const send = useCallback((msg: ClientMsg) => conn.current?.send(msg), []);
  const subscribe = useCallback((l: Listener) => {
    for (const m of log.current) l(m);
    listeners.current.add(l);
    return () => void listeners.current.delete(l);
  }, []);

  return { room, you, error, online, start, send, subscribe };
}
