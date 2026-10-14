import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import Game from "@/components/Game";
import { clearedLevelIds, getBestTime, listLevels } from "@/db/queries";
import { unlockedIds } from "@/game/progress";
import { MAX_PLAYERS } from "@/game/engine/constants";

export default function PlayPage(props: PageProps<"/play/[slug]">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-dusk p-4">
      <Suspense fallback={<p className="text-dust">Carregando fase…</p>}>
        <PlayLevel {...props} />
      </Suspense>
    </main>
  );
}

async function PlayLevel(props: PageProps<"/play/[slug]">) {
  await connection();
  const { slug } = await props.params;
  const { players } = await props.searchParams;
  const playerCount = Math.min(MAX_PLAYERS, Math.max(1, Number(players) || 2));

  const [levels, cleared] = await Promise.all([listLevels(), clearedLevelIds()]);
  const i = levels.findIndex((l) => l.slug === slug);
  if (i < 0) notFound();
  if (!unlockedIds(levels, cleared).has(levels[i].id)) redirect("/");
  const level = levels[i];
  const next = levels[i + 1];

  return (
    <Game
      key={`${slug}-${playerCount}`}
      levelId={level.id}
      name={`${level.slug} · ${level.name}`}
      def={level.data}
      playerCount={playerCount}
      nextHref={next ? `/play/${next.slug}?players=${playerCount}` : null}
      bestMs={await getBestTime(level.id, playerCount)}
    />
  );
}
