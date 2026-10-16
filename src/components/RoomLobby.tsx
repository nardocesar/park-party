"use client";

import { useEffect, useState } from "react";
import { MAX_PLAYERS } from "@/game/engine/constants";
import { LEVELS, WORLDS } from "@/game/levels";
import { COWBOY_NAMES, PLAYER_COLORS } from "@/game/render";
import type { ClientMsg, MemberView, RoomView } from "@/net/protocol";
import Portrait from "./Portrait";

type Props = { room: RoomView; you: string; send: (msg: ClientMsg) => void };

/** Lobby online: cada um escolhe o cowboy; o anfitrião escolhe a fase e inicia. */
export default function RoomLobby({ room, you, send }: Props) {
  const me = room.members.find((m) => m.id === you);
  const isHost = me?.host ?? false;
  const host = room.members.find((m) => m.host);
  const online = room.members.filter((m) => m.online).length;
  const picked = LEVELS.find((l) => l.slug === room.slug);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") send({ t: "cowboy", dir: -1 });
      if (e.code === "ArrowRight" || e.code === "KeyD") send({ t: "cowboy", dir: 1 });
      if (e.code === "Enter" && isHost) send({ t: "start" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, isHost]);

  const copy = () => {
    navigator.clipboard?.writeText(location.href).then(() => setCopied(true), () => {});
  };

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-dusk bg-[linear-gradient(to_bottom,#2b1846,#1d1118_420px)] p-6 text-sand">
      <header className="flex w-full max-w-4xl flex-wrap items-end justify-between gap-3">
        <h1 className="font-western text-4xl text-gold">Room {room.code}</h1>
        <button type="button" onClick={copy} className="rounded border-2 border-gold px-3 py-1 text-sm text-gold">
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </header>

      {room.state !== "lobby" && (
        <p className="rounded bg-plank px-4 py-2 text-sm">A level is being played. You will join the next one.</p>
      )}

      <ol className="grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: MAX_PLAYERS }, (_, i) => (
          <MemberCard key={i} index={i} member={room.members[i]} mine={room.members[i]?.id === you} send={send} />
        ))}
      </ol>

      <section className="grid w-full max-w-4xl gap-3 rounded-lg bg-dusk/80 p-4">
        <p data-testid="picked" className="text-center">
          {picked ? (
            <>
              Level:{" "}
              <b className="text-gold">
                {picked.slug} · {picked.name}
              </b>
            </>
          ) : isHost ? (
            "Pick a level or press Random."
          ) : (
            `Waiting for ${host?.nick ?? "the host"} to pick a level…`
          )}
        </p>
        {isHost && (
          <>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => send({ t: "pick", slug: "random" })}
                className="rounded border-2 border-gold px-4 py-2 font-western text-lg text-gold"
              >
                Random
              </button>
              <button
                type="button"
                onClick={() => send({ t: "start" })}
                disabled={!picked || online < 2 || room.state !== "lobby"}
                className="rounded bg-gold px-6 py-2 font-western text-xl text-dusk disabled:opacity-40"
              >
                {online < 2 ? "Needs 2 players" : "Start (Enter)"}
              </button>
            </div>
            <div className="grid max-h-80 gap-3 overflow-y-auto">
              {WORLDS.map((w, wi) => (
                <div key={w.name} className="grid gap-1">
                  <h2 className="font-western text-gold">
                    World {wi + 1} · {w.name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.filter((l) => l.slug.startsWith(`${wi + 1}-`)).map((l) => (
                      <button
                        key={l.slug}
                        type="button"
                        onClick={() => send({ t: "pick", slug: l.slug })}
                        className={`rounded border-2 px-3 py-1 text-sm ${l.slug === room.slug ? "border-gold bg-gold text-dusk" : "border-plank-edge bg-plank"}`}
                      >
                        {l.slug} · {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <p className="text-sm text-dust">← → change cowboy</p>
    </main>
  );
}

function MemberCard({ index, member, mine, send }: { index: number; member?: MemberView; mine: boolean; send: Props["send"] }) {
  if (!member)
    return (
      <li className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-plank-edge bg-dusk/70 text-dust">
        <span className="font-western text-lg">P{index + 1}</span>
        <span className="text-xs">waiting</span>
      </li>
    );
  const color = PLAYER_COLORS[member.cowboy];
  return (
    <li
      data-testid={`member-${index}`}
      className={`flex h-48 flex-col items-center justify-between rounded-lg border-4 bg-plank p-2 shadow-lg ${member.online ? "" : "opacity-50"}`}
      style={{ borderColor: color }}
    >
      <span className="w-full truncate text-center font-semibold" style={{ color }}>
        {member.nick}
        {member.host && " ★"}
      </span>
      <Portrait cowboy={member.cowboy} />
      <span className="flex w-full items-center justify-between font-western text-base">
        {mine ? (
          <button type="button" aria-label="Previous cowboy" onClick={() => send({ t: "cowboy", dir: -1 })}>
            ◀
          </button>
        ) : (
          <span />
        )}
        {COWBOY_NAMES[member.cowboy]}
        {mine ? (
          <button type="button" aria-label="Next cowboy" onClick={() => send({ t: "cowboy", dir: 1 })}>
            ▶
          </button>
        ) : (
          <span />
        )}
      </span>
      <span className="text-[11px] text-dust">{member.online ? (mine ? "you" : "") : "reconnecting…"}</span>
    </li>
  );
}
