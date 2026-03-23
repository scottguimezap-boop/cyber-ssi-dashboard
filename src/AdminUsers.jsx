import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "./db/firebase";
import { ROLES, getRoleLabel, getRoleBadgeClass } from "./utils/userRole";
import { logAction, ACTIONS } from "./utils/auditTrail";
import "./AdminUsers.css";

const AdminUsers = ({ connectedUser }) => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const changeRole = async (uid, email, newRole) => {
    if (!window.confirm(`Changer le rôle de ${email} en "${getRoleLabel(newRole)}" ?`)) return;
    await updateDoc(doc(db, "users", uid), { role: newRole });
    logAction(connectedUser?.email || "admin", ACTIONS.MODIFIER_ROLE, email, { newRole });
  };

  const filtered = users.filter(
    (u) => u.email?.toLowerCase().includes(search.toLowerCase()) || u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-layout">
      <div className="admin-header">
        <h1>Gestion des Utilisateurs</h1>
        <p>{users.length} utilisateur(s) enregistré(s)</p>
      </div>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Rechercher un utilisateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search"
        />
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Email</th>
              <th>Rôle actuel</th>
              <th>Changer le rôle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.uid}>
                <td>
                  <div className="admin-user-cell">
                    <div className="admin-avatar">{(u.email || "?")[0].toUpperCase()}</div>
                    <span>{u.displayName || u.email?.split("@")[0]}</span>
                  </div>
                </td>
                <td className="admin-email">{u.email}</td>
                <td>
                  <span className={`role-badge ${getRoleBadgeClass(u.role)}`}>
                    {getRoleLabel(u.role)}
                  </span>
                </td>
                <td>
                  <div className="role-actions">
                    {Object.values(ROLES).map((r) => (
                      <button
                        key={r}
                        className={`role-btn ${u.role === r ? "active" : ""}`}
                        onClick={() => changeRole(u.uid, u.email, r)}
                        disabled={u.role === r}
                      >
                        {getRoleLabel(r)}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Aucun utilisateur trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
