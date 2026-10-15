import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { clearedLevelIds, listLevels } from "@/db/queries";
import { WORLDS } from "@/game/levels";
import { teamFromQuery, type Team } from "@/game/lobby";
import { unlockedIds } from "@/game/progress";
import { COWBOY_NAMES, PLAYER_COLORS } from "@/game/render/sprites";

export default function LevelsPage(props: PageProps<"/levels">) {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-dusk bg-[linear-gradient(to_bottom,#2b1846,#1d1118_420px)] p-6 text-sand">
      <Suspense fallback={<p className="text-dust">Loading levels…</p>}>
        <LevelList {...props} />
      </Suspense>
    </main>
  );
}

async function LevelList(props: PageProps<"/levels">) {
  await connection();
  const { team, query } = teamFromQuery(await props.searchParams);
  const [levels, cleared] = await Promise.all([listLevels(), clearedLevelIds()]);
  const unlocked = unlockedIds(levels, cleared);
  const byWorld = Map.groupBy(levels, (l) => Number(l.slug.split("-")[0]));
  return (
    <div className="grid w-full max-w-2xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-western text-4xl text-gold">Pick a level</h1>
        <TeamBar team={team} />
      </header>
      {[...byWorld].map(([world, worldLevels]) => (
        <section key={world} className="grid gap-3">
          <h2 className="font-western text-lg text-gold">
            World {world} · {WORLDS[world - 1]?.name}
          </h2>
          {worldLevels.map((level) =>
            unlocked.has(level.id) ? (
              <Link
                key={level.slug}
                href={`/play/${level.slug}?${query}`}
                className="flex items-center justify-between rounded-lg border-2 border-plank-edge bg-plank p-4 font-semibold shadow-md hover:border-gold"
              >
                <span>
                  {level.slug} · {level.name}
                  {cleared.has(level.id) && <span className="ml-2 text-green-400">✓</span>}
                </span>
                <span className="rounded bg-gold px-2.5 py-1 text-sm text-dusk">Play</span>
              </Link>
            ) : (
              <div key={level.slug} className="flex items-center justify-between rounded-lg border-2 border-plank-edge/60 bg-plank/60 p-4 font-semibold">
                <span className="text-sand/60">
                  {level.slug} · {level.name}
                </span>
                <span className="text-sm text-dust/70">locked</span>
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

function TeamBar({ team }: { team: Team }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {team.map((s, i) => (
        <span key={i} className="flex items-center gap-1 rounded border border-plank-edge bg-plank px-2 py-0.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PLAYER_COLORS[s.cowboy] }} />
          {COWBOY_NAMES[s.cowboy]}
        </span>
      ))}
      <Link href="/" className="text-gold hover:underline">
        change team
      </Link>
    </div>
  );
}
