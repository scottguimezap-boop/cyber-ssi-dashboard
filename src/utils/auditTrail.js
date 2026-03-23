import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../db/firebase";

export const ACTIONS = {
  VALIDER_FOURNISSEUR: "Validation fournisseur",
  SUSPENDRE_FOURNISSEUR: "Suspension fournisseur",
  AJOUTER_FOURNISSEUR: "Ajout fournisseur",
  MODIFIER_FOURNISSEUR: "Modification fournisseur",
  AJOUTER_CONTACT: "Ajout contact",
  AJOUTER_AUDIT: "Ajout audit",
  VALIDER_AUDIT: "Validation audit",
  DECLARER_INCIDENT: "Déclaration incident",
  RESOUDRE_INCIDENT: "Résolution incident",
  IMPORTER_CSV: "Import CSV",
  MODIFIER_ROLE: "Modification rôle",
};

export const logAction = async (userEmail, action, target, details = {}) => {
  try {
    await addDoc(collection(db, "audit_trail"), {
      userEmail,
      action,
      target,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn("Audit trail error:", e);
  }
};
