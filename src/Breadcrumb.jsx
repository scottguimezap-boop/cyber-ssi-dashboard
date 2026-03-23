import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./db/firebase";
import "./Breadcrumb.css";

const ROUTE_LABELS = {
  gestion:     null, // Dashboard, pas affiché tout seul
  fournisseur: null, // nom récupéré depuis Firestore
  modifier:    "Modifier",
  intelligence:"Intelligence",
  crise:       "Salle de Crise",
  audits:      "Planning Audits",
  annuaire:    "Annuaire",
  profil:      "Mon Profil",
};

const Breadcrumb = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [supplierName, setSupplierName] = useState(null);

  const pathname = location.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const firstSeg = segments[0] || "";

  // Extraire l'ID fournisseur depuis l'URL
  const idMatch = pathname.match(/\/(fournisseur|modifier|intelligence)\/([^/]+)/);
  const supplierId = idMatch ? idMatch[2] : null;

  useEffect(() => {
    if (supplierId) {
      getDoc(doc(db, "fournisseurs", supplierId)).then((snap) => {
        if (snap.exists()) setSupplierName(snap.data().nomFournisseur);
      }).catch(() => setSupplierName("..."));
    } else {
      setSupplierName(null);
    }
  }, [supplierId]);

  // Ne pas afficher le breadcrumb sur la page Dashboard elle-même
  if (pathname === "/gestion") return null;

  const crumbs = [];

  // Premier segment toujours = Dashboard (cliquable)
  crumbs.push({ label: "Dashboard", path: "/gestion", clickable: true });

  if (supplierId) {
    // Pages liées à un fournisseur
    const supplierPath = `/fournisseur/${supplierId}`;
    const isOnSupplier = firstSeg === "fournisseur";

    crumbs.push({
      label: supplierName || "...",
      path: supplierPath,
      clickable: !isOnSupplier,
    });

    if (firstSeg === "modifier") {
      crumbs.push({ label: "Modifier", clickable: false });
    } else if (firstSeg === "intelligence") {
      crumbs.push({ label: "Intelligence", clickable: false });
    }
  } else {
    // Pages modules
    const label = ROUTE_LABELS[firstSeg] || firstSeg;
    if (label) crumbs.push({ label, clickable: false });
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav className="breadcrumb" aria-label="Fil d'Ariane">
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
          {crumb.clickable ? (
            <button className="breadcrumb-link" onClick={() => navigate(crumb.path)}>
              {crumb.label}
            </button>
          ) : (
            <span className="breadcrumb-current">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
