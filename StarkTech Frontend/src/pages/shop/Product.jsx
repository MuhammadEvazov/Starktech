import '../../styles/site/catalog.css';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { categoriesApi, mediaApi, productsApi, reviewsApi, variantsApi } from '../../api/endpoints.js';
import { attrLabel, attrValue, date, descOf, money, nameOf, parseJson } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Async, ErrorBox, Spinner, Stars } from '../../components/ui.jsx';
import PhotoPicker from '../../components/PhotoPicker.jsx';
import PhotoEditor from '../../components/PhotoEditor.jsx';
import { shapeKind } from '../../lib/shapes.js';
import Gallery from '../../components/Gallery.jsx';

const num = (v) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

export default function Product() {
  const { id } = useParams();
  const product = useAsync(() => productsApi.get(id), [id]);
  return (
    <div className="site-container pdp-page">
      <Async state={product}>{(p) => <ProductView key={p.id} product={p} />}</Async>
    </div>
  );
}

function ProductView({ product }) {
  const cart = useCart();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const category = useAsync(() => categoriesApi.get(product.categoryId), [product.categoryId]);
  const variantsState = useAsync(
    () => variantsApi.list({ productId: product.id, isActive: true, pageSize: 100 }),
    [product.id],
  );

  const variants = useMemo(
    () => (variantsState.data?.items ?? []).map((v) => ({ ...v, attrs: parseJson(v.attributesJson, {}) })),
    [variantsState.data],
  );
  const keys = useMemo(() => [...new Set(variants.flatMap((v) => Object.keys(v.attrs)))], [variants]);

  const [selection, setSelection] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [photos, setPhotos] = useState([]);
  // Очередь фото, которые нужно подогнать под форму варианта (окно открывается для первого).
  const [editQueue, setEditQueue] = useState([]);

  const sel = selection ?? variants[0]?.attrs ?? {};
  const variant = variants.find((v) => keys.every((k) => String(v.attrs[k] ?? '') === String(sel[k] ?? ''))) ?? variants[0];
  // Форма стикера выбранного варианта («круглый» → круг, «сердце», «квадрат»); null — у товара формы нет.
  const variantShape = variant?.attrs?.shape ? shapeKind(variant.attrs.shape) : null;

  // Галерея: сначала фото и видео выбранного варианта, затем общие фото товара.
  const mediaState = useAsync(() => mediaApi.list(product.id), [product.id]);
  const galleryItems = useMemo(() => {
    const media = mediaState.data ?? [];
    const own = variant
      ? [
          variant.imageUrl && { key: `v-cover-${variant.id}`, url: variant.imageUrl, isVideo: false },
          ...media.filter((m) => m.productVariantId === variant.id).map((m) => ({ key: m.id, url: m.url, isVideo: m.isVideo })),
        ]
      : [];
    const common = [
      product.mainImageUrl && { key: 'cover', url: product.mainImageUrl, isVideo: false },
      ...media.filter((m) => !m.productVariantId).map((m) => ({ key: m.id, url: m.url, isVideo: m.isVideo })),
    ];
    return [...own, ...common].filter(Boolean);
  }, [mediaState.data, variant, product.mainImageUrl]);

  const choose = (key, value) => {
    const candidates = variants.filter((v) => String(v.attrs[key]) === String(value));
    const score = (v) => keys.filter((k) => k !== key && String(v.attrs[k]) === String(sel[k])).length;
    const best = [...candidates].sort((a, b) => score(b) - score(a))[0];
    if (best) setSelection(best.attrs);
  };

  // «Купить сейчас»: тот же товар с фото кладём в корзину и сразу ведём к оформлению.
  const buyNow = () => {
    if (!variant) return;
    addToCart({ silent: true });
    navigate('/checkout');
  };

  const addToCart = ({ silent = false } = {}) => {
    if (!variant) return;
    cart.add({
      productId: product.id,
      variantId: variant.id,
      name: nameOf(product),
      image: variant?.imageUrl || product.mainImageUrl,
      attrs: variant.attrs,
      price: Number(variant.price),
      quantity,
      requiresPhoto: product.requiresPhotoUpload,
      photos,
    });
    setPhotos([]);
    setQuantity(1);
    if (!silent) toast('Добавлено в корзину');
  };

  const total = (variant?.price ?? 0) * quantity;
  // Липкая панель покупки (и отступ под неё) — только у вошедшего покупателя.
  const canBuy = isAuthenticated && !variantsState.loading && !variantsState.error && variants.length > 0;

  return (
    <div className={canBuy ? 'pdp-has-bar' : undefined}>
      <nav className="pdp-crumbs" aria-label="Навигация">
        <Link to="/catalog">Каталог</Link>
        {category.data && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/catalog?category=${category.data.id}`}>{nameOf(category.data)}</Link>
          </>
        )}
      </nav>

      <div className="pdp">
        <div className="pdp-media">
          {/* key сбрасывает галерею на первый слайд при смене варианта */}
          <Gallery key={variant?.id ?? 'product'} items={galleryItems} alt={nameOf(product)} />
        </div>

        <div className="pdp-buy">
          <div className="pdp-head">
            <h1 className="pdp-title">{nameOf(product)}</h1>
            <p className="pdp-price-wrap">
              <span className="sticker-price pdp-price" aria-label={variant ? money(variant.price) : `от ${money(product.basePrice)}`}>
                {!variant && <span className="sticker-price__from">от</span>}
                {num(variant ? variant.price : product.basePrice)}
                <span className="sticker-price__unit">смн</span>
              </span>
              {product.requiresPhotoUpload && <span className="pdp-badge">С вашим фото</span>}
            </p>
            {descOf(product) && <p className="pdp-desc">{descOf(product)}</p>}
          </div>

          {variantsState.loading ? (
            <Spinner label="Загружаем варианты…" />
          ) : variantsState.error ? (
            <ErrorBox error={variantsState.error} onRetry={variantsState.reload} />
          ) : !variants.length ? (
            <p className="pdp-note">Варианты товара ещё не настроены, поэтому заказать его пока нельзя.</p>
          ) : (
            <div className="pdp-steps">
              {keys.map((k) => {
                const values = [...new Set(variants.map((v) => v.attrs[k]).filter((v) => v !== undefined))];
                return (
                  <fieldset key={k} className="pdp-group">
                    <legend className="pdp-group__label">
                      {attrLabel(k)}
                      {sel[k] !== undefined && <span className="pdp-group__value">{attrValue(sel[k])}</span>}
                    </legend>
                    <div className="pdp-chips">
                      {values.map((val) => {
                        const on = String(sel[k]) === String(val);
                        return (
                          <button
                            key={val}
                            type="button"
                            className={`pdp-chip ${on ? 'is-on' : ''}`}
                            aria-pressed={on}
                            onClick={() => choose(k, val)}
                          >
                            {attrValue(val)}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}

              <div className="pdp-group pdp-qty">
                <span className="pdp-group__label" id="pdp-qty-label">
                  Количество
                </span>
                <div role="group" aria-labelledby="pdp-qty-label">
                  <Stepper value={quantity} onChange={(q) => setQuantity(Math.max(1, q, photos.length))} />
                  {photos.length > 0 && (
                    <p className="pdp-qty-hint">
                      1 фото = 1 стикер. Можно заказать больше — лишние стикеры напечатаем копиями.
                    </p>
                  )}
                </div>
              </div>

              {/* Гость смотрит товар и варианты, но фото и покупка — только после входа */}
              {!isAuthenticated ? (
                <section className="pdp-login" aria-labelledby="pdp-login-title">
                  <h2 className="pdp-login__title" id="pdp-login-title">
                    Войдите, чтобы заказать
                  </h2>
                  <p className="pdp-login__text">
                    {product.requiresPhotoUpload
                      ? 'Загрузить фото для печати, положить товар в корзину и оформить заказ можно после входа. Это займёт минуту.'
                      : 'Положить товар в корзину и оформить заказ можно после входа. Это займёт минуту.'}
                  </p>
                  <div className="pdp-login__actions">
                    <Link to="/login" state={{ from: `/product/${product.id}` }} className="btn btn--primary btn--large">
                      Войти
                    </Link>
                    <Link to="/register" state={{ from: `/product/${product.id}` }} className="btn btn--ghost btn--large">
                      Регистрация
                    </Link>
                  </div>
                </section>
              ) : product.requiresPhotoUpload && (
                <section className="pdp-photos" aria-labelledby="pdp-photos-title">
                  <div className="pdp-photos__head">
                    <h2 className="pdp-photos__title" id="pdp-photos-title">
                      Ваши фото
                    </h2>
                    {photos.length > 0 && (
                      <span className="pdp-photos__count">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m5 12 5 5 9-10" />
                        </svg>
                        {photos.length} шт.
                      </span>
                    )}
                  </div>
                  <p className="pdp-photos__text">
                    Добавьте снимки, которые напечатаем на товаре. Можно несколько, если хотите разные варианты.
                  </p>
                  <PhotoPicker
                    files={photos}
                    onChange={(list) => {
                      setPhotos(list);
                      setQuantity((q) => Math.max(q, list.length)); // каждое фото — отдельный стикер
                    }}
                    expectedShape={variantShape}
                    // форма у варианта есть — сразу подгоняем новые фото под неё, по очереди
                    onAdd={variantShape ? (added) => setEditQueue((q) => [...q, ...added]) : undefined}
                    onEdit={variantShape ? (i) => setEditQueue([photos[i]]) : undefined}
                  />
                </section>
              )}

              {isAuthenticated && (
                <div className="pdp-cta">
                  <button type="button" className="pdp-cta__btn" onClick={() => addToCart()}>
                    В корзину за {money(total)}
                  </button>
                  <button type="button" className="pdp-cta__buy" onClick={buyNow}>
                    Купить сейчас
                  </button>
                </div>
              )}
              {variant?.sku && <p className="pdp-sku">Артикул {variant.sku}</p>}
            </div>
          )}
        </div>
      </div>

      <Reviews productId={product.id} />

      {editQueue[0] && variantShape && (
        <PhotoEditor
          key={editQueue[0].name + editQueue[0].lastModified}
          file={editQueue[0]}
          fixedShape={variantShape}
          onApply={(cropData, previewFile) => {
            // Кадр и макет едут вместе с файлом; на оформлении заказа их загрузят после самого фото.
            const f = editQueue[0];
            f.stCrop = cropData;
            f.stPreview = previewFile;
            setPhotos((list) => [...list]);
          }}
          onClose={() => setEditQueue((q) => q.slice(1))}
        />
      )}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1 }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Меньше" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label="Больше" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function Reviews({ productId }) {
  const { isAuthenticated } = useAuth();
  const summary = useAsync(() => reviewsApi.summary(productId), [productId]);
  const list = useAsync(() => reviewsApi.list({ productId, isApproved: true, pageSize: 20 }), [productId]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await reviewsApi.create({ productId, rating, comment: comment || null });
      setSent(true);
      setComment('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const hasSummary = summary.data?.reviewCount > 0;

  return (
    <section className="pdp-reviews" aria-labelledby="pdp-reviews-title">
      <div className="pdp-reviews__head">
        <h2 className="pdp-reviews__title" id="pdp-reviews-title">
          Отзывы
        </h2>
        {hasSummary && (
          <div className="pdp-score">
            <span className="pdp-score__num">{summary.data.averageRating.toFixed(1)}</span>
            <span className="pdp-score__meta">
              <Stars value={summary.data.averageRating} />
              <span>отзывов: {summary.data.reviewCount}</span>
            </span>
          </div>
        )}
      </div>

      <div className="pdp-reviews__layout">
        <Async
          state={list}
          empty={
            <div className="pdp-reviews__empty">
              <p className="pdp-reviews__empty-title">Отзывов пока нет</p>
              <p>Станьте первым, кто расскажет об этом товаре.</p>
            </div>
          }
        >
          {(data) => (
            <ul className="pdp-review-list">
              {data.items.map((r) => {
                const name = r.userFullName || 'Покупатель';
                return (
                  <li key={r.id} className="pdp-review">
                    <span className="pdp-review__avatar" aria-hidden="true">
                      {name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="pdp-review__body">
                      <div className="pdp-review__top">
                        <strong className="pdp-review__name">{name}</strong>
                        <span className="pdp-review__date">{date(r.createdAt)}</span>
                      </div>
                      <Stars value={r.rating} size="sm" />
                      {r.comment && <p className="pdp-review__text">{r.comment}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Async>

        <div className="pdp-review-form">
          <h3 className="pdp-review-form__title">Поделитесь впечатлением</h3>
          {!isAuthenticated ? (
            <p className="pdp-review-form__text">
              <Link to="/login" className="text-link">
                Войдите
              </Link>
              , чтобы оставить отзыв.
            </p>
          ) : sent ? (
            <p className="notice notice--ok">Спасибо! Отзыв появится после проверки модератором.</p>
          ) : (
            <form onSubmit={submit} className="pdp-review-form__form">
              <span className="pdp-group__label">Ваша оценка</span>
              <Stars value={rating} onChange={setRating} size="lg" />
              <textarea
                className="input input--area"
                rows={4}
                placeholder="Что понравилось, что можно улучшить"
                aria-label="Текст отзыва"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <ErrorBox error={error} />
              <button className="btn btn--primary" disabled={busy}>
                {busy ? 'Отправляем…' : 'Отправить отзыв'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
