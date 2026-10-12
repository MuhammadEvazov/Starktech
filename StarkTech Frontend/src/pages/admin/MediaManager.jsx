// Управление галереей товара или одного варианта: загрузка нескольких фото и видео,
// порядок (первый файл покупатель видит первым) и удаление.
import { useState } from 'react';
import { assetUrl } from '../../api/client.js';
import { mediaApi } from '../../api/endpoints.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ErrorBox, Img } from '../../components/ui.jsx';
import { ConfirmDelete } from './CrudPage.jsx';
import { TrashIcon } from './icons.jsx';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

const isVideoFile = (f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name);

export default function MediaManager({ productId, variantId = null, items, onChange, emptyText }) {
  const toast = useToast();
  const [progress, setProgress] = useState(null); // { done, total }
  const [errors, setErrors] = useState([]);
  const [removing, setRemoving] = useState(null);
  const [moving, setMoving] = useState(false);

  const upload = async (fileList) => {
    const files = [...fileList];
    if (!files.length) return;
    const problems = [];
    const ok = files.filter((f) => {
      const limit = isVideoFile(f) ? MAX_VIDEO : MAX_IMAGE;
      if (f.size > limit) {
        problems.push(`«${f.name}» больше ${limit / 1024 / 1024} МБ`);
        return false;
      }
      return true;
    });

    setErrors([]);
    setProgress({ done: 0, total: ok.length });
    let uploaded = 0;
    let failed = 0;
    for (const f of ok) {
      try {
        await mediaApi.upload(productId, f, variantId);
        uploaded++;
      } catch (e) {
        failed++;
        problems.push(`«${f.name}»: ${e.messages?.[0] || 'не загрузился'}`);
      }
      setProgress({ done: uploaded + failed, total: ok.length });
    }
    setProgress(null);
    setErrors(problems);
    if (uploaded) toast(`Загружено файлов: ${uploaded}`);
    onChange();
  };

  // Сдвиг на одну позицию: отправляем весь новый порядок галереи.
  const move = async (i, dir) => {
    const ids = items.map((m) => m.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setMoving(true);
    try {
      await mediaApi.reorder(productId, ids);
      onChange();
    } catch (e) {
      toast(e.messages?.[0] || 'Не удалось изменить порядок', 'error');
    } finally {
      setMoving(false);
    }
  };

  const addTile = (
    <label className={`media-add ${progress ? 'is-busy' : ''}`}>
      <input
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        disabled={!!progress}
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = '';
        }}
      />
      <span className="media-add__plus" aria-hidden="true">+</span>
      <span className="media-add__text">
        {progress ? `Загружаем ${progress.done} из ${progress.total}…` : 'Добавить фото или видео'}
      </span>
    </label>
  );

  return (
    <div className="media-manager">
      {items.length === 0 ? (
        <div className="media-empty">
          {addTile}
          <div className="media-empty__text">
            <p className="media-empty__title">Галерея пуста</p>
            <p>{emptyText}</p>
          </div>
        </div>
      ) : (
      <ul className="media-grid">
        {items.map((m, i) => (
          <li key={m.id} className="media-tile">
            {m.isVideo ? (
              <>
                <video src={assetUrl(m.url)} muted playsInline preload="metadata" />
                <span className="media-tile__badge">Видео</span>
              </>
            ) : (
              <Img src={m.url} alt="" />
            )}
            {i === 0 && <span className="media-tile__first">Первое</span>}
            <div className="media-tile__bar">
              <button type="button" aria-label="Сдвинуть левее" title="Сдвинуть левее" disabled={i === 0 || moving} onClick={() => move(i, -1)}>
                ‹
              </button>
              <button type="button" aria-label="Сдвинуть правее" title="Сдвинуть правее" disabled={i === items.length - 1 || moving} onClick={() => move(i, 1)}>
                ›
              </button>
              <button type="button" className="media-tile__delete" aria-label="Удалить файл" title="Удалить" onClick={() => setRemoving(m)}>
                <TrashIcon />
              </button>
            </div>
          </li>
        ))}

        <li>{addTile}</li>
      </ul>
      )}

      <p className="media-manager__hint">Фото JPG, PNG, WebP до 5 МБ, видео MP4, MOV, WebM до 50 МБ. Можно выбрать сразу несколько файлов.</p>
      {errors.length > 0 && <ErrorBox error={{ messages: errors }} />}

      {removing && (
        <ConfirmDelete
          title={removing.isVideo ? 'Удалить видео?' : 'Удалить фото?'}
          text="Файл исчезнет из галереи на сайте. Восстановить его будет нельзя — только загрузить заново."
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await mediaApi.remove(removing.id);
            setRemoving(null);
            toast('Файл удалён');
            onChange();
          }}
        />
      )}
    </div>
  );
}
