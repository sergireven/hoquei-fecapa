# Pilot Fases Finals: flux simple i automatitzat

Aquest projecte inclou 2 Actions complementàries:

- Workflow: `.github/workflows/prod-pilot-finals-check.yml`
- Nom a GitHub Actions: `Prod Pilot Finals Check`
- Workflow: `.github/workflows/scrape-pilot-finals.yml`
- Nom a GitHub Actions: `Scrape Pilot Finals`

## 1) Configuració (una sola vegada)

No cal cap secret.

La workflow ja porta una URL de prod per defecte:

- `https://hoquei-fecapa.vercel.app`

## 2) Flux recomanat (commit + PR + prod + scrape)

1. Puja el codi (PR) i merge a la branca de producció.
2. Quan Vercel acabi el deploy, ves a `Actions`.
3. Executa `Scrape Pilot Finals`.
4. Aquesta Action llegeix dades live (JOK + FECAPA), genera snapshot i el puja al repo.
5. Revisa a `okCat360` si la lliga pilot té sentit.

## 3) Prova ràpida de salut (opcional)

1. Ves a `Actions`.
2. Obre `Prod Pilot Finals Check`.
3. Clica `Run workflow`.
4. Inputs recomanats:
  - `prod_base_url`: deixa el valor per defecte si és prod oficial.
   - `strict_data`: `false` per smoke test, `true` si vols que falli si no hi ha partits.
   - `jok_comp_id`: `4709`
   - `jok_slug`: `alevi-copa-catalana-plata-fase-final-2025-26`

## 4) Resultat esperat

La Action valida automàticament:

- que l'endpoint respon `ok=true`
- resum de `phases`, `matchCount`
- comptadors per font (`jok`, `fecapa`) i possibles errors

## Quan cal scrape?

- Per provar el pilot runtime (`/api/finals-pilot`): **normalment no cal scrape**.
- Per refrescar snapshots estàtics (`public/data.json`, etc.): sí, fes servir els workflows de scrape existents.
- Per deixar traça específica del pilot en un fitxer versionat: executa `Scrape Pilot Finals`.