import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { clearedLevelIds, listLevels } from "@/db/queries";
import { WORLDS } from "@/game/levels";
import { unlockedIds } from "@/game/progress";

const PLAYER_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-dusk bg-[linear-gradient(to_bottom,#2b1846,#1d1118_420px)] p-6 text-sand">
      <div className="text-center">
        <h1 className="font-western text-6xl text-gold">Park Party</h1>
        <p className="mt-2 text-dust">Plataforma cooperativa: peguem a chave, abram a porta e entrem juntos.</p>
      </div>
      <Suspense fallback={<p className="text-dust">Carregando fases…</p>}>
        <LevelList />
      </Suspense>
      <p className="text-sm text-dust">Teclado compartilhado (até 4) e controles: com 5 a 8 jogadores, os controles 1–4 são os jogadores 5–8.</p>
    </main>
  );
}

async function LevelList() {
  await connection();
  const [levels, cleared] = await Promise.all([listLevels(), clearedLevelIds()]);
  const unlocked = unlockedIds(levels, cleared);
  const byWorld = Map.groupBy(levels, (l) => Number(l.slug.split("-")[0]));
  return (
    <div className="grid w-full max-w-2xl gap-6">
      {[...byWorld].map(([world, worldLevels]) => (
        <section key={world} className="grid gap-3">
          <h2 className="font-western text-lg text-gold">
            Mundo {world} · {WORLDS[world - 1]?.name}
          </h2>
          {worldLevels.map((level) => (
            <div key={level.slug} className="flex items-center justify-between rounded-lg border-2 border-plank-edge bg-plank p-4 shadow-md">
              <span className="font-semibold">
                {level.slug} · {level.name}
                {cleared.has(level.id) && <span className="ml-2 text-green-400">✓</span>}
              </span>
              <span className="flex flex-wrap justify-end gap-1.5">
                {!unlocked.has(level.id) && <span className="text-sm text-dust/70">bloqueada</span>}
                {unlocked.has(level.id) &&
                  PLAYER_OPTIONS.map((n) => (
                    <Link
                      key={n}
                      href={`/play/${level.slug}?players=${n}`}
                      className="rounded bg-gold px-2.5 py-1 text-sm font-semibold text-dusk hover:bg-amber-300"
                    >
                      {n}P
                    </Link>
                  ))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
