import { Link } from '../lib/router.jsx';
import { money, nameOf } from '../lib/format.js';
import { Img } from './ui.jsx';

export default function ProductCard({ product, categoryName }) {
  return (
    <Link to={`/product/${product.id}`} className="product-card">
      <div className="product-card__media">
        <Img src={product.mainImageUrl} alt={nameOf(product)} className="product-card__img" />
        {product.requiresPhotoUpload && <span className="product-card__tag">С вашим фото</span>}
        <span className="sticker-price">
          <span className="sticker-price__from">от</span>
          {Number(product.basePrice).toLocaleString('ru-RU')}
          <span className="sticker-price__unit">смн</span>
        </span>
      </div>
      <div className="product-card__body">
        {categoryName && <span className="product-card__cat">{categoryName}</span>}
        <span className="product-card__name">{nameOf(product)}</span>
        <span className="product-card__price">от {money(product.basePrice)}</span>
      </div>
    </Link>
  );
}
