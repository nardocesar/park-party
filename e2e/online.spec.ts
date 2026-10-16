import { expect, test, type Page } from "@playwright/test";

const playerX = (page: Page, i: number) => page.evaluate((i) => window.__sunsetPark!.world.players[i].x, i);

test("duas abas: criar sala, entrar pelo link, trocar cowboy e escolher fase", async ({ context }) => {
  // mesmo contexto = mesmo navegador: as abas precisam virar jogadores diferentes
  const a = await context.newPage();
  const b = await context.newPage();

  await a.goto("/");
  await a.getByLabel("Nickname").fill("Ana");
  await a.getByRole("button", { name: "Create room" }).click();
  await expect(a).toHaveURL(/\/room\/[A-HJ-NP-Z]{4}$/);
  await expect(a.getByTestId("member-0")).toContainText("Ana");

  await b.goto(a.url());
  await b.getByLabel("Nickname").fill("Bia");
  await b.getByRole("button", { name: "Join" }).click();
  await expect(a.getByTestId("member-1")).toContainText("Bia");
  await expect(b.getByTestId("member-0")).toContainText("Ana");

  // Bia troca de cowboy com →
  await b.keyboard.press("ArrowRight");
  await expect(a.getByTestId("member-1")).toContainText("Bruiser");

  // só a anfitriã escolhe a fase
  await expect(b.getByRole("button", { name: "Random" })).toHaveCount(0);
  await a.getByRole("button", { name: /^1-2 ·/ }).click();
  await expect(b.getByTestId("picked")).toContainText("1-2");
});

test("partida online: cada aba move o próprio cowboy e a outra vê", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/");
  await a.getByLabel("Nickname").fill("Ana");
  await a.getByRole("button", { name: "Create room" }).click();
  await expect(a).toHaveURL(/\/room\/[A-HJ-NP-Z]{4}$/);
  await b.goto(a.url());
  await b.getByLabel("Nickname").fill("Bia");
  await b.getByRole("button", { name: "Join" }).click();
  await expect(a.getByTestId("member-1")).toContainText("Bia");

  await a.getByRole("button", { name: /^1-1 ·/ }).click();
  await a.getByRole("button", { name: /Start/ }).click();
  for (const p of [a, b]) {
    await expect(p.getByTestId("game-canvas")).toBeVisible();
    // passou a contagem e os dois estão no chão
    await p.waitForFunction(
      () => {
        const w = window.__sunsetPark?.world;
        return !!w && w.frame > 30 && w.players.every((pl) => pl.onGround);
      },
      null,
      { timeout: 15_000 },
    );
  }

  // Bia (assento 1) anda para a direita; Ana vê
  const before = await playerX(a, 1);
  await b.bringToFront();
  await b.keyboard.down("ArrowRight");
  await b.waitForTimeout(600);
  await b.keyboard.up("ArrowRight");
  await expect.poll(() => playerX(a, 1), { timeout: 5_000 }).toBeGreaterThan(before + 20);

  // aba escondida segurando a tecla: os outros veem o cowboy parar
  await b.keyboard.down("ArrowRight");
  await b.waitForTimeout(200);
  await b.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await a.waitForTimeout(500);
  const stopped = await playerX(a, 1);
  await a.waitForTimeout(500);
  expect(await playerX(a, 1)).toBeCloseTo(stopped, 0);
  await b.keyboard.up("ArrowRight");

  // Esc da anfitriã volta todos para a sala
  await a.bringToFront();
  await a.keyboard.press("Escape");
  await expect(b.getByTestId("member-0")).toBeVisible();
});
