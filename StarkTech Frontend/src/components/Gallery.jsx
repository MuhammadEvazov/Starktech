// Галерея товара: листается свайпом (scroll-snap), стрелками, точками и клавишами ←/→.
// items: [{ key, url, isVideo }]
import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../api/client.js';
import { Img } from './ui.jsx';

export default function Gallery({ items, alt = '' }) {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const count = items.length;

  // При переключении слайда останавливаем видео, которые ушли из кадра.
  useEffect(() => {
    trackRef.current?.querySelectorAll('video').forEach((v) => {
      if (Number(v.dataset.index) !== index) v.pause();
    });
  }, [index]);

  const go = (i) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(count - 1, i));
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: next * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  };

  if (!count) return <div className="gallery gallery--empty"><Img src={null} alt="" className="gallery__img" /></div>;

  return (
    <div className="gallery" aria-roledescription="галерея" aria-label={alt ? `Фото и видео: ${alt}` : 'Фото и видео'}>
      <div className="gallery__stage">
        <div className="gallery__track" ref={trackRef} onScroll={onScroll} onKeyDown={onKey} tabIndex={0}>
          {items.map((m, i) => (
            <div
              key={m.key}
              className="gallery__slide"
              role="group"
              aria-roledescription="слайд"
              aria-label={`${i + 1} из ${count}`}
            >
              {m.isVideo ? (
                <video
                  className="gallery__img"
                  src={assetUrl(m.url)}
                  data-index={i}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <Img src={m.url} alt={i === 0 ? alt : ''} className="gallery__img" />
              )}
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" className="gallery__arrow gallery__arrow--prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Предыдущее">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" className="gallery__arrow gallery__arrow--next" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label="Следующее">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <span className="gallery__counter" aria-live="polite">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="gallery__thumbs" role="tablist" aria-label="Выбор фото">
          {items.map((m, i) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${m.isVideo ? 'Видео' : 'Фото'} ${i + 1}`}
              className={`gallery__thumb ${i === index ? 'is-on' : ''}`}
              onClick={() => go(i)}
            >
              {m.isVideo ? (
                <>
                  <video src={assetUrl(m.url)} muted playsInline preload="metadata" tabIndex={-1} />
                  <span className="gallery__play" aria-hidden="true">▶</span>
                </>
              ) : (
                <Img src={m.url} alt="" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
