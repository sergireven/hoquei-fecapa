# Implementació preparada: estadístiques entrenador

## Estructura actual del projecte

### Backend / scraping
- `api/scraper.js`
  - Punt principal del scraping.
  - Obté competicions de `jok.cat`.
  - Parseja:
    - llista de competicions
    - classificació
    - calendari
    - indexació bàsica de clubs/equips
  - Escriu la sortida a `public/data.json`.

- `api/cron.js`
  - Probablement executa l’actualització periòdica del scraping a Vercel.

### Frontend
- `public/index.html`
  - Shell principal de la UI.
  - Defineix pantalles:
    - loading
    - home
    - picker
    - detail
  - A detail actualment hi ha 4 pestanyes:
    - `Classificació`
    - `Calendari`
    - `Jugadors`
    - `Entrenador`

- `public/js/app.js`
  - Lògica principal de la UI.
  - Renderitza:
    - favorits
    - clubs
    - competicions
    - detall de competició
    - classificació
    - calendari
    - jugadors (només golejadors/targetes si hi ha dades)

### Dades
- `public/data.json`
  - Fitxer generat pel scraper.
  - Ara mateix conté principalment:
    - `updatedAt`
    - `season`
    - `totalComps`
    - `categories`
    - `clubIndex`

## On s’han de fer els canvis

### 1. Scraping
**Fitxer clau:** `api/scraper.js`

Aquí caldrà:
- ampliar el model de dades per suportar múltiples temporades
- afegir scraping de dades per equip i jugador
- afegir estructures derivades per estadístiques entrenador
- guardar noves claus dins `public/data.json`

### 2. UI
**Fitxers clau:**
- `public/index.html`
- `public/js/app.js`

Aquí caldrà:
- afegir una nova pestanya de detall, per exemple `Entrenador`
- afegir selector de temporada
- renderitzar blocs KPI de jugador i equip
- mantenir l’estil actual de targetes i capçaleres

## Proposta de model de dades a afegir

Afegir a cada competició una estructura nova semblant a:

```json
{
  "season": "2025-26",
  "teamStats": {
    "TEAM_ID": {
      "maxPlayersCalled": 0,
      "avgPlayersPerMatch": 0,
      "multiCategoryPlayers": 0,
      "avgAge": null,
      "oldestPlayer": null,
      "youngestPlayer": null,
      "last3Results": [],
      "trend": "",
      "previousRoundResult": null
    }
  },
  "playerStats": {
    "PLAYER_ID_OR_NAME": {
      "name": "",
      "isGoalkeeper": false,
      "matchesPlayed": 0,
      "matchesOtherCategories": 0,
      "consecutiveMatches": 0,
      "goals": null,
      "yellowCards": null,
      "blueCards": null
    }
  }
}
```

I a nivell global:

```json
{
  "seasons": ["2025-26"],
  "playerIndex": {},
  "teamIndex": {}
}
```

## Limitacions detectades ara mateix

- `api/scraper.js` actualment està orientat només a **una temporada** (`2025-26`).
- En aquesta branca, el scraper ja fa `scrapeTeamPage`/`scrapePlayerPage` i omple estructures com `teamScorers`, `playerStats` i `teamStats`.
- La limitació actual ja no és l’absència d’aquestes dades, sinó que el seu enriquiment i cobertura depenen del que retorni `jok.cat` a les pàgines d’equip/jugador.
- Encara falta consolidar o ampliar, segons necessitat funcional:
  - comparatives entre temporades
  - validació de qualitat/completitud de mètriques avançades
  - robustesa davant canvis d’estructura HTML o camps absents

## Implementació preparada: següents passos recomanats

### Fase 1
1. Refactor de `api/scraper.js` per desacoblar:
   - fetch de temporades
   - fetch de competició
   - càlcul de mètriques
2. Afegir claus noves a `data.json` sense trencar la UI actual.
3. Afegir nova pestanya `Entrenador` a `public/index.html`.
4. Afegir render bàsic a `public/js/app.js` per:
   - selector de temporada
   - KPIs d’equip
   - placeholders de jugadors

### Fase 2
5. Activar/enriquir scraping de pàgines d’equip/jugador si `jok.cat` ho permet.
6. Omplir mètriques avançades.
7. Afegir comparativa entre temporades.

## Estat
Aquesta branca queda preparada amb la documentació tècnica inicial per començar la implementació real sense perdre context.
