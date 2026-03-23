import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./db/firebase";
import "./AuditTrailPage.css";

const AuditTrailPage = () => {
  const [logs, setLogs] = useState([]);
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser] = useState("");

  useEffect(() => {
    const q = query(collection(db, "audit_trail"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const actions = [...new Set(logs.map((l) => l.action).filter(Boolean))];

  const filtered = logs.filter((l) => {
    if (filterAction !== "all" && l.action !== filterAction) return false;
    if (filterUser && !l.userEmail?.toLowerCase().includes(filterUser.toLowerCase())) return false;
    return true;
  });

  const getActionColor = (action) => {
    if (action?.includes("Ajout") || action?.includes("Validation")) return "green";
    if (action?.includes("Suspension") || action?.includes("incident")) return "red";
    return "blue";
  };

  const formatDate = (ts) => {
    if (!ts?.seconds) return "—";
    return new Date(ts.seconds * 1000).toLocaleString("fr-FR");
  };

  return (
    <div className="at-layout">
      <div className="at-header">
        <h1>Journal d'Audit</h1>
        <p>Traçabilité complète des actions sur la plateforme</p>
      </div>

      <div className="at-filters">
        <input
          type="text"
          placeholder="Filtrer par utilisateur..."
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="at-filter-input"
        />
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="at-filter-select">
          <option value="all">Toutes les actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="at-table-wrapper">
        <table className="at-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Cible</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td className="at-date">{formatDate(log.timestamp)}</td>
                <td>{log.userEmail}</td>
                <td>
                  <span className={`at-action-badge ${getActionColor(log.action)}`}>{log.action}</span>
                </td>
                <td className="at-target">{log.target}</td>
                <td className="at-details">
                  {log.details && Object.keys(log.details).length > 0
                    ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Aucune entrée trouvée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditTrailPage;
