import { AppIcon } from './AppIcon';

interface HeaderSearchProps {
  onSearch?: () => void;
}

export function HeaderSearch({ onSearch }: HeaderSearchProps) {
  if (!onSearch) return null;
  return (
    <button type="button" className="header-search-trigger" onClick={onSearch} aria-label="Szukaj w aplikacji">
      <AppIcon name="search" size={18} />
      <span>Szukaj</span>
    </button>
  );
}
