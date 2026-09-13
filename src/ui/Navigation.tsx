import type { AppView } from '../app/app.types';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppBrandMark } from './AppBrandMark';

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
  { id: 'today', label: 'Dzisiaj', short: 'Dzisiaj', icon: 'today' },
  { id: 'calendar', label: 'Kalendarz', short: 'Kalendarz', icon: 'calendar' },
  { id: 'finance', label: 'Finanse', short: 'Finanse', icon: 'finance' },
  { id: 'study', label: 'Studia', short: 'Studia', icon: 'study' },
  { id: 'work', label: 'Praca', short: 'Praca', icon: 'work' },
  { id: 'settings', label: 'Ustawienia', short: 'Ustawienia', icon: 'settings' },
];

export function Navigation({ activeView, onChange }: NavigationProps) {
  return (
    <>
      <aside className="sidebar" aria-label="Główna nawigacja">
        <div className="brand-block">
          <AppBrandMark className="brand-mark" size={44} />
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
              <span className="nav-icon-shell" aria-hidden="true"><AppIcon name={item.icon} className="nav-icon" size={19} /></span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
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
            <span className="bottom-nav-icon-shell" aria-hidden="true"><AppIcon name={item.icon} className="bottom-nav-icon" size={19} /></span>
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
