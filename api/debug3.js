// debug3.js — mostra l'estructura de la classificació
const https = require("https");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
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
  const html = await fetchText("https://jok.cat/competicio/4301/bcn-prebenjami-or-1-2025-26");
  
  console.log("Total bytes:", html.length);
  
  // Busca 'Equips' (capçalera de la taula de classificació)
  const idx = html.indexOf("Equips");
  console.log("\n=== 'Equips' a posició:", idx, "===");
  if (idx > -1) console.log(html.slice(idx, idx + 1500));
  
  // Busca 'Ripollet' per trobar on és l'equip
  const idx2 = html.indexOf("Ripollet");
  console.log("\n=== 'Ripollet' a posició:", idx2, "===");
  if (idx2 > -1) console.log(html.slice(idx2 - 300, idx2 + 200));
  
  // Busca <table
  const idx3 = html.indexOf("<table");
  console.log("\n=== <table> a posició:", idx3, "===");
  if (idx3 > -1) console.log(html.slice(idx3, idx3 + 800));

  // Busca 'classificaci' (pot estar en atributs data-)
  const idx4 = html.toLowerCase().indexOf("classif");
  console.log("\n=== 'classif' a posició:", idx4, "===");
  if (idx4 > -1) console.log(html.slice(idx4 - 100, idx4 + 400));
}

main().catch(console.error);
