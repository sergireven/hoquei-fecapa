const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "../public/data.json");
const FECAPA_FILE = path.join(__dirname, "../public/fecapa-categories.json");
const ACTES_DIR = path.join(__dirname, "../public/actes");
const OUT_FILE = path.join(__dirname, "../public/entity-mapping.json");

function norm(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normCompName(s) {
  return norm(s).replace(/\b(2025|2026|25|26|20\d{2})\b/g, "").replace(/\s+/g, " ").trim();
}

function baseClubName(teamName) {
  return norm(teamName)
    .replace(/\b(A|B|C|D|E|F|G)\b$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashKey(prefix, raw) {
  const h = crypto.createHash("sha1").update(String(raw || "")).digest("hex").slice(0, 12);
  return `${prefix}_${h}`;
}

function addCanonical(map, kind, key) {
  if (!key) return null;
  const full = `${kind}|${key}`;
  if (!map.has(full)) map.set(full, hashKey(kind, full));
  return map.get(full);
}

function pushUnique(arr, item, seen) {
  const k = JSON.stringify(item);
  if (seen.has(k)) return;
  seen.add(k);
  arr.push(item);
}

async function readActes() {
  const out = [];
  let files = [];
  try {
    files = (await fs.readdir(ACTES_DIR)).filter(f => f.endsWith(".json"));
  } catch {
    return out;
  }

  for (const f of files) {
    let parsed = {};
    try {
      parsed = JSON.parse(await fs.readFile(path.join(ACTES_DIR, f), "utf8"));
    } catch {
      continue;
    }
    for (const [actaId, acta] of Object.entries(parsed || {})) {
      out.push({
        actaId: String(actaId || acta?.actaId || "").trim(),
        compId: String(acta?.compId || "").trim(),
        compName: String(acta?.actaMeta?.compName || "").trim(),
        home: String(acta?.home || "").trim(),
        away: String(acta?.away || "").trim(),
      });
    }
  }
  return out;
}

async function main() {
  const data = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  const fecapa = JSON.parse(await fs.readFile(FECAPA_FILE, "utf8"));
  const actes = await readActes();

  const canonicalIds = new Map();

  const mappings = {
    competition: [],
    group: [],
    team: [],
    club: [],
    player: [],
    acta: [],
  };

  const seen = {
    competition: new Set(),
    group: new Set(),
    team: new Set(),
    club: new Set(),
    player: new Set(),
    acta: new Set(),
  };

  // JOK side
  for (const [catName, comps] of Object.entries(data?.categories || {})) {
    for (const comp of comps || []) {
      const compKey = `${norm(catName)}|${normCompName(comp?.name)}`;
      const compCanonicalId = addCanonical(canonicalIds, "cmp", compKey);

      pushUnique(mappings.competition, {
        canonicalId: compCanonicalId,
        source: "jok",
        sourceId: String(comp?.id || ""),
        sourceName: String(comp?.name || ""),
        category: String(catName || ""),
      }, seen.competition);

      // Jok has no explicit group granularity in data.json for many competitions.
      pushUnique(mappings.group, {
        canonicalId: addCanonical(canonicalIds, "grp", `${compKey}|MAIN_GROUP`),
        competitionCanonicalId: compCanonicalId,
        source: "jok",
        sourceId: String(comp?.id || ""),
        sourceName: String(comp?.name || ""),
        groupName: "MAIN_GROUP",
      }, seen.group);

      const teams = new Map();
      for (const r of comp?.classification || []) {
        if (!r?.team) continue;
        teams.set(norm(r.team), { name: r.team, teamId: r.teamId || null, clubId: r.clubId || null });
      }
      for (const t of comp?.teams || []) {
        const name = t?.name || t?.teamName;
        if (!name) continue;
        const existing = teams.get(norm(name)) || {};
        teams.set(norm(name), {
          name,
          teamId: t?.id || t?.teamId || existing.teamId || null,
          clubId: existing.clubId || null,
        });
      }

      for (const t of teams.values()) {
        const teamKey = norm(t.name);
        const teamCanonicalId = addCanonical(canonicalIds, "team", teamKey);
        const clubKey = baseClubName(t.name);
        const clubCanonicalId = addCanonical(canonicalIds, "club", clubKey);

        pushUnique(mappings.team, {
          canonicalId: teamCanonicalId,
          clubCanonicalId,
          source: "jok",
          sourceId: t.teamId ? String(t.teamId) : null,
          sourceName: String(t.name || ""),
          competitionCanonicalId: compCanonicalId,
        }, seen.team);

        pushUnique(mappings.club, {
          canonicalId: clubCanonicalId,
          source: "jok",
          sourceId: t.clubId ? String(t.clubId) : null,
          sourceName: clubKey,
        }, seen.club);
      }
    }
  }

  // FECAPA side
  for (const [catKey, comps] of Object.entries(fecapa?.categories || {})) {
    for (const comp of comps || []) {
      const compKey = `${norm(catKey)}|${normCompName(comp?.competitionName)}`;
      const compCanonicalId = addCanonical(canonicalIds, "cmp", compKey);

      pushUnique(mappings.competition, {
        canonicalId: compCanonicalId,
        source: "fecapa",
        sourceId: String(comp?.competitionId || ""),
        sourceName: String(comp?.competitionName || ""),
        category: String(catKey || ""),
      }, seen.competition);

      for (const g of comp?.groups || []) {
        const groupKey = `${compKey}|${norm(g?.groupName)}`;
        const groupCanonicalId = addCanonical(canonicalIds, "grp", groupKey);

        pushUnique(mappings.group, {
          canonicalId: groupCanonicalId,
          competitionCanonicalId: compCanonicalId,
          source: "fecapa",
          sourceId: String(g?.groupId || ""),
          sourceName: String(g?.groupName || ""),
          groupName: String(g?.groupName || ""),
        }, seen.group);

        for (const t of g?.teams || []) {
          if (!t?.teamName) continue;
          const teamCanonicalId = addCanonical(canonicalIds, "team", norm(t.teamName));
          const clubCanonicalId = addCanonical(canonicalIds, "club", baseClubName(t.teamName));

          pushUnique(mappings.team, {
            canonicalId: teamCanonicalId,
            clubCanonicalId,
            source: "fecapa",
            sourceId: t?.teamId ? String(t.teamId) : null,
            sourceName: String(t.teamName || ""),
            competitionCanonicalId: compCanonicalId,
            groupCanonicalId,
          }, seen.team);

          pushUnique(mappings.club, {
            canonicalId: clubCanonicalId,
            source: "fecapa",
            sourceId: null,
            sourceName: baseClubName(t.teamName),
          }, seen.club);
        }
      }
    }
  }

  // Players
  for (const p of Object.values(data?.jugadors || {})) {
    const pid = p?.jugadorId ? `JID:${p.jugadorId}` : `SLUG:${norm(p?.slug || p?.name || "")}`;
    const canonicalId = addCanonical(canonicalIds, "player", pid);
    pushUnique(mappings.player, {
      canonicalId,
      source: "jok",
      sourceId: p?.jugadorId ? String(p.jugadorId) : null,
      sourceName: String(p?.name || p?.slug || ""),
    }, seen.player);
  }

  // Actes
  for (const a of actes) {
    if (!a.actaId) continue;
    const canonicalId = addCanonical(canonicalIds, "acta", `ACTA:${a.actaId}`);
    pushUnique(mappings.acta, {
      canonicalId,
      source: "jok",
      sourceId: a.actaId,
      sourceName: `${a.home} vs ${a.away}`.trim(),
      compSourceId: a.compId || null,
      compName: a.compName || null,
    }, seen.acta);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    rulesVersion: "v1",
    summary: {
      competitions: mappings.competition.length,
      groups: mappings.group.length,
      teams: mappings.team.length,
      clubs: mappings.club.length,
      players: mappings.player.length,
      actes: mappings.acta.length,
    },
    mappings,
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`✓ entity mapping generated: ${OUT_FILE}`);
  console.log(out.summary);
}

main().catch(err => {
  console.error("Error building entity mapping:", err);
  process.exit(1);
});
