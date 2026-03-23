import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./db/firebase.jsx";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { NotificationProvider } from "./NotificationContext";
import Layout from "./Layout.jsx";

import Gestion from "./Gestion.jsx";
import AjouterFournisseur from "./AjouterFournisseur.jsx";
import DetailsFournisseur from "./DetailsFournisseur.jsx";
import ModifierFournisseur from "./ModifierFournisseur.jsx";
import IntelligenceFournisseur from "./IntelligenceFournisseur.jsx";
import Incidents from "./Incidents.jsx";
import AuditsGlobal from "./AuditsGlobal.jsx";
import ContactsGlobal from "./ContactsGlobal.jsx";
import Profil from "./Profil.jsx";
import Questionnaire from "./Questionnaire.jsx";
import RSSIDashboard from "./RSSIDashboard.jsx";
import AuditTrailPage from "./AuditTrailPage.jsx";
import AdminUsers from "./AdminUsers.jsx";

import "./App.css";

function App() {
  const [connectedUser, setConnectedUser] = useState(null);
  const [userRole, setUserRole] = useState("admin");
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setConnectedUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || "admin");
          } else {
            await setDoc(doc(db, "users", user.uid), {
              email: user.email,
              role: "admin",
              displayName: user.email?.split("@")[0] || "",
              createdAt: serverTimestamp(),
            });
            setUserRole("admin");
          }
        } catch (e) {
          console.warn("Error loading user role:", e);
          setUserRole("admin");
        }
      }
      setChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!email || !password) { setErreur("Champs requis."); return; }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());
    } catch (error) {
      setErreur("Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <div className="app-loader"><div className="spinner"></div></div>;

  const sharedProps = { connectedUser, userRole };

  return (
    <NotificationProvider>
      <Router>
        <Routes>

          {/* INSCRIPTION PRESTATAIRE (publique) */}
          <Route path="/se-proposer-fournisseur" element={
            <div className="public-layout">
              <nav className="public-nav">
                <div className="logo-container">
                  <span className="logo-icon">☁️</span>
                  <h1 className="logo-text">CYBER-SSI</h1>
                </div>
                <Link to="/" className="nav-link-secondary">Connexion Admin</Link>
              </nav>
              <div className="public-content"><AjouterFournisseur /></div>
            </div>
          } />

          {/* LOGIN */}
          <Route path="/" element={
            connectedUser ? <Navigate to="/gestion" replace /> : (
              <div className="login-split-screen">
                <div className="login-visual-side">
                  <div className="visual-content">
                    <div className="logo-display">
                      <span className="logo-icon-lg">☁️</span>
                      <h1>CYBER-SSI</h1>
                    </div>
                    <h2>Sécurisez votre infrastructure Cloud.</h2>
                    <p>Plateforme de gestion des risques tiers et conformité.</p>
                  </div>
                </div>
                <div className="login-form-side">
                  <div className="form-wrapper">
                    <div className="form-header">
                      <h2>Connexion Admin</h2>
                      <p>Accès réservé au service sécurité</p>
                    </div>
                    {erreur && <div className="alert-error">{erreur}</div>}
                    <form onSubmit={handleLogin}>
                      <div className="form-group">
                        <label>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@cyber-ssi.com" />
                      </div>
                      <div className="form-group">
                        <label>Mot de passe</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                      </div>
                      <button className="btn-primary" type="submit" disabled={loading}>
                        {loading ? "Authentification..." : "Accéder au Portail"}
                      </button>
                    </form>
                    <div className="form-footer">
                      <p>Prestataire externe ?</p>
                      <Link to="/se-proposer-fournisseur" className="link-register">Se référencer maintenant →</Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          } />

          {/* ROUTES PROTÉGÉES — enveloppées dans Layout (sidebar) */}
          <Route element={
            connectedUser
              ? <Layout connectedUser={connectedUser} setConnectedUser={setConnectedUser} userRole={userRole} />
              : <Navigate to="/" replace />
          }>
            <Route path="/gestion"          element={<Gestion {...sharedProps} />} />
            <Route path="/fournisseur/:id"  element={<DetailsFournisseur {...sharedProps} />} />
            <Route path="/modifier/:id"     element={<ModifierFournisseur {...sharedProps} />} />
            <Route path="/intelligence/:id" element={<IntelligenceFournisseur />} />
            <Route path="/crise"            element={<Incidents {...sharedProps} />} />
            <Route path="/audits"           element={<AuditsGlobal {...sharedProps} />} />
            <Route path="/annuaire"         element={<ContactsGlobal />} />
            <Route path="/profil"           element={<Profil userRole={userRole} />} />
            <Route path="/questionnaire"    element={<Questionnaire {...sharedProps} />} />
            <Route path="/rssi"             element={userRole === "admin" ? <RSSIDashboard /> : <Navigate to="/gestion" replace />} />
            <Route path="/audit-trail"      element={userRole === "admin" ? <AuditTrailPage /> : <Navigate to="/gestion" replace />} />
            <Route path="/admin/users"      element={userRole === "admin" ? <AdminUsers {...sharedProps} /> : <Navigate to="/gestion" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;
