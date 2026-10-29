import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateQuote,
  combos,
  products,
} from "../src/index.ts";

const individual = (quantity) => ({
  selectionType: "product",
  selectionId: "esencial",
  quantity,
});

test("keeps the existing individual product prices and combo offers", () => {
  assert.deepEqual(
    products.map(({ id, priceCents }) => [id, priceCents]),
    [
      ["esencial", 303],
      ["confort", 424],
      ["luxury", 472],
      ["bio-luxe", 472],
    ],
  );
  assert.deepEqual(
    combos.map(({ id, priceCents, units }) => [id, priceCents, units]),
    [
      ["prueba", 4300, 10],
      ["profesional", 6450, 15],
      ["surtido", 6300, 15],
    ],
  );
});

test("applies no discount for 5 or 10 individual units", () => {
  for (const quantity of [5, 10]) {
    const quote = calculateQuote([individual(quantity)]);
    assert.equal(quote.individualUnits, quantity);
    assert.equal(quote.discountCents, 0);
    assert.equal(quote.subtotalCents, quantity * 303);
    assert.equal(quote.totalCents, quantity * 303);
  }
});

test("applies 15 percent from 11 individual units", () => {
  const quote = calculateQuote([individual(11)]);
  assert.equal(quote.individualUnits, 11);
  assert.equal(quote.subtotalCents, 3333);
  assert.equal(quote.discountCents, 500);
  assert.equal(quote.totalCents, 2833);
});

test("applies 15 percent to 20 individual units", () => {
  const quote = calculateQuote([individual(20)]);
  assert.equal(quote.subtotalCents, 6060);
  assert.equal(quote.discountCents, 909);
  assert.equal(quote.totalCents, 5151);
});

test("combo units do not count toward the threshold and combos are never discounted", () => {
  const belowThreshold = calculateQuote([
    individual(10),
    { selectionType: "combo", selectionId: "prueba", quantity: 1 },
  ]);
  assert.equal(belowThreshold.totalUnits, 20);
  assert.equal(belowThreshold.individualUnits, 10);
  assert.equal(belowThreshold.discountCents, 0);
  assert.equal(belowThreshold.items[1].discountCents, 0);
  assert.equal(belowThreshold.items[1].totalCents, 4300);

  const aboveThreshold = calculateQuote([
    individual(11),
    { selectionType: "combo", selectionId: "prueba", quantity: 1 },
  ]);
  assert.equal(aboveThreshold.individualUnits, 11);
  assert.equal(aboveThreshold.totalUnits, 21);
  assert.equal(aboveThreshold.subtotalCents, 7633);
  assert.equal(aboveThreshold.discountCents, 500);
  assert.equal(aboveThreshold.totalCents, 7133);
  assert.equal(aboveThreshold.items[1].discountCents, 0);
  assert.equal(aboveThreshold.items[1].totalCents, 4300);
  assert.equal(
    aboveThreshold.items.reduce((sum, item) => sum + item.totalCents, 0),
    aboveThreshold.totalCents,
  );
});

test("rejects unknown, repeated, and invalid selections", () => {
  assert.throws(
    () => calculateQuote([{ ...individual(1), selectionId: "unknown" }]),
    /Producto no válido/,
  );
  assert.throws(
    () => calculateQuote([individual(1), individual(2)]),
    /una sola vez/,
  );
  assert.throws(() => calculateQuote([individual(0)]), /entero/);
});
