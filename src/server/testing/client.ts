import WebSocket from "ws";
import type { ClientMsg, ServerMsg } from "@/net/protocol";

/** Cliente WebSocket de teste: guarda tudo o que chega e espera por tipo de mensagem. */
export async function testClient(url: string) {
  const ws = new WebSocket(url);
  const inbox: ServerMsg[] = [];
  ws.on("message", (data) => inbox.push(JSON.parse(String(data)) as ServerMsg));
  const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return {
    ws,
    inbox,
    closed,
    send(msg: ClientMsg, delayMs = 0) {
      const go = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
      if (delayMs > 0) setTimeout(go, delayMs);
      else go();
    },
    /** Tira da caixa a primeira mensagem do tipo `t` (espera até chegar). */
    async next<T extends ServerMsg["t"]>(t: T, timeoutMs = 5000): Promise<Extract<ServerMsg, { t: T }>> {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const i = inbox.findIndex((m) => m.t === t);
        if (i >= 0) return inbox.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>;
        await new Promise((r) => setTimeout(r, 5));
      }
      throw new Error(`tempo esgotado esperando "${t}"`);
    },
  };
}
