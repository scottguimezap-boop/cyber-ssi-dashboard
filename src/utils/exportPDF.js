import jsPDF from "jspdf";
import "jspdf-autotable";

export const exportFournisseursList = (fournisseurs, scores = {}) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("CYBER-SSI — Rapport Fournisseurs", 14, 20);
  doc.setFontSize(9);
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 14, 28);

  doc.autoTable({
    startY: 35,
    head: [["Nom", "Service", "Confiance", "Statut", "Score Risque"]],
    body: fournisseurs.map((f) => [
      f.nomFournisseur || "",
      f.typePrestataire || "",
      `${f.niveauConfiance}/5`,
      f.status === "validé" ? "ACTIF" : "ATTENTE",
      scores[f.id] != null ? `${scores[f.id]}%` : "—",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save("cyber-ssi-fournisseurs.pdf");
};

export const exportFournisseurDetail = (fournisseur, contacts = [], audits = [], incidents = [], score) => {
  const doc = new jsPDF();
  const name = fournisseur.nomFournisseur || "Fournisseur";

  doc.setFontSize(16);
  doc.text(`Dossier : ${name}`, 14, 20);
  doc.setFontSize(9);
  doc.text(`Score de risque : ${score != null ? score + "%" : "N/A"}`, 14, 28);
  doc.text(`Statut : ${fournisseur.status === "validé" ? "ACTIF" : "ATTENTE"}`, 14, 34);
  doc.text(`Confiance : ${fournisseur.niveauConfiance}/5 | Dépendance : ${fournisseur.niveauDependance}/4`, 14, 40);

  let y = 50;

  if (contacts.length > 0) {
    doc.autoTable({
      startY: y,
      head: [["Contact", "Email", "Rôle"]],
      body: contacts.map((c) => [c.nom || "", c.email || "", c.role || ""]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (audits.length > 0) {
    doc.autoTable({
      startY: y,
      head: [["Date Audit", "Type", "Résultat"]],
      body: audits.map((a) => [a.date || "", a.type || "", a.resultat || ""]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (incidents.length > 0) {
    doc.autoTable({
      startY: y,
      head: [["Incident", "Gravité", "Statut"]],
      body: incidents.map((i) => [i.titre || "", i.gravite || "", i.statut || ""]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  doc.save(`cyber-ssi-${name.replace(/\s+/g, "_")}.pdf`);
};

export const exportFournisseursCSV = (fournisseurs, scores = {}) => {
  const headers = "Nom,Email,Type,Confiance,Statut,Score\n";
  const rows = fournisseurs
    .map((f) =>
      [
        `"${f.nomFournisseur || ""}"`,
        `"${f.email || ""}"`,
        `"${f.typePrestataire || ""}"`,
        f.niveauConfiance || "",
        f.status || "",
        scores[f.id] ?? "",
      ].join(",")
    )
    .join("\n");

  const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "cyber-ssi-fournisseurs.csv";
  link.click();
};
