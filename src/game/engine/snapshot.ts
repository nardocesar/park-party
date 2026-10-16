import type { Level } from "./level";
import type { World } from "./world";

/** Estado sem a fase (estática) nem os eventos do último quadro: é o que a rede envia e o hash compara. */
export function worldToJson(world: World): string {
  return JSON.stringify({ ...world, level: null, events: [] });
}

export function worldFromJson(json: string, level: Level): World {
  return { ...(JSON.parse(json) as World), level, events: [] };
}

/** Cópia profunda que compartilha a fase (ela não muda durante a partida). */
export function cloneWorld(world: World): World {
  return { ...structuredClone({ ...world, level: null }), level: world.level };
}

/** FNV-1a de 32 bits sobre o estado serializado. */
export function hashWorld(world: World): number {
  const s = worldToJson(world);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
