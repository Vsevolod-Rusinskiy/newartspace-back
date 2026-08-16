'use strict'

const TABLES_WITH_UNUSED_SLUG = ['Paintings', 'Artists']

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const tableName of TABLES_WITH_UNUSED_SLUG) {
      const columns = await queryInterface.describeTable(tableName)
      if (!columns.slug) continue

      await queryInterface.removeColumn(tableName, 'slug')
    }
  },

  async down(queryInterface, Sequelize) {
    for (const tableName of TABLES_WITH_UNUSED_SLUG) {
      const columns = await queryInterface.describeTable(tableName)
      if (columns.slug) continue

      await queryInterface.addColumn(tableName, 'slug', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }
  }
}
