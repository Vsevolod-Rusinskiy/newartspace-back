import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { SimilarPaintingsQueryDto } from './similar-paintings-query.dto'

describe('SimilarPaintingsQueryDto', () => {
  it('defaults to 20 and accepts integer limits from 1 through 20', async () => {
    const defaultQuery = plainToInstance(SimilarPaintingsQueryDto, {})
    const explicitQuery = plainToInstance(SimilarPaintingsQueryDto, {
      limit: '1'
    })

    await expect(validate(defaultQuery)).resolves.toHaveLength(0)
    await expect(validate(explicitQuery)).resolves.toHaveLength(0)
    expect(defaultQuery.limit).toBe(20)
    expect(explicitQuery.limit).toBe(1)
  })

  it.each(['0', '21', '1.5', 'invalid'])('rejects limit %s', async (limit) => {
    const query = plainToInstance(SimilarPaintingsQueryDto, { limit })
    await expect(validate(query)).resolves.not.toHaveLength(0)
  })
})
