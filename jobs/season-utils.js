function inferSeasonLabel(date = new Date()) {
  const resolvedDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(resolvedDate.getTime())) {
    return '2026-27';
  }

  const year = resolvedDate.getFullYear();
  const month = resolvedDate.getMonth();
  const isAcademicYearStart = month >= 7;
  const startYear = isAcademicYearStart ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

function getCurrentSeasonLabelFromEnvOrDate(env = process.env, date = new Date()) {
  const explicit = String(env?.JOK_SEASON || env?.FECAPA_SEASON || '').trim();
  if (explicit) return explicit;

  const fallbackSeason = process.env.CI ? '2026-27' : inferSeasonLabel(date);
  return fallbackSeason;
}

function isSeasonLabelMatchingCurrentSeason(seasonLabel, env = process.env, date = new Date()) {
  const normalized = String(seasonLabel || '').trim();
  if (!normalized) return false;
  return normalized === getCurrentSeasonLabelFromEnvOrDate(env, date);
}

module.exports = {
  inferSeasonLabel,
  getCurrentSeasonLabelFromEnvOrDate,
  isSeasonLabelMatchingCurrentSeason,
};
