import { DataTypes } from 'sequelize'

it('adds only nullable fractional dimensions and can be applied twice', async () => {
  const columns: Record<string, unknown> = {
    id: { primaryKey: true },
    title: { type: 'VARCHAR' }
  }
  const queryInterface = {
    describeTable: jest.fn(async () => ({ ...columns })),
    addColumn: jest.fn(
      async (_table: string, name: string, definition: unknown) => {
        columns[name] = definition
      }
    )
  }
  const migration = jest.requireActual(
    '../../migrations/20261028000000-add-study-dimensions.js'
  )
  await migration.up(queryInterface, DataTypes)
  await migration.up(queryInterface, DataTypes)
  expect(queryInterface.addColumn).toHaveBeenCalledTimes(2)
  expect(columns).toMatchObject({
    id: { primaryKey: true },
    title: { type: 'VARCHAR' },
    depth: { allowNull: true, type: DataTypes.DOUBLE },
    diameter: { allowNull: true, type: DataTypes.DOUBLE }
  })
})
