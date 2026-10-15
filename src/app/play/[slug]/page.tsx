import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import Game from "@/components/Game";
import { clearedLevelIds, getBestTime, listLevels } from "@/db/queries";
import { unlockedIds } from "@/game/progress";
import { teamFromQuery } from "@/game/lobby";

export default function PlayPage(props: PageProps<"/play/[slug]">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-dusk p-4">
      <Suspense fallback={<p className="text-dust">Loading level…</p>}>
        <PlayLevel {...props} />
      </Suspense>
    </main>
  );
}

async function PlayLevel(props: PageProps<"/play/[slug]">) {
  await connection();
  const { slug } = await props.params;
  const { team, query } = teamFromQuery(await props.searchParams);
  const playerCount = team.length;

  const [levels, cleared] = await Promise.all([listLevels(), clearedLevelIds()]);
  const i = levels.findIndex((l) => l.slug === slug);
  if (i < 0) notFound();
  if (!unlockedIds(levels, cleared).has(levels[i].id)) redirect(`/levels?${query}`);
  const level = levels[i];
  const next = levels[i + 1];

  return (
    <Game
      key={`${slug}-${query}`}
      levelId={level.id}
      name={`${level.slug} · ${level.name}`}
      def={level.data}
      team={team}
      menuHref={`/levels?${query}`}
      nextHref={next ? `/play/${next.slug}?${query}` : null}
      bestMs={await getBestTime(level.id, playerCount)}
    />
  );
}
