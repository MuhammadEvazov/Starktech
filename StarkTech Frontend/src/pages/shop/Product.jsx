import '../../styles/site/catalog.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { categoriesApi, citiesApi, mediaApi, productsApi, reviewsApi, variantsApi } from '../../api/endpoints.js';
import { attrLabel, attrValue, date, descOf, money, nameOf, parseJson } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Async, ErrorBox, Spinner, Stars } from '../../components/ui.jsx';
import PhotoPicker from '../../components/PhotoPicker.jsx';
import PhotoEditor, { printSizeCm } from '../../components/PhotoEditor.jsx';
import { SHAPE_LABEL, shapeKind } from '../../lib/shapes.js';
import { fileId, sumCopies } from '../../lib/cartPhotoStore.js';
import { lineTotal, nextTier, normalizeTiers, percentLabel, tierPercent, unitPrice } from '../../lib/pricing.js';
import { CONTACTS } from '../../lib/contacts.js';
import Gallery from '../../components/Gallery.jsx';

const num = (v) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

export default function Product() {
  const { id } = useParams();
  const product = useAsync(() => productsApi.get(id), [id]);
  return (
    <div className="site-container pdp-page">
      {product.loading && !product.data ? (
        <ProductSkeleton />
      ) : (
        <Async state={product}>{(p) => <ProductView key={p.id} product={p} />}</Async>
      )}
    </div>
  );
}

// Пока товар грузится — силуэт страницы (квадрат фото и строки заголовка), а не голый спиннер.
function ProductSkeleton() {
  return (
    <div className="pdp pdp-skel" role="status" aria-label="Загружаем товар">
      <span className="cat-skel__img" aria-hidden="true" />
      <div className="pdp-skel__body" aria-hidden="true">
        <span className="cat-skel__line pdp-skel__title" />
        <span className="cat-skel__line cat-skel__line--short" />
        <span className="cat-skel__line pdp-skel__price" />
      </div>
    </div>
  );
}

function ProductView({ product }) {
  // Название товара — во вкладке браузера; при уходе со страницы возвращаем прежний заголовок.
  const productName = nameOf(product);
  useEffect(() => {
    const prev = document.title;
    document.title = `${productName} — StarkTech`;
    return () => {
      document.title = prev;
    };
  }, [productName]);

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

  // Товар печатается с фото клиента, а фото ещё нет — покупать пока нечего.
  const needsPhoto = Boolean(product.requiresPhotoUpload) && photos.length === 0;
  const photosRef = useRef(null);
  const goToPhotos = () => {
    const el = photosRef.current;
    if (!el) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    el.focus({ preventScroll: true });
  };

  // Формы, доступные при остальных выбранных параметрах (размер и т. п.): форма → свой вариант.
  // Форму выбирают прямо в окне подгонки — у каждого фото своя, выходить и менять вариант не нужно;
  // в корзину фото разной формы попадают отдельными позициями (каждая своим вариантом).
  const shapeVariants = {};
  if (variantShape) {
    variants.forEach((v) => {
      const kind = v.attrs?.shape ? shapeKind(v.attrs.shape) : null;
      if (!kind || shapeVariants[kind]) return;
      if (keys.every((k) => k === 'shape' || String(v.attrs[k] ?? '') === String(sel[k] ?? ''))) shapeVariants[kind] = v;
    });
  }
  const shapeKinds = Object.keys(shapeVariants);
  const editorShapes = shapeKinds.map((kind) => ({ kind, label: SHAPE_LABEL[kind] }));

  // Фото без кадра (или с формой, которой у товара нет) — сначала подогнать.
  const misfit = variantShape ? photos.filter((f) => !shapeVariants[f.stCrop?.shape]) : [];
  const fitPhotos = () => setEditQueue(misfit);

  const tiers = useMemo(() => normalizeTiers(product.quantityTiers), [product.quantityTiers]);
  // С фото количество задаётся у каждого фото (stCopies): итог = сумма копий; без фото — степпер.
  const photoTotal = sumCopies(photos);
  const qty = photos.length ? photoTotal : quantity;
  const printCm = printSizeCm(variant?.attrs);

  // Позиции для корзины: фото, сгруппированные по форме (у каждой формы свой вариант и цена); без форм — одна.
  const groups =
    variantShape && photos.length
      ? shapeKinds
          .map((kind) => ({ kind, variant: shapeVariants[kind], photos: photos.filter((f) => f.stCrop?.shape === kind) }))
          .filter((g) => g.photos.length)
          .map((g) => ({ ...g, quantity: sumCopies(g.photos) }))
      : variant
        ? [{ kind: variantShape, variant, photos, quantity: qty }]
        : [];

  const cartItem = (g) => ({
    productId: product.id,
    variantId: g.variant.id,
    name: nameOf(product),
    image: g.variant?.imageUrl || product.mainImageUrl,
    attrs: g.variant.attrs,
    price: Number(g.variant.price),
    tiers,
    quantity: g.quantity,
    requiresPhoto: product.requiresPhotoUpload,
    photos: g.photos,
  });

  // «Купить сейчас»: заказываем только этот товар — корзину не трогаем, позиции передаём оформлению напрямую.
  const doBuyNow = () => {
    const list = groups.map(cartItem);
    cart.setBuyNow(list.length === 1 ? list[0] : list);
    navigate('/checkout', { state: { buyNow: true, productId: product.id } });
  };

  const doAddToCart = () => {
    groups.forEach((g) => cart.add(cartItem(g)));
    setPhotos([]);
    setQuantity(1);
    toast(groups.length > 1 ? `Добавлено в корзину: ${groups.length} позиции — по формам` : 'Добавлено в корзину');
  };

  // Кнопки работают всегда: если какое-то фото не подогнано под форму, сначала открываем подгонку,
  // а когда все фото подогнаны — сами завершаем действие, по которому нажали (без второго клика).
  const [pendingAction, setPendingAction] = useState(null);
  const run = (action) => {
    if (!variant) return;
    if (needsPhoto) return goToPhotos();
    if (misfit.length) {
      setPendingAction(action);
      fitPhotos();
      return;
    }
    if (action === 'buy') doBuyNow();
    else doAddToCart();
  };
  const buyNow = () => run('buy');
  const addToCart = () => run('cart');

  useEffect(() => {
    if (!pendingAction || editQueue.length > 0) return;
    const action = pendingAction;
    setPendingAction(null);
    if (misfit.length) {
      // Окно закрыли, не применив кадр — подсказываем, что осталось.
      toast(`Подгоните под форму ещё ${misfit.length} фото — тогда товар добавится`);
      return;
    }
    if (action === 'buy') doBuyNow();
    else doAddToCart();
  }, [pendingAction, editQueue.length, misfit.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Цена с учётом скидки за количество (та же формула, что на сервере).
  const basePrice = Number(variant?.price ?? 0);
  const pieceTiered = unitPrice(basePrice, tiers, qty);
  // Итог — сумма по позициям (у разных форм может быть разная цена; скидка за количество — по каждой позиции).
  const groupTotals = groups.map((g) => ({ ...g, total: lineTotal(Number(g.variant?.price ?? 0), tiers, g.quantity) }));
  const total = groupTotals.length ? groupTotals.reduce((s, g) => s + g.total, 0) : lineTotal(basePrice, tiers, qty);
  const split = groupTotals.length > 1;
  const currentPercent = tierPercent(tiers, qty);
  const upcoming = nextTier(tiers, qty);

  // Доставка: диапазон цен по активным городам (ошибку загрузки не показываем — это справка).
  const cities = useAsync(() => citiesApi.list({ isActive: true, pageSize: 100 }), []);
  const costs = (cities.data?.items ?? []).map((c) => Number(c.deliveryCost) || 0);
  const minCost = costs.length ? Math.min(...costs) : null;
  const maxCost = costs.length ? Math.max(...costs) : null;
  const deliveryText =
    minCost === null
      ? null
      : maxCost === 0
        ? 'Доставка и самовывоз бесплатно'
        : minCost === 0
          ? `Доставка бесплатно или до ${money(maxCost)}, самовывоз бесплатно`
          : `Доставка от ${money(minCost)}, самовывоз бесплатно`;
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
            <ul className="pdp-ship" aria-label="Сроки и доставка">
              <li>Готово за {CONTACTS.leadTime}</li>
              {deliveryText && <li>{deliveryText}</li>}
            </ul>
            {tiers.length > 0 && (
              <ul className="pdp-tiers" aria-label="Скидки за количество">
                {tiers.map((t) => (
                  <li key={t.minQuantity} className={currentPercent === t.discountPercent ? 'is-on' : undefined}>
                    от {t.minQuantity} шт. −{percentLabel(t.discountPercent)}%
                  </li>
                ))}
              </ul>
            )}
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
                <span className="pdp-group__label" aria-hidden="true">
                  Количество
                </span>
                <div>
                  {photos.length > 0 ? (
                    <p className="pdp-qty-total" role="status">
                      Итого {photoTotal} {stickerWord(photoTotal)}
                    </p>
                  ) : (
                    <Stepper value={quantity} onChange={(q) => setQuantity(Math.max(1, q))} />
                  )}
                  {variant &&
                    (split ? (
                      // Фото разной формы — отдельные позиции со своей ценой
                      <ul className="pdp-shape-split">
                        {groupTotals.map((g) => (
                          <li key={g.variant.id}>
                            <span>
                              {SHAPE_LABEL[g.kind]} ×{g.quantity}
                            </span>
                            <span>{money(g.total)}</span>
                          </li>
                        ))}
                        <li className="is-total">
                          <span>Всего</span>
                          <span>{money(total)}</span>
                        </li>
                      </ul>
                    ) : (
                      <p className="pdp-tiers__sum">
                        {money(pieceTiered)} за штуку
                        {currentPercent > 0 && ` (−${percentLabel(currentPercent)}%)`} · всего {money(total)}
                      </p>
                    ))}
                  {upcoming && !split && (
                    <p className="pdp-tiers__next">
                      {photos.length ? 'Добавьте ещё' : 'Возьмите ещё'} {upcoming.need}{' '}
                      {photos.length ? stickerWord(upcoming.need) : 'шт.'} — скидка {percentLabel(upcoming.discountPercent)}%
                    </p>
                  )}
                  {photos.length > 0 && (
                    <p className="pdp-qty-hint">
                      Количество задаётся у каждого фото: сколько стикеров напечатать с этого снимка.
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
                <section
                  className="pdp-photos"
                  aria-labelledby="pdp-photos-title"
                  ref={photosRef}
                  tabIndex={-1}
                >
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
                  {misfit.length > 0 && (
                    <p className="pdp-photos__need" id="pdp-photo-misfit">
                      Подгоните фото под форму ({misfit.length} шт.) — форму можно выбрать прямо в окне подгонки.{' '}
                      <button type="button" className="text-link pdp-shape-fix" onClick={fitPhotos}>
                        Подогнать
                      </button>
                    </p>
                  )}
                  {needsPhoto && (
                    <p className="pdp-photos__need" id="pdp-photo-required">
                      Добавьте хотя бы одно фото — без него заказать этот товар нельзя.
                    </p>
                  )}
                  <PhotoPicker
                    files={photos}
                    onChange={setPhotos}
                    // копии меняются прямо на File (stCopies) — новый массив, чтобы пересчитать итог и цену
                    onCopiesChange={() => setPhotos((list) => [...list])}
                    expectedShape={variantShape}
                    allowedShapes={variantShape ? shapeKinds : undefined}
                    printCm={printCm}
                    // форма у варианта есть — сразу подгоняем новые фото под неё, по очереди
                    onAdd={variantShape ? (added) => setEditQueue((q) => [...q, ...added]) : undefined}
                    onEdit={variantShape ? (i) => setEditQueue([photos[i]]) : undefined}
                  />
                </section>
              )}

              {isAuthenticated && (
                <div className="pdp-cta">
                  {needsPhoto ? (
                    // Без фото печатать нечего: главная кнопка ведёт к блоку «Ваши фото»
                    <button
                      type="button"
                      className="pdp-cta__btn"
                      aria-describedby="pdp-photo-required"
                      onClick={goToPhotos}
                    >
                      Сначала добавьте фото
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pdp-cta__btn"
                      aria-describedby={misfit.length > 0 ? 'pdp-photo-misfit' : undefined}
                      onClick={addToCart}
                    >
                      <span className="pdp-cta__long">В корзину за {money(total)}</span>
                      {/* на узком телефоне — короткая подпись, чтобы влезла в одну строку */}
                      <span className="pdp-cta__short">В корзину · {num(total)} смн</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="pdp-cta__buy"
                    onClick={buyNow}
                    aria-describedby={needsPhoto ? 'pdp-photo-required' : misfit.length > 0 ? 'pdp-photo-misfit' : undefined}
                  >
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
          key={fileId(editQueue[0])}
          file={editQueue[0]}
          // Форму выбирают прямо здесь: круг / сердце / квадрат — из тех, что есть у товара
          shapes={editorShapes}
          initialShape={variantShape}
          printCm={printCm}
          onApply={(cropData, previewFile, copies) => {
            // Кадр, макет и число копий едут вместе с файлом; на оформлении заказа их загрузят после самого фото.
            const f = editQueue[0];
            f.stCrop = cropData;
            f.stPreview = previewFile;
            f.stCopies = copies;
            setPhotos((list) => [...list]);
          }}
          onClose={() => setEditQueue((q) => q.slice(1))}
        />
      )}
    </div>
  );
}

/** «стикер / стикера / стикеров» по числу. */
export function stickerWord(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'стикер';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'стикера';
  return 'стикеров';
}

export function Stepper({ value, onChange, min = 1, max = Infinity, label = 'Количество' }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Меньше" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        −
      </button>
      <span role="status">{value}</span>
      <button type="button" aria-label="Больше" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
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
