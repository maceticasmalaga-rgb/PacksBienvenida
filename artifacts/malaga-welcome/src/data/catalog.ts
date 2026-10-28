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
  { id: 'esencial', name: 'Pack Esencial', displayName: 'Bandeja Biorganical', price: 3.03, composition: 'Gel de 30 ml, champú de 30 ml y pastilla de jabón en bandeja de hoja de palma.', image: '/images/pack-esencial-bandeja-biorganical.jpg', stock: null },
  { id: 'confort', name: 'Pack Confort', displayName: 'Set Higiene Ecorganic', price: 4.24, composition: 'Gel de 40 ml, champú de 40 ml, leche corporal de 40 ml y pastilla de jabón de 12 g.', image: '/images/pack-confort-set-higiene-ecorganic.jpg', stock: null },
  { id: 'luxury', name: 'Pack Luxury', displayName: 'Kit Higiene Bio Luxury', price: 4.72, composition: 'Gel de 30 ml, champú de 30 ml, pastilla de jabón, esponja natural y set dental.', image: '/images/pack-luxury-kit-higiene-bio-luxury.jpg', stock: null },
  { id: 'bio-luxe', name: 'Pack Bio Luxe', displayName: 'Neceser Bio Luxe', price: 4.72, composition: 'Gel de 30 ml, champú de 30 ml, pastilla de jabón, peine, cepillo dental y sobre de pasta dental.', image: '/images/pack-bio-luxe-neceser-bio-luxe.jpg', stock: null },
];

export const combos: Combo[] = [
  { id: 'prueba', name: 'Prueba', price: 43, units: 10, composition: [{ productId: 'confort', quantity: 4 }, { productId: 'luxury', quantity: 3 }, { productId: 'bio-luxe', quantity: 3 }], stock: null },
  { id: 'profesional', name: 'Profesional', price: 64.5, units: 15, composition: [{ productId: 'confort', quantity: 6 }, { productId: 'luxury', quantity: 5 }, { productId: 'bio-luxe', quantity: 4 }], stock: null },
  { id: 'surtido', name: 'Surtido', price: 63, units: 15, composition: [{ productId: 'esencial', quantity: 3 }, { productId: 'confort', quantity: 4 }, { productId: 'luxury', quantity: 4 }, { productId: 'bio-luxe', quantity: 4 }], stock: null },
];

export const productById = (id: string) => products.find((product) => product.id === id);
export const formatEuro = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
