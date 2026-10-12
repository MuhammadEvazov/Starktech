import { Link } from '../lib/router.jsx';
import { nameOf } from '../lib/format.js';

// Лист стикеров: категории магазина вырублены как настоящие стикеры —
// белая кромка, пунктир надсечки и подложка. Один стикер «отклеивается».

const SHAPES = {
  heart: 'M100 172 C40 132 18 100 26 70 C34 40 76 32 100 64 C124 32 166 40 174 70 C182 100 160 132 100 172Z',
  circle: 'M100 22 A78 78 0 1 1 99.9 22Z',
  phone: 'M62 18 H138 Q160 18 160 40 V160 Q160 182 138 182 H62 Q40 182 40 160 V40 Q40 18 62 18Z',
  ticket: 'M34 46 Q34 34 46 34 H154 Q166 34 166 46 V82 Q152 90 152 100 Q152 110 166 118 V154 Q166 166 154 166 H46 Q34 166 34 154 V118 Q48 110 48 100 Q48 90 34 82Z',
  flower: flowerPath(),
};

function flowerPath() {
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 === 0 ? 80 : 64;
    pts.push(`${(100 + r * Math.cos(a)).toFixed(1)} ${(100 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}

const BY_SLUG = {
  '3d-stickers': { shape: 'heart', tone: 'cobalt' },
  keychains: { shape: 'circle', tone: 'lemon' },
  'clear-cases': { shape: 'phone', tone: 'clear' },
  'custom-cases': { shape: 'phone', tone: 'cherry' },
  'gift-sets': { shape: 'flower', tone: 'lilac' },
};
const FALLBACK = [
  { shape: 'heart', tone: 'cobalt' },
  { shape: 'circle', tone: 'lemon' },
  { shape: 'phone', tone: 'cherry' },
  { shape: 'flower', tone: 'lilac' },
  { shape: 'ticket', tone: 'clear' },
];

// Категории из DataSeed — показываются, пока бэкенд не ответил.
export const SEED_CATEGORIES = [
  { id: null, slug: '3d-stickers', nameRu: '3D стикеры с фото' },
  { id: null, slug: 'keychains', nameRu: 'Брелки с фото' },
  { id: null, slug: 'clear-cases', nameRu: 'Прозрачные чехлы' },
  { id: null, slug: 'custom-cases', nameRu: 'Чехлы с дизайном' },
  { id: null, slug: 'gift-sets', nameRu: 'Подарочные наборы' },
];

function Sticker({ category, look, index, peel }) {
  const d = SHAPES[look.shape];
  const to = category.id ? `/catalog?category=${category.id}` : '/catalog';
  return (
    <Link
      to={to}
      className={`sticker sticker--${look.tone} sticker--${look.shape} ${peel ? 'sticker--peel' : ''}`}
      style={{ '--i': index }}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true" className="sticker__svg">
        <path d={d} className="sticker__cut" />
        <path d={d} className="sticker__body" />
        {look.shape === 'phone' && <rect x="56" y="34" width="34" height="34" rx="10" className="sticker__cam" />}
      </svg>
      <span className="sticker__label">{nameOf(category)}</span>
    </Link>
  );
}

export default function StickerSheet({ categories }) {
  const list = (categories?.length ? categories : SEED_CATEGORIES).slice(0, 5);
  return (
    <div className="sheet" aria-label="Категории">
      <div className="sheet__grid">
        {list.map((c, i) => (
          <Sticker
            key={c.id || c.slug}
            category={c}
            look={BY_SLUG[c.slug] || FALLBACK[i % FALLBACK.length]}
            index={i}
            peel={i === 1}
          />
        ))}
      </div>
      <p className="sheet__caption">Нажмите на стикер, чтобы открыть категорию</p>
    </div>
  );
}
