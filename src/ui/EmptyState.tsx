import { FloralAccent } from './FloralAccent';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <FloralAccent variant="blossom" className="empty-floral-accent" />
      <div className="empty-orbit" aria-hidden="true"><span /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="button button-primary" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}
