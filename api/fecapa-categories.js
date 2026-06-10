const fs = require("fs").promises;
const path = require("path");

module.exports = async (req, res) => {
  try {
    const dataPath = path.join(process.cwd(), "public", "fecapa-categories.json");
    const raw = await fs.readFile(dataPath, "utf8");
    const json = JSON.parse(raw);
    return res.status(200).json(json);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No s'ha pogut carregar fecapa-categories.json",
      details: error.message,
    });
  }
};
