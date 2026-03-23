export const ROLES = {
  ADMIN: "admin",
  AUDITEUR: "auditeur",
  LECTEUR: "lecteur",
};

export const canEdit = (role) => role === ROLES.ADMIN;

export const canAudit = (role) => [ROLES.ADMIN, ROLES.AUDITEUR].includes(role);

export const getRoleLabel = (role) => {
  switch (role) {
    case ROLES.ADMIN: return "Administrateur";
    case ROLES.AUDITEUR: return "Auditeur";
    case ROLES.LECTEUR: return "Lecteur";
    default: return "Utilisateur";
  }
};

export const getRoleBadgeClass = (role) => {
  switch (role) {
    case ROLES.ADMIN: return "role-admin";
    case ROLES.AUDITEUR: return "role-auditeur";
    case ROLES.LECTEUR: return "role-lecteur";
    default: return "";
  }
};
