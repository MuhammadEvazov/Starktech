import { useAsync } from '../../lib/hooks.js';
import { categoriesApi, productsApi } from '../../api/endpoints.js';
import { nameOf } from '../../lib/format.js';

export function useCategoryOptions() {
  const state = useAsync(() => categoriesApi.list({ pageSize: 100 }), []);
  const items = [...(state.data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    items,
    options: items.map((c) => ({ value: c.id, label: nameOf(c) })),
    name: (id) => nameOf(items.find((c) => c.id === id)) || '—',
  };
}

export function useProductOptions() {
  const state = useAsync(() => productsApi.list({ pageSize: 100 }), []);
  const items = state.data?.items ?? [];
  return {
    items,
    options: items.map((p) => ({ value: p.id, label: nameOf(p) })),
    name: (id) => nameOf(items.find((p) => p.id === id)) || id,
  };
}

export const ACTIVE_FILTER = { name: 'isActive', label: 'Видимость', type: 'bool', trueLabel: 'Активные', falseLabel: 'Скрытые' };

export const nameFields = [
  { name: 'nameRu', label: 'Название (рус)', required: true },
  { name: 'nameTj', label: 'Название (тоҷ)', required: true },
  { name: 'nameEn', label: 'Название (eng)', required: true },
];

export const descriptionFields = [
  { name: 'descriptionRu', label: 'Описание (рус)', type: 'textarea' },
  { name: 'descriptionTj', label: 'Описание (тоҷ)', type: 'textarea' },
  { name: 'descriptionEn', label: 'Описание (eng)', type: 'textarea' },
];
