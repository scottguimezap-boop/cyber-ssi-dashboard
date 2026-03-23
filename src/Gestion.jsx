import { useEffect, useState, useRef } from "react";
import { db } from "./db/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useNotification } from "./NotificationContext";
import { computeRiskScore, getRiskLevel } from "./utils/riskScore";
import { logAction, ACTIONS } from "./utils/auditTrail";
import { exportFournisseursList, exportFournisseursCSV } from "./utils/exportPDF";
import { parseCSVFile } from "./utils/importCSV";
import DashboardStats from "./DashboardStats";
import CyberMap from "./CyberMap";
import KanbanView from "./KanbanView";
import "./Gestion.css";

const Gestion = ({ connectedUser, userRole }) => {
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const fileInputRef = useRef(null);

  const [fournisseurs, setFournisseurs] = useState([]);
  const [allIncidents, setAllIncidents] = useState([]);
  const [allAudits, setAllAudits] = useState([]);
  const [criticalIncidents, setCriticalIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("table");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [importData, setImportData] = useState(null);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "fournisseurs"), orderBy("createdAt", "desc")), (snap) => {
        setFournisseurs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }),
      onSnapshot(collection(db, "incidents"), (snap) =>
        setAllIncidents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, "audits"), (snap) =>
        setAllAudits(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(
        query(collection(db, "incidents"), where("gravite", "==", "Critique"), where("statut", "==", "En cours")),
        (snap) => setCriticalIncidents(snap.docs.map((d) => d.data()))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const scores = Object.fromEntries(
    fournisseurs.map((f) => [f.id, computeRiskScore(f, allIncidents, allAudits)])
  );

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "validé" ? "en_attente" : "validé";
    await updateDoc(doc(db, "fournisseurs", id), { status: newStatus });
    const fName = fournisseurs.find((f) => f.id === id)?.nomFournisseur || id;
    if (newStatus === "validé") {
      addNotification("success", "Accès fournisseur validé. Protocole activé.");
      logAction(connectedUser?.email || "admin", ACTIONS.VALIDER_FOURNISSEUR, fName);
    } else {
      addNotification("warning", "Fournisseur suspendu. Accès révoqué.");
      logAction(connectedUser?.email || "admin", ACTIONS.SUSPENDRE_FOURNISSEUR, fName);
    }
  };

  const filtered = fournisseurs.filter((f) => {
    const search = f.nomFournisseur?.toLowerCase() || "";
    const email = f.email?.toLowerCase() || "";
    const term = searchTerm.toLowerCase();
    const matchesSearch = search.includes(term) || email.includes(term);
    const matchesStatus = filterStatus === "all" || f.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: fournisseurs.length,
    valides: fournisseurs.filter((f) => f.status === "validé").length,
    risques: fournisseurs.filter((f) => Number(f.niveauConfiance) <= 2).length,
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await parseCSVFile(file);
      setImportData(result);
    } catch {
      addNotification("error", "Erreur de lecture du fichier CSV.");
    }
    e.target.value = "";
  };

  const confirmImport = async () => {
    if (!importData?.valid?.length) return;
    for (const row of importData.valid) {
      await addDoc(collection(db, "fournisseurs"), {
        ...row,
        niveauConfiance: Number(row.niveauConfiance) || 3,
        niveauDependance: Number(row.niveauDependance) || 2,
        createdAt: serverTimestamp(),
        status: row.status || "en_attente",
      });
    }
    logAction(connectedUser?.email || "admin", ACTIONS.IMPORTER_CSV, `${importData.valid.length} fournisseurs`);
    addNotification("success", `${importData.valid.length} fournisseur(s) importé(s) avec succès.`);
    setImportData(null);
  };

  const canToggle = userRole !== "lecteur";

  return (
    <div className="cyber-dashboard">
      <main className="main-content">
        {criticalIncidents.length > 0 && (
          <div className="critical-alert-banner" onClick={() => navigate("/crise")}>
            <div className="critical-alert-text"><span>🚨</span>ALERTE CYBER : {criticalIncidents.length} Incident(s) Critique(s) en cours !</div>
            <div className="critical-alert-action">Gérer la crise →</div>
          </div>
        )}

        <header className="dashboard-header">
          <div className="header-titles">
            <h1>Centre de Contrôle</h1>
            <p>Pilotage centralisé de la sécurité fournisseurs.</p>
          </div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon">📂</div><div className="stat-info"><span className="stat-num">{stats.total}</span><span className="stat-label">Total</span></div></div>
            <div className="stat-card"><div className="stat-icon">🛡️</div><div className="stat-info"><span className="stat-num text-green">{stats.valides}</span><span className="stat-label">Validés</span></div></div>
            <div className="stat-card alert-mode"><div className="stat-icon">⚠️</div><div className="stat-info"><span className="stat-num text-red">{stats.risques}</span><span className="stat-label">Critiques</span></div></div>
          </div>
        </header>

        {!loading && fournisseurs.length > 0 && (
          <><DashboardStats fournisseurs={fournisseurs} /><CyberMap fournisseurs={fournisseurs} /></>
        )}

        <div className="toolbar glass-panel">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Rechercher un fournisseur..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="filter-wrapper">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Tout afficher</option>
              <option value="en_attente">En Attente</option>
              <option value="validé">Validé</option>
            </select>
          </div>
          <div className="toolbar-actions">
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")} title="Tableau">⊞</button>
              <button className={`view-btn ${viewMode === "kanban" ? "active" : ""}`} onClick={() => setViewMode("kanban")} title="Kanban">⋮⋮</button>
            </div>
            {canToggle && (
              <>
                <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleImportCSV} />
                <button className="btn-toolbar" onClick={() => fileInputRef.current?.click()}>↑ Import</button>
              </>
            )}
            <div className="export-wrapper">
              <button className="btn-toolbar" onClick={() => setShowExportMenu(!showExportMenu)}>↓ Export</button>
              {showExportMenu && (
                <div className="export-dropdown">
                  <button onClick={() => { exportFournisseursList(fournisseurs, scores); setShowExportMenu(false); }}>PDF</button>
                  <button onClick={() => { exportFournisseursCSV(fournisseurs, scores); setShowExportMenu(false); }}>CSV</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {viewMode === "kanban" ? (
          <KanbanView
            fournisseurs={filtered}
            allIncidents={allIncidents}
            allAudits={allAudits}
            onToggleStatus={toggleStatus}
            onNavigate={navigate}
            userRole={userRole}
          />
        ) : (
          <div className="data-grid-container glass-panel">
            {loading ? (
              <div className="cyber-loader-container"><div className="cyber-spinner"></div><p>Synchronisation...</p></div>
            ) : (
              <div className="table-responsive">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Fournisseur</th>
                      <th>Service</th>
                      <th>Confiance</th>
                      <th>Score</th>
                      <th>Statut</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => {
                      const score = scores[f.id] ?? 0;
                      const level = getRiskLevel(score);
                      return (
                        <tr key={f.id} className="fade-in-row">
                          <td><div className="fw-bold">{f.nomFournisseur}</div><div className="text-muted-sm">{f.email}</div></td>
                          <td className="tech-font">{f.typePrestataire}</td>
                          <td>
                            <div className="risk-meter">
                              <div className={`risk-fill level-${f.niveauConfiance}`} style={{ width: `${(Number(f.niveauConfiance) / 5) * 100}%` }}></div>
                              <span className="risk-score">{f.niveauConfiance}/5</span>
                            </div>
                          </td>
                          <td><span className={`score-badge score-${level}`}>{score}%</span></td>
                          <td><span className={`status-pill ${f.status === "validé" ? "ok" : "pending"}`}>{f.status === "validé" ? "ACTIF" : "ATTENTE"}</span></td>
                          <td className="text-right">
                            <div className="action-buttons">
                              <button className="btn-icon btn-scan" title="Intelligence" onClick={() => navigate(`/intelligence/${f.id}`)}>📡</button>
                              <button className="btn-icon btn-view" title="Voir dossier" onClick={() => navigate(`/fournisseur/${f.id}`)}>👁️</button>
                              <button className="btn-icon btn-edit" title="Modifier" onClick={() => navigate(`/modifier/${f.id}`)}>✏️</button>
                              {canToggle && (
                                <button className={`btn-toggle ${f.status === "validé" ? "btn-suspend" : "btn-validate"}`} onClick={() => toggleStatus(f.id, f.status)}>
                                  {f.status === "validé" ? "STOP" : "OK"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && !loading && (
                      <tr><td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Aucun fournisseur trouvé.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Import CSV Modal */}
        {importData && (
          <div className="modal-overlay" onClick={() => setImportData(null)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h3>Import CSV</h3>
              <p>{importData.valid.length} fournisseur(s) valide(s) détecté(s)</p>
              {importData.errors.length > 0 && (
                <div className="modal-errors">
                  {importData.errors.map((err, i) => <div key={i} className="modal-error">{err}</div>)}
                </div>
              )}
              {importData.valid.length > 0 && (
                <div className="modal-preview">
                  {importData.valid.slice(0, 5).map((f, i) => (
                    <div key={i} className="modal-preview-row">{f.nomFournisseur} — {f.email || "N/A"}</div>
                  ))}
                  {importData.valid.length > 5 && <div className="modal-preview-more">...et {importData.valid.length - 5} de plus</div>}
                </div>
              )}
              <div className="modal-actions">
                <button className="btn-modal-cancel" onClick={() => setImportData(null)}>Annuler</button>
                <button className="btn-modal-confirm" onClick={confirmImport} disabled={!importData.valid.length}>Importer</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Gestion;
