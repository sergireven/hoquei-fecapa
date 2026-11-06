#!/usr/bin/env node
/**
 * Avisos de canvis de calendari del club.
 *
 * Compara els partits del club entre la versió anterior i la nova de data.json
 * (només data i hora), revisa si els partits moguts tenen conflictes nous
 * (pista, persones, germans) i:
 *   - afegeix una entrada a public/club-changes.json (historial que mostra el panell)
 *   - comenta a una issue de GitHub "Avisos de calendari" → notificació per correu/app
 *
 * Ús: node jobs/club-changes.js --prev /tmp/prev-data.json
 *
 * Env:
 *   CLUB_PATTERN               regex del nom d'equip (per defecte: ripollet)
 *   CLUB_LABEL                 nom per als avisos (per defecte: CH Ripollet)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (opcional) per llegir persones i anotacions
 *   GITHUB_TOKEN, GITHUB_REPOSITORY           (opcional) per comentar a la issue
 *   NOTIFY_MENTION             (opcional) usuari de GitHub a mencionar
 */
const fs = require("fs");
const path = require("path");
const CC = require("../public/js/calendar-conflicts-core");

const ROOT = path.join(__dirname, "..");
const CHANGES_FILE = path.join(ROOT, "public/club-changes.json");
const MAX_ENTRIES = 100;
const ISSUE_LABEL = "calendari-avisos";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function todayKey() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function teamLabel(ev, teamNames = {}) {
  if (teamNames[ev.teamKey]) return teamNames[ev.teamKey];
  if (ev.manual) return ev.team;
  if (!ev.own) return `${ev.team} (${String(ev.compName).replace(/\s*\(\d{4}-\d{2}\)\s*$/, "")})`;
  const letter = (String(ev.team).match(/\s([A-H])$/) || [])[1];
  const level = /INICIACI/i.test(ev.compName) ? " Iniciació" : "";
  return `${ev.category === "Fem" ? "Femení" : ev.category}${letter ? " " + letter : ""}${level}`;
}

function changeLabel(ch, teamNames) {
  const key = `${ch.compId}|${ch.team}`;
  return teamLabel({ teamKey: key, team: ch.team, compName: ch.compName, category: ch.category, own: true }, teamNames);
}

async function loadRecords(pattern) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const { createClient } = require("@supabase/supabase-js");
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.from("club_calendar_data").select("club_name,kind,item_id,data");
    if (error) { console.warn(`[canvis] Supabase: ${error.message}`); return []; }
    return (data || []).filter(r => pattern.test(r.club_name));
  } catch (err) {
    console.warn(`[canvis] Supabase no disponible: ${err.message}`);
    return [];
  }
}

function mergeFep(db, fep) {
  if (!fep?.categories) return db;
  return { ...db, categories: { ...(db?.categories || {}), ...fep.categories } };
}

function summarizeConflict(c, teamNames) {
  const side = ev => ({ label: teamLabel(ev, teamNames), date: ev.date, time: ev.time, isHome: ev.isHome, matchKey: ev.matchKey });
  return {
    id: c.id, type: c.type, severity: c.severity, message: c.message,
    a: side(c.a), b: side(c.b),
    people: (c.people || []).map(p => ({ name: p.name, roles: p.roles || [] })),
  };
}

function markdown(entry, clubLabel, mention) {
  const icon = { canvi: "🔁", nou: "🆕", eliminat: "🗑️" };
  const lines = [];
  lines.push(`### ${clubLabel}: ${entry.changes.length} canvi${entry.changes.length > 1 ? "s" : ""} a jok.cat`);
  if (mention) lines.push(`@${mention}`);
  lines.push("");
  for (const ch of entry.changes) {
    const what = ch.type === "canvi" ? `${ch.from.date} ${ch.from.time} → **${ch.to.date} ${ch.to.time}**`
      : ch.type === "nou" ? `nou: **${ch.to.date} ${ch.to.time}**` : `ja no surt (era ${ch.from.date} ${ch.from.time})`;
    lines.push(`- ${icon[ch.type] || "•"} **${ch.label}** · ${ch.home} – ${ch.away}: ${what}`);
  }
  if (entry.newConflicts.length) {
    lines.push("", `#### ⛔ Conflictes nous (${entry.newConflicts.length})`);
    for (const c of entry.newConflicts) {
      const who = c.people.length ? ` · ${c.people.map(p => p.name).join(", ")}` : "";
      lines.push(`- ${c.severity === "block" ? "⛔" : "⚠️"} ${c.a.date} ${c.a.time} ${c.a.label} ↔ ${c.b.time} ${c.b.label}: ${c.message}${who}`);
    }
  } else {
    lines.push("", "✓ Cap conflicte nou.");
  }
  lines.push("", "_Detall i simulador: panell de coordinador → Calendari i conflictes → Canvis._");
  return lines.join("\n");
}

async function notifyGitHub(body, clubLabel) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo || process.env.CC_NOTIFY === "0") return;
  const api = (p, opts = {}) => fetch(`https://api.github.com/repos/${repo}${p}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  try {
    let issue = (await (await api(`/issues?labels=${ISSUE_LABEL}&state=open&per_page=1`)).json())?.[0];
    if (!issue?.number) {
      const r = await api("/issues", { method: "POST", body: JSON.stringify({
        title: `📅 Avisos de calendari · ${clubLabel}`,
        body: "Aquí s'avisa cada cop que jok.cat mou, afegeix o treu un partit del club, i dels conflictes nous que provoca. Subscriu-te a aquesta issue per rebre-ho al correu o a l'app de GitHub.",
        labels: [ISSUE_LABEL],
      }) });
      issue = await r.json();
    }
    if (!issue?.number) { console.warn("[canvis] no s'ha pogut crear la issue"); return; }
    const r = await api(`/issues/${issue.number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
    console.log(r.ok ? `[canvis] avís publicat a la issue #${issue.number}` : `[canvis] error comentant: HTTP ${r.status}`);
  } catch (err) {
    console.warn(`[canvis] no s'ha pogut avisar: ${err.message}`);
  }
}

async function main() {
  const pattern = new RegExp(process.env.CLUB_PATTERN || "ripollet", "i");
  const clubLabel = process.env.CLUB_LABEL || "CH Ripollet";
  const isClubTeam = name => pattern.test(String(name || ""));
  const prevPath = arg("--prev", "");
  const prevDb = readJson(prevPath, null);
  const nextDb = readJson(path.join(ROOT, "public/data.json"), null);
  if (!prevDb || !nextDb) { console.log("[canvis] falten dades anteriors o noves; res a comparar"); return; }

  const today = todayKey();
  const relevant = ch => [ch.from, ch.to].some(x => x && CC.dayKeyOf(x.date) >= today);
  const changes = CC.diffMatches(prevDb, nextDb, isClubTeam).filter(relevant);
  if (!changes.length) { console.log("[canvis] cap canvi als partits del club"); return; }

  const records = await loadRecords(pattern);
  const teamNames = records.find(r => r.kind === "config" && r.item_id === "main")?.data?.teamNames || {};
  const rosters = readJson(path.join(ROOT, "public/team-rosters.json"), { teams: {}, players: {} });
  const venues = readJson(path.join(ROOT, "public/venues.json"), {}).venues || {};
  const fep = readJson(path.join(ROOT, "public/fep-data.json"), null);

  const conflictsOf = db => {
    const model = CC.buildModel({ db: mergeFep(db, fep), rosters, records, venues, isClubTeam });
    const upcoming = model.events.filter(e => e.dayKey >= today);
    return CC.detectConflicts(upcoming, model);
  };
  const before = new Set(conflictsOf(prevDb).map(c => c.id));
  const changed = new Set(changes.map(c => c.matchKey));
  const newConflicts = conflictsOf(nextDb)
    .filter(c => !before.has(c.id) && (changed.has(c.a.matchKey) || changed.has(c.b.matchKey)))
    .map(c => summarizeConflict(c, teamNames));

  const entry = {
    at: new Date().toISOString(),
    changes: changes.map(ch => ({ ...ch, label: changeLabel(ch, teamNames) })),
    newConflicts,
  };
  const file = readJson(CHANGES_FILE, { club: clubLabel, entries: [] });
  file.club = clubLabel;
  file.updatedAt = entry.at;
  file.entries = [...(file.entries || []), entry].slice(-MAX_ENTRIES);
  fs.writeFileSync(CHANGES_FILE, JSON.stringify(file, null, 1));
  console.log(`[canvis] ${changes.length} canvis, ${newConflicts.length} conflictes nous → ${CHANGES_FILE}`);

  await notifyGitHub(markdown(entry, clubLabel, process.env.NOTIFY_MENTION || ""), clubLabel);
}

if (require.main === module) {
  main().catch(err => { console.error("[canvis] error:", err); process.exit(1); });
}

module.exports = { markdown, summarizeConflict, teamLabel };
