import { DataTypes } from 'sequelize'

type ColumnDefinition = {
  allowNull?: boolean
  type?: unknown
}

type Schema = Record<string, Record<string, ColumnDefinition>>

type Migration = {
  up: (queryInterface: FakeQueryInterface) => Promise<void>
  down: (
    queryInterface: FakeQueryInterface,
    sequelize: typeof DataTypes
  ) => Promise<void>
}

class FakeQueryInterface {
  constructor(private readonly schema: Schema) {}

  async describeTable(tableName: string) {
    return this.schema[tableName]
  }

  async removeColumn(tableName: string, columnName: string) {
    delete this.schema[tableName][columnName]
  }

  async addColumn(
    tableName: string,
    columnName: string,
    definition: ColumnDefinition
  ) {
    this.schema[tableName][columnName] = definition
  }
}

const loadMigration = () =>
  jest.requireActual<Migration>(
    '../../migrations/20260814000000-remove-unused-slug-fields.js'
  )

describe('remove unused slug fields migration', () => {
  it('removes slug from paintings and artists without touching other columns', async () => {
    const schema: Schema = {
      Paintings: { id: {}, title: {}, slug: { allowNull: false } },
      Artists: { id: {}, name: {}, slug: { allowNull: false } }
    }
    const migration = loadMigration()

    await migration.up(new FakeQueryInterface(schema))

    expect(schema).toEqual({
      Paintings: { id: {}, title: {} },
      Artists: { id: {}, name: {} }
    })
  })

  it('is safe to run when slug fields are already absent', async () => {
    const schema: Schema = {
      Paintings: { id: {}, title: {} },
      Artists: { id: {}, name: {} }
    }
    const migration = loadMigration()

    await expect(
      migration.up(new FakeQueryInterface(schema))
    ).resolves.toBeUndefined()
    expect(schema).toEqual({
      Paintings: { id: {}, title: {} },
      Artists: { id: {}, name: {} }
    })
  })

  it('restores only nullable fields on rollback', async () => {
    const schema: Schema = {
      Paintings: { id: {}, title: {} },
      Artists: { id: {}, name: {} }
    }
    const migration = loadMigration()

    await migration.down(new FakeQueryInterface(schema), DataTypes)

    expect(schema.Paintings.slug).toMatchObject({ allowNull: true })
    expect(schema.Artists.slug).toMatchObject({ allowNull: true })
  })
})
