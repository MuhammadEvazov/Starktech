import { useState } from 'react';
import { citiesApi, comboOffersApi, portfolioApi, promoCodesApi } from '../../api/endpoints.js';
import { DISCOUNT_TYPE, money, nameOf, parseJson } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Checkbox, Img } from '../../components/ui.jsx';
import CrudPage, { shopDate } from './CrudPage.jsx';
import { CameraIcon } from './icons.jsx';
import { ACTIVE_FILTER, nameFields, useCategoryOptions, useProductOptions } from './useLookups.js';

const activeBadge = (x) => (x.isActive ? <Badge tone="green">Активен</Badge> : <Badge>Выключен</Badge>);
const discountOptions = Object.entries(DISCOUNT_TYPE).map(([value, label]) => ({ value, label }));
const discountText = (x) => (x.discountType === 'Percent' ? `${x.discountValue}%` : money(x.discountValue));
const period = (x) => (x.validFrom || x.validTo ? `${shopDate(x.validFrom)} – ${shopDate(x.validTo)}` : 'Бессрочно');
const SHOP_TIME_HINT = 'Время Душанбе';

/** Общая проверка скидки и срока для промокодов и комбо (то же проверяет сервер). */
function validateDiscount(f) {
  const errors = [];
  const raw = f.discountValue;
  const value = Number(raw);
  if (raw === '' || raw === null || raw === undefined || Number.isNaN(value)) errors.push('Укажите размер скидки.');
  else if (f.discountType === 'Percent' && (value <= 0 || value > 100)) errors.push('Скидка в процентах — больше 0 и не больше 100.');
  else if (f.discountType !== 'Percent' && value <= 0) errors.push('Скидка суммой должна быть больше 0 смн.');
  if (f.validFrom && f.validTo && f.validTo < f.validFrom) errors.push('Дата окончания не может быть раньше даты начала.');
  return errors;
}

/** Целое ≥ 1 или пусто (без лимита). */
const checkLimit = (v, label) =>
  v === '' || v === null || v === undefined || (Number.isInteger(Number(v)) && Number(v) >= 1)
    ? null
    : `${label}: целое число от 1 или пусто.`;

export function Cities() {
  return (
    <CrudPage
      title="Города доставки"
      api={citiesApi}
      createLabel="Новый город"
      filters={[{ name: 'name', label: 'Название' }, ACTIVE_FILTER]}
      columns={[
        { key: 'nameRu', label: 'Город', render: (c) => nameOf(c) },
        { key: 'nameEn', label: 'Eng' },
        { key: 'deliveryCost', label: 'Стоимость', align: 'right', render: (c) => (Number(c.deliveryCost) === 0 ? 'бесплатно' : money(c.deliveryCost)) },
        { key: 'isActive', label: 'Статус', render: activeBadge },
      ]}
      fields={[
        ...nameFields,
        { name: 'deliveryCost', label: 'Стоимость доставки, смн', type: 'number', min: 0, required: true },
        { name: 'isActive', label: 'Доступен для заказа', type: 'checkbox', create: false },
      ]}
    />
  );
}

export function PromoCodes() {
  return (
    <CrudPage
      title="Промокоды"
      api={promoCodesApi}
      createLabel="Новый промокод"
      defaults={{ discountType: 'Percent', maxUsagesPerUser: 1 }}
      validate={(f) => [
        ...validateDiscount(f),
        checkLimit(f.maxUsages, 'Лимит использований'),
        checkLimit(f.maxUsagesPerUser, 'Лимит на одного клиента'),
      ]}
      filters={[{ name: 'code', label: 'Код' }, ACTIVE_FILTER]}
      columns={[
        { key: 'code', label: 'Код', render: (p) => <strong>{p.code}</strong> },
        { key: 'discount', label: 'Скидка', render: discountText },
        { key: 'usage', label: 'Использован', render: (p) => `${p.usedCount}${p.maxUsages ? ` из ${p.maxUsages}` : ''}` },
        { key: 'perUser', label: 'На клиента', render: (p) => (p.maxUsagesPerUser ? `${p.maxUsagesPerUser} раз` : 'без лимита') },
        { key: 'period', label: 'Срок', render: period },
        { key: 'isActive', label: 'Статус', render: activeBadge },
      ]}
      fields={[
        { name: 'code', label: 'Код', required: true, hint: 'Клиент вводит его при оформлении' },
        { name: 'discountType', label: 'Тип скидки', type: 'select', required: true, options: discountOptions },
        { name: 'discountValue', label: 'Размер скидки', type: 'number', min: 0, required: true, hint: 'Проценты (до 100) или сомони' },
        { name: 'maxUsages', label: 'Лимит использований', type: 'number', min: 1, step: 1, nullable: true, hint: 'Всего на всех клиентов. Пусто — без лимита' },
        { name: 'maxUsagesPerUser', label: 'Лимит на одного клиента', type: 'number', min: 1, step: 1, nullable: true, hint: 'Сколько раз один клиент может применить код. Пусто — без лимита' },
        { name: 'validFrom', label: 'Действует с', type: 'datetime', zone: 'shop', hint: SHOP_TIME_HINT },
        { name: 'validTo', label: 'Действует по', type: 'datetime', zone: 'shop', hint: SHOP_TIME_HINT },
        { name: 'isActive', label: 'Активен', type: 'checkbox', create: false },
      ]}
    />
  );
}

export function ComboOffers() {
  const products = useProductOptions();
  return (
    <CrudPage
      title="Комбо-предложения"
      lead="Скидка на набор товаров, купленных вместе."
      api={comboOffersApi}
      createLabel="Новое комбо"
      defaults={{ discountType: 'Percent', productIdsJson: '[]' }}
      validate={(f) => validateDiscount(f)}
      filters={[{ name: 'name', label: 'Название' }, ACTIVE_FILTER]}
      columns={[
        { key: 'nameRu', label: 'Название', render: (c) => nameOf(c) },
        { key: 'discount', label: 'Скидка', render: discountText },
        {
          key: 'products',
          label: 'Товары',
          render: (c) => parseJson(c.productIdsJson, []).map(products.name).join(', ') || '—',
        },
        { key: 'period', label: 'Срок', render: period },
        { key: 'isActive', label: 'Статус', render: activeBadge },
      ]}
      fields={[
        ...nameFields,
        { name: 'discountType', label: 'Тип скидки', type: 'select', required: true, options: discountOptions },
        { name: 'discountValue', label: 'Размер скидки', type: 'number', min: 0, required: true, hint: 'Проценты (до 100) или сомони' },
        { name: 'validFrom', label: 'Действует с', type: 'datetime', zone: 'shop', hint: SHOP_TIME_HINT },
        { name: 'validTo', label: 'Действует по', type: 'datetime', zone: 'shop', hint: SHOP_TIME_HINT },
        { name: 'productIdsJson', label: 'Товары', type: 'hidden', create: false, edit: false },
        { name: 'isActive', label: 'Активно', type: 'checkbox', create: false },
      ]}
      extraForm={(form, set) => {
        const selected = parseJson(form.productIdsJson, []);
        const toggle = (id, on) =>
          set('productIdsJson', JSON.stringify(on ? [...selected, id] : selected.filter((x) => x !== id)));
        return (
          <fieldset className="check-list">
            <legend className="field__label">Товары в комбо</legend>
            {products.items.map((p) => (
              <Checkbox key={p.id} label={nameOf(p)} checked={selected.includes(p.id)} onChange={(on) => toggle(p.id, on)} />
            ))}
          </fieldset>
        );
      }}
    />
  );
}

export function PortfolioAdmin() {
  const cats = useCategoryOptions();
  const toast = useToast();
  const [file, setFile] = useState(null);

  // Создание идёт через /api/portfolio-items/upload (multipart), изменение — через PUT.
  const api = {
    ...portfolioApi,
    create: (dto) => {
      if (!file) throw new Error('Выберите изображение для новой работы.');
      return portfolioApi.createWithImage({
        File: file,
        CategoryId: dto.categoryId,
        DescriptionRu: dto.descriptionRu,
        DescriptionTj: dto.descriptionTj,
        DescriptionEn: dto.descriptionEn,
        SortOrder: dto.sortOrder,
      });
    },
  };

  return (
    <CrudPage
      title="Портфолио"
      lead="Фото готовых заказов для страницы «Наши работы»."
      api={api}
      createLabel="Добавить работу"
      filters={[{ name: 'categoryId', label: 'Категория', type: 'select', options: cats.options }, ACTIVE_FILTER]}
      columns={[]}
      // Работы — это фото, поэтому карточки в том же стиле, что у товаров и категорий
      renderCard={(p) => (
        <div className={`product-admin-card ${p.isActive ? '' : 'is-hidden'}`}>
          <div className="product-admin-card__top">
            <div className="product-admin-card__media">
              <Img src={p.imageUrl} alt="" fallback={<span className="product-admin-card__noimg">Нет фото</span>} />
            </div>
            {!p.isActive && <span className="product-admin-card__state">Скрыто с сайта</span>}
            <span className="order-sticker" title="Порядок на странице «Наши работы»">№{p.sortOrder ?? 0}</span>
          </div>
          <div className="product-admin-card__body">
            <span className="product-admin-card__name portfolio-card__desc">{p.descriptionRu || 'Без описания'}</span>
            <span className="product-admin-card__cat">{p.categoryId ? cats.name(p.categoryId) : 'Без категории'}</span>
          </div>
        </div>
      )}
      deleteConfirm={{
        title: 'Удалить работу?',
        text: () => 'Фото пропадёт со страницы «Наши работы» без возможности восстановления. Чтобы временно убрать его, снимите «Показывать на сайте» через «Изменить».',
      }}
      fields={[
        { name: 'categoryId', label: 'Категория', type: 'select', options: cats.options },
        { name: 'sortOrder', label: 'Порядок', type: 'number', step: 1 },
        { name: 'descriptionRu', label: 'Описание (рус)', type: 'textarea' },
        { name: 'descriptionTj', label: 'Описание (тоҷ)', type: 'textarea' },
        { name: 'descriptionEn', label: 'Описание (eng)', type: 'textarea' },
        { name: 'imageUrl', label: 'Путь к изображению', create: false, required: true, hint: 'Заполняется автоматически при загрузке' },
        { name: 'isActive', label: 'Показывать на сайте', type: 'checkbox', create: false },
      ]}
      extraForm={(form, set, mode) =>
        mode === 'create' ? (
          <label className="field">
            <span className="field__label">Изображение</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        ) : null
      }
      onSaved={() => setFile(null)}
      rowActions={(p, reload) => (
        <label className="icon-action icon-action--variants" title="Заменить фото">
          <CameraIcon />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Заменить фото"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                await portfolioApi.uploadImage(p.id, f);
                toast('Фото заменено');
                reload();
              } catch (err) {
                toast(err.messages?.[0] || 'Не удалось загрузить', 'error');
              }
            }}
          />
        </label>
      )}
    />
  );
}
