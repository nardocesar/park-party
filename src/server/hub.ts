import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { MAX_MSG, parseClientMsg, type ServerMsg } from "@/net/protocol";
import { createRoom, type Room, type RoomDeps } from "./room";

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Intervalo do laço das salas: curto para os quadros de 16,7 ms saírem no tempo. */
const TICK_MS = 4;
const MAX_MSGS_PER_SEC = 120;

export type Hub = ReturnType<typeof createHub>;

/** Liga sockets a salas. Cada socket começa com `join`; depois tudo vai para a sala dele. */
export function createHub(deps: Omit<RoomDeps, "newId">) {
  const rooms = new Map<string, Room>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG * 2 });

  const newCode = () => {
    let code: string;
    do code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
    while (rooms.has(code));
    return code;
  };

  wss.on("connection", (ws: WebSocket) => {
    let bound: { room: Room; id: string } | null = null;
    let budget = MAX_MSGS_PER_SEC;
    let windowStart = Date.now();
    const send = (msg: ServerMsg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };

    ws.on("message", (data) => {
      const now = Date.now();
      if (now - windowStart >= 1000) {
        windowStart = now;
        budget = MAX_MSGS_PER_SEC;
      }
      if (--budget < 0) return ws.close(1008, "rate");
      const msg = parseClientMsg(String(data));
      if (!msg) return ws.close(1008, "invalid");

      if (!bound) {
        if (msg.t !== "join") return ws.close(1008, "invalid");
        let room = msg.code ? rooms.get(msg.code) : undefined;
        if (msg.code && !room) {
          send({ t: "error", code: "not_found" });
          return ws.close(1000);
        }
        if (!room) {
          room = createRoom(newCode(), { ...deps, newId: randomUUID }, now);
          rooms.set(room.code, room);
        }
        const res = room.join(msg.nick, msg.token, send, now);
        if (!res.ok) {
          send({ t: "error", code: res.code });
          return ws.close(1000);
        }
        bound = { room, id: res.id };
        return;
      }

      const err = bound.room.handle(bound.id, msg, now);
      if (err === "drop") return ws.close(1008, "invalid");
      if (err) send({ t: "error", code: err });
    });

    ws.on("close", () => bound?.room.disconnect(bound.id, send, Date.now()));
  });

  const loop = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      room.tick(now);
      if (room.isDead(now)) rooms.delete(code);
    }
  }, TICK_MS);

  return {
    rooms,
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    },
    close() {
      clearInterval(loop);
      for (const c of wss.clients) c.terminate();
      wss.close();
    },
  };
}
