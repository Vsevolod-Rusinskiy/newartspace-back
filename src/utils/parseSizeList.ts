export function parseSizeList(sizeList: string[]): {
  heightMin: number
  heightMax: number
  widthMin: number
  widthMax: number
}[] {
  const sizeRanges = {
    'Малый (до 30 × 30 см)': {
      heightMin: 0,
      heightMax: 30,
      widthMin: 0,
      widthMax: 30
    },
    'Средний (до 80 × 80 см)': {
      heightMin: 0,
      heightMax: 80,
      widthMin: 0,
      widthMax: 80
    },
    'Крупный (свыше 80 × 80 см)': {
      heightMin: 80,
      heightMax: Number.MAX_SAFE_INTEGER,
      widthMin: 80,
      widthMax: Number.MAX_SAFE_INTEGER
    },
    'Свыше 150 см': {
      heightMin: 150,
      heightMax: Number.MAX_SAFE_INTEGER,
      widthMin: 150,
      widthMax: Number.MAX_SAFE_INTEGER
    }
  }
  return sizeList.map((size) => sizeRanges[size]).filter(Boolean)
}
