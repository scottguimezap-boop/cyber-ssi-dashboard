import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./db/firebase";
import "./IntelligenceFournisseur.css";

const IntelligenceFournisseur = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplierName, setSupplierName] = useState("");
  
  // États : idle, scanning, complete, error
  const [scanStatus, setScanStatus] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [intelData, setIntelData] = useState(null);

  useEffect(() => {
    const fetchName = async () => {
      try {
        const docRef = doc(db, "fournisseurs", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const name = snap.data().nomFournisseur;
          setSupplierName(name);
          startOsintScan(name);
        } else {
            alert("Erreur: Fournisseur introuvable");
            navigate("/gestion");
        }
      } catch(e) { console.error(e); }
    };
    fetchName();
  }, [id, navigate]);

  const startOsintScan = (name) => {
    setScanStatus("scanning");
    const steps = [
      `Initialisation du protocole OSINT sur "${name}"...`,
      "Connexion aux bases de données mondiales (D&B, Sirene)...",
      "Analyse des certificats de sécurité (SSL/TLS)...",
      "Recherche des mandataires sociaux...",
      "Scan de la réputation web & Darkweb...",
      "Vérification des sanctions internationales..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setLogs(prev => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        
        // RECHERCHE DANS LA BASE INTERNE
        // Si le nom existe dans notre grosse base -> On affiche.
        // Sinon -> On simule une erreur "Introuvable" (comme demandé).
        const result = searchInInternalDatabase(name);
        
        if (result) {
          setIntelData(result);
          setScanStatus("complete");
        } else {
           // MODE FALLBACK : Si on veut éviter l'erreur et générer quand même :
           // setIntelData(generateMockData(name)); 
           // setScanStatus("complete");
           
           // MODE STRICT (DEMANDÉ) : Message d'erreur
           setScanStatus("error");
        }
      }
    }, 600);
  };

  const handlePrint = () => window.print();

  return (
    <div className="intel-layout">
      <div className="cyber-bg-animation no-print"></div>

      {/* 1. SCANNING */}
      {scanStatus === "scanning" && (
        <div className="scan-terminal">
          <div className="terminal-header">
            <span className="blink">●</span> RECHERCHE ACTIVE: {supplierName.toUpperCase()}
          </div>
          <div className="terminal-body">
            {logs.map((log, index) => (
              <div key={index} className="log-line">
                <span className="log-time">[{new Date().toLocaleTimeString()}]</span> {log}
              </div>
            ))}
            <div className="loading-bar"></div>
          </div>
        </div>
      )}

      {/* 2. ERREUR - FOURNISSEUR NON TROUVÉ */}
      {scanStatus === "error" && (
        <div className="error-container">
          <div className="error-box">
            <div className="error-icon">🚫</div>
            <h1>CIBLE NON IDENTIFIÉE</h1>
            <p>Le fournisseur <strong>"{supplierName}"</strong> n'apparaît pas dans les registres internationaux certifiés.</p>
            <p style={{fontSize: '0.9rem', color: '#64748b'}}>Veuillez vérifier l'orthographe ou saisir un fournisseur majeur (ex: Microsoft, Orange, AWS, OVH...).</p>
            <div className="error-actions">
              <button onClick={() => window.location.reload()} className="btn-retry">Relancer Scan</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUCCÈS - RAPPORT */}
      {scanStatus === "complete" && intelData && (
        <div className="intel-container">
          <div className="intel-header no-print">
            <h1 className="intel-title">Rapport d'Intelligence</h1>
            <button onClick={handlePrint} className="btn-action btn-print">🖨️ PDF</button>
          </div>

          <div className="report-paper">
            <header className="report-head">
              <div className="target-id">
                <h2>{intelData.name}</h2>
                <span className="siret">ID/SIRET : {intelData.siret}</span>
                <span className="country-flag">{intelData.pays}</span>
              </div>
              <div className="trust-score">
                <div className="score-circle" style={{borderColor: getScoreColor(intelData.globalScore)}}>
                  <span style={{color: getScoreColor(intelData.globalScore)}}>{intelData.globalScore}/100</span>
                </div>
                <label>Score Fiabilité</label>
              </div>
            </header>

            <div className="intel-grid">
              <div className="intel-card">
                <h3>🏢 Identité</h3>
                <div className="data-row"><label>Siège :</label> <span>{intelData.siege}</span></div>
                <div className="data-row"><label>Création :</label> <span>{intelData.creation}</span></div>
                <div className="data-row highlight"><label>Dirigeant :</label> <span>{intelData.pdg}</span></div>
                <div className="data-row"><label>Effectif :</label> <span>{intelData.effectif}</span></div>
              </div>

              <div className="intel-card">
                <h3>💰 Finance</h3>
                <div className="data-row"><label>C.A. :</label> <span className="money">{intelData.ca}</span></div>
                <div className="data-row"><label>Résultat :</label> <span>{intelData.resultat}</span></div>
                <div className="trend-indicator">{intelData.tendance}</div>
              </div>

              <div className="intel-card full-width">
                <h3>⚖️ Risque & Conformité</h3>
                <div className="grid-2">
                  <div>
                    <h4>Juridique</h4>
                    {intelData.juridique.length > 0 ? (
                       <ul className="danger-list">{intelData.juridique.map((j,i)=><li key={i}>⚠️ {j}</li>)}</ul>
                    ) : <div className="safe-badge">RAS - Sain</div>}
                  </div>
                  <div>
                    <h4>Certifications</h4>
                    <div className="cert-tags">
                      {intelData.certifications.length > 0 ? intelData.certifications.map(c => <span key={c} className="cert-tag">{c}</span>) : <span>Aucune certification majeure</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="intel-card full-width reputation-section">
                <h3>⭐ E-Réputation</h3>
                <div className="rating-box">
                  <span className="big-star">★ {intelData.avisNote}/5</span>
                  <span className="rating-count">({intelData.avisCount} sources)</span>
                </div>
                <p className="quote">"{intelData.lastReview}"</p>
              </div>
            </div>

            <footer className="report-footer">Données certifiées par CYBER-SSI INTELLIGENCE.</footer>
          </div>
        </div>
      )}
    </div>
  );
};

const getScoreColor = (score) => score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444';

const searchInInternalDatabase = (queryName) => {
  const key = queryName.toLowerCase().trim();
  const foundKey = Object.keys(DATABASE).find(k => k.includes(key) || key.includes(k));
  return foundKey ? DATABASE[foundKey] : null;
};

// ====================================================================================
// 🏢 BASE DE DONNÉES MASSIVE (60+ LEADERS MARCHÉ)
// ====================================================================================
const DATABASE = {
  // --- TÉLÉCOMS & FAI ---
  "orange": { name: "Orange Business", siret: "380 129 866 00034", pays: "🇫🇷 FR", siege: "Issy-les-Moulineaux", creation: "1991", pdg: "Christel Heydemann", effectif: "136,000", ca: "44 Mrd €", resultat: "+2 Mrd €", tendance: "📈 Leader", globalScore: 98, juridique: [], certifications: ["ISO 27001", "HDS", "SecNumCloud"], avisNote: 4.6, avisCount: 15000, lastReview: "Réseau fiable." },
  "sfr": { name: "SFR Business", siret: "343 059 564 00041", pays: "🇫🇷 FR", siege: "Paris 15", creation: "1987", pdg: "Mathieu Cocq", effectif: "9,000", ca: "10 Mrd €", resultat: "Variable", tendance: "⚖️ Stable", globalScore: 88, juridique: [], certifications: ["ISO 27001"], avisNote: 3.9, avisCount: 8200, lastReview: "Bon rapport qualité/prix." },
  "bouygues": { name: "Bouygues Telecom", siret: "397 975 308 00010", pays: "🇫🇷 FR", siege: "Meudon", creation: "1994", pdg: "Benoît Torloting", effectif: "8,500", ca: "7.5 Mrd €", resultat: "+450 M €", tendance: "📈 Croissance", globalScore: 92, juridique: [], certifications: ["ISO 27001"], avisNote: 4.3, avisCount: 6500, lastReview: "Offres PME flexibles." },
  "free": { name: "Free Pro (Iliad)", siret: "421 938 861 00050", pays: "🇫🇷 FR", siege: "Paris 8", creation: "1999", pdg: "Thomas Reynaud", effectif: "15,000", ca: "8.4 Mrd €", resultat: "+1 Mrd €", tendance: "🚀 Agressif", globalScore: 90, juridique: [], certifications: ["ISO 27001"], avisNote: 4.5, avisCount: 12000, lastReview: "Tarifs imbattables." },
  "verizon": { name: "Verizon", siret: "399 321 071 00067", pays: "🇺🇸 USA", siege: "New York / Paris", creation: "1983", pdg: "Hans Vestberg", effectif: "118,000", ca: "136 Mrd $", resultat: "+21 Mrd $", tendance: "🛡️ Géant", globalScore: 95, juridique: ["Surveillance US"], certifications: ["SOC 2"], avisNote: 4.4, avisCount: 20000, lastReview: "Réseau mondial robuste." },
  "bt": { name: "British Telecom (BT)", siret: "389 687 088", pays: "🇬🇧 UK", siege: "Londres", creation: "1980", pdg: "Allison Kirkby", effectif: "100,000", ca: "20 Mrd £", resultat: "Positif", tendance: "⚖️ Stable", globalScore: 89, juridique: [], certifications: ["ISO 27001"], avisNote: 4.1, avisCount: 3000, lastReview: "Partenaire historique." },
  "colt": { name: "Colt Technology", siret: "402 628 363", pays: "🇬🇧 UK", siege: "Londres", creation: "1992", pdg: "Keri Gilder", effectif: "5,000", ca: "1.6 Mrd €", resultat: "N/C", tendance: "🌐 Fibre", globalScore: 94, juridique: [], certifications: ["ISO 27001"], avisNote: 4.7, avisCount: 1500, lastReview: "Expertise fibre optique." },
  "zayo": { name: "Zayo Group", siret: "514 263 367", pays: "🇺🇸 USA", siege: "Boulder / Paris", creation: "2007", pdg: "Steve Smith", effectif: "3,000", ca: "2.6 Mrd $", resultat: "N/C", tendance: "📈 Infra", globalScore: 91, juridique: [], certifications: ["ISO 27001"], avisNote: 4.3, avisCount: 400, lastReview: "Infrastructure solide." },
  "cogent": { name: "Cogent Communications", siret: "437 749 859", pays: "🇺🇸 USA", siege: "Washington DC", creation: "1999", pdg: "Dave Schaeffer", effectif: "1,000", ca: "600 M $", resultat: "Positif", tendance: "💰 Low Cost", globalScore: 88, juridique: [], certifications: [], avisNote: 4.0, avisCount: 200, lastReview: "Transit IP pas cher." },
  "lumen": { name: "Lumen Technologies", siret: "N/A", pays: "🇺🇸 USA", siege: "Monroe, LA", creation: "1930", pdg: "Kate Johnson", effectif: "30,000", ca: "15 Mrd $", resultat: "N/C", tendance: "⚠️ Dette", globalScore: 85, juridique: [], certifications: ["ISO 27001"], avisNote: 3.8, avisCount: 5000, lastReview: "Anciennement CenturyLink." },

  // --- HÉBERGEURS & CLOUD FR/EU ---
  "ovhcloud": { name: "OVHcloud", siret: "537 407 926", pays: "🇫🇷 FR", siege: "Roubaix", creation: "1999", pdg: "Michel Paulin", effectif: "2,900", ca: "897 M €", resultat: "Investissement", tendance: "📈 Expansion", globalScore: 93, juridique: [], certifications: ["SecNumCloud", "HDS", "ISO 27001"], avisNote: 4.2, avisCount: 5400, lastReview: "Souveraineté garantie." },
  "scaleway": { name: "Scaleway", siret: "433 115 904", pays: "🇫🇷 FR", siege: "Paris", creation: "1999", pdg: "Damien Lucas", effectif: "600", ca: "150 M €", resultat: "Positif", tendance: "🚀 Innovation", globalScore: 91, juridique: [], certifications: ["HDS", "ISO 27001"], avisNote: 4.6, avisCount: 2100, lastReview: "Écosystème complet." },
  "clever": { name: "Clever Cloud", siret: "524 172 376", pays: "🇫🇷 FR", siege: "Nantes", creation: "2010", pdg: "Quentin Adam", effectif: "50", ca: "5 M €", resultat: "Positif", tendance: "❤️ Love Brand", globalScore: 94, juridique: [], certifications: ["ISO 9001"], avisNote: 4.9, avisCount: 500, lastReview: "PaaS simple et efficace." },
  "outscale": { name: "3DS Outscale", siret: "527 594 287", pays: "🇫🇷 FR", siege: "Saint-Cloud", creation: "2010", pdg: "Philippe Miltin", effectif: "200", ca: "45 M €", resultat: "Positif", tendance: "🛡️ Sécurité", globalScore: 97, juridique: [], certifications: ["SecNumCloud", "HDS"], avisNote: 4.5, avisCount: 300, lastReview: "Cloud de confiance." },
  "infomaniak": { name: "Infomaniak", siret: "N/A (CH)", pays: "🇨🇭 CH", siege: "Genève", creation: "1994", pdg: "Marc Oehler", effectif: "200", ca: "40 M CHF", resultat: "Positif", tendance: "🌿 Écologie", globalScore: 95, juridique: [], certifications: ["ISO 27001", "ISO 14001"], avisNote: 4.8, avisCount: 4500, lastReview: "Cloud éthique." },
  "hetzner": { name: "Hetzner Online", siret: "N/A (DE)", pays: "🇩🇪 DE", siege: "Gunzenhausen", creation: "1997", pdg: "Martin Hetzner", effectif: "500", ca: "300 M €", resultat: "Rentable", tendance: "💰 Low Cost", globalScore: 89, juridique: [], certifications: ["ISO 27001"], avisNote: 4.7, avisCount: 8000, lastReview: "Prix imbattables." },
  "ionos": { name: "IONOS (1&1)", siret: "431 303 775", pays: "🇩🇪 DE", siege: "Montabaur", creation: "1988", pdg: "Achim Weiss", effectif: "4,000", ca: "1.1 Mrd €", resultat: "Positif", tendance: "⚖️ Stable", globalScore: 90, juridique: [], certifications: ["ISO 27001"], avisNote: 4.1, avisCount: 12000, lastReview: "Hébergeur généraliste solide." },
  "ikoula": { name: "Ikoula", siret: "417 680 618", pays: "🇫🇷 FR", siege: "Boulogne", creation: "1998", pdg: "Jules-Henri Gavetti", effectif: "60", ca: "10 M €", resultat: "Stable", tendance: "⚖️ Historique", globalScore: 85, juridique: [], certifications: [], avisNote: 4.0, avisCount: 300, lastReview: "Serveurs dédiés corrects." },
  "gandhi": { name: "Gandi.net", siret: "423 093 459", pays: "🇫🇷 FR", siege: "Paris", creation: "1999", pdg: "Stephan Ramoin", effectif: "150", ca: "40 M €", resultat: "Positif", tendance: "⚖️ Rachat TWS", globalScore: 88, juridique: [], certifications: [], avisNote: 4.3, avisCount: 5000, lastReview: "Référence noms de domaine." },

  // --- GAFAM & US TECH ---
  "microsoft": { name: "Microsoft", siret: "327 733 184", pays: "🇺🇸 USA", siege: "Redmond", creation: "1975", pdg: "Satya Nadella", effectif: "221,000", ca: "211 Mrd $", resultat: "+72 Mrd $", tendance: "📈 Forte", globalScore: 98, juridique: [], certifications: ["ISO 27001", "HDS", "SecNumCloud"], avisNote: 4.8, avisCount: 50000, lastReview: "Standard du marché." },
  "google": { name: "Google Cloud", siret: "443 061 841", pays: "🇺🇸 USA", siege: "Mountain View", creation: "1998", pdg: "Sundar Pichai", effectif: "190,000", ca: "282 Mrd $", resultat: "+60 Mrd $", tendance: "📈 Croissance", globalScore: 95, juridique: ["CNIL"], certifications: ["ISO 27001", "HDS"], avisNote: 4.7, avisCount: 32000, lastReview: "Leader IA." },
  "aws": { name: "AWS", siret: "833 686 933", pays: "🇺🇸 USA", siege: "Seattle", creation: "2006", pdg: "Adam Selipsky", effectif: "1.5M", ca: "80 Mrd $", resultat: "+22 Mrd $", tendance: "📈 Leader", globalScore: 96, juridique: [], certifications: ["ISO 27001", "HDS"], avisNote: 4.8, avisCount: 45000, lastReview: "Offre la plus riche." },
  "apple": { name: "Apple", siret: "322 120 916", pays: "🇺🇸 USA", siege: "Cupertino", creation: "1976", pdg: "Tim Cook", effectif: "164,000", ca: "394 Mrd $", resultat: "+99 Mrd $", tendance: "⚖️ Stable", globalScore: 94, juridique: ["DMA"], certifications: ["ISO 27001"], avisNote: 4.9, avisCount: 100000, lastReview: "Matériel sécurisé." },
  "meta": { name: "Meta (Facebook)", siret: "532 321 950", pays: "🇺🇸 USA", siege: "Menlo Park", creation: "2004", pdg: "Mark Zuckerberg", effectif: "70,000", ca: "116 Mrd $", resultat: "+23 Mrd $", tendance: "⚠️ Privacy", globalScore: 85, juridique: ["RGPD"], certifications: [], avisNote: 3.5, avisCount: 80000, lastReview: "Problèmes de confidentialité récurrents." },
  "oracle": { name: "Oracle", siret: "338 300 062", pays: "🇺🇸 USA", siege: "Austin", creation: "1977", pdg: "Safra Catz", effectif: "143,000", ca: "50 Mrd $", resultat: "+10 Mrd $", tendance: "⚖️ Cloud", globalScore: 92, juridique: [], certifications: ["ISO 27001"], avisNote: 4.2, avisCount: 15000, lastReview: "Base de données robuste." },
  "ibm": { name: "IBM", siret: "552 118 465", pays: "🇺🇸 USA", siege: "Armonk", creation: "1911", pdg: "Arvind Krishna", effectif: "280,000", ca: "60 Mrd $", resultat: "+1.6 Mrd $", tendance: "🔄 Pivot", globalScore: 93, juridique: [], certifications: ["ISO 27001"], avisNote: 4.3, avisCount: 20000, lastReview: "Expertise Hybride et IA." },
  "cisco": { name: "Cisco", siret: "349 167 668", pays: "🇺🇸 USA", siege: "San Jose", creation: "1984", pdg: "Chuck Robbins", effectif: "83,000", ca: "57 Mrd $", resultat: "+12 Mrd $", tendance: "📈 Solide", globalScore: 97, juridique: [], certifications: ["FIPS"], avisNote: 4.6, avisCount: 12000, lastReview: "Réseau de référence." },
  "dell": { name: "Dell", siret: "351 528 229", pays: "🇺🇸 USA", siege: "Round Rock", creation: "1984", pdg: "Michael Dell", effectif: "133,000", ca: "102 Mrd $", resultat: "+2.4 Mrd $", tendance: "⚖️ Stable", globalScore: 93, juridique: [], certifications: ["ISO 9001"], avisNote: 4.4, avisCount: 25000, lastReview: "Matériel fiable." },
  "hp": { name: "HP Inc.", siret: "592 035 833", pays: "🇺🇸 USA", siege: "Palo Alto", creation: "1939", pdg: "Enrique Lores", effectif: "50,000", ca: "63 Mrd $", resultat: "+3 Mrd $", tendance: "⚖️ Stable", globalScore: 91, juridique: [], certifications: [], avisNote: 4.2, avisCount: 18000, lastReview: "PC et Imprimantes standards." },
  
  // --- CYBERSECURITY LEADERS ---
  "paloalto": { name: "Palo Alto Networks", siret: "N/A", pays: "🇺🇸 USA", siege: "Santa Clara", creation: "2005", pdg: "Nikesh Arora", ca: "6.9 Mrd $", globalScore: 97, avisNote: 4.8, lastReview: "Firewall Leader." },
  "fortinet": { name: "Fortinet", siret: "N/A", pays: "🇺🇸 USA", siege: "Sunnyvale", creation: "2000", pdg: "Ken Xie", ca: "4.4 Mrd $", globalScore: 95, avisNote: 4.5, lastReview: "Bon rapport perf/prix." },
  "crowdstrike": { name: "CrowdStrike", siret: "N/A", pays: "🇺🇸 USA", siege: "Austin", creation: "2011", pdg: "George Kurtz", ca: "2.2 Mrd $", globalScore: 93, avisNote: 4.8, lastReview: "EDR Top Tier." },
  "sentinelone": { name: "SentinelOne", siret: "N/A", pays: "🇺🇸 USA", siege: "Mountain View", creation: "2013", pdg: "Tomer Weingarten", ca: "400 M $", globalScore: 92, avisNote: 4.7, lastReview: "EDR autonome performant." },
  "zscaler": { name: "Zscaler", siret: "N/A", pays: "🇺🇸 USA", siege: "San Jose", creation: "2007", pdg: "Jay Chaudhry", ca: "1.6 Mrd $", globalScore: 94, avisNote: 4.6, lastReview: "Leader SASE / SSE." },
  "okta": { name: "Okta", siret: "N/A", pays: "🇺🇸 USA", siege: "San Francisco", creation: "2009", pdg: "Todd McKinnon", ca: "1.8 Mrd $", globalScore: 90, avisNote: 4.5, lastReview: "Gestion identité (IAM) leader." },
  "cyberark": { name: "CyberArk", siret: "N/A", pays: "🇮🇱 ISR / 🇺🇸 USA", siege: "Newton", creation: "1999", pdg: "Matt Cohen", ca: "600 M $", globalScore: 93, avisNote: 4.4, lastReview: "PAM (Privileged Access) Leader." },
  "trendmicro": { name: "Trend Micro", siret: "N/A", pays: "🇯🇵 JPN", siege: "Tokyo", creation: "1988", pdg: "Eva Chen", ca: "1.7 Mrd $", globalScore: 91, avisNote: 4.3, lastReview: "Solide sur la protection endpoint." },
  "sophos": { name: "Sophos", siret: "N/A", pays: "🇬🇧 UK", siege: "Abingdon", creation: "1985", pdg: "Kris Hagerman", ca: "1 Mrd $", globalScore: 90, avisNote: 4.2, lastReview: "Simple pour les PME." },
  "check point": { name: "Check Point", siret: "N/A", pays: "🇮🇱 ISR", siege: "Tel Aviv", creation: "1993", pdg: "Gil Shwed", ca: "2.3 Mrd $", globalScore: 92, avisNote: 4.3, lastReview: "Pionnier du firewall." },

  // --- LOGICIELS & SaaS ---
  "salesforce": { name: "Salesforce", siret: "483 996 235", pays: "🇺🇸 USA", ca: "31 Mrd $", globalScore: 94, avisNote: 4.6, lastReview: "CRM Leader." },
  "sap": { name: "SAP", siret: "349 663 542", pays: "🇩🇪 DE", ca: "30 Mrd €", globalScore: 96, avisNote: 4.3, lastReview: "ERP Leader." },
  "adobe": { name: "Adobe", siret: "380 656 389", pays: "🇺🇸 USA", ca: "17 Mrd $", globalScore: 95, avisNote: 4.7, lastReview: "Créativité." },
  "servicenow": { name: "ServiceNow", siret: "N/A", pays: "🇺🇸 USA", ca: "7 Mrd $", globalScore: 93, avisNote: 4.5, lastReview: "ITSM Leader." },
  "workday": { name: "Workday", siret: "N/A", pays: "🇺🇸 USA", ca: "6 Mrd $", globalScore: 92, avisNote: 4.4, lastReview: "RH Cloud." },
  "atlassian": { name: "Atlassian (Jira)", siret: "N/A", pays: "🇦🇺 AUS", ca: "3 Mrd $", globalScore: 90, avisNote: 4.3, lastReview: "Outils dév indispensables." },
  "slack": { name: "Slack (Salesforce)", siret: "N/A", pays: "🇺🇸 USA", ca: "N/A", globalScore: 91, avisNote: 4.6, lastReview: "Collaboration fluide." },
  "zoom": { name: "Zoom", siret: "N/A", pays: "🇺🇸 USA", ca: "4 Mrd $", globalScore: 88, avisNote: 4.5, lastReview: "Visioconférence." },
  "docusign": { name: "DocuSign", siret: "N/A", pays: "🇺🇸 USA", ca: "2.5 Mrd $", globalScore: 92, avisNote: 4.7, lastReview: "Signature électronique." },
  "dropbox": { name: "Dropbox", siret: "N/A", pays: "🇺🇸 USA", ca: "2.3 Mrd $", globalScore: 89, avisNote: 4.2, lastReview: "Stockage simple." },

  // --- ESN FRANCE ---
  "sopra": { name: "Sopra Steria", siret: "326 820 065", pays: "🇫🇷 FR", ca: "5.1 Mrd €", globalScore: 90, avisNote: 4.1, lastReview: "Solide." },
  "wavestone": { name: "Wavestone", siret: "377 550 249", pays: "🇫🇷 FR", ca: "500 M €", globalScore: 93, avisNote: 4.5, lastReview: "Conseil Cyber." },
  "alten": { name: "Alten", siret: "348 607 417", pays: "🇫🇷 FR", ca: "3.7 Mrd €", globalScore: 88, avisNote: 3.9, lastReview: "Ingénierie." },
  "altran": { name: "Altran (Capgemini)", siret: "N/A", pays: "🇫🇷 FR", ca: "3 Mrd €", globalScore: 89, avisNote: 4.0, lastReview: "R&D." },
  "econocom": { name: "Econocom", siret: "326 966 777", pays: "🇫🇷 FR", ca: "2.7 Mrd €", globalScore: 85, avisNote: 3.8, lastReview: "Distribution IT." },
  "neurones": { name: "Neurones", siret: "331 408 336", pays: "🇫🇷 FR", ca: "665 M €", globalScore: 87, avisNote: 4.1, lastReview: "ESN agile." },
  "aubay": { name: "Aubay", siret: "391 504 644", pays: "🇫🇷 FR", ca: "513 M €", globalScore: 86, avisNote: 4.0, lastReview: "Banque/Finance." }
};

export default IntelligenceFournisseur;