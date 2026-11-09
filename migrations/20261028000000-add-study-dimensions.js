'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('Paintings')
    for (const name of ['depth', 'diameter']) {
      if (!columns[name]) {
        await queryInterface.addColumn('Paintings', name, {
          type: Sequelize.DOUBLE,
          allowNull: true
        })
      }
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('Paintings')
    for (const name of ['depth', 'diameter']) {
      if (columns[name]) await queryInterface.removeColumn('Paintings', name)
    }
  }
}
