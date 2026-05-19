const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

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

  console.log(
    `Found ${Object.keys(venues).length} unique home teams to scrape.`
  );
  console.log(`Will scrape ${actaToScrape.length} actes...`);

  // Scrape venues (limit to first 10 to test)
  const limit = 10;
  for (let i = 0; i < Math.min(limit, actaToScrape.length); i++) {
    const { teamName, url, actaId } = actaToScrape[i];
    console.log(
      `\n[${i + 1}/${Math.min(limit, actaToScrape.length)}] Scraping ${teamName}...`
    );

    const coordinates = await scrapeVenueCoordinates(url);
    if (coordinates) {
      venues[teamName].coordinates = coordinates;
      console.log(
        `✓ Found: ${coordinates.lat}, ${coordinates.lng}`
      );
    } else {
      console.log(`✗ No coordinates found`);
    }

    // Add delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Save results
  const outputPath = path.join(__dirname, "public", "venues.json");
  fs.writeFileSync(outputPath, JSON.stringify(venues, null, 2));
  console.log(
    `\n✓ Venues saved to ${outputPath} (${Object.keys(venues).length} teams)`
  );

  // Print summary
  const withCoords = Object.values(venues).filter((v) => v.coordinates);
  console.log(`\n📍 Teams with coordinates: ${withCoords.length}/${Object.keys(venues).length}`);
}

main().catch(console.error);
