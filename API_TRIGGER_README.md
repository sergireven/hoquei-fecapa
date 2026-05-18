# 🚀 GitHub Action Trigger — Admin Panel

## Característica

Els admins poden disparar el scraper directament des del panell d'administrador sense necessitat d'accedir a GitHub Actions.

## Arquitectura

```
Admin Panel (app.js)
    ↓
triggerScraper() — POST /api/trigger-scraper
    ↓
API Server (server.js)
    ↓ (GitHub API)
GitHub Actions Workflow (scraper.yml)
    ↓
Executa el scraper i fa commit a main
```

## Setup

### 1. Generar GitHub Personal Access Token

1. Ves a: https://github.com/settings/personal-access-tokens/new
2. Configuració:
   - **Token name**: `hoquei-fecapa-scraper`
   - **Repository access**: `Only select repositories` → `hoquei-fecapa`
   - **Permissions**: `Actions` → `Read and write`
3. **Copia el token** (no el podràs veure de nou!)

### 2. Local development

```bash
# Crear .env amb el token
echo "GITHUB_TOKEN=ghp_xxxxxx" > .env

# Instalar dependències
npm install

# Executar servidor
npm run server

# En altre terminal:
npm run dev
```

### 3. Producció (Vercel)

1. **Vercel Dashboard** → Settings → Environment Variables:
   - `GITHUB_TOKEN`: `ghp_xxxxxx`

2. Deploy amb `git push` (vercel.json ja està configurat)

## Testing

```bash
# Health check
curl http://localhost:3001/health

# Trigger scraper (require admin email)
curl -X POST http://localhost:3001/api/trigger-scraper \
  -H "Content-Type: application/json" \
  -d '{"adminEmail": "admin@example.com"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Scraper triggered successfully"
}
```

## Files

- **api/server.js** — Express server amb endpoint `/api/trigger-scraper`
- **public/js/app.js** — Funció `triggerScraper()` i botó al panell admin
- **.env.example** — Variables d'entorn necessàries
- **vercel.json** — Configuració per desplegar a Vercel amb servidor Node.js

## Seguretat

✅ Token emmagatzemat en **variable d'entorn** (no al codi)
✅ Validació de format de token
✅ Logging de peticions (qui dispara, quan)
✅ CORS permès (frontend pot cridar l'API)
✅ Endpoint protegit per autenticació Supabase (requereix admin email)

## Troubleshooting

**Error 401: Invalid GitHub token**
→ Verifica que el token és correcte i no ha expirat

**Error 404: Workflow not found**
→ Assegura't que el repositori és `sergireven/hoquei-fecapa`

**Error 500: GitHub token not configured**
→ Verifica que `GITHUB_TOKEN` està a les variables d'entorn

**CORS error al frontend**
→ Server.js ja té CORS activat, però verifica l'URL de l'API
