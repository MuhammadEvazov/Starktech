import { useEffect, useState } from 'react';
import { SHAPE_LABEL } from '../lib/shapes.js';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 5 * 1024 * 1024; // FileStorage:MaxFileSizeBytes

/**
 * Выбор фото до оформления заказа (файлы хранятся в памяти).
 * У файла может быть подогнанный кадр: file.stCrop (данные кадра) и file.stPreview (макет) —
 * тогда показываем макет. onAdd(newFiles) — сообщить о новых фото (страница товара сразу открывает подгонку),
 * onEdit(index) — клик по фото открывает подгонку; expectedShape — форма выбранного варианта.
 */
export default function PhotoPicker({ files, onChange, compact, onAdd, onEdit, expectedShape }) {
  // Ссылки на превью создаём в эффекте: в StrictMode эффект пересоздаёт их после своей же очистки,
  // иначе превью показывались бы «битыми» (ссылка уже отозвана).
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const list = files.map((f) => ({ file: f, url: URL.createObjectURL(f.stPreview || f) }));
    setPreviews(list);
    return () => list.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);

  const rejected = [];
  const add = (list) => {
    const ok = [];
    [...list].forEach((f) => {
      if (!ACCEPT.includes(f.type)) rejected.push(`${f.name}: нужен JPG, PNG или WEBP`);
      else if (f.size > MAX) rejected.push(`${f.name}: больше 5 МБ`);
      else ok.push(f);
    });
    if (rejected.length) alert(rejected.join('\n'));
    onChange([...files, ...ok]);
    if (ok.length) onAdd?.(ok);
  };

  return (
    <div className={`photo-picker ${compact ? 'photo-picker--compact' : ''}`}>
      <div className="photo-picker__grid">
        {previews.map((p, i) => {
          const shape = p.file.stCrop?.shape;
          // Форма варианта поменялась после подгонки — просим подогнать заново.
          const mismatch = expectedShape && (!shape || shape !== expectedShape);
          return (
            <div key={p.url} className={`photo-picker__item ${shape ? 'is-shaped' : ''}`}>
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
              {expectedShape && (
                <span className={`photo-picker__tag ${mismatch ? 'is-warn' : ''}`}>
                  {mismatch ? 'Подогнать' : SHAPE_LABEL[shape]}
                </span>
              )}
              <button
                type="button"
                className="photo-picker__remove"
                aria-label={`Убрать фото ${i + 1}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                ×
              </button>
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
      {!compact && (
        <p className="field__hint">
          JPG, PNG или WEBP до 5 МБ. {expectedShape ? 'Нажмите на фото, чтобы подогнать его под форму. ' : ''}Фото загрузятся
          вместе с заказом.
        </p>
      )}
    </div>
  );
}
