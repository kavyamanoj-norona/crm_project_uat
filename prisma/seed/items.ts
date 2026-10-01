// Starter item catalog (Master Settings → Manage → Items). Created once;
// prices and discounts edited in the UI are never overwritten by a re-seed.
// Prices are in paise.
export const DEFAULT_ITEMS = [
  { code: "SV-DIAG", name: "Diagnosis charge", type: "SERVICE", category: "Diagnosis", unit: "Job", hsnSac: "998716", gstPercent: 18, pricePaise: 30000, maxDiscountPercent: 100 },
  { code: "SV-CLN", name: "Thermal service + cleaning", type: "SERVICE", category: "Cleaning", unit: "Job", hsnSac: "998716", gstPercent: 18, pricePaise: 65000, maxDiscountPercent: 10, warrantyDays: 30 },
  { code: "SV-OS", name: "OS installation + drivers", type: "SERVICE", category: "Software", unit: "Job", hsnSac: "998716", gstPercent: 18, pricePaise: 80000, maxDiscountPercent: 10 },
  { code: "SV-CHIP", name: "Chip-level board repair", type: "SERVICE", category: "Board repair", unit: "Job", hsnSac: "998716", gstPercent: 18, pricePaise: 450000, maxDiscountPercent: 5, warrantyDays: 90 },
  { code: "KB-DELL-5518", name: "Keyboard replacement — Dell Inspiron 5518", type: "PART", category: "Keyboard", brand: "Dell", unit: "Nos", hsnSac: "84716060", gstPercent: 18, pricePaise: 290000, maxDiscountPercent: 10, warrantyDays: 90 },
  { code: "SSD-512-NVME", name: "512 GB NVMe SSD", type: "PART", category: "Storage", unit: "Nos", hsnSac: "84717020", gstPercent: 18, pricePaise: 385000, maxDiscountPercent: 8, warrantyDays: 365 },
  { code: "DP-156-FHD30", name: "15.6″ FHD display panel (30-pin)", type: "PART", category: "Display", unit: "Nos", hsnSac: "85249100", gstPercent: 18, pricePaise: 620000, maxDiscountPercent: 10, warrantyDays: 180 },
  { code: "AD-65W-USBC", name: "65W USB-C adapter", type: "ACCESSORY", category: "Adapter", unit: "Nos", hsnSac: "85044030", gstPercent: 18, pricePaise: 165000, maxDiscountPercent: 10, warrantyDays: 180 },
] as const;
