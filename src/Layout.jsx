import { useEffect, useState, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "./db/firebase";
import { collection, query, where, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { useNotification } from "./NotificationContext";
import { getRoleLabel } from "./utils/userRole";
import Breadcrumb from "./Breadcrumb";
import "./Layout.css";

const NAV_ITEMS = [
  { path: "/gestion",        icon: "⊞",  label: "Dashboard" },
  { path: "/crise",          icon: "🚨", label: "Salle de Crise", isCrise: true },
  { path: "/audits",         icon: "📅", label: "Planning" },
  { path: "/annuaire",       icon: "📇", label: "Annuaire" },
  { path: "/questionnaire",  icon: "📝", label: "Questionnaire" },
];

const ADMIN_ITEMS = [
  { path: "/rssi",          icon: "📊", label: "RSSI Dashboard" },
  { path: "/audit-trail",   icon: "📜", label: "Journal" },
  { path: "/admin/users",   icon: "👥", label: "Utilisateurs" },
];

const Layout = ({ connectedUser, setConnectedUser, userRole }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [criticalCount, setCriticalCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const alertsChecked = useRef(false);

  // Badge incidents critiques
  useEffect(() => {
    const q = query(
      collection(db, "incidents"),
      where("gravite", "==", "Critique"),
      where("statut", "==", "En cours")
    );
    const unsub = onSnapshot(q, (snap) => setCriticalCount(snap.size));
    return () => unsub();
  }, []);

  // Alertes automatiques (une seule fois)
  useEffect(() => {
    if (alertsChecked.current) return;
    alertsChecked.current = true;

    const checkAlerts = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
        const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

        // Audits dans les 7 prochains jours
        const auditsSnap = await getDocs(query(collection(db, "audits"), orderBy("date", "asc")));
        auditsSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.date >= today && data.date <= in7days && !data.resultat?.includes("Validé")) {
            addNotification("warning", `Audit "${data.nomFournisseur}" prévu le ${data.date}`);
          }
        });

        // Contrats expirant dans 30 jours
        const contratsSnap = await getDocs(collection(db, "contrats"));
        contratsSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.dateFin >= today && data.dateFin <= in30days) {
            addNotification("warning", `Contrat "${data.type}" expire le ${data.dateFin}`);
          }
        });
      } catch (e) {
        console.warn("Alert check error:", e);
      }
    };
    checkAlerts();
  }, [addNotification]);

  // Fermer sidebar mobile lors d'un changement de route
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    setConnectedUser(null);
  };

  const isActive = (path) => {
    if (path === "/gestion") {
      return (
        location.pathname === "/gestion" ||
        location.pathname.startsWith("/fournisseur") ||
        location.pathname.startsWith("/modifier") ||
        location.pathname.startsWith("/intelligence")
      );
    }
    return location.pathname === path;
  };

  const emailShort = connectedUser?.email?.split("@")[0] || "admin";

  return (
    <div className="app-layout">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">☁️</span>
          <div>
            <div className="sidebar-brand">CYBER-SSI</div>
            <div className="sidebar-tagline">Security Platform</div>
          </div>
        </div>

        {/* Navigation principale */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.isCrise && criticalCount > 0 && (
                <span className="sidebar-badge">{criticalCount}</span>
              )}
            </button>
          ))}

          {/* Admin section */}
          {userRole === "admin" && (
            <>
              <div className="sidebar-separator" />
              <div className="sidebar-section-label">Administration</div>
              {ADMIN_ITEMS.map((item) => (
                <button
                  key={item.path}
                  className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                </button>
              ))}
            </>
          )}

          <div className="sidebar-separator" />

          <button
            className={`sidebar-nav-item ${isActive("/profil") ? "active" : ""}`}
            onClick={() => navigate("/profil")}
          >
            <span className="sidebar-nav-icon">👤</span>
            <span className="sidebar-nav-label">Mon Profil</span>
          </button>
        </nav>

        {/* Footer utilisateur */}
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">{emailShort[0]?.toUpperCase()}</div>
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">{emailShort}</div>
              <div className="sidebar-user-role">{getRoleLabel(userRole)}</div>
            </div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ZONE PRINCIPALE */}
      <div className="page-wrapper">
        {/* Topbar mobile */}
        <div className="mobile-topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "✕" : "☰"}
          </button>
          <span className="mobile-brand">☁️ CYBER-SSI</span>
          {criticalCount > 0 && (
            <span className="mobile-alert-badge" onClick={() => navigate("/crise")}>
              🚨 {criticalCount}
            </span>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="breadcrumb-wrapper">
          <Breadcrumb />
        </div>

        {/* Contenu de la page avec transition */}
        <div key={location.key} className="page-fade">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
