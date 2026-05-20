const puppeteer = require("puppeteer");

const PORTAL_URL = "https://www.hoqueipatins.fecapa.cat/";
const TEMP_ID = "39";

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&[a-z]+;/gi, " ");
}

function normalizeText(s) {
  return decodeHtmlEntities(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normName(name) {
  return String(name || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferBaseCategory(name) {
  const n = normName(name);
  if (n.includes("PREBENJAMI")) return "prebenjami";
  if (n.includes("BENJAMI")) return "benjami";
  if (n.includes("ALEVI")) return "alevi";
  return null;
}

function parseClassificationSidgad(html) {
  if (!html || html.length < 50) return [];
  const rows = [];

  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
      decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    );
    if (cells.length < 5) continue;

    const posIdx = cells.findIndex(c => /^\d{1,2}$/.test(c) && parseInt(c, 10) >= 1 && parseInt(c, 10) <= 30);
    if (posIdx < 0) continue;
    const pos = parseInt(cells[posIdx], 10);

    const teamIdx = cells.findIndex((c, i) => i > posIdx && c.length > 2 && /[a-zA-Z]/.test(c) && !/^\d+$/.test(c));
    if (teamIdx < 0) continue;

    const teamName = cells[teamIdx].replace(/\s+[A-Z0-9]{2,6}$/, "").trim();
    const nums = cells.slice(teamIdx + 1).map(c => parseInt(c, 10)).filter(n => !Number.isNaN(n));
    if (nums.length < 3) continue;

    const [points = null, played = null, won = null, drawn = null, lost = null, goalsFor = null, goalsAgainst = null, goalDiff = null, penalties = null] = nums;
    const teamIdMatch = tr.match(/\/equip\/(\d+)\//);

    rows.push({
      position: pos,
      teamId: teamIdMatch ? teamIdMatch[1] : null,
      teamName,
      teamShort: null,
      logoSrc: null,
      points,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDiff,
      penalties,
    });
  }

  return rows;
}

function parseClassificationByGroupSidgad(html) {
  if (!html || html.length < 50) return [];

  const groups = [];
  const titles = [...html.matchAll(/<div[^>]*class=['"]?[^'"]*div_titulo_fase_idc[^'"]*['"]?[^>]*>([\s\S]*?)<\/div>/gi)]
    .map(m => normalizeText(m[1]))
    .filter(Boolean);

  const tables = html.match(/<table[^>]*class=['"]?[^'"]*tabla_standard[^'"]*['"]?[^>]*>[\s\S]*?<\/table>/gi)
    || html.match(/<table[^>]*>[\s\S]*?<\/table>/gi)
    || [];

  for (let i = 0; i < tables.length; i += 1) {
    const parsedRows = parseClassificationSidgad(tables[i]);
    if (!parsedRows.length) continue;
    groups.push({
      groupName: titles[i] || `Grup ${i + 1}`,
      teamCount: parsedRows.length,
      teams: parsedRows,
    });
  }

  return groups;
}

async function jqLoad(page, containerId, url, postData, timeoutMs = 12000) {
  return page.evaluate(
    async (cid, u, data, tms) => {
      return new Promise(resolve => {
        const el = document.getElementById(cid);
        if (!el || !window.jQuery) {
          resolve("");
          return;
        }
        window.jQuery(el).load(u, data, function() {
          resolve(el.innerHTML || "");
        });
        setTimeout(() => resolve(el.innerHTML || ""), tms);
      });
    },
    containerId,
    url,
    postData,
    timeoutMs
  );
}

async function loadCompetitionClassificationHtml(page, compId) {
  await page.evaluate(id => document.getElementById(id)?.click(), compId);
  await page.waitForFunction(
    () => {
      const el = document.getElementById("tab_modal_contenido_competicion");
      return el && el.innerHTML.length > 100;
    },
    { timeout: 12000 }
  ).catch(() => {});

  const tabInfo = await page.evaluate(() => {
    const btn = document.getElementById("clasificaciones_btn");
    if (!btn) return null;
    btn.click();
    return {
      file: btn.getAttribute("file") || "",
      filter: btn.getAttribute("filter") || "0",
    };
  });

  let html = await page.evaluate(() => document.getElementById("tab_modal_contenido_competicion")?.innerHTML || "");
  const hasClassif = /div_titulo_fase_idc|tabla_standard|stats_table_special|PUNTS|PT|classificaci/i.test(String(html || ""));
  if (hasClassif) return html;

  if (tabInfo?.file) {
    const forced = await jqLoad(
      page,
      "tab_modal_contenido_competicion",
      tabInfo.file,
      { filter: tabInfo.filter || "0" },
      12000
    );
    if (forced && forced.length > html.length) html = forced;
  }

  return html;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    await page.goto(PORTAL_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForSelector(".listado_competiciones_fila", { timeout: 20000 });

    const allComps = await page.$$eval(
      `.listado_competiciones_fila.temp_${TEMP_ID}`,
      els => els.map(el => ({
        id: el.id,
        name: (el.getAttribute("name") || el.getAttribute("idc_name") || el.textContent || "").trim(),
        hideClasif: /(?:^|;)\s*hide_clasif\s*:\s*1\s*(?:;|$)/i.test(el.getAttribute("config_params") || ""),
      })).filter(c => c.id && c.name)
    );

    const selected = allComps.filter(c => {
      const n = c.name.toUpperCase();
      return !c.hideClasif && (n.includes("PREBENJAM") || n.includes("BENJAM") || n.includes("ALEV"));
    });

    const categories = {
      prebenjami: [],
      benjami: [],
      alevi: [],
    };

    for (const comp of selected) {
      const categoryKey = inferBaseCategory(comp.name);
      if (!categoryKey) continue;

      const classifHtml = await loadCompetitionClassificationHtml(page, comp.id);
      const groups = parseClassificationByGroupSidgad(classifHtml);
      const finalGroups = groups.length ? groups : [{
        groupName: comp.name,
        teamCount: 0,
        teams: parseClassificationSidgad(classifHtml),
      }].filter(g => g.teams.length > 0);

      categories[categoryKey].push({
        competitionId: comp.id,
        competitionName: comp.name,
        groupCount: finalGroups.length,
        teamCount: finalGroups.reduce((acc, g) => acc + g.teamCount, 0),
        groups: finalGroups,
      });
    }

    const out = {
      ok: true,
      source: "fecapa_live_scraper",
      fetchedAt: new Date().toISOString(),
      categories,
    };

    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};
