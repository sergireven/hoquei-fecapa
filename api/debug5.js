const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Encoding": "identity",
        "Accept-Language": "ca,es;q=0.9",
      }
    }, (res) => {
      res.setEncoding("utf8");
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function main() {
  console.log("Fetching jok.cat/competicions...");
  const html = await get("https://jok.cat/competicions");

  const links = [...html.matchAll(/href="https:\/\/jok\.cat\/competicio\/(\d+)\/([^"]+)"/g)];
  console.log("Total links competicio:", links.length);
  console.log("HTML size:", html.length, "bytes");
  console.log("4304 present:", html.includes("4304"));

  // Count by category
  const pb = links.filter(m => m[2].includes("prebenjami") || m[2].includes("pb-"));
  const bj = links.filter(m => m[2].includes("benjami") && !m[2].includes("prebenjami"));
  console.log("Prebenjami links:", pb.length);
  console.log("Benjami links:", bj.length);

  // Show last 5 links to see if list is truncated
  console.log("\nLast 5 links:");
  links.slice(-5).forEach(m => console.log(" ", m[1], m[2]));

  // Show all prebenjami
  console.log("\nAll prebenjami:");
  pb.forEach(m => console.log(" ", m[1], m[2]));
}

main().catch(console.error);
