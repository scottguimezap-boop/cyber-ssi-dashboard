import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./db/firebase";
import { getRoleLabel } from "./utils/userRole";
import "./Profil.css";

const Profil = ({ userRole }) => {
  const user = auth.currentUser;
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState("");

  const handleResetPassword = async () => {
    try {
      setResetError("");
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
    } catch (e) {
      setResetError("Erreur lors de l'envoi. Réessayez.");
    }
  };

  const emailShort = user?.email?.split("@")[0] || "admin";
  const emailDomain = user?.email?.split("@")[1] || "";

  return (
    <div className="profil-page">
      <div className="profil-page-header">
        <h1>Mon Profil</h1>
        <p>Informations et paramètres de votre compte</p>
      </div>

      <div className="profil-grid">
        {/* Carte identité */}
        <div className="profil-card">
          <div className="profil-card-header">
            <div className="profil-avatar-lg">
              {emailShort[0]?.toUpperCase()}
            </div>
            <div>
              <div className="profil-username">{emailShort}</div>
              <div className="profil-email-domain">@{emailDomain}</div>
            </div>
          </div>

          <div className="profil-fields">
            <div className="profil-field">
              <label>Adresse email</label>
              <div className="profil-field-value">{user?.email}</div>
            </div>
            <div className="profil-field">
              <label>Rôle</label>
              <div className="profil-field-value">
                <span className="profil-role-badge">{getRoleLabel(userRole).toUpperCase()}</span>
              </div>
            </div>
            <div className="profil-field">
              <label>Accès</label>
              <div className="profil-field-value profil-access-list">
                <span className="profil-access-tag">Dashboard</span>
                <span className="profil-access-tag">Salle de Crise</span>
                <span className="profil-access-tag">Planning</span>
                <span className="profil-access-tag">Annuaire</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sécurité */}
        <div className="profil-card">
          <h3 className="profil-card-title">Sécurité</h3>
          <p className="profil-card-desc">
            Gérez votre mot de passe. Un email de réinitialisation sera envoyé à <strong>{user?.email}</strong>.
          </p>

          {resetError && <div className="profil-error">{resetError}</div>}

          {resetSent ? (
            <div className="profil-success">
              ✓ Email envoyé ! Vérifiez votre boîte mail pour réinitialiser votre mot de passe.
            </div>
          ) : (
            <button className="profil-btn-reset" onClick={handleResetPassword}>
              Envoyer un lien de réinitialisation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profil;
