import { expect, test, type Page } from "@playwright/test";

const player = (page: Page, i: number) =>
  page.evaluate((i) => {
    const p = window.__parkParty!.world.players[i];
    return { x: p.x, y: p.y, onGround: p.onGround };
  }, i);

test("menu abre a fase 1-1 com 2 jogadores e o teclado controla cada um", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "2P" }).first().click();
  await expect(page).toHaveURL(/\/play\/1-1\?players=2/);
  await expect(page.getByTestId("game-canvas")).toBeVisible();
  await page.waitForFunction(() => window.__parkParty?.world.players.every((p) => p.onGround));

  const p1 = await player(page, 0);
  const p2 = await player(page, 1);

  // J1 anda para a esquerda (A); J2 pula (seta para cima)
  await page.keyboard.down("KeyA");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(150);
  const p2Air = await player(page, 1);
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyA");
  await page.keyboard.up("ArrowUp");

  expect((await player(page, 0)).x).toBeLessThan(p1.x);
  expect(p2Air.y).toBeLessThan(p2.y);

  // R reinicia todos
  await page.keyboard.press("KeyR");
  await page.waitForFunction(() => window.__parkParty!.world.resets === 1);
  expect((await player(page, 0)).x).toBeCloseTo(p1.x, 0);
});
