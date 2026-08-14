/**
 * Batch freshness indicator — the signature visual element from §6.
 * Green = fresh (>90 days), Amber = expiring within 30-90 days, Red = <30 days or expired
 */
export default function FreshnessDot({ expiryDate }) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  let color, label;
  if (daysLeft <= 0) {
    color = 'var(--fresh-red)';
    label = 'Expired';
  } else if (daysLeft <= 30) {
    color = 'var(--fresh-red)';
    label = `${daysLeft}d left`;
  } else if (daysLeft <= 90) {
    color = 'var(--fresh-amber)';
    label = `${daysLeft}d left`;
  } else {
    color = 'var(--fresh-green)';
    label = `${daysLeft}d left`;
  }

  return (
    <span className="freshness-dot" style={{ '--dot-color': color }} title={label}>
      {label}
    </span>
  );
}