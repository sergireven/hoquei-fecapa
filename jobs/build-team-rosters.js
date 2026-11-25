#!/usr/bin/env node
/**
 * Construeix public/team-rosters.json a partir de public/data.json + public/actes/*.json.
 *
 * Per a cada equip (compId|nom equip) guarda quins jugadors han sortit a les seves actes
 * i quantes vegades. El panell de coordinador ho fa servir per detectar jugadors que
 * juguen a més d'un equip del club (conflictes de calendari) sense haver de descarregar
 * totes les actes al navegador (~20 MB).
 *
 * Ús: node jobs/build-team-rosters.js [--data public/data.json] [--actes public/actes] [--out public/team-rosters.json]
 */
const fs = require("fs");
const path = require("path");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function playerNameFromUrl(url) {
  const slug = String(url || "").split("/").filter(Boolean).pop() || "";
  try {
    return decodeURIComponent(slug.replace(/\+/g, " ")).trim();
  } catch {
    return slug.replace(/\+/g, " ").trim();
  }
}

function buildTeamRosters(data, actesByFile) {
  // actaId -> [{ teamKey, side }]
  const actaSides = new Map();
  const teams = {};

  for (const [category, comps] of Object.entries(data?.categories || {})) {
    for (const comp of comps || []) {
      for (const m of comp?.calendar || []) {
        if (!m?.actaId) continue;
        for (const side of ["home", "away"]) {
          const teamName = String(m[side] || "").trim();
          if (!teamName) continue;
          const teamKey = `${comp.id}|${teamName}`;
          if (!teams[teamKey]) {
            teams[teamKey] = { compId: String(comp.id), compName: comp.name || "", category, team: teamName, actes: 0, players: {} };
          }
          if (!actaSides.has(String(m.actaId))) actaSides.set(String(m.actaId), []);
          actaSides.get(String(m.actaId)).push({ teamKey, side });
        }
      }
    }
  }

  const players = {};
  for (const actes of actesByFile) {
    for (const [actaId, acta] of Object.entries(actes || {})) {
      const sides = actaSides.get(String(actaId));
      if (!sides) continue;
      const stats = acta?.playerStats || {};
      for (const { teamKey, side } of sides) {
        const list = Array.isArray(stats[`${side}Players`]) ? stats[`${side}Players`] : [];
        if (!list.length) continue;
        const team = teams[teamKey];
        team.actes += 1;
        for (const p of list) {
          const id = String(p?.jugadorId || "").trim();
          if (!id) continue;
          team.players[id] = (team.players[id] || 0) + 1;
          if (!players[id]) {
            const name = String(p?.name || "").trim() || playerNameFromUrl(p?.url);
            players[id] = { name, gk: /porter/i.test(String(p?.position || "")) || undefined };
          }
        }
      }
    }
  }

  // Treu equips sense cap acta amb jugadors per mantenir el fitxer petit.
  for (const key of Object.keys(teams)) {
    if (!Object.keys(teams[key].players).length) delete teams[key];
  }

  return {
    updatedAt: new Date().toISOString(),
    season: data?.season || "",
    teams,
    players,
  };
}

function main() {
  const dataPath = arg("--data", path.join("public", "data.json"));
  const actesDir = arg("--actes", path.join("public", "actes"));
  const outPath = arg("--out", path.join("public", "team-rosters.json"));

  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const files = fs.existsSync(actesDir) ? fs.readdirSync(actesDir).filter(f => f.endsWith(".json")) : [];
  const actesByFile = files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(actesDir, f), "utf8"));
    } catch (err) {
      console.warn(`[rosters] no s'ha pogut llegir ${f}: ${err.message}`);
      return {};
    }
  });

  const out = buildTeamRosters(data, actesByFile);
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`[rosters] ${Object.keys(out.teams).length} equips, ${Object.keys(out.players).length} jugadors → ${outPath}`);
}

if (require.main === module) main();

module.exports = { buildTeamRosters, playerNameFromUrl };
