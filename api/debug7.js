// debug7.js — check team page structure at jok.cat for players/scorers
const https = require("https");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity" }
    }, (res) => {
      res.setEncoding("utf8"); let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function main() {
  // Ripollet A teamId = 10349
  const html = await fetchText("https://jok.cat/equip/10349/CLUB+HOQUEI+RIPOLLET+A");
  console.log("HTML size:", html.length);
  
  // Find player/scorer section
  const keywords = ["golejador", "jugador", "targeta", "gol", "Gols", "Jugadors", "player"];
  keywords.forEach(kw => {
    const idx = html.toLowerCase().indexOf(kw.toLowerCase());
    if (idx > -1) {
      console.log(`\n=== "${kw}" at ${idx} ===`);
      console.log(html.slice(Math.max(0,idx-50), idx+300));
    }
  });
}
main().catch(console.error);
