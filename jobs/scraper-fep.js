#!/usr/bin/env node
/**
 * Calendaris de les competicions estatals de la RFEP (OK Liga, Plata, Bronce…)
 * des del portal sidgad de hockeypatines.fep.es → public/fep-data.json
 *
 * Mateix format que data.json (categories → competicions → calendar) perquè el
 * panell de coordinador els pugui fer servir com qualsevol altre equip.
 *
 *  1. Obre el portal amb Puppeteer i llegeix la llista de competicions de la temporada activa.
 *  2. Per a cada competició que passa el filtre, demana rfep_cal_idc_{id}_1.php (des de la pàgina).
 *  3. Parseja les files del calendari: data, hora, jornada, local, visitant, resultat.
 *
 * Env:
 *   FEP_COMP_FILTER  regex sobre el nom (per defecte: OK LIGA)
 *   FEP_OUT          sortida (per defecte: public/fep-data.json)
 */
const fs = require("fs");
const path = require("path");

const PORTAL_URL = "https://www.hockeypatines.fep.es/";
const CAL_URL = id => `https://www.server2.sidgad.es/rfep/rfep_cal_idc_${id}_1.php`;
const OUT = process.env.FEP_OUT || path.join(__dirname, "../public/fep-data.json");
const FILTER = new RegExp(process.env.FEP_COMP_FILTER || "OK LIGA", "i");

function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function text(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function titleCase(s) {
  return String(s || "").toLowerCase().replace(/(^|[\s'(-])\S/g, c => c.toUpperCase()).trim();
}

/** Files <tr class="team_X team_Y team_class" gamedate="…"> del calendari sidgad. */
function parseFepCalendar(html) {
  const out = [];
  let jornada = null;
  const re = /<thead[^>]*class="[^"]*head_jornada[^"]*"[^>]*>([\s\S]*?)<\/thead>|<tr[^>]*class="[^"]*team_class[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] != null) {
      const j = text(m[1]).match(/(\d+)/);
      jornada = j ? Number(j[1]) : jornada;
      continue;
    }
    const row = m[2];
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => x[1]);
    const cells = tds.map(text);
    const date = cells.find(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c)) || "";
    const time = cells.find(c => /^\d{1,2}:\d{2}$/.test(c)) || "";
    const names = [...row.matchAll(/class="[^"]*nombre_junto_logo[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)].map(x => text(x[1]));
    if (names.length < 2) continue;
    const jorCell = cells.find(c => /^JORNADA\s+\d+/i.test(c));
    const score = cells.find(c => /^\d+\s*-\s*\d+$/.test(c));
    const [hs, as] = score ? score.split("-").map(x => Number(x.trim())) : [null, null];
    const idp = (row.match(/idp="(\d+)"/) || [])[1] || null;
    out.push({
      jornada: jorCell ? Number(jorCell.match(/\d+/)[0]) : jornada,
      home: titleCase(names[0]),
      away: titleCase(names[1]),
      date: date ? date.replace(/\//g, "-") : "",
      time,
      ...(score ? { homeScore: hs, awayScore: as } : {}),
      played: !!score,
      ...(idp ? { fepId: idp } : {}),
    });
  }
  return out;
}

async function main() {
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(PORTAL_URL, { waitUntil: "networkidle2", timeout: 90000 });
    await page.waitForSelector("a.idc_master", { timeout: 30000 });

    const { season, comps } = await page.evaluate(() => {
      const temp = document.getElementById("temp_activa")?.value || "";
      const name = [...document.querySelectorAll(".select_temporada")].find(e => e.getAttribute("id_temp") === temp)?.getAttribute("temp_name") || "";
      const comps = [...document.querySelectorAll(`a.idc_master.temp_${temp}`)].map(a => ({ id: a.id, name: (a.getAttribute("name") || a.textContent || "").trim() }));
      return { season: name.replace("/", "-"), comps };
    });
    const wanted = comps.filter(c => c.id && FILTER.test(c.name));
    console.log(`[fep] temporada ${season}: ${comps.length} competicions, ${wanted.length} filtrades`);

    const categories = { "OK Liga (RFEP)": [] };
    for (const comp of wanted) {
      const html = await page.evaluate(async (url, id) => {
        const body = new URLSearchParams({ idc: id, site_lang: "es" });
        const r = await fetch(url, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        return r.ok ? r.text() : "";
      }, CAL_URL(comp.id), comp.id).catch(() => "");
      const calendar = parseFepCalendar(html);
      console.log(`[fep] ${comp.id} ${comp.name}: ${calendar.length} partits`);
      if (!calendar.length) continue;
      categories["OK Liga (RFEP)"].push({
        id: `fep-${comp.id}`,
        slug: `fep-${comp.id}`,
        name: `${comp.name} (${season})`,
        source: "rfep",
        calendar,
      });
    }

    const total = categories["OK Liga (RFEP)"].reduce((n, c) => n + c.calendar.length, 0);
    if (!total) throw new Error("No s'ha llegit cap partit de la RFEP");
    fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), season, source: PORTAL_URL, categories }));
    console.log(`[fep] ${total} partits → ${OUT}`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch(err => { console.error("[fep] error:", err.message); process.exit(1); });
}

module.exports = { parseFepCalendar, titleCase };
