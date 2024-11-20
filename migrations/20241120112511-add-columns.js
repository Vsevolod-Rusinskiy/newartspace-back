'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Paintings', 'material', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('Paintings', 'theme', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('Paintings', 'technique', {
      type: Sequelize.STRING,
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Paintings', 'material')
    await queryInterface.removeColumn('Paintings', 'theme')
    await queryInterface.removeColumn('Paintings', 'technique')
  }
}
