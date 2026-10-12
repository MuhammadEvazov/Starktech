// Формы стикера для фото: круг, квадрат, сердце. Список форм берётся из вариантов товара
// (атрибут shape), а здесь — как распознать форму по названию и как её нарисовать.

/** 'circle' | 'heart' | 'square' по значению атрибута («круглый», «сердце», «heart»…). */
export function shapeKind(value) {
  const v = String(value || '').toLowerCase();
  if (/круг|circle|round/.test(v)) return 'circle';
  if (/серд|heart/.test(v)) return 'heart';
  return 'square';
}

export const SHAPE_LABEL = { circle: 'Круг', square: 'Квадрат', heart: 'Сердце' };

/** Различные формы из вариантов товара (attributesJson.shape), в порядке появления. */
export function shapesFromVariants(variants, parse) {
  const seen = new Map();
  for (const v of variants ?? []) {
    const value = parse(v.attributesJson, {})?.shape;
    if (!value) continue;
    const kind = shapeKind(value);
    if (!seen.has(kind)) seen.set(kind, { kind, value, label: SHAPE_LABEL[kind] });
  }
  return [...seen.values()];
}

// Сердце из логотипа (viewBox 64×64) — масштабируется в любой квадрат.
const HEART = [
  ['M', 32, 56],
  ['C', 10, 42, 4, 30, 8, 20],
  ['C', 12, 10, 26, 8, 32, 20],
  ['C', 38, 8, 52, 10, 56, 20],
  ['C', 60, 30, 54, 42, 32, 56],
];

/** SVG-путь формы для области w×h (для оверлея в редакторе и превью). */
export function shapeSvgPath(kind, w, h) {
  if (kind === 'circle') {
    const r = Math.min(w, h) / 2;
    return `M ${w / 2 - r} ${h / 2} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  }
  if (kind === 'heart') {
    const sx = w / 64;
    const sy = h / 64;
    return (
      HEART.map(([cmd, ...pts]) => `${cmd} ${pts.map((p, i) => (i % 2 ? p * sy : p * sx).toFixed(1)).join(' ')}`).join(' ') + ' Z'
    );
  }
  const r = Math.min(w, h) * 0.08; // скруглённый квадрат, как у настоящего стикера
  return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
}

/** Обрезать холст canvas по форме (вызвать до drawImage). */
export function clipCanvasToShape(ctx, kind, w, h) {
  ctx.clip(new Path2D(shapeSvgPath(kind, w, h)));
}
