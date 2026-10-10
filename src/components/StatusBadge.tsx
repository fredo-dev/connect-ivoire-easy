const map = {
  success: { l: "Réussi", c: "text-success" },
  pending: { l: "En attente", c: "text-warning" },
  error: { l: "Échoué", c: "text-destructive" },
} as const;

export function StatusBadge({ status }: { status: string }) {
  const s = map[status as keyof typeof map] ?? map.pending;
  return <span className={`text-xs font-medium ${s.c}`}>{s.l}</span>;
}
