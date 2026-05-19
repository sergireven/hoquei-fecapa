#!/usr/bin/env node

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function scrapeJokCatVenues() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    console.log("📍 Scrapeating jok.cat/pavellons...");
    await page.goto("https://jok.cat/pavellons", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Extract pavilion data from the page
    const venues = await page.evaluate(() => {
      const results = {};

      // Try to find pavilion links with coordinates
      const pavellonElements = document.querySelectorAll(
        "a[href*='maps.google.com'], a[href*='maps.apple.com']"
      );

      pavellonElements.forEach((el) => {
        const href = el.getAttribute("href");
        const text = el.textContent || el.innerText;

        // Extract coordinates from Google Maps URL
        let lat, lng;
        const googleMatch = href.match(/q=([\d.]+)[,%20]+([\d.]+)/);
        if (googleMatch) {
          lat = parseFloat(googleMatch[1]);
          lng = parseFloat(googleMatch[2]);
        }

        // Also try Apple Maps format
        const appleMatch = href.match(/q=([\d.]+),([\d.]+)/);
        if (appleMatch && !lat) {
          lat = parseFloat(appleMatch[1]);
          lng = parseFloat(appleMatch[2]);
        }

        // Try to find pavilion name from nearby text
        const parent = el.closest("div, section, li");
        if (parent && lat && lng) {
          const nameEl = parent.querySelector("h1, h2, h3, .title, strong");
          if (nameEl) {
            const name = nameEl.textContent.trim();
            if (name && name.length > 3) {
              results[name] = { lat, lng };
            }
          }
        }
      });

      return results;
    });

    console.log(`✓ Found ${Object.keys(venues).length} pavilions`);

    // Display results
    Object.entries(venues).slice(0, 20).forEach(([name, coords]) => {
      console.log(`  ${name}: ${coords.lat}, ${coords.lng}`);
    });

    await browser.close();
    return venues;
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (browser) await browser.close();
    return {};
  }
}

scrapeJokCatVenues()
  .then((venues) => {
    if (Object.keys(venues).length > 0) {
      console.log("\n✓ Venues data ready for import");
    } else {
      console.log(
        "\n⚠️ No venues found. jok.cat structure may have changed."
      );
    }
  })
  .catch(console.error);
