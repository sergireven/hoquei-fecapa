#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const VENUES_FILE = path.join(__dirname, "public", "venues.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function main() {
  console.log("📍 FECAPA Venue Coordinates Manager");
  console.log("================================\n");

  let venuesDB = {};
  if (fs.existsSync(VENUES_FILE)) {
    const data = JSON.parse(fs.readFileSync(VENUES_FILE, "utf8"));
    venuesDB = data.venues || {};
  }

  let running = true;
  while (running) {
    console.log("\nOptions:");
    console.log("1. Add/update team coordinates");
    console.log("2. List all teams");
    console.log("3. View team coordinates");
    console.log("4. Delete team coordinates");
    console.log("5. Export teams without coordinates");
    console.log("6. Exit");

    const choice = await question("\nEnter choice (1-6): ");

    switch (choice) {
      case "1": {
        const teamName = await question("Enter team name: ");
        const lat = await question("Enter latitude (e.g., 41.6893214): ");
        const lng = await question("Enter longitude (e.g., 1.5338014486005938): ");

        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          console.log("❌ Invalid coordinates");
          break;
        }

        venuesDB[teamName] = {
          coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
          addressName: teamName,
        };

        fs.writeFileSync(VENUES_FILE, JSON.stringify({ description: "Venue coordinates database", venues: venuesDB }, null, 2));
        console.log(`✓ ${teamName} saved with coordinates: ${lat}, ${lng}`);
        break;
      }

      case "2": {
        if (Object.keys(venuesDB).length === 0) {
          console.log("No teams yet.");
          break;
        }
        console.log("\nTeams in database:");
        Object.keys(venuesDB)
          .slice(0, 20)
          .forEach((team, i) => {
            const coords = venuesDB[team].coordinates;
            const status = coords ? "✓ Has coords" : "✗ No coords";
            console.log(`${i + 1}. ${team} ${status}`);
          });
        if (Object.keys(venuesDB).length > 20) {
          console.log(`... and ${Object.keys(venuesDB).length - 20} more`);
        }
        break;
      }

      case "3": {
        const teamName = await question("Enter team name to view: ");
        const venue = venuesDB[teamName];
        if (!venue) {
          console.log("Team not found.");
          break;
        }
        if (venue.coordinates) {
          const { lat, lng } = venue.coordinates;
          console.log(`\n${teamName}`);
          console.log(`  Coordinates: ${lat}, ${lng}`);
          console.log(`  Google Maps: https://www.google.com/maps?q=${lat},${lng}`);
          console.log(`  Apple Maps: https://maps.apple.com/?q=${lat},${lng}`);
        } else {
          console.log(`${teamName} has no coordinates yet.`);
        }
        break;
      }

      case "4": {
        const teamName = await question("Enter team name to delete: ");
        if (venuesDB[teamName]) {
          delete venuesDB[teamName];
          fs.writeFileSync(VENUES_FILE, JSON.stringify({ description: "Venue coordinates database", venues: venuesDB }, null, 2));
          console.log(`✓ ${teamName} deleted`);
        } else {
          console.log("Team not found.");
        }
        break;
      }

      case "5": {
        const teamsWithoutCoords = Object.keys(venuesDB)
          .filter((team) => !venuesDB[team].coordinates)
          .slice(0, 50);

        console.log(`\n📋 Teams without coordinates (showing first 50):`);
        teamsWithoutCoords.forEach((team, i) => {
          console.log(`${i + 1}. ${team}`);
        });
        console.log(`\nTotal teams without coordinates: ${Object.keys(venuesDB).filter((t) => !venuesDB[t].coordinates).length}`);
        break;
      }

      case "6": {
        running = false;
        console.log("Goodbye!");
        break;
      }

      default:
        console.log("Invalid choice");
    }
  }

  rl.close();
}

main().catch(console.error);
