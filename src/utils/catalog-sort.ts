import { BadRequestException } from '@nestjs/common'

export function parseCatalogSort(
  sort: string | undefined,
  order: string | undefined,
  allowedFields: readonly string[]
): { sortField: string; order: 'ASC' | 'DESC' } {
  let field: unknown = 'priority'
  let direction: unknown = order || 'ASC'
  if (sort !== undefined && sort !== '') {
    let parsed: unknown
    try {
      parsed = JSON.parse(sort)
    } catch {
      throw new BadRequestException('Sort must be a JSON pair')
    }
    if (!Array.isArray(parsed) || parsed.length !== 2) {
      throw new BadRequestException('Sort must be a JSON pair')
    }
    ;[field, direction] = parsed
  }
  if (typeof field !== 'string' || !allowedFields.includes(field)) {
    throw new BadRequestException('Unsupported sort field')
  }
  if (direction !== 'ASC' && direction !== 'DESC') {
    throw new BadRequestException('Unsupported sort direction')
  }
  return { sortField: field, order: direction }
}
