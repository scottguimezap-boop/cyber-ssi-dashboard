import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./db/firebase";
import { useNavigate } from "react-router-dom";
import { useNotification } from "./NotificationContext";
import "./ContactsGlobal.css";

const ContactsGlobal = () => {
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  useEffect(() => {
    // On récupère TOUS les contacts
    const q = query(collection(db, "contacts"), orderBy("nom", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setContacts(data);
    });
    return () => unsubscribe();
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addNotification("info", "Copié dans le presse-papier !");
  };

  // Filtrage intelligent (Nom, Role ou Entreprise)
  const filteredContacts = contacts.filter(c => 
    c.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nomFournisseur?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="contacts-dashboard">
      <div className="contacts-bg"></div>
      
      <header className="contacts-header">
        <div className="header-title-contacts">
          <h1>ANNUAIRE CYBER</h1>
          <p>Répertoire des interlocuteurs clés (DSI, DPO, Support)</p>
        </div>

        <div className="search-contact-box">
            <span className="icon">🔍</span>
            <input 
              type="text" 
              placeholder="Chercher un nom, un rôle, une entreprise..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </header>

      <div className="contacts-content">
        <div className="contacts-grid-global">
            {filteredContacts.map(contact => (
              <div key={contact.id} className="contact-card-global">
                <div className="card-top-bar">
                    <span className="company-tag">{contact.nomFournisseur || "Fournisseur Inconnu"}</span>
                    <button onClick={() => navigate(`/fournisseur/${contact.fournisseurId}`)} className="link-btn">↗</button>
                </div>
                
                <div className="avatar-section">
                    <div className="avatar-circle">{contact.nom.charAt(0)}</div>
                    <h3>{contact.nom}</h3>
                    <span className="role-pill">{contact.role}</span>
                </div>

                <div className="contact-details">
                    <div className="detail-row" onClick={() => copyToClipboard(contact.email)}>
                        <span className="icon">📧</span>
                        <span className="val">{contact.email || "Non renseigné"}</span>
                    </div>
                    <div className="detail-row" onClick={() => copyToClipboard(contact.tel)}>
                        <span className="icon">📞</span>
                        <span className="val">{contact.tel || "Non renseigné"}</span>
                    </div>
                </div>
              </div>
            ))}

            {filteredContacts.length === 0 && (
                <div className="empty-search">
                    <p>Aucun contact ne correspond à votre recherche.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ContactsGlobal;