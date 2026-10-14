import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { clearedLevelIds, listLevels } from "@/db/queries";
import { unlockedIds } from "@/game/progress";

const PLAYER_OPTIONS = [2, 3, 4];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-stone-200 p-6 text-stone-800">
      <div className="text-center">
        <h1 className="text-5xl font-bold">Park Party</h1>
        <p className="mt-2 text-stone-600">Plataforma cooperativa: peguem a chave, abram a porta e entrem juntos.</p>
      </div>
      <Suspense fallback={<p className="text-stone-500">Carregando fases…</p>}>
        <LevelList />
      </Suspense>
      <p className="text-sm text-stone-500">Teclado compartilhado (até 4) ou gamepads.</p>
    </main>
  );
}

async function LevelList() {
  await connection();
  const [levels, cleared] = await Promise.all([listLevels(), clearedLevelIds()]);
  const unlocked = unlockedIds(levels, cleared);
  return (
    <div className="grid w-full max-w-xl gap-4">
      {levels.map((level) => (
        <div key={level.slug} className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
          <span className="font-semibold">
            {level.slug} · {level.name}
            {cleared.has(level.id) && <span className="ml-2 text-green-700">✓</span>}
          </span>
          <span className="flex gap-2">
            {!unlocked.has(level.id) && <span className="text-sm text-stone-400">bloqueada</span>}
            {unlocked.has(level.id) &&
              PLAYER_OPTIONS.map((n) => (
                <Link
                  key={n}
                  href={`/play/${level.slug}?players=${n}`}
                  className="rounded bg-stone-800 px-3 py-1 text-sm text-white hover:bg-stone-700"
                >
                  {n}P
                </Link>
              ))}
          </span>
        </div>
      ))}
    </div>
  );
}
