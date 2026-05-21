const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/home/codespace/.cache/puppeteer/chrome-headless-shell/linux-127.0.6533.88/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

  console.log("Carregant portal...");
  await page.goto("https://www.hoqueipatins.fecapa.cat/", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".listado_competiciones_fila", { timeout: 20000 });

  console.log("Clicant Copa Barcelona (4452)...");
  await page.evaluate(() => document.getElementById("4452")?.click());
  await page.waitForFunction(
    () => document.getElementById("tab_modal_contenido_competicion")?.innerHTML?.length > 200,
    { timeout: 8000 }
  );

  // Guardar HTML del calendari
  const calHtml = await page.evaluate(() => document.getElementById("tab_modal_contenido_competicion")?.innerHTML || "");
  fs.writeFileSync("/tmp/sidgad-4452-calendar.html", calHtml);
  console.log(`HTML calendari: ${calHtml.length} bytes → /tmp/sidgad-4452-calendar.html`);

  // Clicar CLASSIFICACIONS
  console.log("Clicant CLASSIFICACIONS...");
  const found = await page.evaluate(() => {
    const els = [...document.querySelectorAll("a, button, li, span, td, div[onclick]")];
    const tab = els.find(el => el.textContent.trim().toUpperCase().includes("CLASSIFICACI"));
    if (tab) { tab.click(); return tab.textContent.trim(); }
    // Debug: mostrar tots els elements clickables del modal
    const modal = document.getElementById("tab_modal_contenido_competicion");
    const near = modal ? [...modal.closest("div, section, table")?.querySelectorAll("a, button, li[onclick], div[onclick]") || []]
      .slice(0, 15)
      .map(e => ({ tag: e.tagName, txt: e.textContent.trim().slice(0, 50), oc: (e.getAttribute("onclick") || "").slice(0, 60) })) : [];
    return { notFound: true, near };
  });

  console.log("Botó trobat:", found);
  await new Promise(r => setTimeout(r, 1500));

  const classHtml = await page.evaluate(() => document.getElementById("tab_modal_contenido_competicion")?.innerHTML || "");
  fs.writeFileSync("/tmp/sidgad-4452-class.html", classHtml);
  console.log(`HTML classificació: ${classHtml.length} bytes → /tmp/sidgad-4452-class.html`);

  await browser.close();
})();
