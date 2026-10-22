import db from '../db/connection.js';

export function auditLog(userId, action, entityType, entityId = null, details = null) {
  db.prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)').run(userId ?? null, action, entityType, entityId == null ? null : String(entityId), details == null ? null : JSON.stringify(details));
}
