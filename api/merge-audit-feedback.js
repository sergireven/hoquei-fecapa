// merge-audit-feedback.js
// Fusiona feedback exportat (JSON) dins public/classification-audit-feedback.json
// Ús:
//   node api/merge-audit-feedback.js /path/to/feedback.json

const fs = require("fs").promises;
const path = require("path");

const FEEDBACK_FILE = path.join(__dirname, "../public/classification-audit-feedback.json");

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Falta fitxer d'entrada. Ús: node api/merge-audit-feedback.js /path/to/feedback.json");
    process.exit(1);
  }

  const current = JSON.parse(await fs.readFile(FEEDBACK_FILE, "utf8").catch(() => "{\"updatedAt\":null,\"matches\":{}}"));
  const incoming = JSON.parse(await fs.readFile(input, "utf8"));

  const src = incoming.matches && typeof incoming.matches === "object" ? incoming.matches : incoming;
  const dst = current.matches && typeof current.matches === "object" ? current.matches : {};

  for (const [k, v] of Object.entries(src || {})) {
    dst[k] = v;
  }

  const out = {
    updatedAt: new Date().toISOString(),
    matches: dst,
  };

  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(out, null, 2));
  console.log(`✓ Feedback fusionat a ${FEEDBACK_FILE}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
