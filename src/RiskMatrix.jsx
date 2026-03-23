import { computeRiskScore } from "./utils/riskScore";
import "./RiskMatrix.css";

const RiskMatrix = ({ fournisseurs, allIncidents, allAudits }) => {
  const getPosition = (f) => {
    const activeInc = allIncidents.filter(
      (i) => i.statut !== "Résolu" && i.fournisseurId === f.id
    ).length;
    const probabilite = Math.min(5, Math.max(1, activeInc + 1));
    const impact = Math.min(5, Math.max(1, 6 - Number(f.niveauConfiance || 3)));
    return { probabilite, impact };
  };

  const cells = {};
  fournisseurs.forEach((f) => {
    const { probabilite, impact } = getPosition(f);
    const key = `${probabilite}-${impact}`;
    if (!cells[key]) cells[key] = [];
    cells[key].push({
      ...f,
      score: computeRiskScore(f, allIncidents, allAudits),
    });
  });

  const getCellColor = (prob, imp) => {
    const val = prob * imp;
    if (val >= 15) return "cell-critical";
    if (val >= 8) return "cell-moderate";
    return "cell-safe";
  };

  return (
    <div className="risk-matrix-wrapper">
      <h3 className="risk-matrix-title">Cartographie des Risques</h3>
      <div className="risk-matrix">
        <div className="matrix-y-label">Probabilité</div>
        <div className="matrix-grid">
          {[5, 4, 3, 2, 1].map((prob) => (
            <div key={prob} className="matrix-row">
              <div className="matrix-row-label">{prob}</div>
              {[1, 2, 3, 4, 5].map((imp) => {
                const key = `${prob}-${imp}`;
                const items = cells[key] || [];
                return (
                  <div key={key} className={`matrix-cell ${getCellColor(prob, imp)}`}>
                    {items.map((f) => (
                      <div key={f.id} className="matrix-dot" title={`${f.nomFournisseur} (${f.score}%)`}>
                        {f.nomFournisseur?.substring(0, 2).toUpperCase()}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="matrix-x-labels">
            <div className="matrix-row-label" />
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="matrix-x-label">{n}</div>
            ))}
          </div>
        </div>
        <div className="matrix-x-title">Impact</div>
      </div>
      <div className="matrix-legend">
        <span className="legend-item"><span className="legend-dot cell-safe" /> Faible</span>
        <span className="legend-item"><span className="legend-dot cell-moderate" /> Moyen</span>
        <span className="legend-item"><span className="legend-dot cell-critical" /> Critique</span>
      </div>
    </div>
  );
};

export default RiskMatrix;
