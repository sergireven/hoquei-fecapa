const fs = require("fs");
const puppeteer = require("puppeteer");
const OUT = "probe-out3"; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await puppeteer.launch({ headless: true, args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
  const p = await b.newPage();
  await p.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await p.goto("https://www.hoqueipatins.fecapa.cat/", { waitUntil: "networkidle0", timeout: 60000 });
  await p.waitForFunction(() => typeof window.sidgadFetch === "function", { timeout: 20000 });
  const calls = [["standing",{id:4946}],["standing",{id:4810}],["standing",{id:4774}],["standing",{id:4999}],["calendar",{id:4946}],["calendar",{id:4774}],["calendar",{id:4999}],["profile",{id:74449,s:41}],["profile",{id:67304,s:41}],["stats",{id:4774}]];
  for (const [r, prm] of calls) {
    const res = await p.evaluate(async (r, prm) => { try { return JSON.stringify(await sidgadFetch(r, prm)); } catch (e) { return "ERR " + e.message; } }, r, prm);
    fs.writeFileSync(`${OUT}/${r}-${Object.values(prm).join("_")}.json`, res);
  }
  await b.close();
})();
