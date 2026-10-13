// Фото крупно в окне по центру (макет, исходное фото, чек оплаты) — без перехода на новую вкладку.
// Escape закрывает только этот просмотр: слушаем на window в фазе захвата — раньше,
// чем Modal (document), и дальше событие не пускаем.
import '../styles/photo-zoom.css';
import { useEffect, useRef } from 'react';

export default function PhotoZoom({ src, title, onClose }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  const closeOnBackdrop = (e) => e.target === e.currentTarget && onCloseRef.current();

  return (
    <div className="photo-zoom" role="dialog" aria-modal="true" aria-label={title} onClick={closeOnBackdrop}>
      <div className="photo-zoom__panel">
        <div className="photo-zoom__bar">
          <strong>{title}</strong>
          <a href={src} download className="photo-zoom__btn">
            Скачать
          </a>
          <button ref={closeRef} type="button" className="photo-zoom__btn photo-zoom__close" onClick={() => onCloseRef.current()} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="photo-zoom__stage">
          <img src={src} alt={title} />
        </div>
      </div>
    </div>
  );
}
