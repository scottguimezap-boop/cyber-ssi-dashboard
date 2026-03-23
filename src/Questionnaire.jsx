import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./db/firebase";
import "./Questionnaire.css";

const QUESTIONS = [
  { id: "q1",  categorie: "Gouvernance",    texte: "L'entreprise dispose-t-elle d'une politique de sécurité SI formalisée ?" },
  { id: "q2",  categorie: "Gouvernance",    texte: "Un RSSI ou responsable sécurité est-il désigné ?" },
  { id: "q3",  categorie: "Conformité",     texte: "L'entreprise est-elle certifiée ISO 27001 ?" },
  { id: "q4",  categorie: "Conformité",     texte: "Un DPA (Data Processing Agreement) est-il signé avec votre organisation ?" },
  { id: "q5",  categorie: "Conformité",     texte: "La conformité RGPD est-elle formellement attestée ?" },
  { id: "q6",  categorie: "Technique",      texte: "Les accès sont-ils gérés via une solution IAM / SSO ?" },
  { id: "q7",  categorie: "Technique",      texte: "Un MFA est-il appliqué sur les comptes à privilèges ?" },
  { id: "q8",  categorie: "Technique",      texte: "Les données sont-elles chiffrées au repos et en transit ?" },
  { id: "q9",  categorie: "Technique",      texte: "Des sauvegardes régulières avec test de restauration sont-elles effectuées ?" },
  { id: "q10", categorie: "Technique",      texte: "Un plan de gestion des vulnérabilités (patch management) est-il en place ?" },
  { id: "q11", categorie: "Résilience",     texte: "Un Plan de Continuité d'Activité (PCA) est-il documenté ?" },
  { id: "q12", categorie: "Résilience",     texte: "Le PCA a-t-il été testé dans les 12 derniers mois ?" },
  { id: "q13", categorie: "Incident",       texte: "Une procédure de gestion des incidents de sécurité est-elle formalisée ?" },
  { id: "q14", categorie: "Incident",       texte: "Les incidents sont-ils notifiés dans les délais RGPD (72h) ?" },
  { id: "q15", categorie: "Sous-traitance", texte: "Les sous-traitants font-ils l'objet d'une évaluation de sécurité ?" },
];

const OPTIONS = ["Oui", "Partiel", "Non", "N/A"];
const SCORES  = { Oui: 2, Partiel: 1, Non: 0, "N/A": 0 };

const Questionnaire = ({ connectedUser }) => {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState("");
  const [reponses, setReponses] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsubF = onSnapshot(collection(db, "fournisseurs"), (s) =>
      setFournisseurs(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubQ = onSnapshot(
      query(collection(db, "questionnaires"), orderBy("date", "desc")),
      (s) => setHistorique(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubF(); unsubQ(); };
  }, []);

  const handleReponse = (qId, val) => setReponses((r) => ({ ...r, [qId]: val }));

  const scoreTotal = QUESTIONS.reduce((acc, q) => acc + (SCORES[reponses[q.id]] || 0), 0);
  const scoreMax   = QUESTIONS.length * 2;
  const scorePct   = Math.round((scoreTotal / scoreMax) * 100);
  const isComplete = QUESTIONS.every((q) => reponses[q.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFournisseur || !isComplete) return;
    setSaving(true);
    const fournisseur = fournisseurs.find((f) => f.id === selectedFournisseur);
    await addDoc(collection(db, "questionnaires"), {
      fournisseurId: selectedFournisseur,
      nomFournisseur: fournisseur?.nomFournisseur || "",
      reponses,
      score: scorePct,
      evaluateur: connectedUser?.email || "admin",
      date: new Date().toISOString().split("T")[0],
      createdAt: serverTimestamp(),
    });
    setReponses({});
    setSelectedFournisseur("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const categories = [...new Set(QUESTIONS.map((q) => q.categorie))];

  return (
    <div className="questionnaire-layout">
      <div className="qst-header">
        <h1>Questionnaire de Sécurité</h1>
        <p>Évaluation ISO 27001 / RGPD — {QUESTIONS.length} questions</p>
      </div>

      <div className="qst-body">
        <form onSubmit={handleSubmit} className="qst-form glass-panel">
          <div className="qst-selector">
            <label>Fournisseur évalué</label>
            <select value={selectedFournisseur} onChange={(e) => setSelectedFournisseur(e.target.value)} required>
              <option value="">-- Sélectionner un fournisseur --</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nomFournisseur}</option>
              ))}
            </select>
          </div>

          {categories.map((cat) => (
            <div key={cat} className="qst-category">
              <h3 className="qst-cat-title">{cat}</h3>
              {QUESTIONS.filter((q) => q.categorie === cat).map((q) => (
                <div key={q.id} className="qst-question">
                  <p className="qst-q-text">{q.texte}</p>
                  <div className="qst-options">
                    {OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        className={`qst-option ${reponses[q.id] === opt ? "selected score-" + opt.toLowerCase().replace("/", "") : ""}`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={reponses[q.id] === opt}
                          onChange={() => handleReponse(q.id, opt)}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {Object.keys(reponses).length > 0 && (
            <div className="qst-score-live">
              <span>Score : </span>
              <strong style={{ color: scorePct >= 70 ? "var(--success)" : scorePct >= 40 ? "var(--warning)" : "var(--danger)" }}>
                {scorePct}%
              </strong>
              <span className="qst-progress-bar">
                <span
                  className="qst-progress-fill"
                  style={{
                    width: `${scorePct}%`,
                    background: scorePct >= 70 ? "var(--success)" : scorePct >= 40 ? "var(--warning)" : "var(--danger)",
                  }}
                />
              </span>
            </div>
          )}

          <div className="qst-form-actions">
            {saved && <span className="qst-saved">Questionnaire enregistré !</span>}
            <button type="submit" className="btn-qst-submit" disabled={!selectedFournisseur || !isComplete || saving}>
              {saving ? "Enregistrement..." : "Enregistrer l'évaluation"}
            </button>
          </div>
        </form>

        <div className="qst-history">
          <h2>Historique des évaluations</h2>
          {historique.length === 0 ? (
            <p className="qst-empty">Aucune évaluation enregistrée.</p>
          ) : (
            <div className="qst-history-list">
              {historique.map((h) => (
                <div key={h.id} className="qst-history-card">
                  <div className="qst-hist-name">{h.nomFournisseur}</div>
                  <div className="qst-hist-meta">{h.date} · par {h.evaluateur}</div>
                  <div className={`qst-hist-score score-${h.score >= 70 ? "safe" : h.score >= 40 ? "moderate" : "critical"}`}>
                    {h.score}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
