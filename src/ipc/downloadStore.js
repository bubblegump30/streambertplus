const fs = require("fs");
const path = require("path");

function readDownloadStore(file) {
  let lastError;
  for (const candidate of [file, `${file}.bak`]) {
    try {
      const entries = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (!Array.isArray(entries)) throw new Error("Invalid download history");
      return entries.filter((entry) => entry && typeof entry.id === "string")
        .map((entry) => entry.status === "downloading" ? {
          ...entry, status: "interrupted", speed: "",
          lastMessage: "Interrupted before completion. Partial files were preserved. Reopen the title to retry.",
        } : entry);
    } catch (error) { lastError = error; }
  }
  if (lastError?.code !== "ENOENT") console.error("[downloads] Invalid history; original files retained.");
  return [];
}

function writeDownloadStore(file, entries) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(entries, null, 2), "utf8");
  // Preserve the last valid snapshot, never replace it with corrupt input.
  if (fs.existsSync(file)) {
    try {
      if (Array.isArray(JSON.parse(fs.readFileSync(file, "utf8")))) fs.copyFileSync(file, `${file}.bak`);
    } catch (error) {
      if (error instanceof SyntaxError) fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`);
      else throw error;
    }
  }
  fs.renameSync(temporary, file);
}

module.exports = { readDownloadStore, writeDownloadStore };
