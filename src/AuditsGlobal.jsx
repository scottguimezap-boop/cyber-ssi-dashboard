import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "./db/firebase";
// On utilise le bon chemin pour la notification (racine src)
import { useNotification } from "./NotificationContext";
import { logAction, ACTIONS } from "./utils/auditTrail";
import "./AuditsGlobal.css";

const AuditsGlobal = ({ connectedUser }) => {
  const [audits, setAudits] = useState([]);
  const { addNotification } = useNotification();

  useEffect(() => {
    const q = query(collection(db, "audits"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAudits(data);
    });
    return () => unsubscribe();
  }, []);

  const markAsDone = async (audit) => {
    if (window.confirm(`Valider l'audit de ${audit.nomFournisseur} ?`)) {
      await updateDoc(doc(db, "audits", audit.id), { resultat: "✅ Conforme (Validé)" });
      logAction(connectedUser?.email || "admin", ACTIONS.VALIDER_AUDIT, audit.nomFournisseur, { date: audit.date });
      addNotification("success", "Audit validé et archivé.");
    }
  };

  // Filtres
  const today = new Date().toISOString().split('T')[0];
  const upcoming = audits.filter(a => a.date >= today && !a.resultat?.includes("Validé"));
  const history = audits.filter(a => a.date < today || a.resultat?.includes("Validé"));

  return (
    <div className="audit-dashboard">
      <div className="audit-content">
        {/* À VENIR */}
        <section className="audit-section">
          <h2>📅 À Venir ({upcoming.length})</h2>
          <div className="audit-grid">
            {upcoming.map(a => (
              <div key={a.id} className="audit-card">
                <div className="date-box">
                  <strong>{new Date(a.date).getDate()}</strong>
                  <small>{new Date(a.date).toLocaleString('default', { month: 'short' })}</small>
                </div>
                <div className="info">
                  <h3>{a.nomFournisseur}</h3>
                  <span>{a.type}</span>
                </div>
                <button onClick={() => markAsDone(a)} className="btn-check">✅</button>
              </div>
            ))}
            {upcoming.length === 0 && <p>Aucun audit prévu.</p>}
          </div>
        </section>

        {/* HISTORIQUE */}
        <section className="audit-section">
          <h2>🗂️ Terminés / Passés</h2>
          <table className="history-table">
            <tbody>
              {history.map(a => (
                <tr key={a.id}>
                  <td>{a.date}</td>
                  <td>{a.nomFournisseur}</td>
                  <td style={{color: a.resultat?.includes('Non') ? 'red' : '#10b981'}}>{a.resultat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
};

export default AuditsGlobal;