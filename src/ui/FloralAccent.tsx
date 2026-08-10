export type FloralAccentVariant = 'sprig' | 'blossom' | 'flourish';

interface FloralAccentProps {
  variant: FloralAccentVariant;
  className?: string;
}

export function FloralAccent({ variant, className = '' }: FloralAccentProps) {
  const classes = `floral-ui-accent floral-ui-accent-${variant}${className ? ` ${className}` : ''}`;

  if (variant === 'sprig') {
    return (
      <svg className={classes} viewBox="0 0 120 90" aria-hidden="true" focusable="false">
        <g className="floral-ui-linework">
          <path d="M12 78c22-15 40-34 53-56" />
          <path d="M38 57c-12-1-21 3-28 12 12 2 21-2 28-12Z" />
          <path d="M52 41c5-11 13-17 24-18-4 12-12 18-24 18Z" />
          <path d="M64 24c-9-6-18-7-27-3 8 7 17 8 27 3Z" />
        </g>
        <g className="floral-ui-blossom" transform="translate(78 21)">
          <ellipse cx="0" cy="-10" rx="6" ry="11" />
          <ellipse cx="9" cy="-2" rx="6" ry="11" transform="rotate(68)" />
          <ellipse cx="5" cy="8" rx="6" ry="11" transform="rotate(142)" />
          <ellipse cx="-6" cy="8" rx="6" ry="11" transform="rotate(-142)" />
          <ellipse cx="-9" cy="-2" rx="6" ry="11" transform="rotate(-68)" />
          <circle cx="0" cy="0" r="2.8" />
        </g>
      </svg>
    );
  }

  if (variant === 'blossom') {
    return (
      <svg className={classes} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <g className="floral-ui-linework">
          <path d="M60 69c-6 15-7 29-3 43" />
          <path d="M58 89c-11-4-20-2-27 6 11 5 20 3 27-6Z" />
          <path d="M58 78c10-5 19-4 27 3-9 6-18 5-27-3Z" />
        </g>
        <g className="floral-ui-blossom" transform="translate(60 48)">
          <ellipse cx="0" cy="-22" rx="13" ry="24" />
          <ellipse cx="20" cy="-6" rx="13" ry="24" transform="rotate(70)" />
          <ellipse cx="12" cy="18" rx="13" ry="24" transform="rotate(140)" />
          <ellipse cx="-13" cy="18" rx="13" ry="24" transform="rotate(-140)" />
          <ellipse cx="-20" cy="-6" rx="13" ry="24" transform="rotate(-70)" />
          <circle cx="0" cy="0" r="6" />
        </g>
      </svg>
    );
  }

  return (
    <svg className={classes} viewBox="0 0 180 110" aria-hidden="true" focusable="false">
      <g className="floral-ui-linework">
        <path d="M12 91c41-10 76-29 104-56 14-13 27-22 46-27" />
        <path d="M50 74c-12-7-25-8-38-2 11 9 24 10 38 2Z" />
        <path d="M78 58c-3-14-11-24-24-29 2 15 10 25 24 29Z" />
        <path d="M111 37c14 1 25-4 34-15-14-3-26 2-34 15Z" />
        <path d="M132 24c-7-10-16-15-28-14 6 11 16 16 28 14Z" />
      </g>
      <g className="floral-ui-blossom" transform="translate(151 16)">
        <ellipse cx="0" cy="-9" rx="5.5" ry="10" />
        <ellipse cx="8" cy="-2" rx="5.5" ry="10" transform="rotate(70)" />
        <ellipse cx="5" cy="7" rx="5.5" ry="10" transform="rotate(140)" />
        <ellipse cx="-5" cy="7" rx="5.5" ry="10" transform="rotate(-140)" />
        <ellipse cx="-8" cy="-2" rx="5.5" ry="10" transform="rotate(-70)" />
        <circle cx="0" cy="0" r="2.5" />
      </g>
    </svg>
  );
}
