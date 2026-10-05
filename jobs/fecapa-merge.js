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
    .replace(/\s*\(\d{4}-\d{2}\)\s*$/i, "")
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
  if (/PREBENJAM[ÍI]/.test(normalized) || /PREBENJAMI/.test(normalized)) return "Prebenjamí";
  if (/BENJAM[ÍI]/.test(normalized) || /BENJAMI/.test(normalized)) return "Benjamí";
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

function collectFecapaClassification(group) {
  const rows = [];
  for (const team of Array.isArray(group?.teams) ? group.teams : []) {
    const row = mapFecapaTeamToClassificationRow(team);
    if (row) rows.push(row);
  }
  return rows;
}

function collectFecapaCalendar(comp, group) {
  const matches = [];
  const groupTeams = new Set(
    (Array.isArray(group?.teams) ? group.teams : [])
      .map(team => normalizeCompName(team?.teamName || team?.name || team?.team || ""))
      .filter(Boolean)
  );
  if (Array.isArray(comp?.groups) && comp.groups.length > 1 && groupTeams.size === 0) return matches;
  for (const phase of Array.isArray(comp?.competitionPhases) ? comp.competitionPhases : []) {
    for (const match of Array.isArray(phase?.matches) ? phase.matches : []) {
      const home = normalizeText(match?.home || "");
      const away = normalizeText(match?.away || "");
      if (!home || !away) continue;
      if (groupTeams.size && (!groupTeams.has(normalizeCompName(home)) || !groupTeams.has(normalizeCompName(away)))) continue;
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

      const groups = Array.isArray(comp?.groups) && comp.groups.length ? comp.groups : [null];
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        const group = groups[groupIndex];
        const groupName = normalizeText(group?.groupName || "");
        const itemName = groups.length === 1 ? name : (groupName || name);
        const matchNameKeys = new Set([groupName, name].map(normalizeCompName).filter(Boolean));
        const classification = collectFecapaClassification(group);
        const calendar = collectFecapaCalendar(comp, group);
        let existingBucket = bucket;
        let existingIndex = bucket.findIndex(item => {
          const itemId = String(item?.id || item?.competitionId || "").trim();
          const itemNameKey = normalizeCompName(item?.name || "");
          return (groups.length === 1 && itemId === compId) ||
            (itemNameKey && matchNameKeys.has(itemNameKey));
        });
        if (existingIndex < 0) {
          for (const [category, items] of Object.entries(output)) {
            if (category === targetCategory) continue;
            const index = items.findIndex(item => matchNameKeys.has(normalizeCompName(item?.name || "")));
            if (index < 0) continue;
            existingBucket = items;
            existingIndex = index;
            break;
          }
        }
        if (!(existingBucket[existingIndex]?.calendar || []).length) {
          for (const [category, items] of Object.entries(output)) {
            if (category === targetCategory) continue;
            const index = items.findIndex(item =>
              matchNameKeys.has(normalizeCompName(item?.name || ""))
              && (item?.calendar || []).length > 0
            );
            if (index < 0) continue;
            existingBucket = items;
            existingIndex = index;
            break;
          }
        }
        const mappedComp = {
          id: groups.length === 1 ? compId : String(group?.groupId || `${compId}-group-${groupIndex + 1}`),
          name: itemName,
          slug: normalizeText(comp?.slug || itemName),
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

        if (existingIndex >= 0) {
          const existing = existingBucket[existingIndex];
          if (classification.length) existing.classification = classification;
          if (calendar.length) existing.calendar = calendar;
          if (existing.id == null || !String(existing.id || "").trim()) existing.id = mappedComp.id;
          if (classification.length) existing.classificationSource = "fecapa";
          existing.competitionId = existing.competitionId || compId;
          if (calendar.length) {
            existing.hasPostSeasonPhases = mappedComp.hasPostSeasonPhases;
            existing.postSeasonPhases = mappedComp.postSeasonPhases;
          }
          if (existingBucket !== bucket) {
            existingBucket.splice(existingIndex, 1);
            const duplicateIndex = bucket.findIndex(item => matchNameKeys.has(normalizeCompName(item?.name || "")));
            if (duplicateIndex >= 0) bucket.splice(duplicateIndex, 1);
            bucket.push(existing);
          }
          continue;
        }

        bucket.push(mappedComp);
      }
    }
  }

  return output;
}

module.exports = {
  mergeFecapaCompetitionsIntoCategories,
};
