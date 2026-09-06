interface AppBrandMarkProps {
  className?: string;
  size?: number;
  title?: string;
}

export function AppBrandMark({ className, size = 96, title }: AppBrandMarkProps) {
  const labelled = Boolean(title);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={labelled ? 'img' : undefined}
      aria-label={title}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      data-brand-mark="calendar-today"
    >
      <rect x="112" y="126" width="288" height="278" rx="64" stroke="#1f2725" strokeWidth="30" />
      <path d="M112 218H400" stroke="#1f2725" strokeWidth="30" strokeLinecap="round" />
      <path d="M190 102V158M322 102V158" stroke="#1f2725" strokeWidth="30" strokeLinecap="round" />
      <circle cx="192" cy="286" r="15" fill="#1f2725" />
      <circle cx="256" cy="286" r="15" fill="#1f2725" />
      <circle cx="320" cy="286" r="15" fill="#1f2725" />
      <circle cx="192" cy="346" r="15" fill="#1f2725" />
      <circle cx="256" cy="346" r="15" fill="#1f2725" />
      <circle cx="320" cy="346" r="17" fill="#cf789b" />
    </svg>
  );
}
