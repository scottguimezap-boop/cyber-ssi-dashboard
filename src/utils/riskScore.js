import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../db/firebase";

export const computeRiskScore = (fournisseur, allIncidents = [], allAudits = []) => {
  const base = (Number(fournisseur.niveauConfiance) / 5) * 60;
  const activeInc = allIncidents.filter(
    (i) => i.statut !== "Résolu" && i.fournisseurId === fournisseur.id
  ).length;
  const conformeAudits = Math.min(
    3,
    allAudits.filter(
      (a) => a.resultat?.includes("Conforme") && a.fournisseurId === fournisseur.id
    ).length
  );
  return Math.max(0, Math.min(100, Math.round(base - activeInc * 15 + conformeAudits * 5)));
};

export const getRiskLevel = (score) =>
  score >= 70 ? "safe" : score >= 40 ? "moderate" : "critical";

export const getRiskColor = (score) =>
  score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--danger)";
