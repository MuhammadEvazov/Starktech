// Все эндпоинты WebApi/Controllers в одном месте.
import { http } from './client.js';

const resource = (base) => ({
  list: (query) => http.get(base, query),
  get: (id) => http.get(`${base}/${id}`),
  create: (dto) => http.post(base, dto),
  update: (id, dto) => http.put(`${base}/${id}`, dto),
  remove: (id) => http.del(`${base}/${id}`),
});

// AuthController — /api/auth
export const authApi = {
  login: (dto) => http.post('/api/auth/login', dto), // → LoginResponseDto (без обёртки Result)
  register: (dto) => http.post('/api/auth/register', dto),
  changePassword: (dto) => http.post('/api/auth/change-password', dto),
  sendResetCode: (email) => http.post('/api/auth/send-reset-code', { email }),
  verifyResetCode: (email, code) => http.post('/api/auth/verify-reset-code', { email, code }),
  resetPassword: (dto) => http.post('/api/auth/reset-password', dto),
  assignRole: (userId, roleName) => http.post('/api/auth/assign-role', { userId, roleName }),
  removeRole: (userId, roleName) => http.post('/api/auth/remove-role', { userId, roleName }),
};

// ProfileController — /api/profile
export const profileApi = {
  get: () => http.get('/api/profile'),
  update: (dto) => http.put('/api/profile', dto),
  uploadAvatar: (file) => http.upload('/api/profile/avatar', file, { method: 'PUT', field: 'File' }),
  coins: (query) => http.get('/api/profile/coins', query), // история монет текущего пользователя
};

export const categoriesApi = {
  ...resource('/api/categories'),
  uploadImage: (id, file) => http.upload(`/api/categories/${id}/image`, file),
  deleteImage: (id) => http.del(`/api/categories/${id}/image`),
};

export const productsApi = {
  ...resource('/api/products'),
  uploadImage: (id, file) => http.upload(`/api/products/${id}/image`, file),
  deleteImage: (id) => http.del(`/api/products/${id}/image`),
  // Удаление мягкое: товар уходит в корзину и восстанавливается оттуда.
  deleted: (query) => http.get('/api/products/deleted', query),
  restore: (id) => http.post(`/api/products/${id}/restore`),
};

// ProductMediaController — галерея товара и вариантов (фото и видео)
export const mediaApi = {
  list: (productId) => http.get(`/api/products/${productId}/media`),
  upload: (productId, file, variantId) =>
    http.upload(`/api/products/${productId}/media`, file, { extra: { variantId: variantId || undefined } }),
  reorder: (productId, ids) => http.put(`/api/products/${productId}/media/order`, { ids }),
  remove: (id) => http.del(`/api/product-media/${id}`),
};

export const variantsApi = {
  ...resource('/api/product-variants'),
  uploadImage: (id, file) => http.upload(`/api/product-variants/${id}/image`, file),
  // Удаление мягкое: вариант уходит в «Удалённые варианты» и восстанавливается оттуда.
  deleted: (productId) => http.get('/api/product-variants/deleted', { productId, pageSize: 100 }),
  restore: (id) => http.post(`/api/product-variants/${id}/restore`),
  deleteImage: (id) => http.del(`/api/product-variants/${id}/image`),
};

export const attributeOptionsApi = {
  ...resource('/api/variant-attribute-options'),
  grouped: (categoryId) => http.get(`/api/variant-attribute-options/category/${categoryId}/grouped`),
};

export const citiesApi = resource('/api/delivery-cities');
export const promoCodesApi = resource('/api/promo-codes');
export const comboOffersApi = resource('/api/combo-offers');

export const portfolioApi = {
  ...resource('/api/portfolio-items'),
  createWithImage: (fields) => http.form('/api/portfolio-items/upload', fields),
  uploadImage: (id, file) => http.upload(`/api/portfolio-items/${id}/image`, file),
};

export const reviewsApi = {
  list: (query) => http.get('/api/reviews', query),
  get: (id) => http.get(`/api/reviews/${id}`),
  create: (dto) => http.post('/api/reviews', dto),
  approve: (id) => http.post(`/api/reviews/${id}/approve`),
  remove: (id) => http.del(`/api/reviews/${id}`),
  summary: (productId) => http.get(`/api/reviews/product/${productId}/summary`),
};

export const ordersApi = {
  list: (query) => http.get('/api/orders', query),
  get: (id) => http.get(`/api/orders/${id}`),
  // Личный кабинет: только свои заказы (у админа list/get отдают все заказы магазина).
  mine: (query) => http.get('/api/orders/my', query),
  mineGet: (id) => http.get(`/api/orders/my/${id}`),
  // Журнал изменений заказа (что поменял клиент) и отметка «просмотрено».
  activity: (id) => http.get(`/api/orders/${id}/activity`),
  activitySeen: (id) => http.post(`/api/orders/${id}/activity/seen`),
  // Клиент меняет состав своего заказа, пока он «Новый» или «Подтверждён».
  addMyItem: (orderId, productVariantId, quantity) => http.post(`/api/orders/my/${orderId}/items`, { productVariantId, quantity }),
  updateMyItem: (orderId, itemId, quantity) => http.put(`/api/orders/my/${orderId}/items/${itemId}`, { quantity }),
  removeMyItem: (orderId, itemId) => http.del(`/api/orders/my/${orderId}/items/${itemId}`),
  create: (dto) => http.post('/api/orders', dto),
  updateStatus: (id, status, paymentStatus) => http.put(`/api/orders/${id}/status`, { status, paymentStatus }),
  cancel: (id) => http.post(`/api/orders/${id}/cancel`),
  addItem: (orderId, productVariantId, quantity) => http.post(`/api/orders/${orderId}/items`, { productVariantId, quantity }),
  updateItem: (orderId, itemId, quantity) => http.put(`/api/orders/${orderId}/items/${itemId}`, { quantity }),
  removeItem: (orderId, itemId) => http.del(`/api/orders/${orderId}/items/${itemId}`),
};

export const orderPhotosApi = {
  list: (orderItemId) => http.get(`/api/order-items/${orderItemId}/photos`),
  // copies — сколько стикеров сделать с этого фото (по умолчанию 1)
  upload: (orderItemId, file, copies) =>
    http.upload(`/api/order-items/${orderItemId}/photos`, file, copies != null ? { extra: { copies } } : undefined),
  updateCopies: (photoId, copies) => http.put(`/api/order-item-photos/${photoId}/copies`, { copies }),
  uploadPreview: (photoId, file) => http.upload(`/api/order-item-photos/${photoId}/edited-preview`, file),
  updateCrop: (photoId, cropDataJson) => http.put(`/api/order-item-photos/${photoId}/crop`, { cropDataJson }),
  remove: (photoId) => http.del(`/api/order-item-photos/${photoId}`),
};

export const usersApi = {
  list: (query) => http.get('/api/User', query),
  get: (id) => http.get(`/api/User/${id}`),
  assignRole: (id, role) => http.post(`/api/User/${id}/roles`, { role }),
  removeRole: (id, role) => http.del(`/api/User/${id}/roles/${encodeURIComponent(role)}`),
  remove: (id) => http.del(`/api/User/${id}`),
};

export const coinsApi = {
  list: (query) => http.get('/api/coins-transactions', query),
  get: (id) => http.get(`/api/coins-transactions/${id}`),
  adjust: (dto) => http.post('/api/coins-transactions/adjust', dto),
};

export const permissionsApi = {
  all: () => http.get('/api/role-permissions'),
  byRole: (role) => http.get(`/api/role-permissions/role/${role}`),
  set: (role, permissionKey, isGranted) => http.put('/api/role-permissions', { role, permissionKey, isGranted }),
};

export const notificationsApi = {
  list: (query) => http.get('/api/notifications', query),
  get: (id) => http.get(`/api/notifications/${id}`),
  create: (dto) => http.post('/api/notifications', dto),
};

// DashboardController — сводка для главной админки (суммы только при праве finance.view)
export const dashboardApi = {
  get: (days) => http.get('/api/dashboard', { days }),
};

export const telegramApi = {
  list: (query) => http.get('/api/telegram-bindings', query),
  get: (id) => http.get(`/api/telegram-bindings/${id}`),
  initiate: (userId) => http.post('/api/telegram-bindings/link/initiate', { userId }),
  confirm: (code, telegramChatId) => http.post('/api/telegram-bindings/link/confirm', { code, telegramChatId }),
  unlink: (userId) => http.post(`/api/telegram-bindings/${userId}/unlink`),
};

// ChatController — REST-часть чата «Написать нам»; сообщения в реальном времени идут через SignalR (lib/chatHub.js).
export const chatApi = {
  my: () => http.get('/api/chat/my'),
  unread: () => http.get('/api/chat/unread'),
  conversations: (query) => http.get('/api/chat/conversations', query),
  conversation: (id) => http.get(`/api/chat/conversations/${id}`),
  forCustomer: (customerId) => http.post(`/api/chat/conversations/for-customer/${customerId}`),
  messages: (id, query) => http.get(`/api/chat/conversations/${id}/messages`, query),
  sendPhoto: (id, file, { text, replyToId } = {}) =>
    http.upload(`/api/chat/conversations/${id}/attachments`, file, { extra: { text, replyToId } }),
  setClosed: (id, closed) => http.put(`/api/chat/conversations/${id}/closed`, { closed }),
};

// PaymentController — оплата переводом: реквизиты, чеки клиента, проверка чеков сотрудником.
export const paymentsApi = {
  settings: () => http.get('/api/payments/settings'),
  updateSettings: (dto) => http.put('/api/payments/settings', dto),
  myProofs: (orderId) => http.get(`/api/orders/my/${orderId}/payment-proofs`),
  uploadProof: (orderId, file, { amount, comment } = {}) =>
    http.upload(`/api/orders/my/${orderId}/payment-proofs`, file, { extra: { amount, comment } }),
  proofs: (orderId) => http.get(`/api/orders/${orderId}/payment-proofs`),
  approve: (proofId, amount) => http.post(`/api/payment-proofs/${proofId}/approve`, { amount }),
  reject: (proofId, reason) => http.post(`/api/payment-proofs/${proofId}/reject`, { reason }),
};

// Согласование макета: менеджер загружает макет, клиент одобряет или просит правки.
export const layoutsApi = {
  list: (orderId) => http.get(`/api/orders/${orderId}/layouts`),
  upload: (orderId, file, note) => http.upload(`/api/orders/${orderId}/layouts`, file, { extra: { note } }),
  mine: (orderId) => http.get(`/api/orders/my/${orderId}/layouts`),
  approve: (orderId, layoutId) => http.post(`/api/orders/my/${orderId}/layouts/${layoutId}/approve`),
  requestChanges: (orderId, layoutId, comment) =>
    http.post(`/api/orders/my/${orderId}/layouts/${layoutId}/request-changes`, { comment }),
};

/** Проверка промокода покупателем: { id, code, discountType, discountValue } или ошибка с понятным текстом. */
export const promoCheckApi = {
  validate: (code) => http.get('/api/promo-codes/validate', { code }),
};
