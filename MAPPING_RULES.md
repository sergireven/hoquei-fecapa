# Mapping Rules (JOK ↔ FECAPA)

## Objetivo
Definir IDs canónicos por entidad y una tabla de correspondencias entre fuentes (`jok`, `fecapa`).

## IDs Canónicos
- `cmp_*`: competición/liga
- `grp_*`: grupo/fase
- `team_*`: equipo
- `club_*`: club
- `player_*`: jugador
- `acta_*`: acta/partido

Se generan por hash estable de una clave normalizada (sin acentos, uppercase, espacios colapsados).

## Reglas de Normalización
1. Texto base:
- Quitar acentos
- Uppercase
- Sustituir no alfanumérico por espacio
- Colapsar espacios

2. Competiciones:
- Se ignoran tokens de temporada (`2025`, `2026`, `25`, `26`)
- Clave recomendada: `categoria_normalizada + nombre_competicion_normalizado`

3. Clubes:
- Derivados del nombre base del equipo
- Se elimina sufijo de letra final (`A`, `B`, `C`...) cuando aplique

4. Grupos:
- Clave recomendada: `competition_key + group_name_normalized`

## Tabla de Mapping
Se genera en `public/entity-mapping.json` con esta estructura:
- `mappings.competition`
- `mappings.group`
- `mappings.team`
- `mappings.club`
- `mappings.player`
- `mappings.acta`

Cada fila incluye:
- `canonicalId`
- `source` (`jok` | `fecapa`)
- `sourceId`
- `sourceName`
- Referencias a canonicalId padre cuando aplique (competición/grupo/club)

## Regla de Prioridad de Clasificación (prebenjamín)
1. Si existe clasificación FECAPA compatible para la competición prebenjamín, prioridad FECAPA.
2. Si no existe, usar JOK.
3. Si no existe ninguna, `none`.

## Problema detectado en UI
`public/js/app.js` estaba sobrescribiendo `classificationSource` a `jok` para cualquier clasificación no vacía dentro de `applyClassificationSourceMerge()`.
Esto enmascaraba competiciones ya marcadas como `fecapa` por backend.

## Script
Generación de mapping:

```bash
node api/build-entity-mapping.js
```

Salida:
- `public/entity-mapping.json`
