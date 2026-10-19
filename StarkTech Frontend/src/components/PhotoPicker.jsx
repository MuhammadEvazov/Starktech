import { useEffect, useState } from 'react';
import { Link } from '../lib/router.jsx';
import { SHAPE_LABEL } from '../lib/shapes.js';
import { fileId, MAX_COPIES, photoCopies } from '../lib/cartPhotoStore.js';
import { DEFAULT_PRINT_CM, isLowQuality } from './PhotoEditor.jsx';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 5 * 1024 * 1024; // FileStorage:MaxFileSizeBytes

// Размер исходного фото (без кадра) — считаем один раз на файл.
const sizes = new WeakMap();
function imageSize(file) {
  if (sizes.has(file)) return sizes.get(file);
  const p = (async () => {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file);
      const out = { w: bmp.width, h: bmp.height };
      bmp.close?.();
      return out;
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve({ w: el.naturalWidth, h: el.naturalHeight });
        el.onerror = reject;
        el.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  })().catch(() => null);
  sizes.set(file, p);
  return p;
}

/** Большая сторона того, что попадёт на печать: кадр, если подогнан, иначе квадрат по короткой стороне (с формой) или всё фото. */
async function printedPx(file, shaped) {
  if (file.stCrop?.width && file.stCrop?.height) return Math.max(file.stCrop.width, file.stCrop.height);
  const s = await imageSize(file);
  if (!s) return 0;
  return shaped ? Math.min(s.w, s.h) : Math.max(s.w, s.h);
}

/**
 * Выбор фото до оформления заказа (файлы хранятся в памяти).
 * У файла может быть подогнанный кадр: file.stCrop (данные кадра) и file.stPreview (макет) —
 * тогда показываем макет. onAdd(newFiles) — сообщить о новых фото (страница товара сразу открывает подгонку),
 * onEdit(index) — клик по фото открывает подгонку; expectedShape — форма выбранного варианта;
 * printCm — размер печати в см: если пикселей мало, у фото появляется жёлтая метка «Нечётко».
 * Копии: под каждым фото — «− N +», сколько стикеров напечатать с этого снимка. Число хранится на File
 * (file.stCopies, по умолчанию 1); onCopiesChange(file, copies) — сообщить родителю (без него — onChange
 * с новым массивом). maxCopies — необязательный потолок для одного фото.
 */
export default function PhotoPicker({
  files,
  onChange,
  compact,
  onAdd,
  onEdit,
  onCopiesChange,
  maxCopies = MAX_COPIES,
  expectedShape,
  // формы, которые есть у товара: если задано, фото любой из них считается подогнанным (форма у каждого фото своя)
  allowedShapes,
  printCm = DEFAULT_PRINT_CM,
}) {
  // Ссылки на превью создаём в эффекте: в StrictMode эффект пересоздаёт их после своей же очистки,
  // иначе превью показывались бы «битыми» (ссылка уже отозвана).
  // Пересоздаём, только когда сменились сами файлы или макеты: смена числа копий картинки не трогает.
  const previewKey = files.map((f) => `${fileId(f)}:${f.stPreview ? fileId(f.stPreview) : ''}`).join('|');
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const list = files.map((f) => ({ file: f, url: URL.createObjectURL(f.stPreview || f) }));
    setPreviews(list);
    return () => list.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Какие фото получатся нечёткими на печати.
  const [blurry, setBlurry] = useState(() => new Set());
  useEffect(() => {
    let active = true;
    Promise.all(files.map((f) => printedPx(f, !!expectedShape))).then((px) => {
      if (!active) return;
      setBlurry(new Set(files.filter((_, i) => isLowQuality(px[i], printCm))));
    });
    return () => {
      active = false;
    };
  }, [files, expectedShape, printCm]);

  // Отклонённые файлы показываем прямо под выбором (role="alert"), а не всплывающим alert().
  const [rejected, setRejected] = useState([]);
  const add = (list) => {
    const ok = [];
    const bad = [];
    [...list].forEach((f) => {
      if (!ACCEPT.includes(f.type)) bad.push(`${f.name}: нужен JPG, PNG или WEBP`);
      else if (f.size > MAX) bad.push(`${f.name}: больше 5 МБ`);
      else ok.push(f);
    });
    setRejected(bad);
    onChange([...files, ...ok]);
    if (ok.length) onAdd?.(ok);
  };

  // Число копий меняем прямо на File (как кадр и макет) и сообщаем родителю — он пересчитает итог.
  const setCopies = (file, n) => {
    const copies = Math.max(1, Math.min(maxCopies, n));
    if (copies === photoCopies(file)) return;
    file.stCopies = copies;
    if (onCopiesChange) onCopiesChange(file, copies);
    else onChange([...files]);
  };

  const blurryCount = files.filter((f) => blurry.has(f)).length;

  return (
    <div className={`photo-picker ${compact ? 'photo-picker--compact' : ''}`}>
      <div className="photo-picker__grid">
        {previews.map((p, i) => {
          const shape = p.file.stCrop?.shape;
          // Форма варианта поменялась после подгонки — просим подогнать заново.
          const mismatch = allowedShapes
            ? !shape || !allowedShapes.includes(shape)
            : expectedShape && (!shape || shape !== expectedShape);
          const low = blurry.has(p.file);
          const copies = photoCopies(p.file);
          return (
            <div key={p.url} className="pp-cell">
              <div className={`photo-picker__item ${shape ? 'is-shaped' : ''}`}>
                {onEdit ? (
                  <button
                    type="button"
                    className="photo-picker__edit"
                    aria-label={`Подогнать фото ${i + 1} под форму`}
                    onClick={() => onEdit(i)}
                  >
                    <img src={p.url} alt={`Фото ${i + 1}`} />
                  </button>
                ) : (
                  <img src={p.url} alt={`Фото ${i + 1}`} />
                )}
                {expectedShape ? (
                  <span className={`photo-picker__tag ${mismatch ? 'is-warn' : low ? 'pp-q-tag' : ''}`}>
                    {mismatch ? 'Подогнать' : low ? 'Нечётко' : SHAPE_LABEL[shape]}
                  </span>
                ) : (
                  low && <span className="photo-picker__tag pp-q-tag">Нечётко</span>
                )}
                <span className="pp-copies-badge" aria-hidden="true">
                  ×{copies}
                </span>
                <button
                  type="button"
                  className="photo-picker__remove"
                  aria-label={`Убрать фото ${i + 1}`}
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
              {/* Сколько стикеров с этого фото — работает и у товаров без формы, где редактор не открывается */}
              <div className="pp-copies" role="group" aria-label={`Сколько стикеров с фото ${i + 1}`}>
                <button
                  type="button"
                  aria-label="Меньше стикеров"
                  disabled={copies <= 1}
                  onClick={() => setCopies(p.file, copies - 1)}
                >
                  −
                </button>
                <span aria-live="polite">{copies}</span>
                <button
                  type="button"
                  aria-label="Больше стикеров"
                  disabled={copies >= maxCopies}
                  onClick={() => setCopies(p.file, copies + 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
        <label className="photo-picker__add">
          <span aria-hidden="true">+</span>
          <span>{files.length ? 'Ещё фото' : 'Добавить фото'}</span>
          <input
            type="file"
            accept={ACCEPT.join(',')}
            multiple
            className="sr-only"
            onChange={(e) => {
              add(e.target.files || []);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {blurryCount > 0 && (
        <p className="pp-q-note" role="status">
          Фото может получиться нечётким ({blurryCount === 1 ? 'одно фото' : `фото: ${blurryCount}`}) — у снимка мало
          пикселей для печати. Лучше выбери оригинал крупнее{onEdit ? ' или уменьши фото в кадре' : ''}.
        </p>
      )}
      {rejected.length > 0 && (
        <div className="error-box" role="alert">
          <p>Не добавили:</p>
          {rejected.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
        </div>
      )}
      {!compact && (
        <p className="field__hint">
          JPG, PNG или WEBP до 5 МБ. {expectedShape ? 'Нажми на фото, чтобы подогнать его под форму. ' : ''}Под каждым
          фото — сколько стикеров с него напечатать. Фото загрузятся вместе с заказом.
        </p>
      )}
      <p className="legal-note">
        Загружая фото, ты подтверждаешь, что{' '}
        <Link to="/terms" className="text-link">
          у тебя есть право их использовать
        </Link>
        .
      </p>
    </div>
  );
}
