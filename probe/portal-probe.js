const fs = require("fs");
const puppeteer = require("puppeteer");
const OUT = "probe-out2"; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ headless: true, args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
  const p = await b.newPage();
  await p.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  const reqs = []; let n = 0;
  p.on("response", async r => {
    const u = r.url();
    if (/api\.sidgad\.com|server2\.sidgad\.es\/(?!new_portal\/assets\/(css|images))/.test(u)) {
      const i = n++; let body = ""; try { body = await r.text(); } catch {}
      reqs.push({ i, status: r.status(), method: r.request().method(), url: u, post: r.request().postData() || null, len: body.length });
      const ext = u.includes(".js") && !u.includes("api.sidgad") ? "js" : "txt";
      fs.writeFileSync(`${OUT}/resp-${String(i).padStart(3,"0")}.${ext}`, body);
    }
  });
  await p.goto("https://www.hoqueipatins.fecapa.cat/", { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(4000);
  fs.writeFileSync(`${OUT}/globals.json`, JSON.stringify(await p.evaluate(() => Object.keys(window).filter(k => /sidgad|SIDGAD|Sidgad/.test(k))), null, 1));
  // Click Barcelona zone, then Benjamí
  const log = [];
  async function clickText(sel, re) {
    return p.evaluate((sel, src) => { const re = new RegExp(src, "i"); const el = [...document.querySelectorAll(sel)].find(e => re.test(e.textContent.trim())); if (el) { el.click(); return el.textContent.trim(); } return null; }, sel, re.source);
  }
  log.push("zona " + await clickText("#sidgad-zona-tabs button", /^BARCELONA$/)); await sleep(2500);
  log.push("cat " + await clickText("#sidgad-categorias button", /^BENJAM/)); await sleep(2500);
  const cards = await p.evaluate(() => [...document.querySelectorAll(".sidgad-liga-card")].filter(e => e.offsetParent).map(e => ({ html: e.outerHTML.slice(0, 400), t: e.innerText.replace(/\s+/g, " ").slice(0, 120) })));
  fs.writeFileSync(`${OUT}/cards-bcn-benjami.json`, JSON.stringify(cards, null, 1));
  const mark = n; log.push("reqs before card click " + mark);
  log.push("card " + await clickText(".sidgad-liga-card", /BENJAM[IÍ] OR 2/)); await sleep(8000);
  fs.writeFileSync(`${OUT}/after-card.html`, await p.content());
  log.push("url " + p.url());
  // try opening a calendar/jornadas tab
  const tabs = await p.evaluate(() => [...document.querySelectorAll("button, a")].filter(e => e.offsetParent).map(e => e.textContent.trim()).filter(Boolean).slice(0, 80));
  log.push("visible buttons: " + JSON.stringify(tabs));
  for (const re of [/CALENDARI|CALENDARIO|JORNADAS|PARTIDOS|RESULTADOS/, /CLASIFICACI|CLASSIFICACI/]) { log.push("tab " + await clickText("button, a", re)); await sleep(5000); }
  fs.writeFileSync(`${OUT}/after-tabs.html`, await p.content());
  // try a finished match game report
  log.push("acta " + await p.evaluate(() => { const el = document.querySelector(".sidgad-partido-finalizado, .sidgad-partido-fila"); if (el) { el.click(); return el.outerHTML.slice(0, 600); } return null; })); await sleep(6000);
  fs.writeFileSync(`${OUT}/after-acta.html`, await p.content());
  fs.writeFileSync(`${OUT}/log.txt`, log.join("\n"));
  fs.writeFileSync(`${OUT}/requests.json`, JSON.stringify(reqs, null, 1));
  // old endpoints still alive?
  const old = await p.evaluate(async () => { const out = {}; for (const u of ["https://www.server2.sidgad.es/fecapa/fecapa_ls_1.php", "https://www.server2.sidgad.es/fecapa/"]) { try { const r = await fetch(u); out[u] = r.status + " " + (await r.text()).slice(0, 300); } catch (e) { out[u] = "ERR " + e.message; } } return out; });
  fs.writeFileSync(`${OUT}/old-endpoints.json`, JSON.stringify(old, null, 1));
  await b.close();
})();
