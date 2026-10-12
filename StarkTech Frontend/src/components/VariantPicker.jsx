// Выбор товара и варианта для добавления в заказ (админка и кабинет клиента).
import { useState } from 'react';
import { useAsync } from '../lib/hooks.js';
import { productsApi, variantsApi } from '../api/endpoints.js';
import { attrValue, money, nameOf, parseJson } from '../lib/format.js';
import { ErrorBox, Modal, Select } from './ui.jsx';
import { Stepper } from '../pages/shop/Product.jsx';

export default function VariantPicker({ title, onClose, onPick }) {
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(null);
  const products = useAsync(() => productsApi.list({ pageSize: 100, isActive: true }), []);
  const variants = useAsync(
    () => (productId ? variantsApi.list({ productId, isActive: true, pageSize: 100 }) : Promise.resolve({ items: [] })),
    [productId],
  );
  const variantLabel = (v) =>
    `${Object.values(parseJson(v.attributesJson, {})).map(attrValue).join(', ') || 'Базовый'}, ${money(v.price)}${v.sku ? ` (${v.sku})` : ''}`;

  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await onPick(variantId, qty);
          } catch (err) {
            setError(err);
          }
        }}
      >
        <Select
          label="Товар"
          required
          placeholder="Выберите товар"
          options={(products.data?.items ?? []).map((p) => ({ value: p.id, label: nameOf(p) }))}
          value={productId}
          onChange={(e) => { setProductId(e.target.value); setVariantId(''); }}
        />
        <Select
          label="Вариант"
          required
          placeholder={productId ? 'Выберите вариант' : 'Сначала выберите товар'}
          options={(variants.data?.items ?? []).map((v) => ({ value: v.id, label: variantLabel(v) }))}
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
        />
        <div>
          <span className="field__label">Количество</span>
          <Stepper value={qty} onChange={setQty} />
        </div>
        <ErrorBox error={error} />
        <button className="btn btn--primary" disabled={!variantId}>
          Добавить
        </button>
      </form>
    </Modal>
  );
}
