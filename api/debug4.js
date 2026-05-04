// debug4.js — mostra l'HTML exacte de la classificació
const https = require("https");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,*/*",
        "Accept-Language": "ca,es;q=0.9",
        "Accept-Encoding": "identity",
      }
    }, (res) => {
      res.setEncoding("utf8");
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function main() {
  // Agafem una competició petita per veure millor l'HTML
  const html = await fetchText("https://jok.cat/competicio/4301/bcn-prebenjami-or-1-2025-26");
  
  // Troba el bloc de classificació complet (des d'Equips fins a Equip més golejador)
  const start = html.indexOf("classCol-team");
  const end   = html.indexOf("Equip m\u00E9s golejador");
  
  if (start === -1) { console.log("No trobat classCol-team"); return; }
  
  // Mostra des de 1000 chars abans fins al final
  const block = html.slice(Math.max(0, start-800), end !== -1 ? end : start+5000);
  
  console.log("=== BLOC CLASSIFICACIÓ COMPLET ===");
  console.log(block);
}

main().catch(console.error);
