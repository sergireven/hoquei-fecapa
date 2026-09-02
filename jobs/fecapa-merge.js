function normalizeText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompName(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategoryKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const CATEGORY_ALIASES = {
  nacional_catalana: "Nacional Catalana",
  primera_catalana: "1ª Catalana",
  segona_catalana: "2ª Catalana",
  tercera_catalana: "3ª Catalana",
  fem: "Fem",
  junior: "Júnior",
  juvenil: "Juvenil",
  infantil: "Infantil",
  alevi: "Aleví",
  benjami: "Benjamí",
  prebenjami: "Prebenjamí",
  veterans: "Veterans",
};

function detectCompetitionBucket(name) {
  const normalized = normalizeCompName(name || "");
  if (!normalized) return null;

  if (/NACIONAL\s+CATALANA/.test(normalized)) return "Nacional Catalana";
  if (/PRIMERA\s+CATALANA/.test(normalized)) return "1ª Catalana";
  if (/SEGONA\s+CATALANA/.test(normalized)) return "2ª Catalana";
  if (/TERCERA\s+CATALANA/.test(normalized)) return "3ª Catalana";
  if (/JUNIOR/.test(normalized) || /JÚNIOR/.test(normalized)) return "Júnior";
  if (/JUVENIL/.test(normalized)) return "Juvenil";
  if (/INFANTIL/.test(normalized)) return "Infantil";
  if (/ALEV[ÍI]/.test(normalized) || /ALEVI/.test(normalized)) return "Aleví";
  if (/BENJAM[ÍI]/.test(normalized) || /BENJAMI/.test(normalized)) return "Benjamí";
  if (/PREBENJAM[ÍI]/.test(normalized) || /PREBENJAMI/.test(normalized)) return "Prebenjamí";
  if (/VETERANS/.test(normalized) || /LCV/.test(normalized)) return "Veterans";
  if (/FEM/.test(normalized) || /FEMENI/.test(normalized) || /FEMENINA/.test(normalized)) return "Fem";
  return null;
}

function mapFecapaTeamToClassificationRow(team) {
  const rawTeam = normalizeText(team?.teamName || team?.name || team?.team || "");
  if (!rawTeam) return null;

  return {
    pos: team?.position ?? null,
    teamId: team?.teamId ? String(team.teamId) : null,
    team: rawTeam,
    clubId: team?.logoSrc ? String(team.logoSrc) : null,
    pts: team?.points ?? null,
    pj: team?.played ?? null,
    pg: team?.won ?? null,
    pe: team?.drawn ?? null,
    pp: team?.lost ?? null,
    gf: team?.goalsFor ?? null,
    gc: team?.goalsAgainst ?? null,
    gav: team?.goalDiff ?? null,
    pen: team?.penalties ?? null,
  };
}

function collectFecapaClassification(comp) {
  const rows = [];
  for (const group of Array.isArray(comp?.groups) ? comp.groups : []) {
    for (const team of Array.isArray(group?.teams) ? group.teams : []) {
      const row = mapFecapaTeamToClassificationRow(team);
      if (row) rows.push(row);
    }
  }
  return rows;
}

function collectFecapaCalendar(comp) {
  const matches = [];
  for (const phase of Array.isArray(comp?.competitionPhases) ? comp.competitionPhases : []) {
    for (const match of Array.isArray(phase?.matches) ? phase.matches : []) {
      const home = normalizeText(match?.home || "");
      const away = normalizeText(match?.away || "");
      if (!home || !away) continue;
      matches.push({
        ...match,
        home,
        away,
        source: "fecapa",
        phaseName: phase?.phaseName || match?.phaseName || "",
        phaseType: phase?.phaseType || match?.phaseType || "",
      });
    }
  }
  return matches;
}

function mergeFecapaCompetitionsIntoCategories({ categories = {}, fecapaCategories = {} }) {
  const output = {};
  for (const [catKey, items] of Object.entries(categories)) {
    output[catKey] = Array.isArray(items) ? items.map(item => ({ ...item })) : [];
  }

  const sourceCats = fecapaCategories?.categories || {};
  for (const [sourceKey, comps] of Object.entries(sourceCats)) {
    const sourceBucket = CATEGORY_ALIASES[normalizeCategoryKey(sourceKey)] || null;
    for (const comp of Array.isArray(comps) ? comps : []) {
      const name = normalizeText(comp?.competitionName || comp?.name || "");
      const compId = String(comp?.competitionId || comp?.id || name || "").trim();
      if (!name || !compId) continue;

      const targetCategory = detectCompetitionBucket(name) || sourceBucket || "Altres";
      const bucket = output[targetCategory] || (output[targetCategory] = []);

      const classification = collectFecapaClassification(comp);
      const calendar = collectFecapaCalendar(comp);
      const mappedComp = {
        id: compId,
        name,
        slug: normalizeText(comp?.slug || name),
        competitionId: compId,
        classification,
        calendar,
        teams: [],
        teamToClub: {},
        classificationSource: "fecapa",
        hasPostSeasonPhases: Boolean(
          Array.isArray(comp?.competitionPhases) &&
          comp.competitionPhases.some(phase => phase?.isPostSeason === true || /playoff|eliminat|fase final|final/i.test(String(phase?.phaseName || "")))
        ),
        postSeasonPhases: Array.isArray(comp?.competitionPhases) ? comp.competitionPhases.map(phase => ({ ...phase })) : [],
      };

      const existingIndex = bucket.findIndex(item => {
        const itemId = String(item?.id || item?.competitionId || "").trim();
        const itemName = normalizeCompName(item?.name || "");
        return itemId === compId || (itemName && itemName === normalizeCompName(name));
      });

      if (existingIndex >= 0) {
        const existing = bucket[existingIndex];
        if (classification.length && (!existing.classification || existing.classification.length === 0)) {
          existing.classification = classification;
        } else if (classification.length) {
          existing.classification = classification;
        }
        if (calendar.length && (!existing.calendar || existing.calendar.length === 0)) {
          existing.calendar = calendar;
        } else if (calendar.length) {
          existing.calendar = calendar;
        }
        if (existing.id == null || !String(existing.id || "").trim()) existing.id = compId;
        if (!existing.name) existing.name = name;
        existing.classificationSource = "fecapa";
        existing.competitionId = existing.competitionId || compId;
        continue;
      }

      bucket.push(mappedComp);
    }
  }

  return output;
}

module.exports = {
  mergeFecapaCompetitionsIntoCategories,
};
