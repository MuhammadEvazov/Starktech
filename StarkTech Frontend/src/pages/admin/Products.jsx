import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { attributeOptionsApi, mediaApi, productsApi, variantsApi } from '../../api/endpoints.js';
import { attrLabel, attrValue, dateTime, money, nameOf, parseJson } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Async, Badge, Checkbox, Empty, ErrorBox, Img, ImageUpload, Input, Modal, Pagination } from '../../components/ui.jsx';
import CrudPage, { ConfirmDelete } from './CrudPage.jsx';
import { CameraIcon, EditIcon, EyeIcon, EyeOffIcon, GalleryIcon, LayersIcon, TrashIcon } from './icons.jsx';
import MediaManager from './MediaManager.jsx';
import { ACTIVE_FILTER, useCategoryOptions } from './useLookups.js';

// Бэкенд хранит название и описание на трёх языках, а сайт показывает русский —
// поэтому в форме только русские поля, а тоҷ/eng заполняются копией.
const withRuCopies = (f) => ({
  ...f,
  nameTj: f.nameRu,
  nameEn: f.nameRu,
  descriptionTj: f.descriptionRu,
  descriptionEn: f.descriptionRu,
});

// ─── Скидки за количество (Product.quantityTiers) ────────────────────────────
// Ступень: от minQuantity штук одной позиции — минус discountPercent %. Правила те же,
// что у Domain.Common.QuantityTiers: от 2 шт., процент больше 0 и меньше 100, не больше 6 ступеней.
const MAX_TIERS = 6;

const tierRows = (form, item) =>
  Array.isArray(form.quantityTiers)
    ? form.quantityTiers
    : (item?.quantityTiers ?? []).map((t) => ({ minQuantity: String(t.minQuantity), discountPercent: String(t.discountPercent) }));

const toNum = (v) => Number(String(v ?? '').replace(',', '.').trim());

/** Ошибки ступеней (пустой массив — всё верно). */
export function tierErrors(rows) {
  const errors = [];
  if (rows.length > MAX_TIERS) errors.push(`Скидок за количество — не больше ${MAX_TIERS}.`);
  const seen = new Set();
  rows.forEach((r, i) => {
    const n = i + 1;
    const q = toNum(r.minQuantity);
    const pct = toNum(r.discountPercent);
    if (!Number.isInteger(q) || q < 2) errors.push(`Строка ${n}: количество — целое число от 2.`);
    else if (seen.has(q)) errors.push(`Строка ${n}: ступень «от ${q} шт.» уже есть.`);
    else seen.add(q);
    if (!(pct > 0 && pct < 100)) errors.push(`Строка ${n}: скидка — больше 0 и меньше 100 %.`);
  });
  return errors;
}

const cleanTiers = (rows) =>
  rows
    .map((r) => ({ minQuantity: toNum(r.minQuantity), discountPercent: toNum(r.discountPercent) }))
    .sort((a, b) => a.minQuantity - b.minQuantity);

function QuantityTiersEditor({ rows, onChange }) {
  const update = (i, key, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const errors = tierErrors(rows);
  const valid = cleanTiers(rows).filter((t) => Number.isInteger(t.minQuantity) && t.minQuantity >= 2 && t.discountPercent > 0 && t.discountPercent < 100);
  return (
    <fieldset className="qtiers">
      <legend className="field__label">Скидки за количество</legend>
      <p className="muted small">Цена за штуку снижается, когда в позиции заказа столько штук или больше. Срабатывает самая большая подходящая скидка.</p>
      {rows.length > 0 && (
        <ul className="qtiers__list">
          {rows.map((r, i) => (
            <li key={i} className="qtiers__row">
              <label className="qtiers__cell">
                <span>от</span>
                <input
                  className="input qtiers__input"
                  type="number"
                  min={2}
                  step={1}
                  inputMode="numeric"
                  aria-label={`Ступень ${i + 1}: от скольких штук`}
                  value={r.minQuantity}
                  onChange={(e) => update(i, 'minQuantity', e.target.value)}
                />
                <span>шт.</span>
              </label>
              <label className="qtiers__cell">
                <span>−</span>
                <input
                  className="input qtiers__input"
                  type="number"
                  min={0.01}
                  max={99.99}
                  step="any"
                  inputMode="decimal"
                  aria-label={`Ступень ${i + 1}: скидка в процентах`}
                  value={r.discountPercent}
                  onChange={(e) => update(i, 'discountPercent', e.target.value)}
                />
                <span>%</span>
              </label>
              <button type="button" className="btn btn--quiet btn--small" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                Убрать
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--small"
        disabled={rows.length >= MAX_TIERS}
        title={rows.length >= MAX_TIERS ? `Не больше ${MAX_TIERS} ступеней` : undefined}
        onClick={() => onChange([...rows, { minQuantity: '', discountPercent: '' }])}
      >
        Добавить скидку
      </button>
      {valid.length > 0 && (
        <p className="qtiers__preview" aria-live="polite">
          Покупатель увидит: {valid.map((t) => `от ${t.minQuantity} шт. −${t.discountPercent}%`).join(', ')}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="qtiers__errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

export function ProductImageField({ file, current, onChange, label = 'Фото товара' }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const src = preview || current;
  return (
    <div className="product-image-field">
      <span className="field__label">{label}</span>
      <div className="product-image-field__row">
        <div className="product-image-field__preview">
          {src ? <Img src={src} alt="" /> : <span className="muted small">Нет фото</span>}
        </div>
        <div className="stack">
          <label className="btn btn--ghost btn--small">
            {src ? 'Выбрать другое' : 'Выбрать фото'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                onChange(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
          {file && (
            <button type="button" className="btn btn--quiet btn--small" onClick={() => onChange(null)}>
              Отменить выбор
            </button>
          )}
          <span className="muted small">JPG, PNG или WebP. Загрузится при сохранении.</span>
        </div>
      </div>
    </div>
  );
}

/** Корзина: удалённые товары с восстановлением. */
function DeletedProducts({ onClose, onRestored, categoryName }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const list = useAsync(() => productsApi.deleted({ page, pageSize: 10 }), [page]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const restore = async (p) => {
    setBusyId(p.id);
    setError(null);
    try {
      await productsApi.restore(p.id);
      toast(`«${nameOf(p)}» снова в каталоге`);
      list.reload();
      onRestored();
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title="Удалённые товары" onClose={onClose} wide>
      <p className="muted small trash__lead">
        Удалённые товары не видны в каталоге и в админке, но остаются в старых заказах. Восстановленный товар
        возвращается с прежними фото, ценой и вариантами.
      </p>
      <ErrorBox error={error} />
      <Async
        state={list}
        empty={<p className="trash__empty">Корзина пуста. Сюда попадают товары, которые вы удалили.</p>}
      >
        {(data) => (
          <>
            <ul className="trash">
              {data.items.map((p) => (
                <li key={p.id} className="trash__item">
                  <Img src={p.mainImageUrl} alt="" className="trash__thumb" />
                  <div className="trash__info">
                    <strong>{nameOf(p)}</strong>
                    <span className="muted small">
                      {categoryName(p.categoryId)}, от {money(p.basePrice)}
                    </span>
                    <span className="muted small">Удалён {dateTime(p.deletedAt)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    disabled={busyId === p.id}
                    onClick={() => restore(p)}
                  >
                    {busyId === p.id ? 'Восстанавливаем…' : 'Восстановить'}
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </>
        )}
      </Async>
    </Modal>
  );
}

export function Products() {
  const cats = useCategoryOptions();
  const toast = useToast();
  const [trashOpen, setTrashOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Фото из формы загружается сразу после сохранения товара. Если загрузка не удалась,
  // товар уже сохранён — сообщаем, а не держим форму (повторное сохранение создало бы дубль).
  const api = useMemo(() => {
    const upload = async (id, file) => {
      if (!file) return;
      try {
        await productsApi.uploadImage(id, file);
      } catch (e) {
        toast(`Товар сохранён, но фото не загрузилось: ${e.messages?.[0] || 'ошибка'}`, 'error');
      }
    };
    return {
      ...productsApi,
      create: async ({ imageFile, ...dto }) => {
        const saved = await productsApi.create(dto);
        await upload(saved.id, imageFile);
        return saved;
      },
      update: async (id, { imageFile, ...dto }) => {
        const saved = await productsApi.update(id, dto);
        await upload(id, imageFile);
        return saved;
      },
    };
  }, [toast]);

  return (
    <>
    <CrudPage
      title="Товары"
      lead="Цена в карточке товара — «от». Реальная цена берётся из вариантов."
      api={api}
      createLabel="Новый товар"
      reloadKey={reloadKey}
      headerActions={
        <button type="button" className="btn btn--ghost" onClick={() => setTrashOpen(true)}>
          <TrashIcon />
          Удалённые товары
        </button>
      }
      deleteConfirm={{
        title: 'Удалить товар?',
        text: (p) =>
          `«${nameOf(p)}» пропадёт из каталога на сайте и из списка товаров. В старых заказах он останется. Вернуть товар можно в разделе «Удалённые товары».`,
        action: 'Удалить',
        done: 'Товар удалён. Вернуть его можно в «Удалённые товары»',
      }}
      filters={[
        { name: 'name', label: 'Название', placeholder: 'Найти товар по названию' },
        { name: 'categoryId', label: 'Категория', type: 'select', options: cats.options, allLabel: 'Все категории' },
        ACTIVE_FILTER,
      ]}
      columns={[]}
      renderCard={(p) => (
        <div className={`product-admin-card ${p.isActive ? '' : 'is-hidden'}`}>
          <div className="product-admin-card__top">
            <Link to={`/admin/products/${p.id}`} className="product-admin-card__media" aria-label={nameOf(p)}>
              <Img src={p.mainImageUrl} alt="" fallback={<span className="product-admin-card__noimg">Нет фото товара</span>} />
            </Link>
            {/* «Активен» — обычное состояние, отмечаем только скрытые */}
            {!p.isActive && <span className="product-admin-card__state">Скрыт с сайта</span>}
            {p.requiresPhotoUpload && (
              <span className="product-admin-card__flag" title="Клиент загружает своё фото">
                <CameraIcon />
                <span className="sr-only">Клиент загружает своё фото</span>
              </span>
            )}
            <span className="price-sticker">
              <span className="price-sticker__from">от</span>
              {Number(p.basePrice).toLocaleString('ru-RU')}
              <span className="price-sticker__unit">смн</span>
            </span>
          </div>
          <div className="product-admin-card__body">
            <Link to={`/admin/products/${p.id}`} className="product-admin-card__name">
              {nameOf(p)}
            </Link>
            <span className="product-admin-card__cat">{cats.name(p.categoryId)}</span>
          </div>
        </div>
      )}
      fields={[
        { name: 'categoryId', label: 'Категория', type: 'select', required: true, options: cats.options, placeholder: 'Выберите категорию', wide: true },
        { name: 'nameRu', label: 'Название', required: true },
        { name: 'basePrice', label: 'Базовая цена, смн', type: 'number', required: true, min: 0 },
        { name: 'descriptionRu', label: 'Описание', type: 'textarea' },
        { name: 'requiresPhotoUpload', label: 'Клиент загружает своё фото', type: 'checkbox', default: true },
        { name: 'isActive', label: 'Показывать на сайте', type: 'checkbox', create: false },
        // Ступени скидки редактируются отдельным блоком ниже (extraForm)
        { name: 'quantityTiers', type: 'hidden', create: false, edit: false },
      ]}
      extraForm={(form, set, mode, item) => (
        <div className="stack">
          <ProductImageField file={form.imageFile ?? null} current={item?.mainImageUrl} onChange={(f) => set('imageFile', f)} />
          <QuantityTiersEditor rows={tierRows(form, item)} onChange={(rows) => set('quantityTiers', rows)} />
        </div>
      )}
      validate={(f, mode, item) => tierErrors(tierRows(f, item))}
      toPayload={(f, mode, item) =>
        withRuCopies({ ...f, mainImageUrl: item?.mainImageUrl ?? null, quantityTiers: cleanTiers(tierRows(f, item)) })
      }
      rowActions={(p) => (
        <Link to={`/admin/products/${p.id}`} className="icon-action icon-action--variants" aria-label="Варианты" title="Варианты">
          <LayersIcon />
        </Link>
      )}
    />
    {trashOpen && (
      <DeletedProducts
        categoryName={cats.name}
        onClose={() => setTrashOpen(false)}
        onRestored={() => setReloadKey((k) => k + 1)}
      />
    )}
    </>
  );
}

/** Витрина товара: крупная обложка с действиями и сводка справа. */
function ProductHero({ product: p, categoryName, galleryCount, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError({ messages: [`«${file.name}» больше 5 МБ`] });
    setBusy(true);
    setError(null);
    try {
      onChange(await productsApi.uploadImage(p.id, file));
      toast(p.mainImageUrl ? 'Обложка заменена' : 'Обложка загружена');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="product-hero">
      <div className="product-hero__cover">
        <Img src={p.mainImageUrl} alt="" fallback={<span className="product-hero__nocover">Нет обложки</span>} />
        <div className="product-hero__cover-actions">
          <label className={`hero-btn ${busy ? 'is-busy' : ''}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <CameraIcon />
            {busy ? 'Загружаем…' : p.mainImageUrl ? 'Заменить обложку' : 'Загрузить обложку'}
          </label>
          {p.mainImageUrl && (
            <button type="button" className="hero-btn hero-btn--danger" aria-label="Удалить обложку" title="Удалить обложку" onClick={() => setRemoving(true)}>
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      <div className="product-hero__info">
        <h1 className="product-hero__title">{nameOf(p)}</h1>
        <div className="product-hero__tags">
          {categoryName && <span className="tag">{categoryName}</span>}
          {p.requiresPhotoUpload && <span className="tag tag--blue">Клиент присылает фото</span>}
          {!p.isActive && <span className="tag tag--dark">Скрыт с сайта</span>}
        </div>
        <span className="price-sticker price-sticker--static">
          <span className="price-sticker__from">от</span>
          {Number(p.basePrice).toLocaleString('ru-RU')}
          <span className="price-sticker__unit">смн</span>
        </span>
        {p.descriptionRu && <p className="product-hero__desc">{p.descriptionRu}</p>}
        <dl className="product-hero__facts">
          <div>
            <dt>Обложка</dt>
            <dd>{p.mainImageUrl ? 'Есть' : 'Нет'}</dd>
          </div>
          <div>
            <dt>В галерее</dt>
            <dd>{galleryCount}</dd>
          </div>
          <div>
            <dt>Скидки за количество</dt>
            <dd>
              {p.quantityTiers?.length
                ? p.quantityTiers.map((t) => `от ${t.minQuantity} шт. −${t.discountPercent}%`).join(', ')
                : 'Нет'}
            </dd>
          </div>
        </dl>
        <div className="product-hero__actions">
          <a href={`/product/${p.id}`} className="btn btn--ghost" target="_blank" rel="noreferrer">
            Открыть на сайте
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </a>
        </div>
        <p className="product-hero__hint">Обложка — первое фото в карточке и на странице товара. JPG, PNG или WebP до 5 МБ.</p>
        <ErrorBox error={error} />
      </div>

      {removing && (
        <ConfirmDelete
          title="Удалить обложку?"
          text="Товар останется без главного фото: в каталоге вместо него будет заглушка. Новую обложку можно загрузить в любой момент."
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            onChange(await productsApi.deleteImage(p.id));
            setRemoving(false);
            toast('Обложка удалена');
          }}
        />
      )}
    </section>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const toast = useToast();
  const product = useAsync(() => productsApi.get(id), [id]);
  const media = useAsync(() => mediaApi.list(id), [id]);
  const cats = useCategoryOptions();
  const allMedia = media.data ?? [];

  return (
    <Async state={product}>
      {(p) => (
        <>
          <div className="page-top">
            <Link to="/admin/products" className="back-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Все товары
            </Link>
            <nav className="crumbs-admin" aria-label="Навигация">
              <Link to="/admin/products">Товары</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{nameOf(p)}</span>
            </nav>
          </div>

          <ProductHero
            product={p}
            categoryName={cats.items.find((c) => c.id === p.categoryId) ? cats.name(p.categoryId) : null}
            galleryCount={allMedia.filter((m) => !m.productVariantId).length}
            onChange={product.setData}
          />

          <section className="panel adm-section">
            <header className="adm-section__head">
              <div>
                <h2 className="adm-section__title">
                  Галерея товара
                  <span className="adm-section__count">{allMedia.filter((m) => !m.productVariantId).length}</span>
                </h2>
                <p className="adm-section__lead">Покупатель листает эти фото и видео после главного изображения.</p>
              </div>
            </header>
            <MediaManager
              productId={p.id}
              items={allMedia.filter((m) => !m.productVariantId)}
              onChange={media.reload}
              emptyText="Пока здесь только главное изображение. Добавьте фото с разных сторон и короткое видео — так товар легче оценить."
            />
          </section>

          <Variants product={p} media={allMedia} onMediaChange={media.reload} />
        </>
      )}
    </Async>
  );
}

/** Удалённые варианты товара с восстановлением. */
function DeletedVariants({ product, onClose, onRestored }) {
  const toast = useToast();
  const list = useAsync(() => variantsApi.deleted(product.id), [product.id]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const describe = (v) =>
    Object.entries(parseJson(v.attributesJson, {}))
      .map(([k, val]) => `${attrLabel(k)}: ${attrValue(val)}`)
      .join(', ') || 'Без атрибутов';

  const restore = async (v) => {
    setBusyId(v.id);
    setError(null);
    try {
      await variantsApi.restore(v.id);
      toast(`Вариант «${describe(v)}» восстановлен`);
      list.reload();
      onRestored();
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title="Удалённые варианты" onClose={onClose} wide>
      <p className="muted small trash__lead">
        Удалённые варианты не видны покупателям, но остаются в старых заказах. Восстановленный вариант вернётся с прежней
        ценой, фото и галереей.
      </p>
      <ErrorBox error={error} />
      <Async state={list} empty={<p className="trash__empty">Удалённых вариантов нет.</p>}>
        {(data) => (
          <ul className="trash">
            {data.items.map((v) => (
              <li key={v.id} className="trash__item">
                <Img src={v.imageUrl || product.mainImageUrl} alt="" className="trash__thumb" />
                <div className="trash__info">
                  <strong>{describe(v)}</strong>
                  <span className="muted small">{money(v.price)}{v.sku ? `, артикул ${v.sku}` : ''}</span>
                  <span className="muted small">Удалён {dateTime(v.deletedAt)}</span>
                </div>
                <button type="button" className="btn btn--ghost btn--small" disabled={busyId === v.id} onClick={() => restore(v)}>
                  {busyId === v.id ? 'Восстанавливаем…' : 'Восстановить'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Modal>
  );
}

function Variants({ product, media = [], onMediaChange }) {
  const [galleryOf, setGalleryOf] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [toggling, setToggling] = useState(null);
  const toast = useToast();
  const list = useAsync(() => variantsApi.list({ productId: product.id, pageSize: 100 }), [product.id]);
  const grouped = useAsync(() => attributeOptionsApi.grouped(product.categoryId), [product.categoryId]);
  const [editing, setEditing] = useState(null);
  const [generating, setGenerating] = useState(false);

  const options = grouped.data || {};
  const variants = (list.data?.items ?? []).map((v) => ({ ...v, attrs: parseJson(v.attributesJson, {}) }));

  // Все сочетания значений атрибутов категории; цена = базовая + сумма надбавок.
  const combos = useMemo(() => {
    const keys = Object.keys(options);
    if (!keys.length) return [];
    let acc = [{ attrs: {}, price: Number(product.basePrice) }];
    keys.forEach((k) => {
      const next = [];
      acc.forEach((c) =>
        options[k].forEach((o) =>
          next.push({ attrs: { ...c.attrs, [k]: o.attributeValue }, price: c.price + Number(o.priceModifier || 0) }),
        ),
      );
      acc = next;
    });
    const existing = new Set(variants.map((v) => JSON.stringify(sortObj(v.attrs))));
    return acc.filter((c) => !existing.has(JSON.stringify(sortObj(c.attrs))));
  }, [options, variants, product.basePrice]);

  const generate = async () => {
    if (!window.confirm(`Создать вариантов: ${combos.length}?`)) return;
    setGenerating(true);
    let ok = 0;
    for (const c of combos) {
      try {
        await variantsApi.create({ productId: product.id, attributesJson: JSON.stringify(c.attrs), price: c.price, stockUnlimited: true, sku: null });
        ok++;
      } catch { /* продолжаем */ }
    }
    setGenerating(false);
    toast(`Создано вариантов: ${ok} из ${combos.length}`, ok === combos.length ? 'ok' : 'error');
    list.reload();
  };

  const [removing, setRemoving] = useState(null);
  const confirmRemove = async () => {
    await variantsApi.remove(removing.id);
    toast('Вариант удалён. Вернуть его можно в «Удалённые варианты»');
    setRemoving(null);
    list.reload();
  };

  // Скрыть/показать — одним кликом: вариант остаётся в списке, но покупатель его не видит.
  const toggleActive = async (v) => {
    setToggling(v.id);
    try {
      await variantsApi.update(v.id, {
        attributesJson: v.attributesJson,
        price: v.price,
        stockUnlimited: v.stockUnlimited,
        sku: v.sku,
        isActive: !v.isActive,
      });
      toast(v.isActive ? 'Вариант скрыт — покупатели его не видят' : 'Вариант снова в продаже');
      list.reload();
    } catch (e) {
      toast(e.messages?.[0] || 'Не удалось изменить видимость', 'error');
    } finally {
      setToggling(null);
    }
  };

  return (
    <section className="adm-section">
      <header className="adm-section__head">
        <div>
          <h2 className="adm-section__title">
            Варианты
            <span className="adm-section__count">{variants.length}</span>
          </h2>
          <p className="adm-section__lead">Покупатель выбирает вариант на странице товара. Без вариантов товар нельзя заказать.</p>
        </div>
        <div className="adm-section__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setTrashOpen(true)}>
            <TrashIcon />
            Удалённые варианты
          </button>
          {combos.length > 0 && (
            <button type="button" className="btn btn--ghost" disabled={generating} onClick={generate}>
              {generating ? 'Создаём…' : `Создать из шаблона категории (${combos.length})`}
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => setEditing({})}>
            Новый вариант
          </button>
        </div>
      </header>

      <Async state={list}>
        {() =>
          !variants.length ? (
            <Empty title="Вариантов пока нет">Создайте хотя бы один вариант с ценой — без него товар нельзя положить в корзину. Если у товара нет отличий (формы, размера), хватит одного варианта без атрибутов.</Empty>
          ) : (
            <ul className="crud-cards">
              {variants.map((v) => {
                const own = !!v.imageUrl;
                const attrs = Object.entries(v.attrs);
                return (
                  <li key={v.id} className="crud-card">
                    <div className={`product-admin-card ${v.isActive ? '' : 'is-hidden'}`}>
                      <div className="product-admin-card__top">
                        <div className={`product-admin-card__media ${own ? '' : 'is-fallback'}`}>
                          <Img
                            src={v.imageUrl || product.mainImageUrl}
                            alt=""
                            fallback={<span className="product-admin-card__noimg">Нет фото</span>}
                          />
                        </div>
                        {!v.isActive && <span className="product-admin-card__state">Скрыт</span>}
                        {/* Без своего фото покупатель увидит общее фото товара */}
                        {!own && product.mainImageUrl && <span className="variant-card__shared">Общее фото товара</span>}
                        <span className="price-sticker">
                          {Number(v.price).toLocaleString('ru-RU')}
                          <span className="price-sticker__unit">смн</span>
                        </span>
                      </div>
                      <div className="product-admin-card__body">
                        {attrs.length ? (
                          <span className="variant-card__attrs">
                            {attrs.map(([k, val]) => (
                              <span key={k} className="attr-pill">
                                {attrLabel(k)}: {attrValue(val)}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="product-admin-card__name">Без атрибутов</span>
                        )}
                        <span className="product-admin-card__cat">{v.sku ? `Артикул ${v.sku}` : 'Без артикула'}</span>
                      </div>
                    </div>
                    <div className="crud-card__actions">
                      <button
                        type="button"
                        className="icon-action icon-action--variants"
                        aria-label="Галерея варианта"
                        title="Галерея варианта"
                        onClick={() => setGalleryOf(v)}
                      >
                        <GalleryIcon />
                        {media.some((m) => m.productVariantId === v.id) && (
                          <span className="icon-action__count">{media.filter((m) => m.productVariantId === v.id).length}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        className={`icon-action icon-action--visibility ${v.isActive ? '' : 'is-hidden'}`}
                        aria-label={v.isActive ? 'Скрыть вариант' : 'Показать вариант'}
                        title={v.isActive ? 'Скрыть: покупатели не увидят вариант' : 'Показать покупателям'}
                        disabled={toggling === v.id}
                        onClick={() => toggleActive(v)}
                      >
                        {v.isActive ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                      <button type="button" className="icon-action icon-action--edit" aria-label="Изменить" title="Изменить" onClick={() => setEditing(v)}>
                        <EditIcon />
                      </button>
                      <button type="button" className="icon-action icon-action--delete" aria-label="Удалить" title="Удалить" onClick={() => setRemoving(v)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Async>

      {galleryOf && (
        <Modal
          title={`Галерея варианта: ${Object.entries(galleryOf.attrs).map(([k, val]) => `${attrLabel(k)} ${attrValue(val)}`).join(", ") || "без атрибутов"}`}
          onClose={() => setGalleryOf(null)}
          wide
        >
          <p className="muted small">
            Когда покупатель выберет этот вариант, сначала он увидит эти фото и видео, затем общую галерею товара.
          </p>
          <MediaManager
            productId={product.id}
            variantId={galleryOf.id}
            items={media.filter((m) => m.productVariantId === galleryOf.id)}
            onChange={onMediaChange}
            emptyText="У варианта пока нет своих фото и видео — покупатель увидит общую галерею товара."
          />
        </Modal>
      )}

      {trashOpen && (
        <DeletedVariants
          product={product}
          onClose={() => setTrashOpen(false)}
          onRestored={list.reload}
        />
      )}

      {removing && (
        <ConfirmDelete
          title="Удалить вариант?"
          text={`Вариант «${Object.entries(removing.attrs).map(([k, val]) => `${attrLabel(k)}: ${attrValue(val)}`).join(', ') || 'без атрибутов'}» за ${money(removing.price)} пропадёт со страницы товара. В старых заказах он останется, а вернуть его можно в «Удалённые варианты». Если нужно только временно убрать его из продажи — нажмите на глаз, чтобы скрыть.`}
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      )}

      {editing && (
        <VariantForm
          variant={editing.id ? editing : null}
          product={product}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast('Вариант сохранён');
            list.reload();
          }}
        />
      )}
    </section>
  );
}

const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

function VariantForm({ variant, product, options, onClose, onSaved }) {
  const initialAttrs = variant ? Object.entries(variant.attrs) : Object.keys(options).map((k) => [k, '']);
  const [rows, setRows] = useState(initialAttrs.length ? initialAttrs : [['', '']]);
  const [price, setPrice] = useState(variant?.price ?? product.basePrice);
  const [sku, setSku] = useState(variant?.sku ?? '');
  const [stockUnlimited, setStockUnlimited] = useState(variant?.stockUnlimited ?? true);
  const [isActive, setIsActive] = useState(variant?.isActive ?? true);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const setRow = (i, idx, v) => setRows((r) => r.map((row, j) => (j === i ? (idx === 0 ? [v, row[1]] : [row[0], v]) : row)));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const attributesJson = JSON.stringify(Object.fromEntries(rows.filter(([k, v]) => k.trim() && String(v).trim())));
    const dto = { attributesJson, price: Number(price), stockUnlimited, sku: sku || null };
    try {
      const id = variant
        ? (await variantsApi.update(variant.id, { ...dto, isActive }), variant.id)
        : (await variantsApi.create({ ...dto, productId: product.id })).id;
      // Фото грузится после сохранения; при ошибке вариант уже сохранён — сообщаем, но не держим форму.
      if (imageFile) {
        try {
          await variantsApi.uploadImage(id, imageFile);
        } catch (e) {
          toast(`Вариант сохранён, но фото не загрузилось: ${e.messages?.[0] || 'ошибка'}`, 'error');
        }
      }
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={variant ? 'Вариант' : 'Новый вариант'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div>
          <span className="field__label">Атрибуты</span>
          <datalist id="attr-keys">
            {['size', 'shape', 'phoneModel', 'quantity', ...Object.keys(options)].map((k) => (
              <option key={k} value={k}>{attrLabel(k)}</option>
            ))}
          </datalist>
          <div className="attr-rows">
            {rows.map(([k, v], i) => (
              <div key={i} className="attr-row">
                <input className="input" list="attr-keys" placeholder="Ключ, напр. size" aria-label="Ключ атрибута" value={k} onChange={(e) => setRow(i, 0, e.target.value)} />
                {options[k]?.length ? (
                  <select className="input" aria-label="Значение" value={v} onChange={(e) => setRow(i, 1, e.target.value)}>
                    <option value="">—</option>
                    {options[k].map((o) => (
                      <option key={o.id} value={o.attributeValue}>
                        {attrValue(o.attributeValue)}
                        {o.priceModifier ? ` (+${money(o.priceModifier)})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="input" placeholder="Значение" aria-label="Значение" value={v} onChange={(e) => setRow(i, 1, e.target.value)} />
                )}
                <button type="button" className="icon-btn" aria-label="Убрать атрибут" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--quiet btn--small" onClick={() => setRows((r) => [...r, ['', '']])}>
            Добавить атрибут
          </button>
        </div>
        <div className="form-grid">
          <Input label="Цена, смн" type="number" step="any" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input label="Артикул (SKU)" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <ProductImageField
          label="Фото варианта"
          file={imageFile}
          current={variant?.imageUrl}
          onChange={setImageFile}
        />
        {!variant?.imageUrl && !imageFile && (
          <p className="muted small variant-form__hint">Без своего фото покупатель увидит общее фото товара.</p>
        )}
        <Checkbox label="Без ограничения остатка" checked={stockUnlimited} onChange={setStockUnlimited} />
        {variant && <Checkbox label="Доступен для заказа" checked={isActive} onChange={setIsActive} />}
        <ErrorBox error={error} />
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn--primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
        </div>
      </form>
    </Modal>
  );
}
