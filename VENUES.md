# 📍 Afegir Ubicacions de Pavellons

Aquest document explica com afegir les coordenades dels pavellons perquè apareguin els enlaces a Google Maps i Apple Maps en els partits futurs.

## Com funciona

1. Les coordenades es guarden a `public/venues.json`
2. Quan es veu el detall d'un partit, l'app busca si l'equip local té coordenades
3. Si les té, mostra els enlaces a **Google Maps** 🗺️ i **Apple Maps** 🗺️

## Opció 1: Utilitat Interactiva (Recomanada)

```bash
node manage-venues.js
```

Aquesta utilitat permet:
- ✏️ Afegir/actualitzar coordenades d'equips
- 📋 Listar tots els equips
- 🔍 Cercar coordenades d'un equip
- 🗑️ Esborrar coordenades
- 📊 Veure equips sense coordenades

## Opció 2: Editar directament `public/venues.json`

Obriu `public/venues.json` i afegiu entries com aquesta:

```json
{
  "Sant Josep A": {
    "coordinates": {
      "lat": 41.6893214,
      "lng": 1.5338014486005938
    },
    "addressName": "Sant Josep A"
  }
}
```

## Com trobar les coordenades a jok.cat

1. Aneu a jok.cat i buscaeu un partit de l'equip (ex: https://jok.cat/competicio/4301/BCN+PREBENJAMI+OR+1)
2. Feu clic a la jornada que vulgueu
3. Busqueu el partit de l'equip local
4. Si hi ha una icona de **diana** 🎯 o **ubicació**, feu-hi clic
5. Es mostrarà l'URL amb les coordenades (ex: `https://www.google.com/maps?q=41.6893214,1.5338014486005938`)
6. Copieu els números de latitud i longitud (separats per coma) i afegiu-los a `venues.json`

## Formato de coordenades

- **Latitud**: Entre 41.0 i 42.0 (graus nord per a Catalunya)
- **Longitud**: Entre 0.0 i 3.0 (graus est per a Catalunya)

Exemple vàlid:
- Latitud: 41.6893214
- Longitud: 1.5338014486005938

## Exemple real

Per a Sant Josep A (jornada 17, BCN PREBENJAMI OR 1):
```
Coordenades: 41.6893214, 1.5338014486005938
Google Maps: https://www.google.com/maps?q=41.6893214,1.5338014486005938
Apple Maps: https://maps.apple.com/?q=41.6893214,1.5338014486005938
```

## Dica: Fer-ho automàticament

Si teniu accés a jok.cat API o podeu scrapear les dades, contacteu amb el desenvolupador per integrar un scraper automàtic.
