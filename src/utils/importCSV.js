const ALIASES = {
  nomFournisseur: ["nomfournisseur", "nom", "name", "entreprise", "societe"],
  email: ["email", "mail", "courriel", "contact"],
  typePrestataire: ["typeprestataire", "type", "service", "prestataire"],
  niveauConfiance: ["niveauconfiance", "confiance", "score", "trust"],
  status: ["status", "statut", "etat"],
};

const normalize = (str) => str.toLowerCase().trim().replace(/[^a-z]/g, "");

const mapHeader = (header) => {
  const norm = normalize(header);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.some((a) => normalize(a) === norm)) return field;
  }
  return null;
};

export const parseCSVFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const sep = text.indexOf(";") !== -1 ? ";" : ",";
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) return resolve({ valid: [], errors: ["Fichier vide ou sans données"] });

        const rawHeaders = lines[0].split(sep).map((h) => h.replace(/"/g, "").trim());
        const headerMap = rawHeaders.map(mapHeader);

        const valid = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep).map((c) => c.replace(/"/g, "").trim());
          const row = {};
          headerMap.forEach((field, idx) => {
            if (field && cols[idx]) row[field] = cols[idx];
          });

          if (!row.nomFournisseur) {
            errors.push(`Ligne ${i + 1}: nom manquant`);
            continue;
          }
          row.niveauConfiance = Number(row.niveauConfiance) || 3;
          row.status = row.status || "en_attente";
          valid.push(row);
        }

        resolve({ valid, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
