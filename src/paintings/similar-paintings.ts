export interface SimilarPaintingAttribute {
  value?: string
  PaintingAttributes?: { type?: string }
  paintingAttributes?: { type?: string }
  dataValues?: Record<string, unknown>
}

export interface SimilarPaintingCandidate {
  id: number
  artistId?: number
  theme?: string
  artType?: string
  color?: string
  artStyle?: string
  priority?: number
  isHidden?: boolean
  attributes?: SimilarPaintingAttribute[]
  dataValues?: Record<string, unknown>
  toJSON?: () => Record<string, unknown>
}

interface RankingMetadata {
  candidate: SimilarPaintingCandidate
  group: number
  additionalMatches: number
  sameArtStyle: boolean
}

const normalize = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const asPlain = (
  painting: SimilarPaintingCandidate
): SimilarPaintingCandidate => {
  if (typeof painting.toJSON === 'function') {
    return painting.toJSON() as unknown as SimilarPaintingCandidate
  }
  return painting
}

const getAttributeType = (attribute: SimilarPaintingAttribute): string => {
  const dataValues = attribute.dataValues || {}
  const through =
    attribute.PaintingAttributes ||
    attribute.paintingAttributes ||
    (dataValues.PaintingAttributes as { type?: string } | undefined) ||
    (dataValues.paintingAttributes as { type?: string } | undefined)
  return normalize(through?.type)
}

const getAttributeValue = (attribute: SimilarPaintingAttribute): string =>
  normalize(attribute.value ?? attribute.dataValues?.value)

const createValueSet = (
  painting: SimilarPaintingCandidate,
  primaryField: 'theme' | 'color',
  associationType: 'themeslist' | 'colorslist'
): Set<string> => {
  const values = new Set<string>()
  const primary = normalize(painting[primaryField])
  if (primary) values.add(primary)

  for (const attribute of painting.attributes || []) {
    if (getAttributeType(attribute) !== associationType) continue
    const value = getAttributeValue(attribute)
    if (value) values.add(value)
  }

  return values
}

const intersectionSize = (left: Set<string>, right: Set<string>): number => {
  let matches = 0
  left.forEach((value) => {
    if (right.has(value)) matches += 1
  })
  return matches
}

const createMetadata = (
  source: SimilarPaintingCandidate,
  candidate: SimilarPaintingCandidate
): RankingMetadata => {
  const sourceThemes = createValueSet(source, 'theme', 'themeslist')
  const candidateThemes = createValueSet(candidate, 'theme', 'themeslist')
  const sourceColors = createValueSet(source, 'color', 'colorslist')
  const candidateColors = createValueSet(candidate, 'color', 'colorslist')
  const themeMatches = intersectionSize(sourceThemes, candidateThemes)
  const colorMatches = intersectionSize(sourceColors, candidateColors)
  const sameArtType =
    normalize(source.artType) !== '' &&
    normalize(source.artType) === normalize(candidate.artType)
  const sameArtist =
    source.artistId !== undefined && source.artistId === candidate.artistId

  let group = 6
  if (themeMatches > 0 && sameArtist) group = 0
  else if (themeMatches > 0) group = 1
  else if (sameArtType && sameArtist) group = 2
  else if (sameArtType) group = 3
  else if (colorMatches > 0) group = 4
  else if (sameArtist) group = 5

  return {
    candidate,
    group,
    additionalMatches: themeMatches + colorMatches + Number(sameArtType),
    sameArtStyle: normalize(source.artStyle) === normalize(candidate.artStyle)
  }
}

const compareMetadata = (left: RankingMetadata, right: RankingMetadata) => {
  if (left.group !== right.group) return left.group - right.group
  if (left.additionalMatches !== right.additionalMatches) {
    return right.additionalMatches - left.additionalMatches
  }

  const priorityDifference =
    (Number(right.candidate.priority) || 0) -
    (Number(left.candidate.priority) || 0)
  if (priorityDifference !== 0) return priorityDifference
  return Number(left.candidate.id) - Number(right.candidate.id)
}

export const rankSimilarPaintings = <T extends SimilarPaintingCandidate>(
  sourcePainting: T,
  candidatePaintings: T[],
  requestedLimit = 20
): T[] => {
  const source = asPlain(sourcePainting)
  const uniqueCandidates = new Map<number, T>()

  for (const candidate of candidatePaintings) {
    const plainCandidate = asPlain(candidate)
    const id = Number(plainCandidate.id)
    if (
      !Number.isInteger(id) ||
      id === Number(source.id) ||
      plainCandidate.isHidden === true ||
      uniqueCandidates.has(id)
    ) {
      continue
    }
    uniqueCandidates.set(id, candidate)
  }

  const ranked = [...uniqueCandidates.values()].map((candidate) =>
    createMetadata(source, asPlain(candidate))
  )
  const sameArtStyle = ranked
    .filter((item) => item.sameArtStyle)
    .sort(compareMetadata)
  const otherArtStyles = ranked
    .filter((item) => !item.sameArtStyle)
    .sort(compareMetadata)
  const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 0, 0), 20)

  return [...sameArtStyle, ...otherArtStyles]
    .slice(0, limit)
    .map(({ candidate }) => candidate as T)
}
