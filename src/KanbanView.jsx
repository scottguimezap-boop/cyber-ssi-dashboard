import { computeRiskScore, getRiskLevel } from "./utils/riskScore";
import "./KanbanView.css";

const COLUMNS = [
  { key: "en_attente", label: "En Attente", color: "var(--warning)" },
  { key: "en_examen",  label: "En Examen",  color: "var(--accent)" },
  { key: "validé",     label: "Validé",      color: "var(--success)" },
];

const KanbanView = ({ fournisseurs, allIncidents, allAudits, onToggleStatus, onNavigate, userRole }) => {
  const getColumn = (status) => {
    if (status === "validé") return "validé";
    if (status === "en_examen") return "en_examen";
    return "en_attente";
  };

  return (
    <div className="kanban-board">
      {COLUMNS.map((col) => {
        const items = fournisseurs.filter((f) => getColumn(f.status) === col.key);
        return (
          <div key={col.key} className="kanban-column">
            <div className="kanban-col-header" style={{ borderTopColor: col.color }}>
              <span className="kanban-col-title">{col.label}</span>
              <span className="kanban-col-count">{items.length}</span>
            </div>
            <div className="kanban-col-body">
              {items.map((f) => {
                const score = computeRiskScore(f, allIncidents, allAudits);
                const level = getRiskLevel(score);
                return (
                  <div key={f.id} className={`kanban-card level-${level}`}>
                    <div className="kanban-card-name">{f.nomFournisseur}</div>
                    <div className="kanban-card-meta">{f.typePrestataire}</div>
                    <div className="kanban-card-footer">
                      <span className={`kanban-score score-${level}`}>{score}%</span>
                      <div className="kanban-card-actions">
                        <button onClick={() => onNavigate(`/fournisseur/${f.id}`)} className="kanban-btn" title="Voir">👁️</button>
                        <button onClick={() => onNavigate(`/intelligence/${f.id}`)} className="kanban-btn" title="Intel">📡</button>
                        {userRole !== "lecteur" && (
                          <button onClick={() => onToggleStatus(f.id, f.status)} className="kanban-btn" title="Toggle">
                            {f.status === "validé" ? "⏸" : "✓"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="kanban-empty">Aucun élément</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanView;
