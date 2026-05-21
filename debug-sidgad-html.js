// Script per debugar el HTML de clasificacions de Sidgad
const puppeteer = require("puppeteer");
const fs = require("fs");

const PORTAL_URL = "https://www.hoqueipatins.fecapa.cat/";
const TEMP_ID = "39";

(async () => {
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

    console.log("🌐 Carregant portal...");
    await page.goto(PORTAL_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForSelector(".listado_competiciones_fila", { timeout: 20000 });

    // Seleccionar Copa Barcelona (4452)
    console.log("📋 Clidant Copa Barcelona (4452)...");
    await page.click("#4452");
    await page.waitForFunction(
      () => document.getElementById("tab_modal_contenido_competicion")?.innerHTML?.length > 50,
      { timeout: 6000 }
    );

    // Click "CLASSIFICACIONS"
    console.log("📊 Clicant 'CLASSIFICACIONS'...");
    const found = await page.evaluate(() => {
      const allClickable = [...document.querySelectorAll("a, button, li, span, td, div[onclick], [class*='tab'], [class*='nav']")];
      const tab = allClickable.find(el => {
        const txt = el.textContent.trim().toUpperCase();
        return txt.includes("CLASSIFICACI");
      });
      if (tab) {
        tab.click();
        return true;
      }
      return false;
    });

    if (!found) {
      console.log("❌ No es va trobar botó CLASSIFICACIONS");
      process.exit(1);
    }

    await page.waitForFunction(
      () => document.getElementById("tab_modal_contenido_competicion")?.innerHTML?.length > 100,
      { timeout: 5000 }
    ).catch(() => {});

    // Obtenir HTML
    const classHtml = await page.evaluate(() =>
      document.getElementById("tab_modal_contenido_competicion")?.innerHTML || ""
    );

    console.log(`✓ HTML rebut: ${classHtml.length} bytes`);

    // Guardar HTML per analitzar
    fs.writeFileSync("debug-sidgad-class.html", classHtml);
    console.log("✓ HTML guardat a debug-sidgad-class.html");

    // Buscar patrons de grups
    const groupMatches = classHtml.match(/(?:OR|PLATA|GRUPO|GROUPE|GROUP|GRP)\s*(\d+|[A-Z])/gi);
    console.log(`\n🔍 Grups detectats: ${groupMatches ? groupMatches.join(", ") : "NINGÚ"}`);

    // Buscar taules
    const tables = classHtml.match(/<table[^>]*>/gi) || [];
    console.log(`📋 Taules: ${tables.length}`);

    // Buscar divs de grups
    const groupDivs = classHtml.match(/<div[^>]*class=['"]?[^'"]*(?:grup|group|division)[^'"]*['"]?[^>]*>/gi) || [];
    console.log(`📦 Divs de grups: ${groupDivs.length}`);

  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    await browser.close();
  }
})();
