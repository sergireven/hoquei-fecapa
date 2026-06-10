// process-audit-feedback-inbox.js
// Llegeix JSONs d'entrada de .github/audit-feedback/inbox,
// valida i fusiona a public/classification-audit-feedback.json.
//
// Ús:
//   node api/process-audit-feedback-inbox.js
//   node api/process-audit-feedback-inbox.js --consume
//   node api/process-audit-feedback-inbox.js --consume --fail-on-invalid

const fs = require("fs").promises;
const path = require("path");

const FEEDBACK_FILE = path.join(__dirname, "../public/classification-audit-feedback.json");
const INBOX_DIR = path.join(__dirname, "../.github/audit-feedback/inbox");
const REPORT_FILE = path.join(__dirname, "../.github/audit-feedback/last-process-report.json");

const args = new Set(process.argv.slice(2));
const consume = args.has("--consume");
const failOnInvalid = args.has("--fail-on-invalid");

function toISO(value) {
  const d = new Date(value || 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseFeedbackPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.matches && typeof payload.matches === "object") return payload.matches;
  return payload;
}

function normalizeEntry(key, raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const competitionId = String(value.competitionId || "").trim();
  const groupKey = String(value.groupKey || "").trim();
  const verdictRaw = value.verdict == null ? null : String(value.verdict).trim();
  const verdict = verdictRaw === "correct" || verdictRaw === "incorrect" ? verdictRaw : null;
  const manualJokcatGroupId = String(value.manualJokcatGroupId || "").trim();
  const updatedAt = toISO(value.updatedAt) || new Date().toISOString();

  const hasSignal = Boolean(verdict) || Boolean(manualJokcatGroupId);
  if (!competitionId || !groupKey || !hasSignal) {
    return { ok: false, reason: "missing_required_fields", key };
  }

  return {
    ok: true,
    key,
    value: {
      competitionId,
      groupKey,
      verdict,
      manualJokcatGroupId,
      updatedAt,
      actor: value.actor || null,
      source: value.source || "inbox",
    },
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  await fs.mkdir(INBOX_DIR, { recursive: true });
  await fs.mkdir(path.dirname(REPORT_FILE), { recursive: true });

  const current = await readJson(FEEDBACK_FILE, { updatedAt: null, matches: {} });
  const currentMatches = current.matches && typeof current.matches === "object" ? current.matches : {};

  const files = (await fs.readdir(INBOX_DIR))
    .filter(name => name.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const invalid = [];
  let merged = 0;
  let unchanged = 0;
  const outMatches = { ...currentMatches };

  for (const fileName of files) {
    const filePath = path.join(INBOX_DIR, fileName);
    let payload;
    try {
      payload = JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch {
      invalid.push({ file: fileName, reason: "invalid_json" });
      continue;
    }

    const src = parseFeedbackPayload(payload);
    for (const [key, raw] of Object.entries(src || {})) {
      const normalized = normalizeEntry(key, raw);
      if (!normalized.ok) {
        invalid.push({ file: fileName, key, reason: normalized.reason });
        continue;
      }

      const prev = outMatches[key];
      const next = normalized.value;
      if (prev && JSON.stringify(prev) === JSON.stringify(next)) {
        unchanged++;
        continue;
      }

      const prevTs = Date.parse(prev?.updatedAt || 0) || 0;
      const nextTs = Date.parse(next.updatedAt || 0) || 0;
      if (prev && nextTs < prevTs) {
        unchanged++;
        continue;
      }

      outMatches[key] = next;
      merged++;
    }
  }

  const changed = merged > 0;
  if (changed) {
    const out = {
      updatedAt: new Date().toISOString(),
      matches: outMatches,
    };
    await fs.writeFile(FEEDBACK_FILE, JSON.stringify(out, null, 2));
  }

  if (consume && files.length) {
    for (const fileName of files) {
      await fs.rm(path.join(INBOX_DIR, fileName), { force: true });
    }
  }

  const report = {
    processedAt: new Date().toISOString(),
    inboxFiles: files.length,
    merged,
    unchanged,
    invalid,
    consume,
    failOnInvalid,
    changed,
    totalMatches: Object.keys(outMatches).length,
  };
  await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log(`Inbox files: ${files.length}`);
  console.log(`Merged entries: ${merged}`);
  console.log(`Unchanged entries: ${unchanged}`);
  console.log(`Invalid entries: ${invalid.length}`);
  console.log(`Feedback changed: ${changed ? "yes" : "no"}`);

  if (failOnInvalid && invalid.length > 0) {
    console.error("Invalid feedback entries found. Review .github/audit-feedback/last-process-report.json");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
