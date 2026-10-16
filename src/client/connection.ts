import type { ClientMsg, ServerMsg } from "@/net/protocol";

export type Connection = { send(msg: ClientMsg): void; close(): void };

/** WebSocket em /ws que reconecta sozinho; `hello` (o join) é reenviado a cada conexão. */
export function connect(opts: {
  hello: () => ClientMsg;
  onMessage: (msg: ServerMsg) => void;
  onOpenChange: (open: boolean) => void;
}): Connection {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${proto}://${location.host}/ws`);
    ws = socket;
    socket.onopen = () => {
      opts.onOpenChange(true);
      socket.send(JSON.stringify(opts.hello()));
    };
    socket.onmessage = (e) => opts.onMessage(JSON.parse(String(e.data)) as ServerMsg);
    socket.onclose = () => {
      opts.onOpenChange(false);
      if (!closed) retry = setTimeout(open, 1000);
    };
  };
  open();

  return {
    send(msg) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    },
  };
}
