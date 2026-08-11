import type { AppView } from '../app/app.types';
import { AppIcon, type AppIconName } from './AppIcon';
import { FloralAccent } from './FloralAccent';

interface NavigationProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
}

export interface NavigationItem {
  id: AppView;
  label: string;
  short: string;
  icon: AppIconName;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'today', label: 'Dzisiaj', short: 'Dziś', icon: 'today' },
  { id: 'calendar', label: 'Kalendarz', short: 'Kal.', icon: 'calendar' },
  { id: 'work', label: 'Praca', short: 'Praca', icon: 'work' },
  { id: 'shopping', label: 'Zakupy', short: 'Zak.', icon: 'shopping' },
  { id: 'cycle', label: 'Cykl', short: 'Cykl', icon: 'cycle' },
  { id: 'study', label: 'Studia', short: 'Studia', icon: 'study' },
  { id: 'locations', label: 'Miejsca', short: 'Miej.', icon: 'locations' },
  { id: 'settings', label: 'Ustawienia', short: 'Ustaw.', icon: 'settings' },
];

export function Navigation({ activeView, onChange }: NavigationProps) {
  return (
    <>
      <aside className="sidebar" aria-label="Główna nawigacja">
        <div className="brand-block">
          <FloralAccent variant="sprig" className="brand-floral-accent" />
          <div className="brand-mark" aria-hidden="true">IK</div>
          <div className="brand-copy">
            <strong>Inteligentny</strong>
            <span>Kalendarz</span>
          </div>
        </div>
        <nav className="side-nav">
          {NAVIGATION_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={activeView === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => onChange(item.id)}
              aria-current={activeView === item.id ? 'page' : undefined}
            >
              <AppIcon name={item.icon} className="nav-icon" size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="privacy-dot" aria-hidden="true" />
          Dane pozostają lokalnie na tym urządzeniu.
        </div>
      </aside>

      <nav className="bottom-nav" aria-label="Główna nawigacja mobilna">
        {NAVIGATION_ITEMS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={activeView === item.id ? 'bottom-nav-item active' : 'bottom-nav-item'}
            onClick={() => onChange(item.id)}
            aria-current={activeView === item.id ? 'page' : undefined}
          >
            <AppIcon name={item.icon} className="bottom-nav-icon" size={19} />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
