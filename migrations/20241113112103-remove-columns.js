'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Paintings', 'theme')
    await queryInterface.removeColumn('Paintings', 'techniques')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Paintings', 'theme', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('Paintings', 'techniques', {
      type: Sequelize.STRING,
      allowNull: true
    })
  }
}
