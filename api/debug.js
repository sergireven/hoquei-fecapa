// Script de diagnòstic — executa: node api/debug.js
const https = require("https");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "ca,es;q=0.9",
      }
    }, (res) => {
      console.log("Status:", res.statusCode);
      console.log("Headers:", JSON.stringify(res.headers, null, 2));
      res.setEncoding("utf8");
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function main() {
  console.log("Fetching jok.cat/competicions...\n");
  const text = await fetchText("https://jok.cat/competicions");
  console.log("\n--- PRIMERS 2000 CARÀCTERS ---");
  console.log(text.slice(0, 2000));
  console.log("\n--- BUSQUEM 'competicio' ---");
  const idx = text.indexOf("competicio");
  if (idx === -1) {
    console.log("⚠️  NO trobat 'competicio' al text!");
  } else {
    console.log("✅ Trobat a posició", idx);
    console.log("Context:", text.slice(idx - 50, idx + 200));
  }
  console.log("\n--- BUSQUEM '2025-26' ---");
  const idx2 = text.indexOf("2025-26");
  if (idx2 === -1) {
    console.log("⚠️  NO trobat '2025-26' al text!");
    console.log("Total caràcters rebuts:", text.length);
  } else {
    console.log("✅ Trobat a posició", idx2);
    console.log("Context:", text.slice(idx2 - 50, idx2 + 100));
  }
}

main().catch(console.error);
