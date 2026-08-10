import type { DecorativeBackgroundMode } from '../settings/appearance';

interface AppBackgroundDecorProps {
  mode: DecorativeBackgroundMode;
}

export function AppBackgroundDecor({ mode }: AppBackgroundDecorProps) {
  if (mode === 'off') return null;

  return (
    <div
      className={`app-background-decor ${mode === 'animated' ? 'is-animated' : 'is-static'}`}
      aria-hidden="true"
    >
      <svg className="floral-motif floral-motif-top floral-animate-a" viewBox="0 0 420 420" focusable="false">
        <g className="floral-linework">
          <path d="M350 34c-18 40-41 75-72 105-31 30-69 55-111 71" />
          <path d="M284 128c-20-6-38-2-52 12 20 8 39 4 52-12Z" />
          <path d="M246 163c-8-21-22-34-42-38 6 22 20 35 42 38Z" />
          <path d="M203 192c-23-3-42 4-56 21 24 4 43-3 56-21Z" />
          <path d="M327 73c-19-13-38-16-58-7 18 14 38 17 58 7Z" />
          <path d="M358 40c-2 22 6 40 24 53 4-22-4-40-24-53Z" />
          <path d="M164 211c-24 19-44 43-58 72" />
          <path d="M108 282c-10-19-25-31-45-34 8 20 23 31 45 34Z" />
          <path d="M124 257c-22 2-39 12-50 30 22-1 39-11 50-30Z" />
        </g>
        <g className="floral-blossom" transform="translate(309 83)">
          <ellipse cx="0" cy="-24" rx="16" ry="28" transform="rotate(-8)" />
          <ellipse cx="23" cy="-8" rx="16" ry="28" transform="rotate(54)" />
          <ellipse cx="15" cy="20" rx="16" ry="28" transform="rotate(126)" />
          <ellipse cx="-15" cy="20" rx="16" ry="28" transform="rotate(-126)" />
          <ellipse cx="-23" cy="-8" rx="16" ry="28" transform="rotate(-54)" />
          <circle cx="0" cy="0" r="8" />
        </g>
      </svg>

      <svg className="floral-motif floral-motif-upper-left" viewBox="0 0 250 310" focusable="false">
        <g className="floral-linework floral-linework-fine">
          <path d="M30 286c46-39 78-83 96-132 13-36 19-75 16-117" />
          <path d="M74 245c-21-1-38 7-50 23 21 3 38-5 50-23Z" />
          <path d="M94 211c8-19 22-30 41-32-6 20-20 31-41 32Z" />
          <path d="M112 166c-21 2-37-5-49-20 21-4 38 3 49 20Z" />
          <path d="M130 120c8-18 21-28 39-30-6 19-19 29-39 30Z" />
          <path d="M142 76c-18-8-33-8-47 1 17 10 33 10 47-1Z" />
        </g>
        <g className="floral-bud" transform="translate(144 49)">
          <path d="M0 18C-14 6-13-9 0-21 13-9 14 6 0 18Z" />
          <path d="M-2 19c8 10 12 21 12 34" />
        </g>
      </svg>

      <svg className="floral-motif floral-motif-mid-left floral-animate-b" viewBox="0 0 270 340" focusable="false">
        <g className="floral-linework floral-linework-fine">
          <path d="M38 316c39-30 72-65 98-105 26-40 44-85 55-136" />
          <path d="M91 265c-17-6-33-4-47 7 16 8 32 6 47-7Z" />
          <path d="M116 225c-5-18-16-30-33-36 4 19 15 31 33 36Z" />
          <path d="M144 181c18-3 32-12 41-28-18 1-32 11-41 28Z" />
          <path d="M169 131c-13-12-28-17-45-13 12 14 27 18 45 13Z" />
          <path d="M188 84c17 1 31-6 42-19-18-2-32 5-42 19Z" />
        </g>
        <g className="floral-blossom floral-blossom-tiny" transform="translate(76 278)">
          <ellipse cx="0" cy="-12" rx="7" ry="13" />
          <ellipse cx="11" cy="-2" rx="7" ry="13" transform="rotate(72)" />
          <ellipse cx="7" cy="10" rx="7" ry="13" transform="rotate(144)" />
          <ellipse cx="-8" cy="10" rx="7" ry="13" transform="rotate(-144)" />
          <ellipse cx="-11" cy="-2" rx="7" ry="13" transform="rotate(-72)" />
          <circle cx="0" cy="0" r="3.5" />
        </g>
      </svg>

      <svg className="floral-motif floral-motif-mid-right" viewBox="0 0 250 300" focusable="false">
        <g className="floral-linework floral-linework-fine">
          <path d="M225 282c-38-33-65-70-82-111-16-38-24-80-24-126" />
          <path d="M184 241c18-1 33 6 45 20-19 3-34-4-45-20Z" />
          <path d="M163 204c-7-17-19-27-36-31 6 18 18 28 36 31Z" />
          <path d="M143 160c18 2 33-5 44-19-18-4-33 3-44 19Z" />
          <path d="M127 115c-8-17-20-27-37-30 6 18 19 28 37 30Z" />
        </g>
        <g className="floral-bud" transform="translate(118 57) rotate(-11)">
          <path d="M0 20C-16 8-15-10 0-24 15-10 16 8 0 20Z" />
          <path d="M0 20c-2 13-1 25 3 36" />
        </g>
      </svg>

      <svg className="floral-motif floral-motif-center-right" viewBox="0 0 190 240" focusable="false">
        <g className="floral-linework floral-linework-fine">
          <path d="M177 22c-28 20-50 43-67 69-18 28-30 61-35 99" />
          <path d="M139 58c-14-4-27-1-37 9 14 5 27 2 37-9Z" />
          <path d="M113 93c-5-14-14-23-28-26 4 15 13 24 28 26Z" />
          <path d="M91 135c-15-1-27 4-36 15 15 2 27-3 36-15Z" />
        </g>
        <circle className="floral-seed" cx="73" cy="193" r="5" />
        <circle className="floral-seed" cx="87" cy="199" r="3" />
        <circle className="floral-seed" cx="61" cy="204" r="2.5" />
      </svg>

      <svg className="floral-motif floral-motif-bottom floral-animate-c" viewBox="0 0 460 420" focusable="false">
        <g className="floral-linework">
          <path d="M42 356c54-31 101-71 140-120 31-39 54-84 69-134" />
          <path d="M103 316c22 2 40-6 52-24-23-3-41 5-52 24Z" />
          <path d="M139 283c9 21 24 33 45 36-7-22-22-34-45-36Z" />
          <path d="M176 239c24 2 43-7 56-25-24-2-43 6-56 25Z" />
          <path d="M213 177c-8-22-23-35-45-38 7 23 22 36 45 38Z" />
          <path d="M238 122c21 7 40 4 56-10-20-9-39-5-56 10Z" />
          <path d="M67 343c-3-22-14-38-33-49 1 22 12 39 33 49Z" />
        </g>
        <g className="floral-blossom floral-blossom-small" transform="translate(180 224)">
          <ellipse cx="0" cy="-19" rx="12" ry="22" />
          <ellipse cx="18" cy="-4" rx="12" ry="22" transform="rotate(70)" />
          <ellipse cx="10" cy="16" rx="12" ry="22" transform="rotate(140)" />
          <ellipse cx="-12" cy="15" rx="12" ry="22" transform="rotate(-140)" />
          <ellipse cx="-18" cy="-5" rx="12" ry="22" transform="rotate(-70)" />
          <circle cx="0" cy="0" r="6" />
        </g>
      </svg>

      <svg className="floral-motif floral-motif-bottom-right" viewBox="0 0 310 290" focusable="false">
        <g className="floral-linework floral-linework-fine">
          <path d="M292 270c-44-18-81-43-111-76-28-31-49-69-63-115" />
          <path d="M248 244c-18 5-34 1-47-11 18-7 34-3 47 11Z" />
          <path d="M211 212c-2-19-11-33-27-43 1 20 10 34 27 43Z" />
          <path d="M177 170c18 1 33-6 44-20-18-3-33 4-44 20Z" />
          <path d="M143 126c-6-18-18-30-35-35 4 19 16 31 35 35Z" />
        </g>
        <g className="floral-blossom floral-blossom-medium" transform="translate(107 72)">
          <ellipse cx="0" cy="-17" rx="10" ry="19" />
          <ellipse cx="15" cy="-5" rx="10" ry="19" transform="rotate(62)" />
          <ellipse cx="10" cy="14" rx="10" ry="19" transform="rotate(128)" />
          <ellipse cx="-10" cy="14" rx="10" ry="19" transform="rotate(-128)" />
          <ellipse cx="-15" cy="-5" rx="10" ry="19" transform="rotate(-62)" />
          <circle cx="0" cy="0" r="5" />
        </g>
      </svg>
    </div>
  );
}
