import { db } from "./index";
import { levels } from "./schema";
import { LEVELS } from "../game/levels";

async function main() {
  for (const [i, def] of LEVELS.entries()) {
    const row = { slug: `1-${i + 1}`, name: def.name, order: i, data: def };
    await db.insert(levels).values(row).onConflictDoUpdate({ target: levels.slug, set: row });
  }
  console.log(`${LEVELS.length} fases gravadas`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
