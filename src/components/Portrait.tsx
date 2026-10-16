"use client";

import { useEffect, useRef } from "react";
import { COWBOYS, COWBOYS_WALK, spriteImage } from "@/game/render";

/** Cowboy em pixel art, andando no lugar. */
export default function Portrait({ cowboy }: { cowboy: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    let step = 0;
    const draw = () => {
      ctx.clearRect(0, 0, 14, 16);
      ctx.drawImage(spriteImage((step++ % 2 ? COWBOYS_WALK : COWBOYS)[cowboy]), 0, 0);
    };
    draw();
    const id = setInterval(draw, 300);
    return () => clearInterval(id);
  }, [cowboy]);
  return <canvas ref={ref} width={14} height={16} className="h-24 w-[84px] [image-rendering:pixelated]" />;
}
