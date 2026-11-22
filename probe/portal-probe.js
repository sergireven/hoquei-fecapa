const fs = require("fs");
const puppeteer = require("puppeteer");
(async () => {
  fs.mkdirSync("probe-out", { recursive: true });
  const b = await puppeteer.launch({ headless: true, args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
  const p = await b.newPage();
  await p.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  const reqs = [];
  p.on("request", r => reqs.push(r.method() + " " + r.url()));
  p.on("framenavigated", f => reqs.push("NAV " + f.url()));
  let status = "";
  try { const r = await p.goto("https://www.hoqueipatins.fecapa.cat/", { waitUntil: "networkidle0", timeout: 60000 }); status = r && r.status(); } catch (e) { status = "ERR " + e.message; }
  await new Promise(r => setTimeout(r, 8000));
  fs.writeFileSync("probe-out/home.html", await p.content());
  const info = await p.evaluate(() => {
    const cls = {};
    document.querySelectorAll("[class]").forEach(e => e.classList.forEach(c => cls[c] = (cls[c]||0)+1));
    return {
      url: location.href, title: document.title,
      rows: document.querySelectorAll(".listado_competiciones_fila").length,
      seasons: [...document.querySelectorAll(".select_temporada")].map(e => ({ temp_name: e.getAttribute("temp_name"), id_temp: e.getAttribute("id_temp"), text: e.textContent.trim() })),
      temp_activa: document.getElementById("temp_activa")?.value ?? null,
      iframes: [...document.querySelectorAll("iframe")].map(f => f.src),
      topClasses: Object.entries(cls).sort((a,b)=>b[1]-a[1]).slice(0,120),
    };
  });
  info.status = status;
  info.frames = p.frames().map(f => f.url());
  for (const [i, f] of p.frames().entries()) { if (i === 0) continue; try { fs.writeFileSync(`probe-out/frame${i}.html`, await f.content()); } catch {} }
  fs.writeFileSync("probe-out/info.json", JSON.stringify(info, null, 2));
  fs.writeFileSync("probe-out/requests.txt", reqs.join("\n"));
  await b.close();
})();
