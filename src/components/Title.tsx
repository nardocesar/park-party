"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { loadNick, markAutoJoin, saveNick } from "@/client/nick";
import { VIEW_H, VIEW_W } from "@/game/engine/constants";
import { drawBackground } from "@/game/render";
import { CODE_RE, cleanNick } from "@/net/protocol";

const BG_SCALE = 4;
/** Armazenamento do navegador não avisa mudanças nesta aba: só a leitura importa. */
const noSubscribe = () => () => {};

/** Tela título: apelido + criar sala ou entrar com o código. */
export default function Title() {
  const router = useRouter();
  const saved = useSyncExternalStore(noSubscribe, loadNick, () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const nick = typed ?? saved;
  const [code, setCode] = useState("");
  const bgRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = bgRef.current?.getContext("2d");
    let raf = 0;
    const loop = (now: number) => {
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.setTransform(BG_SCALE, 0, 0, BG_SCALE, 0, 0);
        drawBackground(ctx, now / 40, true);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const valid = cleanNick(nick) !== null;
  const go = (target: string) => {
    saveNick(nick);
    markAutoJoin(target);
    router.push(`/room/${target}`);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-dusk p-6 text-sand">
      <canvas
        ref={bgRef}
        width={VIEW_W * BG_SCALE}
        height={VIEW_H * BG_SCALE}
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-70 [image-rendering:pixelated]"
      />
      <div className="relative text-center drop-shadow-[0_3px_0_#1d1118]">
        <h1 className="font-western text-7xl text-gold sm:text-8xl">Sunset Park</h1>
        <p className="mt-2 text-sand">Grab the key, open the door and walk in together.</p>
      </div>
      <form
        className="relative grid w-full max-w-sm gap-4 rounded-lg bg-dusk/85 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) go("NEW");
        }}
      >
        <label className="grid gap-1 text-sm">
          Nickname
          <input
            value={nick}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={16}
            className="rounded border-2 border-plank-edge bg-plank px-3 py-2 text-base text-sand"
          />
        </label>
        <button type="submit" disabled={!valid} className="rounded bg-gold px-4 py-2 font-western text-xl text-dusk disabled:opacity-40">
          Create room
        </button>
        <div className="flex items-end gap-2">
          <label className="grid flex-1 gap-1 text-sm">
            Room code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="rounded border-2 border-plank-edge bg-plank px-3 py-2 font-mono text-base uppercase tracking-widest text-sand"
            />
          </label>
          <button
            type="button"
            disabled={!valid || !CODE_RE.test(code)}
            onClick={() => go(code)}
            className="rounded border-2 border-gold px-4 py-2 font-western text-lg text-gold disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </form>
    </main>
  );
}
