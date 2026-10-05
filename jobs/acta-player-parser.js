function decodeActaHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDivAfterMarker(html, marker) {
  const markerIndex = String(html || "").indexOf(marker);
  if (markerIndex < 0) return "";
  const start = String(html).indexOf("<div", markerIndex + marker.length);
  if (start < 0) return "";

  const divTags = /<\/?div\b[^>]*>/gi;
  divTags.lastIndex = start;
  let depth = 0;
  let tag;
  while ((tag = divTags.exec(html)) !== null) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth === 0) return String(html).slice(start, divTags.lastIndex);
  }

  return String(html).slice(start);
}

function parsePlayerTable(html) {
  const anchors = [...String(html || "").matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => {
      const playerMatch = String(match[1] || "").match(/\/jugador\/(\d+)\/([^/?#]+)/i);
      return playerMatch ? {
        match,
        playerId: String(playerMatch[1]),
        url: new URL(match[1], "https://jok.cat").href,
        name: decodeActaHtml(match[2]),
      } : null;
    })
    .filter(Boolean);

  return anchors.map((anchor, index) => {
    const next = anchors[index + 1]?.match.index ?? String(html || "").length;
    const rowHtml = String(html || "").slice(anchor.match.index + anchor.match[0].length, next);
    const statCells = [...rowHtml.matchAll(/<div\b[^>]*class=["'][^"']*\bw-1\/12\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)]
      .map(match => {
        const value = decodeActaHtml(match[1]).match(/\b\d+\b/)?.[0];
        return value == null ? null : Number(value);
      });
    const fallbackValues = statCells.length >= 3 ? [] : decodeActaHtml(rowHtml).match(/\b\d+\b/g) || [];
    const values = statCells.length >= 3 ? statCells : fallbackValues.map(Number);
    const name = anchor.name || decodeURIComponent(anchor.url.split("/").pop().replace(/\+/g, " "));
    return {
      name,
      g: Number(values[0] || 0),
      b: Number(values[1] || 0),
      v: Number(values[2] || 0),
      fd: values[3] == null ? null : Number(values[3]),
      pe: values[4] == null ? null : Number(values[4]),
      jugadorId: anchor.playerId,
      url: anchor.url,
    };
  });
}

function extractPlayerStatsRaw(rawText, html = "") {
  const result = {
    columns: ["Jugador", "G", "B", "V", "FD", "Pe"],
    homeBlock: "",
    awayBlock: "",
  };
  const sourceHtml = String(html || "");
  const localMarker = "<!-- Local Team Players Table -->";
  const visitorMarker = "<!-- Visitor Team Players Table -->";
  const localIndex = sourceHtml.indexOf(localMarker);
  const visitorIndex = sourceHtml.indexOf(visitorMarker);

  if (localIndex >= 0 && visitorIndex > localIndex) {
    const localHtml = sourceHtml.slice(localIndex, visitorIndex);
    const visitorHtml = extractDivAfterMarker(sourceHtml, visitorMarker);
    result.homePlayers = parsePlayerTable(localHtml);
    result.awayPlayers = parsePlayerTable(visitorHtml);
    result.homeBlock = decodeActaHtml(localHtml);
    result.awayBlock = decodeActaHtml(visitorHtml);
    return result;
  }

  const parts = String(rawText || "").split(/Jugador\s+G\s+B\s+V(?:\s+FD\s+Pe)?/i);
  if (parts.length < 3) return result;

  const cleanBlock = txt => String(txt || "")
    .replace(/\s+JOK\.cat[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  result.homeBlock = cleanBlock(parts[1]);
  result.awayBlock = cleanBlock(parts[2]);
  return result;
}

function parsePlayerStats(playerStatsRaw, playerLinks = []) {
  const raw = playerStatsRaw || {};
  if (Array.isArray(raw.homePlayers) && Array.isArray(raw.awayPlayers)) {
    return { homePlayers: raw.homePlayers, awayPlayers: raw.awayPlayers };
  }

  const links = Array.isArray(playerLinks) ? playerLinks : [];
  function parseBlock(block, offset) {
    const result = [];
    const re = /((?:[A-Za-zÀ-ÿ'\-]+ )+?)(\d+) (\d+) (\d+)(?: (\d+) (\d+))?(?= [A-Za-zÀ-ÿ]|$)/g;
    let match;
    while ((match = re.exec(String(block || ""))) !== null) {
      const link = links[offset + result.length] || {};
      result.push({
        name: match[1].trim(),
        g: Number(match[2]),
        b: Number(match[3]),
        v: Number(match[4]),
        fd: match[5] == null ? null : Number(match[5]),
        pe: match[6] == null ? null : Number(match[6]),
        jugadorId: link.jugadorId || link.id || null,
        url: link.url || null,
      });
    }

    if (!result.length && String(block || "").trim() && links.slice(offset).length) {
      const blockLinks = links.slice(offset);
      const tokens = String(block || "").trim().split(/\s+/);
      let tokenIndex = 0;
      for (const link of blockLinks) {
        const nameParts = [];
        while (tokenIndex < tokens.length && !/^\d+$/.test(tokens[tokenIndex])) nameParts.push(tokens[tokenIndex++]);
        result.push({
          name: nameParts.join(" "),
          g: Number(tokens[tokenIndex++] || 0),
          b: Number(tokens[tokenIndex++] || 0),
          v: Number(tokens[tokenIndex++] || 0),
          fd: /^\d+$/.test(tokens[tokenIndex] || "") ? Number(tokens[tokenIndex++]) : null,
          pe: /^\d+$/.test(tokens[tokenIndex] || "") ? Number(tokens[tokenIndex++]) : null,
          jugadorId: link.jugadorId || link.id || null,
          url: link.url || null,
        });
      }
    }
    return result;
  }

  const homePlayers = parseBlock(raw.homeBlock || "", 0);
  const awayPlayers = parseBlock(raw.awayBlock || "", homePlayers.length);
  return { homePlayers, awayPlayers };
}

module.exports = { extractPlayerStatsRaw, parsePlayerStats };