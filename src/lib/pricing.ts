// Catalog pricing rules, shared by the browser and the server so the numbers
// staff see are exactly the ones the server enforces.

/** Lowest price per unit staff may bill: list price less the item's max discount (rounded up to the paisa). */
export function minPricePaise(pricePaise: number, maxDiscountPercent: number) {
  return Math.ceil((pricePaise * (100 - maxDiscountPercent)) / 100);
}

/** Discount given, as a whole percent of the list price (0 when billed at list). */
export function discountPercent(listPaise: number, unitPaise: number) {
  if (listPaise <= 0 || unitPaise >= listPaise) return 0;
  return Math.round(((listPaise - unitPaise) / listPaise) * 100);
}
