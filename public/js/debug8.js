const https = require("https");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity", "Accept": "text/html,application/json" }
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
  // 1. Get team page and show full golejadors section
  const html = await fetchText("https://jok.cat/equip/10349/CLUB+HOQUEI+RIPOLLET+A");
  
  const gIdx = html.indexOf("Golejadors");
  console.log("=== FULL GOLEJADORS SECTION (1500 chars) ===");
  console.log(html.slice(gIdx, gIdx + 1500));
  
  // 2. Check targetes section
  const tIdx = html.toLowerCase().indexOf("targeta");
  console.log("\n=== TARGETES SECTION ===");
  if (tIdx > -1) console.log(html.slice(tIdx - 50, tIdx + 500));
  else console.log("No trobat");
  
  // 3. Try the players API
  console.log("\n=== PLAYERS API ===");
  try {
    const api = await fetchText("https://jok.cat/api/equip/10349/jugadors");
    console.log("API response (500 chars):", api.slice(0, 500));
  } catch(e) {
    console.log("API error:", e.message);
  }
  
  // 4. Try competition scorers
  console.log("\n=== COMPETITION SCORERS (comp 4301) ===");
  const comp = await fetchText("https://jok.cat/competicio/4301/bcn-prebenjami-or-1-2025-26");
  const sIdx = comp.indexOf("golejador");
  if (sIdx > -1) console.log(comp.slice(sIdx - 50, sIdx + 800));
  else console.log("No trobat a la competicio");
}

main().catch(console.error);
