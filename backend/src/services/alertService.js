import db from '../db/connection.js';

export function checkNearExpiryAlerts() {
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    // Find batches expiring within 30 days that have positive quantity
    const expiringBatches = db.prepare(`
      SELECT b.id, b.medicine_id, b.batch_no, b.expiry_date, b.qty, m.name 
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.qty > 0 AND b.expiry_date <= ?
    `).all(thirtyDaysFromNow);

    const insertAlert = db.prepare(
      'INSERT INTO alerts (medicine_id, type, message) VALUES (?, ?, ?)'
    );

    // Check if an alert for this batch/medicine was already created recently to avoid spam
    const existingAlert = db.prepare(`
      SELECT id FROM alerts 
      WHERE medicine_id = ? AND type = 'near_expiry' AND sent_at >= DATE('now', '-7 days')
    `);

    for (const batch of expiringBatches) {
      const hasRecent = existingAlert.get(batch.medicine_id);
      if (!hasRecent) {
        insertAlert.run(
          batch.medicine_id,
          'near_expiry',
          `Near Expiry: ${batch.name} (Batch ${batch.batch_no}) expires on ${batch.expiry_date} with ${batch.qty} units left.`
        );
      }
    }
    
    if (expiringBatches.length > 0) {
      console.log(`[AlertService] Scanned and found ${expiringBatches.length} batches nearing expiry.`);
    }
  } catch (err) {
    console.error('[AlertService] Error checking near-expiry alerts:', err);
  }
}

// Function to start the periodic check
export function startAlertService() {
  // Run once on startup
  checkNearExpiryAlerts();
  
  // Then run every 24 hours (86400000 ms)
  setInterval(checkNearExpiryAlerts, 24 * 60 * 60 * 1000);
  console.log('[AlertService] Nearing-expiry alert service started.');
}
