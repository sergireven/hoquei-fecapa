const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCalendarGames, parseStanding, parseReportPlayers } = require("../jobs/sidgad-api");

const blank = { home_logo: "", away_name: "--", away_logo: "", result: "--", home_id: null, away_id: null };

test("parseCalendarGames: separa fases (FASE) i jornades (JORNADA)", () => {
  const data = {
    games: [
      { ...blank, idp: "0", dia_partido: "FASE", hora_partido: "4946", home_name: "BCN BENJAMÍ OR 2" },
      { ...blank, idp: "0", dia_partido: "JORNADA", hora_partido: "_", home_name: "JORNADA 3" },
      {
        idp: "154390", dia_partido: "26/09/2026", hora_partido: "17:30",
        home_name: "CH RIPOLLET A", away_name: "CP MASQUEFA A", result: "10:0",
        home_id: "12440", away_id: "11264", home_club_id: "278", away_club_id: "262", pista: "",
      },
      {
        idp: "154391", dia_partido: "28/11/2026", hora_partido: "9:15",
        home_name: " VICIO PHC SANT CUGAT  A", away_name: "CH RIPOLLET A", result: "",
        home_id: "12124", away_id: "12440", home_club_id: "282", away_club_id: "278", pista: "",
      },
    ],
  };
  const phases = parseCalendarGames(data, "4810");
  assert.equal(phases.length, 1);
  assert.equal(phases[0].idc, "4946");
  assert.equal(phases[0].name, "BCN BENJAMÍ OR 2");
  const [played, pending] = phases[0].matches;
  assert.deepEqual(
    [played.idp, played.jornada, played.home, played.homeId, played.homeScore, played.awayScore, played.played],
    ["154390", 3, "CH RIPOLLET A", "12440", 10, 0, true]
  );
  assert.deepEqual([played.day, played.month, played.year, played.time], ["26", "09", "2026", "17:30"]);
  assert.equal(pending.home, "VICIO PHC SANT CUGAT A");
  assert.equal(pending.time, "09:15");
  assert.equal(pending.played, false);
  assert.equal(pending.homeScore, null);
});

test("parseCalendarGames: competició sense fases fa servir l'id de la competició", () => {
  const data = { games: [{ idp: "1", dia_partido: "01/10/2026", hora_partido: "10:00", home_name: "A", away_name: "B", result: "2:2" }] };
  const phases = parseCalendarGames(data, "4999");
  assert.equal(phases.length, 1);
  assert.equal(phases[0].idc, "4999");
  assert.equal(phases[0].name, null);
});

test("parseStanding: files GENERAL separen grups", () => {
  const row = (order, id, name, pts) => ({
    order, team_id: id, club_id: "1", team_name: name, team_logo: "https://x/l.png", team_short: "X",
    points: pts, bonus: "0", played: "9", win: "7", tie: "2", lost: "0", gf: "58", ga: "22", gavg: "36", penalti: "0",
  });
  const sep = (idc, name) => ({ order: "", team_id: "0", club_id: "0", team_name: name, team_logo: idc, team_short: "GENERAL", points: "-" });
  const data = { standings: { standing: [sep("4945", "BCN BENJAMÍ OR 1"), row(1, "11418", "CP RIUDEBITLLES A", "23"), sep("4946", "BCN BENJAMÍ OR 2"), row(1, "12440", "CH RIPOLLET A", "27")] } };
  const groups = parseStanding(data, "4810");
  assert.deepEqual(groups.map(g => [g.idc, g.name, g.rows.length]), [["4945", "BCN BENJAMÍ OR 1", 1], ["4946", "BCN BENJAMÍ OR 2", 1]]);
  assert.deepEqual(
    [groups[1].rows[0].teamName, groups[1].rows[0].points, groups[1].rows[0].goalDiff, groups[1].rows[0].position],
    ["CH RIPOLLET A", 27, 36, 1]
  );
});

test("parseReportPlayers: nom 'COGNOMS,NOM' i porter (P)", () => {
  const data = {
    game_data: {
      home_team_name: "CH RIPOLLET A", home_team_shortName: "RIPA",
      home_roster: [
        { player_id: "1", player_name: "GARCIA PUIG,JAN", player_role: "P", player_categ: "BENA" },
        { player_id: "0", player_name: "BUIT,X" },
      ],
      away_roster: [{ player_id: "2", player_name: "SOLER,PAU", player_role: null, player_categ: "BENA" }],
    },
  };
  const players = parseReportPlayers(data);
  assert.equal(players.length, 2);
  assert.deepEqual([players[0].player_name, players[0].isGK, players[0].registeredTeam], ["GARCIA PUIG JAN", true, "BENA"]);
  assert.equal(players[1].isGK, false);
});
