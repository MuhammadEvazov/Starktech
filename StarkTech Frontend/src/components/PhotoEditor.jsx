// Кадрирование фото к товару: клиент выбирает форму или формат, двигает фото и меняет его размер
// за угловые маркеры (как в графических редакторах). На сервер уходят координаты кадра
// (PUT .../crop) и готовый макет (POST .../edited-preview).
import { useEffect, useId, useRef, useState } from 'react';
import { assetUrl } from '../api/client.js';
import { orderPhotosApi } from '../api/endpoints.js';
import { MAX_COPIES, photoCopies } from '../lib/cartPhotoStore.js';
import { parseJson } from '../lib/format.js';
import { SHAPE_LABEL, shapeSvgPath } from '../lib/shapes.js';
import { ErrorBox, Modal, Spinner } from './ui.jsx';

const ASPECTS = [
  { value: 1, label: 'Квадрат' },
  { value: 3 / 4, label: '3:4' },
  { value: 4 / 3, label: '4:3' },
  { value: 0, label: 'Как есть' },
];
const MAX_OUTPUT = 1600;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const MARGIN = 0.14; // поля рабочей области вокруг формы — там видно фото за пределами стикера
const CORNERS = ['nw', 'ne', 'sw', 'se'];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const num = (v) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

// ─── Качество печати ───
// Стикер по умолчанию 3 см; ~250 px исходного фото на 3 см (≈210 dpi) — нижняя граница чёткой печати.
export const DEFAULT_PRINT_CM = 3;
const PX_PER_CM = 250 / 3;

/** Размер печати в см (большая сторона) по атрибутам варианта: «3x3», «5×5 см», «40 мм», «4 см». По умолчанию 3 см. */
export function printSizeCm(attrs) {
  const toNum = (v) => Number(String(v).replace(',', '.'));
  for (const raw of Object.values(attrs || {})) {
    const v = String(raw ?? '').toLowerCase();
    const k = /мм|mm/.test(v) ? 0.1 : 1;
    const pair = v.match(/(\d+(?:[.,]\d+)?)\s*[x×х*]\s*(\d+(?:[.,]\d+)?)/);
    if (pair) {
      const cm = Math.max(toNum(pair[1]), toNum(pair[2])) * k;
      if (cm > 0) return cm;
    }
    const single = v.match(/(\d+(?:[.,]\d+)?)\s*(см|cm|мм|mm)/);
    if (single) {
      const cm = toNum(single[1]) * k;
      if (cm > 0) return cm;
    }
  }
  return DEFAULT_PRINT_CM;
}

/** Мало пикселей на печатный размер: longSidePx — большая сторона кадра в пикселях исходного фото. */
export const isLowQuality = (longSidePx, cm = DEFAULT_PRINT_CM) => longSidePx > 0 && longSidePx < Math.round(cm * PX_PER_CM);

// shapes — формы стикера из вариантов товара ([{ kind, label }]); если есть, клиент выбирает форму,
// кадр становится квадратным, а макет вырезается по форме (PNG с прозрачным фоном).
// Два режима:
//  • photo — фото уже на сервере (кабинет, админка): кадр и макет сразу отправляются на сервер;
//  • file  — фото ещё в браузере (страница товара, до заказа): результат отдаём в onApply(cropData, previewFile, copies),
//            а загрузит его оформление заказа.
// copies — сколько стикеров сделать с этого фото (по умолчанию file.stCopies / photo.copies / 1); степпер под
// рабочей областью. maxCopies — потолок (в кабинете: сколько штук позиции ещё не занято другими фото).
// В режиме photo изменённое число копий сохраняется на сервере (PUT .../copies) вместе с кадром.
// fixedShape — форма задана выбранным вариантом товара (круг/квадрат/сердце): выбора формы нет.
// printCm — размер печати в см (printSizeCm по атрибутам варианта): от него зависит предупреждение о нечётком фото.
export default function PhotoEditor({
  photo,
  file,
  shapes: shapesProp = [],
  fixedShape,
  // форма, выбранная по умолчанию, если у фото ещё нет кадра (страница товара: форма текущего варианта)
  initialShape,
  printCm = DEFAULT_PRINT_CM,
  copies: copiesProp,
  maxCopies = MAX_COPIES,
  onApply,
  onClose,
  onSaved,
}) {
  const saved = file ? file.stCrop ?? null : parseJson(photo.cropDataJson, null);
  const shapes = fixedShape ? [{ kind: fixedShape, label: SHAPE_LABEL[fixedShape] }] : shapesProp;
  const hasShapes = shapes.length > 0;
  // Ссылку на локальный файл создаём в эффекте: в StrictMode эффект пересоздаёт её после
  // своей же очистки, иначе картинка грузилась бы по уже отозванной ссылке.
  const [src, setSrc] = useState(() => (file ? null : assetUrl(photo.originalPhotoUrl)));
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const maskId = useId().replace(/:/g, '');
  const helpId = useId();
  const stageRef = useRef(null);
  const drag = useRef(null);
  // Ширину рабочей области берём у реального контейнера в окне (а не у окна браузера):
  // на узком телефоне модалка уже экрана, и маска с маркерами вылезали бы за край.
  const [wrapEl, setWrapEl] = useState(null);
  const [availW, setAvailW] = useState(null);
  useEffect(() => {
    if (!wrapEl) return undefined;
    const measure = () => setAvailW(Math.floor(wrapEl.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(wrapEl);
    return () => ro.disconnect();
  }, [wrapEl]);

  const [img, setImg] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [shape, setShape] = useState(
    hasShapes
      ? shapes.some((s) => s.kind === saved?.shape)
        ? saved.shape
        : shapes.some((s) => s.kind === initialShape)
          ? initialShape
          : shapes[0].kind
      : null,
  );
  const [aspectState, setAspect] = useState(saved?.aspect ?? 1);
  const aspect = hasShapes ? 1 : aspectState;
  const [zoom, setZoom] = useState(clamp(saved?.zoom ?? 1, MIN_ZOOM, MAX_ZOOM));
  // Смещение центра фото в долях кадра — не зависит от размера экрана.
  const [offset, setOffset] = useState({ x: saved?.offsetX ?? 0, y: saved?.offsetY ?? 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Сколько стикеров с этого фото
  const initialCopies = copiesProp ?? photoCopies(file ?? photo);
  const copyLimit = Math.max(1, maxCopies);
  // сохранённое значение не урезаем, даже если оно выше потолка: уменьшить можно, увеличить — нет
  const [copies, setCopies] = useState(initialCopies);
  const copiesId = useId();

  useEffect(() => {
    if (!src) return undefined;
    let cancelled = false;
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => !cancelled && (setImg(el), setLoadError(false));
    el.onerror = () => !cancelled && setLoadError(true);
    el.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Рабочая область (stage) и кадр печати (frame) внутри неё.
  // До первого замера — грубая оценка по окну, после — точная ширина контейнера.
  const fallbackW = (typeof window !== 'undefined' ? window.innerWidth : 440) - 96;
  const stageW = Math.max(160, Math.min(440, availW ?? fallbackW));
  const ratio = aspect || (img ? img.naturalWidth / img.naturalHeight : 1);
  const frameW = Math.round(stageW * (1 - 2 * MARGIN));
  const frameH = Math.round(frameW / ratio);
  const marginPx = Math.round(stageW * MARGIN);
  const stageH = frameH + 2 * marginPx;
  const frameX = marginPx;
  const frameY = marginPx;

  // Геометрия: при zoom = 1 фото ровно покрывает кадр; меньше 1 — фото меньше формы.
  const geo = (() => {
    if (!img) return null;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(frameW / iw, frameH / ih) * zoom;
    // центр фото держим внутри рабочей области, чтобы его нельзя было «потерять»
    const ox = clamp(offset.x * frameW, -stageW / 2, stageW / 2);
    const oy = clamp(offset.y * frameH, -stageH / 2, stageH / 2);
    const dispW = iw * scale;
    const dispH = ih * scale;
    const left = stageW / 2 + ox - dispW / 2;
    const top = stageH / 2 + oy - dispH / 2;
    return {
      iw, ih, scale, ox, oy, dispW, dispH, left, top,
      crop: {
        x: iw / 2 - (frameW / 2 + ox) / scale,
        y: ih / 2 - (frameH / 2 + oy) / scale,
        width: frameW / scale,
        height: frameH / scale,
      },
    };
  })();

  // ─── Перетаскивание: само фото — сдвиг, угловой маркер — пропорциональный размер ───
  const stagePoint = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e) => {
    if (!geo) return;
    e.preventDefault();
    stageRef.current.setPointerCapture(e.pointerId);
    const p = stagePoint(e);
    const corner = e.target.dataset?.corner;
    if (corner) {
      const cx = stageW / 2 + geo.ox;
      const cy = stageH / 2 + geo.oy;
      drag.current = { mode: 'resize', cx, cy, d0: Math.max(8, Math.hypot(p.x - cx, p.y - cy)), z0: zoom };
    } else {
      drag.current = { mode: 'move', x: p.x, y: p.y, ox: geo.ox, oy: geo.oy };
    }
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || !geo) return;
    const p = stagePoint(e);
    if (d.mode === 'resize') {
      const dist = Math.hypot(p.x - d.cx, p.y - d.cy);
      setZoom(clamp((d.z0 * dist) / d.d0, MIN_ZOOM, MAX_ZOOM));
    } else {
      const nx = clamp(d.ox + p.x - d.x, -stageW / 2, stageW / 2);
      const ny = clamp(d.oy + p.y - d.y, -stageH / 2, stageH / 2);
      setOffset({ x: nx / frameW, y: ny / frameH });
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  // Клавиатура: стрелки двигают фото, + и − меняют размер.
  const onKeyDown = (e) => {
    if (!geo) return;
    const step = e.shiftKey ? 20 : 5;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setOffset({ x: (geo.ox + dx) / frameW, y: (geo.oy + dy) / frameH });
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom((z) => clamp(z * 1.05, MIN_ZOOM, MAX_ZOOM));
    } else if (e.key === '-') {
      e.preventDefault();
      setZoom((z) => clamp(z / 1.05, MIN_ZOOM, MAX_ZOOM));
    }
  };

  const save = async () => {
    if (!geo) return;
    setBusy(true);
    setError(null);
    try {
      const { crop } = geo;
      const outScale = Math.min(1, MAX_OUTPUT / Math.max(crop.width, crop.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(crop.width * outScale);
      canvas.height = Math.round(crop.height * outScale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Без формы фон белый (JPEG); с формой — вырезаем по контуру, вокруг прозрачно (PNG).
      if (shape) ctx.clip(new Path2D(shapeSvgPath(shape, canvas.width, canvas.height)));
      else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // Рисуем всё фото целиком в координатах кадра — работает и когда фото меньше формы.
      const k = canvas.width / crop.width;
      ctx.drawImage(img, -crop.x * k, -crop.y * k, geo.iw * k, geo.ih * k);

      const type = shape ? 'image/png' : 'image/jpeg';
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось подготовить макет.'))), type, 0.92),
      );
      const previewFile = new File([blob], shape ? 'preview.png' : 'preview.jpg', { type });

      const cropData = {
        x: Math.round(crop.x),
        y: Math.round(crop.y),
        width: Math.round(crop.width),
        height: Math.round(crop.height),
        aspect,
        zoom,
        offsetX: geo.ox / frameW,
        offsetY: geo.oy / frameH,
        ...(shape ? { shape } : {}),
      };
      if (onApply) {
        await onApply(cropData, previewFile, copies);
      } else {
        // Копии — первыми: если сервер не даст (копий больше, чем штук в позиции), кадр не трогаем.
        if (copies !== initialCopies) await orderPhotosApi.updateCopies(photo.id, copies);
        await orderPhotosApi.updateCrop(photo.id, JSON.stringify(cropData));
        await orderPhotosApi.uploadPreview(photo.id, previewFile);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      // SecurityError — canvas «заражён» чужим доменом без CORS.
      setError(e?.name === 'SecurityError' ? { messages: ['Браузер не дал обработать фото. Попробуйте позже.'] } : e);
    } finally {
      setBusy(false);
    }
  };

  // Сколько пикселей исходного фото попадёт на печать: мало — предупреждаем (сохранить всё равно можно).
  const qualityPx = geo ? Math.round(Math.max(geo.crop.width, geo.crop.height)) : 0;
  const lowQuality = isLowQuality(qualityPx, printCm);

  // Маркеры по углам фото; если фото больше рабочей области — прижимаем их к краю, чтобы их было видно.
  const handlePos = (c) => ({
    left: clamp(c.includes('w') ? geo.left : geo.left + geo.dispW, 8, stageW - 8),
    top: clamp(c.includes('n') ? geo.top : geo.top + geo.dispH, 8, stageH - 8),
  });

  const holePath = shape
    ? shapeSvgPath(shape, frameW, frameH)
    : `M0 0H${frameW}V${frameH}H0Z`;

  return (
    <Modal title={hasShapes ? 'Форма и кадр стикера' : 'Кадрирование фото'} onClose={onClose}>
      {loadError ? (
        <ErrorBox error={{ messages: ['Не удалось загрузить фото.'] }} />
      ) : !geo ? (
        <Spinner label="Загружаем фото…" />
      ) : (
        <div className="photo-editor stack">
          {fixedShape ? (
            <p className="photo-editor__fixed">
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                <path d={shapeSvgPath(fixedShape, 22, 22)} fill="currentColor" />
              </svg>
              Форма «{SHAPE_LABEL[fixedShape]}» — как в выбранном варианте. Подгоните фото под неё.
            </p>
          ) : hasShapes ? (
            <div className="photo-editor__shapes" role="group" aria-label="Форма стикера">
              {shapes.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  aria-pressed={shape === s.kind}
                  className={`photo-editor__shape ${shape === s.kind ? 'is-active' : ''}`}
                  onClick={() => setShape(s.kind)}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <path d={shapeSvgPath(s.kind, 22, 22)} fill="currentColor" />
                  </svg>
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="photo-editor__aspects" role="group" aria-label="Формат">
              {ASPECTS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  aria-pressed={aspect === a.value}
                  className={`photo-editor__aspect ${aspect === a.value ? 'is-active' : ''}`}
                  onClick={() => setAspect(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Обёртка во всю ширину окна: по ней меряем место под рабочую область и центрируем её */}
          <div
            ref={setWrapEl}
            style={{ width: '100%', minWidth: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}
          >
          <div
            ref={stageRef}
            className="photo-editor__stage"
            style={{ width: stageW, height: stageH }}
            tabIndex={0}
            role="group"
            aria-label="Область кадрирования"
            aria-describedby={helpId}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          >
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{ width: geo.dispW, height: geo.dispH, left: geo.left, top: geo.top }}
            />

            {/* Затемнение всего, что не попадёт на изделие, и белый контур формы */}
            <svg className="photo-editor__mask" width={stageW} height={stageH} aria-hidden="true">
              <defs>
                <mask id={maskId}>
                  <rect width={stageW} height={stageH} fill="white" />
                  <path d={holePath} transform={`translate(${frameX} ${frameY})`} fill="black" />
                </mask>
              </defs>
              <rect width={stageW} height={stageH} className="photo-editor__shade" mask={`url(#${maskId})`} />
              <path d={holePath} transform={`translate(${frameX} ${frameY})`} className="photo-editor__outline" />
            </svg>

            {/* Рамка выделения фото с угловыми маркерами */}
            <div
              className="photo-editor__bbox"
              style={{ left: geo.left, top: geo.top, width: geo.dispW, height: geo.dispH }}
              aria-hidden="true"
            />
            {CORNERS.map((c) => (
              <span
                key={c}
                data-corner={c}
                className={`photo-editor__handle photo-editor__handle--${c}`}
                style={handlePos(c)}
                aria-hidden="true"
              />
            ))}
          </div>
          </div>

          <label className="photo-editor__zoom">
            <span className="field__label">Размер фото: {Math.round(zoom * 100)}%</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              aria-valuetext={`${Math.round(zoom * 100)}%`}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <p className="muted small" id={helpId}>
            Перетащите фото, чтобы сдвинуть. Тяните за белые уголки, чтобы увеличить или уменьшить.
            {shape ? ' Всё вне контура не попадёт на стикер.' : ''}
            <span className="sr-only"> С клавиатуры: стрелки двигают фото, плюс и минус меняют размер.</span>
          </p>
          {/* Сколько стикеров напечатать с этого фото */}
          <div className="photo-editor__copies">
            <span className="photo-editor__copies-label" id={copiesId}>
              Сколько стикеров с этим фото
            </span>
            <div className="stepper" role="group" aria-labelledby={copiesId}>
              <button
                type="button"
                aria-label="Меньше"
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                disabled={busy || copies <= 1}
              >
                −
              </button>
              <span aria-live="polite">{copies}</span>
              <button
                type="button"
                aria-label="Больше"
                onClick={() => setCopies((c) => Math.min(copyLimit, c + 1))}
                disabled={busy || copies >= copyLimit}
              >
                +
              </button>
            </div>
            {copies >= copyLimit && maxCopies < MAX_COPIES && (
              <span className="photo-editor__copies-hint">Все штуки позиции уже распределены по фото — чтобы добавить стикеров, сначала увеличьте количество товара.</span>
            )}
          </div>
          {lowQuality && (
            <p className="photo-editor__quality" role="status">
              Фото может получиться нечётким: на стикер {num(printCm)} см попадёт всего {qualityPx} px. Уменьшите фото в
              кадре или выберите снимок крупнее.
            </p>
          )}
          <ErrorBox error={error} />
          <div className="photo-editor__actions">
            <button type="button" className="btn btn--quiet" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить макет'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
