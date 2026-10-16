import { createServer } from "node:http";
import next from "next";
import { LEVELS } from "./src/game/levels";
import { createHub } from "./src/server/hub";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev });

app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const upgradeNext = app.getUpgradeHandler();
  const hub = createHub({ random: Math.random, levels: LEVELS });

  const server = createServer((req, res) => handle(req, res));
  // /ws é das salas; o resto (HMR em dev) continua com o Next
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws")) hub.handleUpgrade(req, socket, head);
    else upgradeNext(req, socket, head);
  });
  server.listen(port, () => console.log(`> Sunset Park em http://localhost:${port} (${dev ? "dev" : "produção"})`));
});
