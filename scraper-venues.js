const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const VENUES_FILE = path.join(__dirname, "public", "venues.json");

function loadExistingVenuesDoc() {
  try {
    const raw = fs.readFileSync(VENUES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.venues && typeof parsed.venues === "object") {
      return parsed;
    }
    // Backward compatibility for legacy shape: top-level map
    if (parsed && typeof parsed === "object") {
      return {
        description: "Venue coordinates database",
        updatedAt: new Date().toISOString(),
        venues: parsed,
      };
    }
  } catch {
    // no-op
  }
  return {
    description: "Venue coordinates database",
    updatedAt: new Date().toISOString(),
    venues: {},
  };
}

// Load all actes and extract unique home teams with their URLs
function extractVenuesFromAcctes() {
  const categories = [
    "alevi",
    "benjami",
    "infantil",
    "alevi",
    "juvenil",
    "junior",
    "nacional-catalana",
    "prebenjami",
    "veterans",
    "fem",
    "altres"
  ];

  const venues = {};
  const actaToScrape = [];

  for (const category of categories) {
    const filePath = path.join(__dirname, `public/actes/${category}.json`);
    if (!fs.existsSync(filePath)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      Object.values(data).forEach((acta) => {
        const teamName = acta.home;
        const url = acta.actaUrl || acta.url;

        if (teamName && url && !venues[teamName]) {
          venues[teamName] = { url, actaId: acta.actaId, coordinates: null };
          actaToScrape.push({ teamName, url, actaId: acta.actaId });
        }
      });
    } catch (e) {
      console.error(`Error loading ${category}.json:`, e.message);
    }
  }

  return { venues, actaToScrape };
}

async function scrapeVenueCoordinates(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        "/home/codespace/.cache/puppeteer/chrome-headless-shell/linux-127.0.6533.88/chrome-headless-shell-linux64/chrome-headless-shell",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    console.log(`Loading: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(2000);

    // Extract coordinates from various possible locations
    const coordinates = await page.evaluate(() => {
      // Try to find Google Maps link
      const mapLinks = [
        ...document.querySelectorAll(
          'a[href*="maps.google.com"], a[href*="google.com/maps"]'
        ),
      ];
      for (const link of mapLinks) {
        const href = link.getAttribute("href");
        const match = href.match(/[\?&]q=([\d.]+),([\d.]+)/);
        if (match) {
          return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        }
      }

      // Try to find coordinates in text (41.xxx,1.xxx format)
      const text = document.body.innerText;
      const coordPattern = /(41\.\d+)[,\s]+(1\.\d+)/g;
      const matches = [...text.matchAll(coordPattern)];
      if (matches.length > 0) {
        return {
          lat: parseFloat(matches[0][1]),
          lng: parseFloat(matches[0][2]),
        };
      }

      // Try to find in data attributes or meta tags
      const allText = document.documentElement.outerHTML;
      const deepMatch = allText.match(
        /(41\.\d{6,10})[,\s]+(1\.\d{6,10})/
      );
      if (deepMatch) {
        return {
          lat: parseFloat(deepMatch[1]),
          lng: parseFloat(deepMatch[2]),
        };
      }

      return null;
    });

    await browser.close();
    return coordinates;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    if (browser) await browser.close();
    return null;
  }
}

async function main() {
  console.log("Extracting venues from actes...");
  const { venues, actaToScrape } = extractVenuesFromAcctes();
  const existingDoc = loadExistingVenuesDoc();
  const existingVenues = existingDoc.venues || {};

  console.log(
    `Found ${Object.keys(venues).length} unique home teams to scrape.`
  );
  console.log(`Will scrape ${actaToScrape.length} actes...`);

  // Scrape venues (optional cap with VENUES_LIMIT for quick tests)
  const requestedLimit = Number(process.env.VENUES_LIMIT || 0);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, actaToScrape.length)
    : actaToScrape.length;
  for (let i = 0; i < limit; i++) {
    const { teamName, url, actaId } = actaToScrape[i];
    console.log(`\n[${i + 1}/${limit}] Scraping ${teamName}...`);

    const coordinates = await scrapeVenueCoordinates(url);
    if (coordinates) {
      venues[teamName] = {
        ...(existingVenues[teamName] || {}),
        ...venues[teamName],
        lat: coordinates.lat,
        lng: coordinates.lng,
      };
      console.log(
        `✓ Found: ${coordinates.lat}, ${coordinates.lng}`
      );
    } else {
      console.log(`✗ No coordinates found`);
    }

    // Add delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Save merged results in canonical shape expected by app.js
  const mergedVenues = {
    ...existingVenues,
    ...venues,
  };
  const outputDoc = {
    ...existingDoc,
    updatedAt: new Date().toISOString(),
    venues: mergedVenues,
  };
  fs.writeFileSync(VENUES_FILE, JSON.stringify(outputDoc, null, 2));
  console.log(`\n✓ Venues saved to ${VENUES_FILE} (${Object.keys(mergedVenues).length} teams)`);

  // Print summary
  const withCoords = Object.values(mergedVenues).filter((v) => {
    const lat = v?.lat ?? v?.coordinates?.lat;
    const lng = v?.lng ?? v?.coordinates?.lng;
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  });
  console.log(`\n📍 Teams with coordinates: ${withCoords.length}/${Object.keys(mergedVenues).length}`);
}

main().catch(console.error);
