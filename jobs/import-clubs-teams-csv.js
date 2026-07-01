#!/usr/bin/env node
/**
 * Import clubs and teams from CSV files to Supabase
 * 
 * Usage:
 *   node jobs/import-clubs-teams-csv.js
 * 
 * Reads:
 *   - public/db-csv/clubs.csv
 *   - public/db-csv/teams.csv
 * 
 * Actions:
 *   1. DELETE all existing clubs and teams (CASCADE)
 *   2. INSERT clubs from clubs.csv
 *   3. INSERT teams from teams.csv
 *   4. Verify counts
 */

const fs = require("fs").promises;
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Parse CSV line (simple implementation)
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function importClubsAndTeams() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[import] SUPABASE_URL and SUPABASE_ANON_KEY env vars required"
    );
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const publicDir = "./public";

  console.log("[import] Starting import from CSV files");

  try {
    // Read CSV files
    const clubsPath = path.join(publicDir, "db-csv", "clubs.csv");
    const teamsPath = path.join(publicDir, "db-csv", "teams.csv");

    const clubsContent = await fs.readFile(clubsPath, "utf-8");
    const teamsContent = await fs.readFile(teamsPath, "utf-8");

    // Parse clubs.csv
    const clubLines = clubsContent.split("\n").filter(l => l.trim());
    const clubHeader = parseCSVLine(clubLines[0]);
    const clubs = [];
    
    for (let i = 1; i < clubLines.length; i++) {
      const values = parseCSVLine(clubLines[i]);
      if (values.length < clubHeader.length) continue;
      
      const row = {};
      for (let j = 0; j < clubHeader.length; j++) {
        row[clubHeader[j]] = values[j] || null;
      }
      
      clubs.push({
        id: row.id,
        name: row.name,
        jok_key: row.jok_key || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    console.log(`[import] Parsed ${clubs.length} clubs from CSV`);

    // Parse teams.csv
    const teamLines = teamsContent.split("\n").filter(l => l.trim());
    const teamHeader = parseCSVLine(teamLines[0]);
    const teams = [];
    
    for (let i = 1; i < teamLines.length; i++) {
      const values = parseCSVLine(teamLines[i]);
      if (values.length < teamHeader.length) continue;
      
      const row = {};
      for (let j = 0; j < teamHeader.length; j++) {
        row[teamHeader[j]] = values[j] || null;
      }
      
      teams.push({
        id: row.id,
        club_id: row.club_id,
        club_name: row.club_name,
        team_name: row.team_name,
        category: row.category,
        season: row.season,
        team_key: row.team_key,
        created_at: row.created_at,
        updated_at: row.updated_at,
        jok_id: row.jok_id || null,
      });
    }

    console.log(`[import] Parsed ${teams.length} teams from CSV`);

    // Step 1: DELETE existing (triggers CASCADE)
    console.log("[import] Deleting existing clubs and teams...");
    const { error: deleteTeamsErr } = await sb.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (deleteTeamsErr && !deleteTeamsErr.message.includes("0 rows")) {
      console.warn("[import] Warning deleting teams:", deleteTeamsErr.message);
    }

    const { error: deleteClubsErr } = await sb.from("clubs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (deleteClubsErr && !deleteClubsErr.message.includes("0 rows")) {
      console.warn("[import] Warning deleting clubs:", deleteClubsErr.message);
    }

    // Step 2: INSERT clubs (batch)
    console.log("[import] Inserting clubs...");
    const BATCH_SIZE = 500;
    let clubBatchIndex = 0;
    
    for (let i = 0; i < clubs.length; i += BATCH_SIZE) {
      const batch = clubs.slice(i, i + BATCH_SIZE);
      clubBatchIndex++;
      
      const { error: clubErr } = await sb
        .from("clubs")
        .insert(batch);
      
      if (clubErr) {
        console.error(
          `[import] Error inserting clubs batch ${clubBatchIndex}:`,
          clubErr.message
        );
        throw clubErr;
      }
      
      console.log(
        `[import] Inserted clubs batch ${clubBatchIndex}/${Math.ceil(clubs.length / BATCH_SIZE)} (${batch.length} clubs)`
      );
    }

    console.log(`[import] Successfully inserted ${clubs.length} clubs`);

    // Step 3: INSERT teams (batch)
    console.log("[import] Inserting teams...");
    let teamBatchIndex = 0;
    
    for (let i = 0; i < teams.length; i += BATCH_SIZE) {
      const batch = teams.slice(i, i + BATCH_SIZE);
      teamBatchIndex++;
      
      const { error: teamErr } = await sb
        .from("teams")
        .insert(batch);
      
      if (teamErr) {
        console.error(
          `[import] Error inserting teams batch ${teamBatchIndex}:`,
          teamErr.message
        );
        throw teamErr;
      }
      
      console.log(
        `[import] Inserted teams batch ${teamBatchIndex}/${Math.ceil(teams.length / BATCH_SIZE)} (${batch.length} teams)`
      );
    }

    console.log(`[import] Successfully inserted ${teams.length} teams`);

    // Step 4: Verify
    const { count: clubCount } = await sb.from("clubs").select("*", { count: "exact", head: true });
    const { count: teamCount } = await sb.from("teams").select("*", { count: "exact", head: true });

    console.log(
      `[import] ✅ Import complete! Clubs: ${clubCount}, Teams: ${teamCount}`
    );

    return { ok: true, clubs: clubCount, teams: teamCount };
  } catch (err) {
    console.error("[import] Fatal error:", err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  importClubsAndTeams().then(() => process.exit(0));
}

module.exports = { importClubsAndTeams };
