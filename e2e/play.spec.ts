import { expect, test, type Page } from "@playwright/test";

const player = (page: Page, i: number) =>
  page.evaluate((i) => {
    const p = window.__sunsetPark!.world.players[i];
    return { x: p.x, y: p.y, onGround: p.onGround };
  }, i);

test("lista de fases sem lobby abre a fase 1-1 com 2 jogadores e o teclado controla cada um", async ({ page }) => {
  await page.goto("/levels?players=2");
  await page.getByRole("link", { name: /^1-1/ }).click();
  await expect(page).toHaveURL(/\/play\/1-1\?players=2/);
  await expect(page.getByTestId("game-canvas")).toBeVisible();
  await page.waitForFunction(() => window.__sunsetPark?.world.players.every((p) => p.onGround));

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
  await page.waitForFunction(() => window.__sunsetPark!.world.resets === 1);
  expect((await player(page, 0)).x).toBeCloseTo(p1.x, 0);
});

test("título → lobby: cada um entra com o próprio pulo, escolhe o cowboy e joga com ele", async ({ page }) => {
  await page.goto("/local");
  // a página pode chegar antes da hidratação: repete a tecla até o lobby abrir
  await expect(async () => {
    await page.keyboard.press("Space");
    await expect(page.getByText("Needs 2 players")).toBeVisible({ timeout: 500 });
  }).toPass();

  // J1 entra pela seta (↑), J2 pelo W; o J1 troca de cowboy com →
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("KeyW");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("seat-0")).toContainText("Bruiser"); // pula o Gunslinger, que é do J2
  await expect(page.getByTestId("seat-1")).toContainText("Gunslinger");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/levels\?team=k1:2,k0:1/);
  await page.getByRole("link", { name: /^1-1/ }).click();
  await expect(page).toHaveURL(/\/play\/1-1\?team=k1:2,k0:1/);
  await page.waitForFunction(() => window.__sunsetPark?.world.players.every((p) => p.onGround));

  // a seta agora comanda o J1 (só ela), e o W o J2
  const before = await player(page, 0);
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(150);
  expect((await player(page, 0)).y).toBeLessThan(before.y);
  expect((await player(page, 1)).onGround).toBe(true);
  await page.keyboard.up("ArrowUp");
});
