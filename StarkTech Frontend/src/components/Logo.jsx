// Знак Stark Tech: серебряный куб-каркас, сквозь грани которого виден неоновый «дуговой реактор».
// variant="badge" — круглый значок с кольцом (левая половина кирпично-красная, правая чёрная),
// variant="mark" — только куб (иконки, аватар чата, фавикон).
// Словесный знак «STARK TECH» рядом набирается текстом (шрифт --font-display), не внутри SVG.
import { useId } from 'react';

const COLORS = {
  red: '#8F3A36',
  ink: '#010101',
  cyan: '#11F2F4',
  spoke: '#06292B',
};

// Грани куба: единичный квадрат → ромб изометрии (matrix a b c d e f), центр куба в (0,0), «радиус» 20
const FACES = [
  { key: 'top', m: '17.32 -10 17.32 10 -17.32 -10' },
  { key: 'left', m: '17.32 10 0 20 -17.32 -10' },
  { key: 'right', m: '17.32 -10 0 20 0 0' },
];
// Квадрат с круглым вырезом (evenodd) — рамка грани
const FRAME = 'M0 0H1V1H0Z M0.5 0.1A0.4 0.4 0 1 0 0.5001 0.1Z';
const SPOKES = [0, 45, 90, 135, 180, 225, 270, 315];

function Cube({ id, transform }) {
  return (
    <g transform={transform}>
      {/* полость куба */}
      <path d="M0 -20L17.32 -10V10L0 20L-17.32 10V-10Z" fill={COLORS.ink} />
      {/* реактор */}
      <circle r="14.5" fill={`url(#${id}-arc)`} />
      <g stroke={COLORS.spoke} strokeWidth="1.7" strokeLinecap="round">
        {SPOKES.map((a) => (
          <line key={a} x1="0" y1="-6" x2="0" y2="-14" transform={`rotate(${a + 22.5})`} />
        ))}
      </g>
      <circle r="5.2" fill={COLORS.cyan} stroke={COLORS.spoke} strokeWidth="1.6" />
      <circle r="14.5" fill="none" stroke={COLORS.spoke} strokeWidth="1.4" />
      {/* серебряные грани поверх */}
      {FACES.map((f) => (
        <path
          key={f.key}
          d={FRAME}
          fillRule="evenodd"
          transform={`matrix(${f.m})`}
          fill={`url(#${id}-${f.key})`}
        />
      ))}
      {/* рёбра — тонкий блик */}
      <path
        d="M0 0L0 20M0 0L17.32 -10M0 0L-17.32 -10"
        stroke="#FFFFFF"
        strokeOpacity="0.85"
        strokeWidth="0.9"
        fill="none"
      />
    </g>
  );
}

function Defs({ id }) {
  return (
    <defs>
      <radialGradient id={`${id}-arc`}>
        <stop offset="0" stopColor="#E9FFFF" />
        <stop offset="0.45" stopColor={COLORS.cyan} />
        <stop offset="1" stopColor="#0BB8BA" />
      </radialGradient>
      <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#D6D7DB" />
      </linearGradient>
      <linearGradient id={`${id}-left`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#D9DBE0" />
        <stop offset="1" stopColor="#A9AEB7" />
      </linearGradient>
      <linearGradient id={`${id}-right`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#B7BBC3" />
        <stop offset="1" stopColor="#7E838D" />
      </linearGradient>
    </defs>
  );
}

/**
 * @param {{ size?: number|string, variant?: 'badge'|'mark', title?: string, className?: string }} props
 * Без title знак декоративный (aria-hidden) — подпись даёт окружающая ссылка/текст.
 */
export default function Logo({ size = 40, variant = 'badge', title, className = '' }) {
  const id = 'st' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true, focusable: 'false' };
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`brand-logo brand-logo--${variant} ${className}`.trim()}
      {...a11y}
    >
      <Defs id={id} />
      {variant === 'badge' ? (
        <>
          <circle cx="32" cy="32" r="29" fill="#FFFFFF" />
          <path d="M32 2.5A29.5 29.5 0 0 0 32 61.5" fill="none" stroke={COLORS.red} strokeWidth="5" />
          <path d="M32 2.5A29.5 29.5 0 0 1 32 61.5" fill="none" stroke={COLORS.ink} strokeWidth="5" />
          <Cube id={id} transform="translate(32 32) rotate(-12) scale(1.15)" />
        </>
      ) : (
        <Cube id={id} transform="translate(32 32) rotate(-12) scale(1.42)" />
      )}
    </svg>
  );
}
