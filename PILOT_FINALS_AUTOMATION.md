# Fases Finals: validació en producció

Aquest projecte utilitza una Action principal de comprovació:

- Workflow: `.github/workflows/prod-finals-check.yml`
- Nom a GitHub Actions: `Prod Finals Check`

## 1) Configuració (una sola vegada)

No cal cap secret.

La workflow ja porta una URL de prod per defecte:

- `https://hoquei-fecapa.vercel.app`

## 2) Flux recomanat (commit + PR + validació)

1. Puja el codi (PR) i merge a la branca de producció.
2. Quan Vercel acabi el deploy, ves a `Actions`.
3. Executa `Prod Finals Check`.
4. Aquesta Action consulta l'endpoint live de fases finals i valida la resposta.
5. Revisa a `okCat360` que les fases finals es mostrin correctament.

## 3) Prova ràpida de salut (opcional)

1. Ves a `Actions`.
2. Obre `Prod Finals Check`.
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

## Notes operatives

- L'endpoint runtime de fases finals és `/api/finals-pilot` (nom històric), però ara funciona en mode general.
- Ja no es versionen snapshots `public/pilot-finals-*.json` des de GitHub Actions.
- Per refrescar dades estàtiques (`public/data.json`, etc.), fes servir el pipeline de scrape general del projecte.