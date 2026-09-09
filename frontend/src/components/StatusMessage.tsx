interface StatusMessageProps {
  tone: 'danger' | 'success';
  children: string;
}

/** Aviso corto de formulario, con rol de alerta para lectores de pantalla. */
export function StatusMessage({ tone, children }: StatusMessageProps) {
  const styles =
    tone === 'danger'
      ? 'border-danger/30 bg-danger-soft text-danger-soft-foreground'
      : 'border-success/30 bg-success-soft text-success-soft-foreground';

  return (
    <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}
