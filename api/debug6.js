// debug6.js — verifica escuts al data.json i a jok.cat
const https = require("https");
const fs    = require("fs");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Encoding": "identity",
      }
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
  // 1. Check clubIndex in data.json
  const data = JSON.parse(fs.readFileSync("./public/data.json", "utf8"));
  const idx  = data.clubIndex || {};
  const total   = Object.keys(idx).length;
  const withId  = Object.values(idx).filter(v => v.clubId).length;
  console.log(`clubIndex: ${total} entries, ${withId} with clubId (${Math.round(withId/total*100)}%)`);
  
  // Show first 5 with clubId and first 5 without
  console.log("\nWith clubId:");
  Object.entries(idx).filter(([,v])=>v.clubId).slice(0,5).forEach(([k,v])=>
    console.log(`  teamId:${k} name:${v.name} clubId:${v.clubId}`));
  
  console.log("\nWithout clubId:");
  Object.entries(idx).filter(([,v])=>!v.clubId).slice(0,5).forEach(([k,v])=>
    console.log(`  teamId:${k} name:${v.name}`));

  // 2. Fetch one competition page and look for logos pattern
  console.log("\n--- Fetching BCN Prebenjami OR 1 to check logo HTML ---");
  const html = await fetchText("https://jok.cat/competicio/4301/bcn-prebenjami-or-1-2025-26");
  
  // Find all logo patterns
  const logos  = [...html.matchAll(/logos_clubes\/(\d+)[._]/g)];
  const equips = [...html.matchAll(/\/equip\/(\d+)\//g)];
  console.log(`Logos found: ${logos.length}, Equip links: ${equips.length}`);
  
  // Show context around first logo
  const firstLogo = logos[0];
  if (firstLogo) {
    console.log("\nFirst logo context:");
    console.log(html.slice(firstLogo.index - 50, firstLogo.index + 200));
  }
  
  // Show a classification row to see exact structure
  const rowIdx = html.indexOf("classCol-team");
  if (rowIdx > 0) {
    console.log("\nFirst classCol-team row (300 chars):");
    console.log(html.slice(rowIdx - 200, rowIdx + 400));
  }
}

main().catch(console.error);
