// debug2.js — mostra l'HTML al voltant de 2025-26 i busca els links
const https = require("https");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
  const html = await fetchText("https://jok.cat/competicions");
  
  // 1. Mostra HTML al voltant de 2025-26
  const idx = html.indexOf("2025-26");
  console.log("=== HTML AL VOLTANT DE '2025-26' (posició", idx,") ===");
  console.log(html.slice(idx - 100, idx + 500));
  
  // 2. Busca quants links /competicio/ hi ha
  const links = html.match(/href="\/competicio\/\d+\/[^"]+"/g) || [];
  console.log("\n=== LINKS /competicio/ TROBATS:", links.length, "===");
  links.slice(0, 5).forEach(l => console.log(" ", l));
  
  // 3. Busca si hi ha data en format JSON (Vue inline data)
  const vueData = html.indexOf("window.__INITIAL_STATE__");
  const propsData = html.indexOf(":competitions=");
  const jsonData = html.indexOf('"competitions"');
  console.log("\n=== ESTRUCTURES DE DADES ===");
  console.log("window.__INITIAL_STATE__:", vueData);
  console.log(":competitions=", propsData);
  console.log('"competitions":', jsonData);
  
  // 4. Busca el tag <a> mes proper a 2025-26
  const nearLink = html.slice(idx, idx + 2000).match(/<a[^>]+>[^<]+<\/a>/g);
  console.log("\n=== PRIMERS LINKS DESPRES DE 2025-26 ===");
  (nearLink || []).slice(0, 10).forEach(l => console.log(" ", l));
  
  // 5. Busca patrons de competicio en la zona correcta
  console.log("\n=== HTML POSICIO 19700-21000 ===");
  console.log(html.slice(19700, 21000));
}

main().catch(console.error);
