// Sonda temporal: com carrega el portal sidgad de la RFEP (hockeypatines.fep.es)
const puppeteer = require("puppeteer");
const fs = require("fs");
const OUT = "probe-out";
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => { console.log(...a); fs.appendFileSync(`${OUT}/log.txt`, a.join(" ") + "\n"); };

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const reqs = [];
  page.on("request", r => {
    const u = r.url();
    if (/sidgad|fep\.es/.test(u) && !/\.(png|jpe?g|gif|svg|css|woff2?|ttf)(\?|$)/i.test(u)) reqs.push({ method: r.method(), url: u, post: r.postData() || "" });
  });
  for (const url of ["https://www.hockeypatines.fep.es/", "https://www.hockeypatines.fep.es/league/2819"]) {
    reqs.length = 0;
    log("\n==== ", url);
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise(r => setTimeout(r, 4000));
      const info = await page.evaluate(() => ({
        title: document.title,
        vars: Object.fromEntries(["ruta_files", "id_temp", "idm", "id_web", "temp_activa", "ruta", "url_base"].map(k => [k, typeof window[k] === "undefined" ? null : String(window[k])])),
        tempActiva: document.getElementById("temp_activa")?.value || null,
        temporadas: [...document.querySelectorAll(".select_temporada")].slice(0, 5).map(e => ({ id: e.getAttribute("id_temp"), name: e.getAttribute("temp_name") })),
        compLinks: [...document.querySelectorAll("a, [id], [idc], [id_league]")].map(e => ({ tag: e.tagName, id: e.id, href: e.getAttribute("href"), idc: e.getAttribute("idc"), text: (e.textContent || "").trim().slice(0, 80) }))
          .filter(x => /plata|league|liga/i.test((x.text || "") + (x.href || ""))).slice(0, 150),
        gameReports: document.querySelectorAll(".game_report").length,
        scripts: [...document.scripts].map(s => s.src || ("inline:" + s.textContent.slice(0, 300))).slice(0, 40),
      }));
      log(JSON.stringify(info, null, 1));
      const html = await page.content();
      fs.writeFileSync(`${OUT}/${url.includes("league") ? "league" : "home"}.html`, html);
      log("REQUESTS:\n" + reqs.map(r => `${r.method} ${r.url} ${r.post}`).join("\n"));
    } catch (e) { log("ERROR", e.message); }
  }
  await browser.close();
})();
