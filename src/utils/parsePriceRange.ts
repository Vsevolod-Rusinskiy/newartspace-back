export function parsePriceRange(priceRange: string): {
  min: number
  max: number
} {
  const ranges = {
    'до 10 000 руб.': { min: 0, max: 10000 },
    '10 000 - 50 000 руб.': { min: 10000, max: 50000 },
    '50 000 - 100 000 руб.': { min: 50000, max: 100000 },
    '100 000 - 150 000 руб.': { min: 100000, max: 150000 },
    '150 000 - 250 000 руб.': { min: 150000, max: 250000 },
    '250 000 - 300 000 руб.': { min: 250000, max: 300000 },
    'свыше 300 000 руб.': { min: 300000, max: Number.MAX_SAFE_INTEGER }
  }
  return ranges[priceRange] || { min: 0, max: Number.MAX_SAFE_INTEGER }
}
