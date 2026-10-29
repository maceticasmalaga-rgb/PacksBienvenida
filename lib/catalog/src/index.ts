export type SelectionType = "product" | "combo";

export type QuoteSelectionInput = {
  selectionType: SelectionType;
  selectionId: string;
  quantity: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  displayName: string;
  priceCents: number;
  composition: string;
};

export type CatalogCombo = {
  id: string;
  name: string;
  priceCents: number;
  units: number;
  composition: { productId: string; quantity: number }[];
};

export type CalculatedQuoteLine = {
  selectionType: SelectionType;
  selectionId: string;
  name: string;
  quantity: number;
  units: number;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};

export type QuoteCalculation = {
  items: CalculatedQuoteLine[];
  individualUnits: number;
  totalUnits: number;
  subtotalCents: number;
  individualSubtotalCents: number;
  comboSubtotalCents: number;
  discountCents: number;
  totalCents: number;
  discountRate: number;
};

export const individualDiscountThreshold = 11;
export const individualDiscountPercent = 15;

export const products: CatalogProduct[] = [
  {
    id: "esencial",
    name: "Pack Esencial",
    displayName: "Bandeja Biorganical",
    priceCents: 303,
    composition:
      "Gel de 30 ml, champú de 30 ml y pastilla de jabón en bandeja de hoja de palma.",
  },
  {
    id: "confort",
    name: "Pack Confort",
    displayName: "Set Higiene Ecorganic",
    priceCents: 424,
    composition:
      "Gel de 40 ml, champú de 40 ml, leche corporal de 40 ml y pastilla de jabón de 12 g.",
  },
  {
    id: "luxury",
    name: "Pack Luxury",
    displayName: "Kit Higiene Bio Luxury",
    priceCents: 472,
    composition:
      "Gel de 30 ml, champú de 30 ml, pastilla de jabón, esponja natural y set dental.",
  },
  {
    id: "bio-luxe",
    name: "Pack Bio Luxe",
    displayName: "Neceser Bio Luxe",
    priceCents: 472,
    composition:
      "Gel de 30 ml, champú de 30 ml, pastilla de jabón, peine, cepillo dental y sobre de pasta dental.",
  },
];

export const combos: CatalogCombo[] = [
  {
    id: "prueba",
    name: "Prueba",
    priceCents: 4300,
    units: 10,
    composition: [
      { productId: "confort", quantity: 4 },
      { productId: "luxury", quantity: 3 },
      { productId: "bio-luxe", quantity: 3 },
    ],
  },
  {
    id: "profesional",
    name: "Profesional",
    priceCents: 6450,
    units: 15,
    composition: [
      { productId: "confort", quantity: 6 },
      { productId: "luxury", quantity: 5 },
      { productId: "bio-luxe", quantity: 4 },
    ],
  },
  {
    id: "surtido",
    name: "Surtido",
    priceCents: 6300,
    units: 15,
    composition: [
      { productId: "esencial", quantity: 3 },
      { productId: "confort", quantity: 4 },
      { productId: "luxury", quantity: 4 },
      { productId: "bio-luxe", quantity: 4 },
    ],
  },
];

function allocateDiscount(
  items: CalculatedQuoteLine[],
  discountCents: number,
  individualSubtotalCents: number,
): CalculatedQuoteLine[] {
  const productIndexes = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.selectionType === "product");

  if (discountCents === 0 || individualSubtotalCents === 0) {
    return items.map((item) => ({ ...item, totalCents: item.subtotalCents }));
  }

  const shares = productIndexes.map(({ item, index }) => {
    const numerator = discountCents * item.subtotalCents;
    const baseDiscount = Math.floor(numerator / individualSubtotalCents);
    return { index, baseDiscount, remainder: numerator % individualSubtotalCents };
  });
  const unallocated = discountCents - shares.reduce((sum, share) => sum + share.baseDiscount, 0);
  shares
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, unallocated)
    .forEach((share) => {
      share.baseDiscount += 1;
    });

  const discountsByIndex = new Map(shares.map((share) => [share.index, share.baseDiscount]));
  return items.map((item, index) => {
    const lineDiscount = discountsByIndex.get(index) ?? 0;
    return {
      ...item,
      discountCents: lineDiscount,
      totalCents: item.subtotalCents - lineDiscount,
    };
  });
}

export function calculateQuote(
  selections: QuoteSelectionInput[],
): QuoteCalculation {
  if (selections.length === 0) {
    throw new Error("Selecciona al menos un pack o combo.");
  }

  const seen = new Set<string>();
  const lines = selections.map((selection): CalculatedQuoteLine => {
    if (!Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 9999) {
      throw new Error("La cantidad debe ser un entero entre 1 y 9999.");
    }

    const key = `${selection.selectionType}:${selection.selectionId}`;
    if (seen.has(key)) {
      throw new Error("Cada producto o combo debe aparecer una sola vez.");
    }
    seen.add(key);

    if (selection.selectionType === "product") {
      const product = products.find((entry) => entry.id === selection.selectionId);
      if (!product) throw new Error("Producto no válido.");
      const subtotalCents = product.priceCents * selection.quantity;
      return {
        selectionType: "product",
        selectionId: product.id,
        name: product.name,
        quantity: selection.quantity,
        units: selection.quantity,
        unitPriceCents: product.priceCents,
        subtotalCents,
        discountCents: 0,
        totalCents: subtotalCents,
      };
    }

    const combo = combos.find((entry) => entry.id === selection.selectionId);
    if (!combo) throw new Error("Combo no válido.");
    const subtotalCents = combo.priceCents * selection.quantity;
    return {
      selectionType: "combo",
      selectionId: combo.id,
      name: `Combo ${combo.name}`,
      quantity: selection.quantity,
      units: combo.units * selection.quantity,
      unitPriceCents: combo.priceCents,
      subtotalCents,
      discountCents: 0,
      totalCents: subtotalCents,
    };
  });

  const individualUnits = lines.reduce(
    (sum, item) =>
      sum + (item.selectionType === "product" ? item.quantity : 0),
    0,
  );
  const totalUnits = lines.reduce((sum, item) => sum + item.units, 0);
  const individualSubtotalCents = lines.reduce(
    (sum, item) =>
      sum + (item.selectionType === "product" ? item.subtotalCents : 0),
    0,
  );
  const comboSubtotalCents = lines.reduce(
    (sum, item) =>
      sum + (item.selectionType === "combo" ? item.subtotalCents : 0),
    0,
  );
  const subtotalCents = individualSubtotalCents + comboSubtotalCents;
  const discountRate =
    individualUnits >= individualDiscountThreshold
      ? individualDiscountPercent
      : 0;
  const discountCents =
    discountRate === 0
      ? 0
      : Math.round((individualSubtotalCents * discountRate) / 100);
  const calculatedItems = allocateDiscount(
    lines,
    discountCents,
    individualSubtotalCents,
  );

  return {
    items: calculatedItems,
    individualUnits,
    totalUnits,
    subtotalCents,
    individualSubtotalCents,
    comboSubtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    discountRate,
  };
}
