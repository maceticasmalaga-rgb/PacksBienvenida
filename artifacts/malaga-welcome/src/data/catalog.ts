import {
  combos as quoteCombos,
  products as quoteProducts,
} from '@workspace/catalog';

export type Product = {
  id: string;
  name: string;
  displayName: string;
  price: number;
  composition: string;
  image: string;
  stock: number | null;
};

export type Combo = {
  id: string;
  name: string;
  price: number;
  units: number;
  composition: { productId: string; quantity: number }[];
  stock: number | null;
};

export const products: Product[] = [
  ...quoteProducts.map((product) => ({
    ...product,
    price: product.priceCents / 100,
    image: `/images/pack-${product.id === 'esencial' ? 'esencial-bandeja-biorganical' : product.id === 'confort' ? 'confort-set-higiene-ecorganic' : product.id === 'luxury' ? 'luxury-kit-higiene-bio-luxury' : 'bio-luxe-neceser-bio-luxe'}.jpg`,
    stock: null,
  })),
];

export const combos: Combo[] = quoteCombos.map((combo) => ({
  ...combo,
  price: combo.priceCents / 100,
  stock: null,
}));

export const productById = (id: string) => products.find((product) => product.id === id);
export const formatEuro = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
