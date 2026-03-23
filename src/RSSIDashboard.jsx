import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "./db/firebase";
import { computeRiskScore, getRiskLevel, getRiskColor } from "./utils/riskScore";
import { exportFournisseursList } from "./utils/exportPDF";
import RiskMatrix from "./RiskMatrix";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import "./RSSIDashboard.css";

const RSSIDashboard = () => {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [audits, setAudits] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "fournisseurs"), (s) =>
        setFournisseurs(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, "incidents"), orderBy("dateDeclaration", "desc")), (s) =>
        setIncidents(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, "audits"), (s) =>
        setAudits(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, "questionnaires"), (s) =>
        setQuestionnaires(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // KPIs
  const scores = fournisseurs.map((f) => computeRiskScore(f, incidents, audits));
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const criticalCount = fournisseurs.filter((f) => getRiskLevel(computeRiskScore(f, incidents, audits)) === "critical").length;
  const activeIncidents = incidents.filter((i) => i.statut !== "Résolu").length;
  const today = new Date().toISOString().split("T")[0];
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const auditsThisWeek = audits.filter((a) => a.date >= today && a.date <= weekFromNow).length;
  const avgQuestionnaire = questionnaires.length
    ? Math.round(questionnaires.reduce((a, q) => a + (q.score || 0), 0) / questionnaires.length)
    : 0;

  // Chart: incidents par mois (6 derniers mois)
  const incidentsByMonth = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("fr-FR", { month: "short" });
      const count = incidents.filter((inc) => {
        const ts = inc.dateDeclaration?.seconds ? new Date(inc.dateDeclaration.seconds * 1000) : null;
        if (!ts) return false;
        return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}` === key;
      }).length;
      months.push({ name: label, incidents: count });
    }
    return months;
  })();

  // Chart: distribution des scores
  const scoreDistribution = (() => {
    const buckets = [
      { name: "0-20", min: 0, max: 20, count: 0 },
      { name: "21-40", min: 21, max: 40, count: 0 },
      { name: "41-60", min: 41, max: 60, count: 0 },
      { name: "61-80", min: 61, max: 80, count: 0 },
      { name: "81-100", min: 81, max: 100, count: 0 },
    ];
    fournisseurs.forEach((f) => {
      const score = computeRiskScore(f, incidents, audits);
      const bucket = buckets.find((b) => score >= b.min && score <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  })();

  // Top 5 à risque
  const top5Risk = [...fournisseurs]
    .map((f) => ({ ...f, score: computeRiskScore(f, incidents, audits) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const scoresMap = Object.fromEntries(fournisseurs.map((f) => [f.id, computeRiskScore(f, incidents, audits)]));

  return (
    <div className="rssi-layout">
      <div className="rssi-header">
        <div>
          <h1>Tableau de Bord RSSI</h1>
          <p>Vue exécutive de la posture sécurité fournisseurs</p>
        </div>
        <button className="btn-rssi-export" onClick={() => exportFournisseursList(fournisseurs, scoresMap)}>
          Exporter Rapport PDF
        </button>
      </div>

      {/* KPI Cards */}
      <div className="rssi-kpis">
        <div className="rssi-kpi">
          <div className="kpi-value" style={{ color: avgScore >= 70 ? "var(--success)" : avgScore >= 40 ? "var(--warning)" : "var(--danger)" }}>
            {avgScore}%
          </div>
          <div className="kpi-label">Score Moyen</div>
        </div>
        <div className="rssi-kpi">
          <div className="kpi-value" style={{ color: "var(--danger)" }}>{criticalCount}</div>
          <div className="kpi-label">Fournisseurs Critiques</div>
        </div>
        <div className="rssi-kpi">
          <div className="kpi-value" style={{ color: activeIncidents > 0 ? "var(--danger)" : "var(--success)" }}>{activeIncidents}</div>
          <div className="kpi-label">Incidents Actifs</div>
        </div>
        <div className="rssi-kpi">
          <div className="kpi-value">{auditsThisWeek}</div>
          <div className="kpi-label">Audits cette semaine</div>
        </div>
        <div className="rssi-kpi">
          <div className="kpi-value" style={{ color: avgQuestionnaire >= 70 ? "var(--success)" : "var(--warning)" }}>{avgQuestionnaire}%</div>
          <div className="kpi-label">Conformité Moyenne</div>
        </div>
      </div>

      {/* Charts */}
      <div className="rssi-charts">
        <div className="rssi-chart-card">
          <h3>Incidents par Mois</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={incidentsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)" }} />
              <Line type="monotone" dataKey="incidents" stroke="var(--danger)" strokeWidth={2} dot={{ fill: "var(--danger)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rssi-chart-card">
          <h3>Distribution des Scores</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)" }} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom: Top 5 + Matrix */}
      <div className="rssi-bottom">
        <div className="rssi-top5">
          <h3>Top 5 Fournisseurs à Risque</h3>
          <div className="top5-list">
            {top5Risk.map((f, i) => (
              <div key={f.id} className="top5-item">
                <span className="top5-rank">#{i + 1}</span>
                <span className="top5-name">{f.nomFournisseur}</span>
                <span className="top5-score" style={{ color: getRiskColor(f.score) }}>{f.score}%</span>
              </div>
            ))}
            {top5Risk.length === 0 && <p className="top5-empty">Aucun fournisseur enregistré.</p>}
          </div>
        </div>
        <RiskMatrix fournisseurs={fournisseurs} allIncidents={incidents} allAudits={audits} />
      </div>
    </div>
  );
};

export default RSSIDashboard;
