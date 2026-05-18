# 🏒 FECAPA Hoquei Patins — Guia de Desplegament

## Arquitectura

```
jok.cat ──► Scraper (Node.js)
                │
                ▼
          data.json  ◄── servit com arxiu estàtic
                │
                ▼
          Frontend (HTML/CSS/JS)
                │
                ▼
          Vercel (hosting gratuït)
          └── Cron job: 02:00 UTC cada dia
```

**Cost: 0€** — tot entra al tier gratuït de Vercel.

---

## Pas 1 — Instal·lar Node.js (si no el tens)

Ves a https://nodejs.org i descarrega la versió LTS (la verda).

---

## Pas 2 — Descarregar i preparar el projecte

1. Descomprimeix el ZIP del projecte
2. Obre una terminal a la carpeta del projecte
3. Genera les dades per primera vegada:

```bash
node api/scraper.js
```

Triga uns 5-10 minuts (fa centenars de peticions a jok.cat).
Crea `public/data.json` amb totes les competicions.

Per veure-ho en local:
```bash
npx serve public -p 3000
# Obre http://localhost:3000
```

---

## Pas 3 — Pujar a GitHub

1. Ves a https://github.com i crea un compte (gratuït)
2. Crea un **nou repositori** (botó verd "New")
   - Nom: `hoquei-fecapa`
   - Visibilitat: **Public** (necessari per Vercel gratuït)
3. A la terminal del projecte:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/EL-TEU-USUARI/hoquei-fecapa.git
git push -u origin main
```

---

## Pas 4 — Desplegar a Vercel

1. Ves a https://vercel.com i inicia sessió amb el compte GitHub
2. Clica **"New Project"** → importa el repositori `hoquei-fecapa`
3. **Build settings** (deixa-les per defecte — no fa falta build)
4. Clica **Deploy**

En 30 segons tens la web a una URL com:
`https://hoquei-fecapa.vercel.app`

---

## Pas 5 — Configurar actualització automàtica

El `vercel.json` ja té el cron configurat:
```json
{
  "crons": [{ "path": "/api/cron", "schedule": "0 2 * * *" }]
}
```

Cada nit a les 2:00 UTC el scraper s'executa sol i actualitza `data.json`.

Per activar-ho necessites el **pla Hobby** de Vercel (gratuït, però cal registrar targeta):
→ https://vercel.com/pricing

Si prefereixes sense targeta, pots actualitzar manualment:
```bash
node api/scraper.js
git add public/data.json
git commit -m "Update data"
git push
```
Vercel redesplega automàticament quan fas push.

---

## Pas 6 — Domini personalitzat (opcional)

A Vercel → Settings → Domains → afegeix el teu domini.
Dominis .cat valen ~15€/any a https://www.nominalia.com o https://www.arsys.es

Exemple: `hoqueicatalunya.cat`

---

## Estructura del projecte

```
hoquei-fecapa/
├── api/
│   ├── scraper.js      ← Scraper principal (Node.js)
│   └── cron.js         ← Endpoint Vercel que executa el scraper
├── public/
│   ├── index.html      ← Frontend (HTML + CSS)
│   ├── js/
│   │   └── app.js      ← Lògica de l'aplicació
│   └── data.json       ← Generat pel scraper (NO pujar al git manual)
├── package.json
├── vercel.json
└── DEPLOY.md           ← Aquest arxiu
```

---

## Actualitzar dades manualment

```bash
node api/scraper.js   # ~5-10 min, descarrega totes les competicions
```

---

## Troubleshooting

**Error "Cannot find module"**
→ Assegura't d'estar a la carpeta del projecte

**data.json buit o error**
→ jok.cat pot tenir rate limiting. Augmenta `DELAY_MS` a `scraper.js` (p.ex. 800ms)

**Escudos no es veuen**
→ sidgad.cloud permet les imatges directament. Si no, caldria un proxy.

**Vercel diu "Function timeout"**
→ Divideix el scraper en múltiples crons (un per categoria)

---

## Notes de privacitat

Les dades s'obtenen de jok.cat, que les publica públicament.
No es guarden dades personals de jugadors.
Consulta els termes d'ús de jok.cat si vols ús comercial.
