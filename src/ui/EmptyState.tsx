import { AppIcon, type AppIconName } from './AppIcon';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: AppIconName;
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state-icon" aria-hidden="true"><AppIcon name={icon} size={28} /></div> : <div className="empty-orbit" aria-hidden="true"><span /></div>}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="button button-primary" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}
