import { DataTypes } from 'sequelize'

type Index = { name: string }
class QueryInterface {
  tables: string[] = ['Paintings']
  indexes: Index[] = []
  tableDefinition: Record<string, any> | undefined
  createTable = jest.fn(
    async (name: string, definition: Record<string, any>) => {
      this.tables.push(name)
      this.tableDefinition = definition
    }
  )
  dropTable = jest.fn(async (name: string) => {
    this.tables = this.tables.filter((table) => table !== name)
  })
  showAllTables = jest.fn(async () => this.tables)
  showIndex = jest.fn(async () => this.indexes)
  addIndex = jest.fn(
    async (_table: string, _fields: string[], options: Index) =>
      this.indexes.push(options)
  )
}

const migration = () =>
  jest.requireActual(
    '../../migrations/20260924000000-create-painting-images.js'
  )

describe('create painting images migration', () => {
  it('creates its table and named indexes idempotently, then removes it', async () => {
    const queryInterface = new QueryInterface()
    await migration().up(queryInterface, DataTypes)
    await migration().up(queryInterface, DataTypes)
    expect(queryInterface.createTable).toHaveBeenCalledTimes(1)
    expect(queryInterface.tableDefinition).toMatchObject({
      id: { primaryKey: true, autoIncrement: true },
      paintingId: { allowNull: false, onDelete: 'CASCADE' },
      imgUrl: { allowNull: false },
      position: { allowNull: false },
      createdAt: { allowNull: false },
      updatedAt: { allowNull: false }
    })
    expect(queryInterface.indexes.map(({ name }) => name)).toEqual([
      'painting_images_painting_id_img_url_unique',
      'painting_images_painting_id_position_unique'
    ])
    await migration().down(queryInterface)
    expect(queryInterface.tables).not.toContain('PaintingImages')
  })
})
