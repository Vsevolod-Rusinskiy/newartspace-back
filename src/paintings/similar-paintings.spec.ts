import {
  rankSimilarPaintings,
  SimilarPaintingCandidate
} from './similar-paintings'

const painting = (
  id: number,
  values: Partial<SimilarPaintingCandidate> = {}
): SimilarPaintingCandidate => ({
  id,
  artistId: id,
  theme: `theme-${id}`,
  artType: `type-${id}`,
  color: `color-${id}`,
  artStyle: 'Современность',
  priority: 0,
  isHidden: false,
  attributes: [],
  ...values
})

describe('rankSimilarPaintings', () => {
  const source = painting(1, {
    artistId: 10,
    theme: ' Пейзаж ',
    artType: 'Живопись',
    color: 'Синий',
    attributes: [
      {
        value: ' Море ',
        PaintingAttributes: { type: 'themesList' }
      },
      {
        value: 'Голубой',
        PaintingAttributes: { type: 'colorsList' }
      }
    ]
  })

  it('uses the fixed seven-group order with normalized values', () => {
    const candidates = [
      painting(8, { priority: 100 }),
      painting(7, { artistId: 10 }),
      painting(6, { color: ' голубой ' }),
      painting(5, { artType: ' живопись ' }),
      painting(4, { artistId: 10, artType: 'ЖИВОПИСЬ' }),
      painting(3, { theme: 'море' }),
      painting(2, { artistId: 10, theme: 'ПЕЙЗАЖ' })
    ]

    expect(
      rankSimilarPaintings(source, candidates).map(({ id }) => id)
    ).toEqual([2, 3, 4, 5, 6, 7, 8])
  })

  it('orders same-art-style candidates before applying groups to fallback art styles', () => {
    const fallbackStrongMatch = painting(2, {
      artistId: 10,
      theme: 'Пейзаж',
      artStyle: 'Традиции'
    })
    const sameStyleFallback = painting(3, { priority: 0 })

    expect(
      rankSimilarPaintings(source, [
        fallbackStrongMatch,
        sameStyleFallback
      ]).map(({ id }) => id)
    ).toEqual([3, 2])
  })

  it('uses additional matches, priority, and id as deterministic tie-breakers', () => {
    const moreMatches = painting(4, {
      theme: 'Пейзаж',
      artType: 'Живопись',
      color: 'Синий',
      priority: 0
    })
    const highPriority = painting(3, { theme: 'Пейзаж', priority: 10 })
    const lowId = painting(2, { theme: 'Пейзаж', priority: 10 })

    expect(
      rankSimilarPaintings(source, [highPriority, moreMatches, lowId]).map(
        ({ id }) => id
      )
    ).toEqual([4, 2, 3])
  })

  it('excludes the source, hidden records, duplicates, and caps the limit at 20', () => {
    const candidates = [
      source,
      painting(2, { isHidden: true }),
      painting(3),
      painting(3, { priority: 100 }),
      ...Array.from({ length: 25 }, (_, index) => painting(index + 4))
    ]

    const result = rankSimilarPaintings(source, candidates, 50)

    expect(result).toHaveLength(20)
    expect(result.map(({ id }) => id)).not.toContain(1)
    expect(result.map(({ id }) => id)).not.toContain(2)
    expect(result.filter(({ id }) => id === 3)).toHaveLength(1)
  })
})
