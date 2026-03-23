import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db, storage, functions } from "./db/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { useNotification } from "./NotificationContext";
import { computeRiskScore, getRiskLevel, getRiskColor } from "./utils/riskScore";
import { logAction, ACTIONS } from "./utils/auditTrail";
import { exportFournisseurDetail } from "./utils/exportPDF";
import "./DetailsFournisseur.css";

const DetailsFournisseur = ({ connectedUser, userRole }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [fournisseur, setFournisseur] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("general");

  const [contacts, setContacts] = useState([]);
  const [audits, setAudits] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [allIncidents, setAllIncidents] = useState([]);
  const [allAudits, setAllAudits] = useState([]);

  const [newContact, setNewContact] = useState({ nom: "", role: "", email: "", tel: "" });
  const [newAudit, setNewAudit] = useState({ type: "Audit Sécurité", date: "", resultat: "En attente" });
  const [newIncident, setNewIncident] = useState({ titre: "", gravite: "Majeur", statut: "En cours", impact: "", date: "" });
  const [newContrat, setNewContrat] = useState({ type: "", dateDebut: "", dateFin: "", description: "" });
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // IA Claude
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);

  const canEdit = !userRole || userRole !== "lecteur";

  useEffect(() => {
    const fetchFournisseur = async () => {
      const docSnap = await getDoc(doc(db, "fournisseurs", id));
      if (docSnap.exists()) setFournisseur({ id: docSnap.id, ...docSnap.data() });
      setLoading(false);
    };
    fetchFournisseur();

    const unsubs = [
      onSnapshot(query(collection(db, "contacts"), where("fournisseurId", "==", id)), (s) =>
        setContacts(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, "audits"), where("fournisseurId", "==", id)), (s) =>
        setAudits(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, "incidents"), where("fournisseurId", "==", id)), (s) =>
        setIncidents(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, "contrats"), where("fournisseurId", "==", id)), (s) =>
        setContrats(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, "incidents"), (s) =>
        setAllIncidents(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, "audits"), (s) =>
        setAllAudits(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, "documents"), where("fournisseurId", "==", id)), (s) =>
        setDocuments(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [id]);

  const score = fournisseur ? computeRiskScore(fournisseur, allIncidents, allAudits) : 0;
  const level = getRiskLevel(score);

  const isExpiringSoon = (dateFin) => {
    if (!dateFin) return false;
    const diff = (new Date(dateFin) - new Date()) / 86400000;
    return diff >= 0 && diff <= 30;
  };
  const isExpired = (dateFin) => dateFin && new Date(dateFin) < new Date();

  const handleAddContact = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "contacts"), { ...newContact, fournisseurId: id, nomFournisseur: fournisseur.nomFournisseur });
    setNewContact({ nom: "", role: "", email: "", tel: "" });
    addNotification("success", "Nouveau contact ajouté à l'annuaire.");
    logAction(connectedUser?.email || "admin", ACTIONS.AJOUTER_CONTACT, newContact.nom, { fournisseur: fournisseur.nomFournisseur });
  };

  const handleAddAudit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "audits"), { ...newAudit, fournisseurId: id, nomFournisseur: fournisseur.nomFournisseur, createdAt: serverTimestamp() });
    setNewAudit({ type: "Audit Sécurité", date: "", resultat: "En attente" });
    addNotification("info", "Audit planifié dans le calendrier global.");
    logAction(connectedUser?.email || "admin", ACTIONS.AJOUTER_AUDIT, fournisseur.nomFournisseur, { date: newAudit.date });
  };

  const handleAddIncident = async (e) => {
    e.preventDefault();
    const dateFinale = newIncident.date ? new Date(newIncident.date) : new Date();
    await addDoc(collection(db, "incidents"), {
      titre: newIncident.titre, gravite: newIncident.gravite, statut: newIncident.statut,
      impact: newIncident.impact, fournisseurId: id, nomFournisseur: fournisseur.nomFournisseur, dateDeclaration: dateFinale,
    });
    if (newIncident.gravite === "Critique") {
      addNotification("error", "ALERTE CRITIQUE TRANSMISE !");
    } else {
      addNotification("warning", "Incident enregistré.");
    }
    logAction(connectedUser?.email || "admin", ACTIONS.DECLARER_INCIDENT, newIncident.titre, { fournisseur: fournisseur.nomFournisseur, gravite: newIncident.gravite });
    setNewIncident({ titre: "", gravite: "Majeur", statut: "En cours", impact: "", date: "" });
  };

  const handleAddContrat = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "contrats"), { ...newContrat, fournisseurId: id, nomFournisseur: fournisseur.nomFournisseur, createdAt: serverTimestamp() });
    setNewContrat({ type: "", dateDebut: "", dateFin: "", description: "" });
    addNotification("success", "Contrat ajouté.");
  };

  const handleExportPDF = () => {
    exportFournisseurDetail(fournisseur, contacts, audits, incidents, score);
  };

  const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg";

  const getFileIcon = (name) => {
    const ext = name?.split(".").pop()?.toLowerCase();
    if (["pdf"].includes(ext)) return "📄";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
    if (["ppt", "pptx"].includes(ext)) return "📽️";
    if (["png", "jpg", "jpeg"].includes(ext)) return "🖼️";
    return "📎";
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / 1048576).toFixed(1) + " Mo";
  };

  const handleUploadFiles = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(0);

    let completed = 0;
    files.forEach((file) => {
      const storagePath = `fournisseurs/${id}/documents/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on("state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploadProgress(pct);
        },
        (error) => {
          console.error("Upload error:", error);
          addNotification("error", `Erreur upload : ${file.name}`);
          completed++;
          if (completed === files.length) setUploading(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "documents"), {
            fournisseurId: id,
            nomFournisseur: fournisseur.nomFournisseur,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            storagePath,
            url,
            uploadedBy: connectedUser?.email || "admin",
            createdAt: serverTimestamp(),
          });
          completed++;
          if (completed === files.length) {
            setUploading(false);
            setUploadProgress(0);
            addNotification("success", `${files.length} fichier(s) uploadé(s).`);
          }
        }
      );
    });
    e.target.value = "";
  };

  // IA Claude — Analyse fournisseur
  const AI_SUGGESTIONS = [
    "Analyse les risques de ce fournisseur",
    "Quelles améliorations de sécurité recommandes-tu ?",
    "Évalue la conformité RGPD de ce fournisseur",
    "Rédige un plan d'audit pour ce fournisseur",
    "Quels sont les points d'attention critiques ?",
  ];

  const handleAskClaude = async (questionOverride) => {
    const question = questionOverride || aiPrompt;
    if (!question.trim()) return;
    setAiLoading(true);
    setAiResponse("");

    try {
      const askClaude = httpsCallable(functions, "askClaude");
      const result = await askClaude({
        prompt: question,
        fournisseurData: {
          nomFournisseur: fournisseur.nomFournisseur,
          typePrestataire: fournisseur.typePrestataire,
          niveauConfiance: fournisseur.niveauConfiance,
          status: fournisseur.status,
          conformiteRGPD: fournisseur.conformiteRGPD,
          hebergementDonnees: fournisseur.hebergementDonnees,
          certificationISO: fournisseur.certificationISO,
          scoreRisque: score,
        },
      });
      const responseText = result.data.response;
      setAiResponse(responseText);
      setAiHistory((prev) => [{ question, response: responseText, date: new Date().toLocaleString("fr-FR") }, ...prev]);
      setAiPrompt("");
    } catch (e) {
      console.error("Claude AI error:", e);
      setAiResponse("Erreur : impossible de contacter l'assistant IA. Vérifiez que la clé API est configurée.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeleteDoc = async (docItem) => {
    if (!window.confirm(`Supprimer "${docItem.fileName}" ?`)) return;
    try {
      await deleteObject(ref(storage, docItem.storagePath));
    } catch (e) {
      console.warn("Storage delete error:", e);
    }
    await deleteDoc(doc(db, "documents", docItem.id));
    addNotification("info", "Document supprimé.");
  };

  if (loading) return <div className="loader-screen"><div className="spinner"></div>Chargement...</div>;
  if (!fournisseur) return <div className="error-screen">Dossier introuvable.</div>;

  return (
    <div className="details-layout">
      <header className="details-header">
        <div className="header-top">
          <div className="header-meta">
            <span className={`status-badge ${fournisseur.status}`}>{fournisseur.status === "validé" ? "HOMOLOGUÉ" : "EN EXAMEN"}</span>
          </div>
          <button className="btn-export-detail" onClick={handleExportPDF}>Export PDF</button>
        </div>
        <h1>{fournisseur.nomFournisseur}</h1>
        <p className="subtitle">{fournisseur.typePrestataire} • {fournisseur.email}</p>

        <div className="tabs-nav">
          <button className={activeTab === "general" ? "active" : ""} onClick={() => setActiveTab("general")}>Général</button>
          <button className={activeTab === "contacts" ? "active" : ""} onClick={() => setActiveTab("contacts")}>Équipe ({contacts.length})</button>
          <button className={activeTab === "contrats" ? "active" : ""} onClick={() => setActiveTab("contrats")}>Contrats ({contrats.length})</button>
          <button className={activeTab === "audits" ? "active" : ""} onClick={() => setActiveTab("audits")}>Audits ({audits.length})</button>
          <button className={`tab-danger ${activeTab === "incidents" ? "active" : ""}`} onClick={() => setActiveTab("incidents")}>Incidents ({incidents.length})</button>
          <button className={activeTab === "documents" ? "active" : ""} onClick={() => setActiveTab("documents")}>Documents ({documents.length})</button>
          <button className={`tab-ai ${activeTab === "ia" ? "active" : ""}`} onClick={() => setActiveTab("ia")}>IA Assistant</button>
        </div>
      </header>

      <div className="details-content">
        {/* GÉNÉRAL */}
        {activeTab === "general" && (
          <div className="tab-panel fade-in">
            <div className="info-grid">
              <div className="card-glass">
                <h3>Score de Risque</h3>
                <div className="score-big" style={{ color: getRiskColor(score) }}>{score}<span className="score-max">%</span></div>
                <span className={`score-level-label level-${level}`}>{level === "safe" ? "Fiable" : level === "moderate" ? "Attention" : "Critique"}</span>
              </div>
              <div className="card-glass">
                <h3>Confiance</h3>
                <div className="score-big" style={{ color: Number(fournisseur.niveauConfiance) > 3 ? "var(--success)" : "var(--warning)" }}>
                  {fournisseur.niveauConfiance}<span className="score-max">/5</span>
                </div>
              </div>
              <div className="card-glass full-width">
                <h3>Mission</h3>
                <p><strong>Service :</strong> {fournisseur.typeServiceMateriel}</p>
                <p><strong>Données :</strong> {fournisseur.accesDonneesPersonnelles}</p>
              </div>
            </div>
            <div className="actions-footer">
              <button onClick={() => navigate(`/modifier/${id}`)} className="btn-edit-large">Modifier</button>
            </div>
          </div>
        )}

        {/* CONTACTS */}
        {activeTab === "contacts" && (
          <div className="tab-panel fade-in">
            {canEdit && (
              <form onSubmit={handleAddContact} className="add-form-row" style={{ flexWrap: "wrap", gap: "10px" }}>
                <input placeholder="Nom complet" value={newContact.nom} onChange={(e) => setNewContact({ ...newContact, nom: e.target.value })} required style={{ flex: "1 1 200px" }} />
                <input placeholder="Rôle (ex: DSI)" value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} required style={{ flex: "1 1 150px" }} />
                <input type="email" placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} style={{ flex: "1 1 200px" }} />
                <input type="tel" placeholder="Tél" value={newContact.tel} onChange={(e) => setNewContact({ ...newContact, tel: e.target.value })} style={{ flex: "1 1 120px" }} />
                <button type="submit" className="btn-add" style={{ flex: "0 0 auto" }}>Ajouter +</button>
              </form>
            )}
            <div className="contacts-grid">
              {contacts.map((c) => (
                <div key={c.id} className="contact-card">
                  <div className="contact-avatar">{c.nom.charAt(0)}</div>
                  <div className="contact-info">
                    <h4>{c.nom}</h4>
                    <span className="role-badge">{c.role}</span>
                    {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                    {c.tel && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{c.tel}</span>}
                  </div>
                </div>
              ))}
              {contacts.length === 0 && <p className="empty-msg">Aucun contact enregistré.</p>}
            </div>
          </div>
        )}

        {/* CONTRATS */}
        {activeTab === "contrats" && (
          <div className="tab-panel fade-in">
            {canEdit && (
              <form onSubmit={handleAddContrat} className="add-form-row" style={{ flexWrap: "wrap", gap: "10px" }}>
                <input placeholder="Type (ex: DPA, NDA, SLA)" value={newContrat.type} onChange={(e) => setNewContrat({ ...newContrat, type: e.target.value })} required style={{ flex: "1 1 180px" }} />
                <input type="date" value={newContrat.dateDebut} onChange={(e) => setNewContrat({ ...newContrat, dateDebut: e.target.value })} required style={{ flex: "1 1 140px" }} />
                <input type="date" value={newContrat.dateFin} onChange={(e) => setNewContrat({ ...newContrat, dateFin: e.target.value })} required style={{ flex: "1 1 140px" }} />
                <input placeholder="Description" value={newContrat.description} onChange={(e) => setNewContrat({ ...newContrat, description: e.target.value })} style={{ flex: "2 1 200px" }} />
                <button type="submit" className="btn-add" style={{ flex: "0 0 auto" }}>Ajouter +</button>
              </form>
            )}
            <div className="contrats-list">
              {contrats.map((c) => (
                <div key={c.id} className={`contrat-card ${isExpired(c.dateFin) ? "expired" : isExpiringSoon(c.dateFin) ? "expiring" : ""}`}>
                  <div className="contrat-type">{c.type}</div>
                  <div className="contrat-dates">Du {c.dateDebut} au {c.dateFin}</div>
                  {c.description && <div className="contrat-desc">{c.description}</div>}
                  {isExpiringSoon(c.dateFin) && <div className="contrat-alert">Expire bientôt !</div>}
                  {isExpired(c.dateFin) && <div className="contrat-alert expired-label">Expiré</div>}
                </div>
              ))}
              {contrats.length === 0 && <p className="empty-msg">Aucun contrat enregistré.</p>}
            </div>
          </div>
        )}

        {/* AUDITS */}
        {activeTab === "audits" && (
          <div className="tab-panel fade-in">
            {canEdit && (
              <form onSubmit={handleAddAudit} className="add-form-row">
                <select value={newAudit.type} onChange={(e) => setNewAudit({ ...newAudit, type: e.target.value })}>
                  <option>Audit Sécurité</option><option>Pentest</option><option>Conformité</option>
                </select>
                <input type="date" value={newAudit.date} onChange={(e) => setNewAudit({ ...newAudit, date: e.target.value })} required />
                <button type="submit" className="btn-add">Planifier +</button>
              </form>
            )}
            <table className="cyber-table-details">
              <thead><tr><th>Date</th><th>Type</th><th>Résultat</th></tr></thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id}>
                    <td>{a.date}</td>
                    <td>{a.type}</td>
                    <td className={a.resultat?.includes("Non") ? "text-red" : "text-green"}>{a.resultat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* INCIDENTS */}
        {activeTab === "incidents" && (
          <div className="tab-panel fade-in">
            <div className="alert-banner-info">Déclarez ici les incidents de sécurité.</div>
            {canEdit && (
              <form onSubmit={handleAddIncident} className="add-form-block">
                <div className="form-row">
                  <input placeholder="Titre incident" value={newIncident.titre} onChange={(e) => setNewIncident({ ...newIncident, titre: e.target.value })} required style={{ flex: 2 }} />
                  <input type="datetime-local" value={newIncident.date} onChange={(e) => setNewIncident({ ...newIncident, date: e.target.value })} style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: "4px" }} />
                  <select value={newIncident.gravite} onChange={(e) => setNewIncident({ ...newIncident, gravite: e.target.value })}>
                    <option>Majeur</option><option value="Critique">CRITIQUE</option>
                  </select>
                  <select value={newIncident.statut} onChange={(e) => setNewIncident({ ...newIncident, statut: e.target.value })}>
                    <option>En cours</option><option>Résolu</option>
                  </select>
                </div>
                <button type="submit" className="btn-add-danger">DÉCLARER</button>
              </form>
            )}
            <div className="incidents-list">
              {incidents.map((inc) => (
                <div key={inc.id} className={`incident-item ${inc.gravite}`}>
                  <h4>{inc.titre}</h4>
                  <span className="inc-date">
                    {inc.dateDeclaration?.seconds
                      ? new Date(inc.dateDeclaration.seconds * 1000).toLocaleString()
                      : inc.dateDeclaration ? new Date(inc.dateDeclaration).toLocaleString() : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DOCUMENTS */}
        {activeTab === "documents" && (
          <div className="tab-panel fade-in">
            {canEdit && (
              <div className="doc-upload-zone">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={ACCEPTED_TYPES}
                  multiple
                  style={{ display: "none" }}
                  onChange={handleUploadFiles}
                />
                <button className="btn-upload" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? `Upload en cours... ${uploadProgress}%` : "Charger des fichiers"}
                </button>
                <span className="doc-upload-hint">PDF, Word, Excel, PowerPoint, Images (max 10 Mo)</span>
                {uploading && (
                  <div className="doc-progress-bar">
                    <div className="doc-progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>
            )}

            <div className="doc-list">
              {documents.map((d) => (
                <div key={d.id} className="doc-card">
                  <span className="doc-icon">{getFileIcon(d.fileName)}</span>
                  <div className="doc-info">
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="doc-name">{d.fileName}</a>
                    <div className="doc-meta">
                      {formatFileSize(d.fileSize)} · {d.uploadedBy} · {d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toLocaleDateString("fr-FR") : "—"}
                    </div>
                  </div>
                  {canEdit && (
                    <button className="doc-delete-btn" onClick={() => handleDeleteDoc(d)} title="Supprimer">✕</button>
                  )}
                </div>
              ))}
              {documents.length === 0 && <p className="empty-msg">Aucun document attaché.</p>}
            </div>
          </div>
        )}

        {/* IA ASSISTANT */}
        {activeTab === "ia" && (
          <div className="tab-panel fade-in">
            <div className="ai-panel">
              <div className="ai-suggestions">
                <p className="ai-suggestions-label">Questions rapides :</p>
                <div className="ai-suggestions-list">
                  {AI_SUGGESTIONS.map((s, i) => (
                    <button key={i} className="ai-suggestion-btn" onClick={() => handleAskClaude(s)} disabled={aiLoading}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <form className="ai-input-form" onSubmit={(e) => { e.preventDefault(); handleAskClaude(); }}>
                <input
                  type="text"
                  placeholder="Posez une question sur ce fournisseur..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={aiLoading}
                  className="ai-input"
                />
                <button type="submit" className="ai-send-btn" disabled={aiLoading || !aiPrompt.trim()}>
                  {aiLoading ? "Analyse..." : "Envoyer"}
                </button>
              </form>

              {aiLoading && (
                <div className="ai-loading">
                  <div className="ai-loading-dots"><span /><span /><span /></div>
                  <p>Claude analyse le fournisseur...</p>
                </div>
              )}

              {aiResponse && !aiLoading && (
                <div className="ai-response-card">
                  <div className="ai-response-header">Réponse de Claude</div>
                  <div className="ai-response-body">{aiResponse}</div>
                </div>
              )}

              {aiHistory.length > 1 && (
                <div className="ai-history">
                  <h4>Historique</h4>
                  {aiHistory.slice(1).map((h, i) => (
                    <details key={i} className="ai-history-item">
                      <summary>{h.question} <span className="ai-hist-date">{h.date}</span></summary>
                      <div className="ai-hist-response">{h.response}</div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailsFournisseur;
