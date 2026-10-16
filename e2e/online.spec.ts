import { expect, test } from "@playwright/test";

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
