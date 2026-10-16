"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { hasAutoJoin, loadNick, loadToken, saveNick } from "@/client/nick";
import { useRoom } from "@/client/useRoom";
import { cleanNick } from "@/net/protocol";
import OnlineGame from "./OnlineGame";
import RoomLobby from "./RoomLobby";

/** Armazenamento do navegador não avisa mudanças nesta aba: só a leitura importa. */
const noSubscribe = () => () => {};

/** /room/[code]: pede o apelido (se preciso), conecta e mostra o lobby. */
export default function RoomScreen({ code }: { code: string }) {
  // no servidor não há armazenamento: "" e null; no navegador, o que estiver salvo
  const saved = useSyncExternalStore(noSubscribe, loadNick, () => "");
  // veio da tela título, ou é F5 de quem já estava na sala: entra direto
  const auto = useSyncExternalStore(
    noSubscribe,
    () => (cleanNick(saved) && (code === "NEW" || hasAutoJoin(code) || loadToken(code)) ? saved : null),
    () => null,
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const nick = chosen ?? auto;
  const draft = typed ?? saved;

  if (!nick) {
    const valid = cleanNick(draft) !== null;
    return (
      <Shell>
        <form
          className="grid w-full max-w-sm gap-4 rounded-lg bg-plank p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            saveNick(draft);
            setChosen(draft.trim());
          }}
        >
          <p className="font-western text-2xl text-gold">Room {code}</p>
          <label className="grid gap-1 text-sm">
            Nickname
            <input
              value={draft}
              onChange={(e) => setTyped(e.target.value)}
              maxLength={16}
              autoFocus
              className="rounded border-2 border-plank-edge bg-dusk px-3 py-2 text-base text-sand"
            />
          </label>
          <button type="submit" disabled={!valid} className="rounded bg-gold px-4 py-2 font-western text-xl text-dusk disabled:opacity-40">
            Join
          </button>
        </form>
      </Shell>
    );
  }
  return <Connected code={code} nick={nick} />;
}

function Connected({ code, nick }: { code: string; nick: string }) {
  const { room, you, error, start, send, subscribe } = useRoom(code, nick);
  if (error === "not_found" || error === "full")
    return (
      <Shell>
        <p className="font-western text-3xl text-gold">{error === "full" ? "Room is full" : "Room not found"}</p>
        <p className="text-dust">{error === "full" ? "8 players already." : "Check the code. The server may also have restarted."}</p>
        <Link href="/" className="rounded bg-gold px-4 py-2 font-semibold text-dusk">
          Back to title
        </Link>
      </Shell>
    );
  if (!room || !you)
    return (
      <Shell>
        <p className="text-dust">Connecting…</p>
      </Shell>
    );
  const me = room.members.find((m) => m.id === you);
  if (start && room.state !== "lobby" && me?.playing) {
    const nicks = Object.fromEntries(room.members.map((m) => [m.id, m.nick]));
    return (
      <OnlineGame
        key={start.slug + start.seats.map((s) => s.id).join()}
        start={start}
        you={you}
        isHost={me.host}
        nicks={nicks}
        send={send}
        subscribe={subscribe}
      />
    );
  }
  return <RoomLobby room={room} you={you} send={send} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-dusk p-6 text-sand">{children}</main>;
}
