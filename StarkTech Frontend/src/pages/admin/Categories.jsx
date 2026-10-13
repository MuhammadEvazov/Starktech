import { Link, useParams } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { attributeOptionsApi, categoriesApi, productsApi } from '../../api/endpoints.js';
import { attrLabel, attrValue, money, nameOf } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Async, ErrorBox, Img } from '../../components/ui.jsx';
import { useMemo, useState } from 'react';
import CrudPage, { ConfirmDelete } from './CrudPage.jsx';
import { ProductImageField } from './Products.jsx';
import { CameraIcon, LayersIcon, TrashIcon } from './icons.jsx';
import { ACTIVE_FILTER } from './useLookups.js';

// Сайт показывает русский — тоҷ/eng заполняются копией, как у товаров.
const withRuCopies = (f) => ({
  ...f,
  nameTj: f.nameRu,
  nameEn: f.nameRu,
  descriptionTj: f.descriptionRu,
  descriptionEn: f.descriptionRu,
});

export function Categories() {
  const toast = useToast();

  // Фото из формы загружается сразу после сохранения категории.
  const api = useMemo(() => {
    const upload = async (id, file) => {
      if (!file) return;
      try {
        await categoriesApi.uploadImage(id, file);
      } catch (e) {
        toast(`Категория сохранена, но фото не загрузилось: ${e.messages?.[0] || 'ошибка'}`, 'error');
      }
    };
    return {
      ...categoriesApi,
      create: async ({ imageFile, ...dto }) => {
        const saved = await categoriesApi.create(dto);
        await upload(saved.id, imageFile);
        return saved;
      },
      update: async (id, { imageFile, ...dto }) => {
        const saved = await categoriesApi.update(id, dto);
        await upload(id, imageFile);
        return saved;
      },
    };
  }, [toast]);

  return (
    <CrudPage
      title="Категории"
      lead="Порядок категорий — это порядок, в котором их видит покупатель в каталоге."
      api={api}
      createLabel="Новая категория"
      filters={[{ name: 'name', label: 'Название', placeholder: 'Найти категорию по названию' }, ACTIVE_FILTER]}
      columns={[]}
      renderCard={(c) => (
        <div className={`product-admin-card ${c.isActive ? '' : 'is-hidden'}`}>
          <div className="product-admin-card__top">
            <Link to={`/admin/categories/${c.id}`} className="product-admin-card__media" aria-label={nameOf(c)}>
              <Img src={c.imageUrl} alt="" fallback={<span className="product-admin-card__noimg">Нет фото категории</span>} />
            </Link>
            {!c.isActive && <span className="product-admin-card__state">Скрыта с сайта</span>}
            <span className="order-sticker" title="Место в каталоге">№{c.sortOrder}</span>
          </div>
          <div className="product-admin-card__body category-card__body">
            <Link to={`/admin/categories/${c.id}`} className="product-admin-card__name">
              {nameOf(c)}
            </Link>
            <span className="product-admin-card__cat">/{c.slug}</span>
          </div>
        </div>
      )}
      fields={[
        { name: 'nameRu', label: 'Название', required: true, wide: true },
        { name: 'slug', label: 'Адрес в каталоге', required: true, hint: 'Латиница и дефисы, напр. photo-keychains' },
        { name: 'sortOrder', label: 'Место в каталоге', type: 'number', step: 1, min: 0, hint: 'Меньше число — выше в списке' },
        { name: 'descriptionRu', label: 'Описание', type: 'textarea' },
        { name: 'isActive', label: 'Показывать на сайте', type: 'checkbox', create: false },
      ]}
      extraForm={(form, set, mode, item) => (
        <ProductImageField label="Фото категории" file={form.imageFile ?? null} current={item?.imageUrl} onChange={(f) => set('imageFile', f)} />
      )}
      toPayload={(f, mode, item) => withRuCopies({ ...f, imageUrl: item?.imageUrl ?? null })}
      deleteConfirm={{
        title: 'Удалить категорию?',
        text: (c) => `Категория «${nameOf(c)}» удалится без возможности восстановления. Если в ней есть товары, сервер не даст её удалить — тогда скройте категорию через «Изменить».`,
      }}
      rowActions={(c) => (
        <Link to={`/admin/categories/${c.id}`} className="icon-action icon-action--variants" aria-label="Опции и изображение" title="Опции и изображение">
          <LayersIcon />
        </Link>
      )}
    />
  );
}

/** Витрина категории: обложка с действиями и сводка — в стиле страницы товара. */
function CategoryHero({ category: c, productCount, onChange }) {
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
      onChange(await categoriesApi.uploadImage(c.id, file));
      toast(c.imageUrl ? 'Обложка заменена' : 'Обложка загружена');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="product-hero">
      <div className="product-hero__cover">
        <Img src={c.imageUrl} alt="" fallback={<span className="product-hero__nocover">Нет обложки</span>} />
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
            {busy ? 'Загружаем…' : c.imageUrl ? 'Заменить обложку' : 'Загрузить обложку'}
          </label>
          {c.imageUrl && (
            <button type="button" className="hero-btn hero-btn--danger" aria-label="Удалить обложку" title="Удалить обложку" onClick={() => setRemoving(true)}>
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      <div className="product-hero__info">
        <h1 className="product-hero__title">{nameOf(c)}</h1>
        <div className="product-hero__tags">
          <span className="tag">/{c.slug}</span>
          {!c.isActive && <span className="tag tag--dark">Скрыта с сайта</span>}
        </div>
        <span className="order-sticker order-sticker--static" title="Место в каталоге">
          №{c.sortOrder} в каталоге
        </span>
        {c.descriptionRu && <p className="product-hero__desc">{c.descriptionRu}</p>}
        <dl className="product-hero__facts">
          <div>
            <dt>Товаров</dt>
            <dd>{productCount ?? '…'}</dd>
          </div>
          <div>
            <dt>Обложка</dt>
            <dd>{c.imageUrl ? 'Есть' : 'Нет'}</dd>
          </div>
        </dl>
        <div className="product-hero__actions">
          <a href={`/catalog?category=${c.id}`} className="btn btn--ghost" target="_blank" rel="noreferrer">
            Открыть на сайте
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </a>
        </div>
        <p className="product-hero__hint">Обложку видно в каталоге на сайте. JPG, PNG или WebP до 5 МБ.</p>
        <ErrorBox error={error} />
      </div>

      {removing && (
        <ConfirmDelete
          title="Удалить обложку?"
          text="Категория останется без фото: в каталоге вместо него будет заглушка. Новую обложку можно загрузить в любой момент."
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            onChange(await categoriesApi.deleteImage(c.id));
            setRemoving(false);
            toast('Обложка удалена');
          }}
        />
      )}
    </section>
  );
}

const ATTR_OPTIONS = ['size', 'shape', 'phoneModel', 'quantity', 'color'].map((k) => ({ value: k, label: attrLabel(k) }));

export function CategoryDetail() {
  const { id } = useParams();
  const category = useAsync(() => categoriesApi.get(id), [id]);
  const products = useAsync(() => productsApi.list({ categoryId: id, pageSize: 1 }), [id]);

  return (
    <Async state={category}>
      {(c) => (
        <>
          <div className="page-top">
            <Link to="/admin/categories" className="back-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Все категории
            </Link>
            <nav className="crumbs-admin" aria-label="Навигация">
              <Link to="/admin/categories">Категории</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{nameOf(c)}</span>
            </nav>
          </div>

          <CategoryHero category={c} productCount={products.data?.totalCount} onChange={category.setData} />

          <section className="panel adm-section">
            <header className="adm-section__head">
              <div>
                <h2 className="adm-section__title">Шаблон вариантов</h2>
                <p className="adm-section__lead">
                  Общие формы, размеры и цвета для всех товаров этой категории. Покупатель шаблон не видит — он нужен,
                  чтобы не создавать одинаковые варианты у каждого товара вручную. Если у товаров разные варианты,
                  шаблон можно не заполнять.
                </p>
              </div>
            </header>

            <ol className="how-steps" aria-label="Как это работает">
              <li>
                <strong>Добавьте значения здесь</strong>
                <span>Например, «Форма: сердце» и надбавку к цене, если она есть.</span>
              </li>
              <li>
                <strong>Откройте товар этой категории</strong>
                <span>В разделе «Варианты» появится кнопка «Создать из шаблона категории».</span>
              </li>
              <li>
                <strong>Нажмите её — варианты готовы</strong>
                <span>Цена каждого — базовая цена товара плюс надбавка. В форме варианта значения выбираются из списка.</span>
              </li>
            </ol>

            <CrudPage
              embedded
              title="Значения шаблона"
              api={attributeOptionsApi}
              baseQuery={{ categoryId: c.id, pageSize: 100 }}
              createLabel="Добавить значение"
              filters={[{ name: 'attributeKey', label: 'Атрибут', type: 'select', options: ATTR_OPTIONS, allLabel: 'Все атрибуты' }]}
              columns={[
                { key: 'attributeKey', label: 'Атрибут', render: (o) => attrLabel(o.attributeKey) },
                { key: 'attributeValue', label: 'Значение', render: (o) => <strong>{attrValue(o.attributeValue)}</strong> },
                { key: 'priceModifier', label: 'Надбавка', align: 'right', render: (o) => (o.priceModifier ? `+${money(o.priceModifier)}` : 'без надбавки') },
                { key: 'sortOrder', label: 'Порядок', align: 'right' },
              ]}
              fields={[
                { name: 'attributeKey', label: 'Атрибут', type: 'select', required: true, options: ATTR_OPTIONS, placeholder: 'Что отличается: форма, размер…' },
                { name: 'attributeValue', label: 'Значение', required: true, hint: 'Как увидит покупатель: сердце, 5×5 см, iPhone 15' },
                { name: 'priceModifier', label: 'Надбавка к цене, смн', type: 'number', nullable: true, min: 0, hint: 'Пусто — цена как у товара' },
                { name: 'sortOrder', label: 'Порядок в списке', type: 'number', step: 1, min: 0, hint: 'Меньше число — выше' },
              ]}
              deleteConfirm={{
                title: 'Удалить значение?',
                text: (o) => `«${attrLabel(o.attributeKey)}: ${attrValue(o.attributeValue)}» пропадёт из шаблона. Уже созданные варианты товаров не изменятся.`,
              }}
              toPayload={(f) => ({ ...f, categoryId: c.id })}
            />
          </section>
        </>
      )}
    </Async>
  );
}
