'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Paintings', 'materials')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Paintings', 'materials', {
      type: Sequelize.STRING,
      allowNull: true
    })
  }
}
