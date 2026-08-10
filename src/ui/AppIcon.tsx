export type AppIconName =
  | 'today'
  | 'calendar'
  | 'study'
  | 'work'
  | 'shopping'
  | 'cycle'
  | 'locations'
  | 'settings'
  | 'search';

interface AppIconProps {
  name: AppIconName;
  className?: string;
  size?: number;
}

export const APP_ICON_NAMES: AppIconName[] = [
  'today',
  'calendar',
  'study',
  'work',
  'shopping',
  'cycle',
  'locations',
  'settings',
  'search',
];

function IconGlyph({ name }: { name: AppIconName }) {
  switch (name) {
    case 'today':
      return (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9h17" />
          <circle cx="12" cy="14.5" r="2.1" />
        </>
      );
    case 'calendar':
      return (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9h17M8 12.5h.01M12 12.5h.01M16 12.5h.01M8 16.5h.01M12 16.5h.01M16 16.5h.01" />
        </>
      );
    case 'study':
      return (
        <>
          <path d="m3 9 9-4.5L21 9l-9 4.5L3 9Z" />
          <path d="M6.5 11v4.1c0 1.7 2.5 3.1 5.5 3.1s5.5-1.4 5.5-3.1V11M21 9v5" />
        </>
      );
    case 'work':
      return (
        <>
          <rect x="3" y="7" width="18" height="12.5" rx="2.5" />
          <path d="M8.5 7V5.5c0-.8.7-1.5 1.5-1.5h4c.8 0 1.5.7 1.5 1.5V7M3 12.5c2.8 1.4 5.8 2.1 9 2.1s6.2-.7 9-2.1M10.5 14.4v1.2h3v-1.2" />
        </>
      );
    case 'shopping':
      return (
        <>
          <path d="M5.5 8.5h13l1 11H4.5l1-11Z" />
          <path d="M9 9V7a3 3 0 0 1 6 0v2" />
        </>
      );
    case 'cycle':
      return (
        <>
          <path d="M18.6 8.2A7.5 7.5 0 0 0 6 6.2L4.3 8" />
          <path d="M4.3 4.6V8H7.7M5.4 15.8A7.5 7.5 0 0 0 18 17.8l1.7-1.8" />
          <path d="M19.7 19.4V16h-3.4" />
        </>
      );
    case 'locations':
      return (
        <>
          <path d="M19 10c0 5.2-7 10.5-7 10.5S5 15.2 5 10a7 7 0 1 1 14 0Z" />
          <circle cx="12" cy="10" r="2.4" />
        </>
      );
    case 'settings':
      return (
        <>
          <path d="M4 6h8M16 6h4M4 12h3M11 12h9M4 18h10M18 18h2" />
          <circle cx="14" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="16" cy="18" r="2" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="10.8" cy="10.8" r="6.2" />
          <path d="m15.4 15.4 4.2 4.2" />
        </>
      );
  }
}

export function AppIcon({ name, className, size = 20 }: AppIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <IconGlyph name={name} />
    </svg>
  );
}
