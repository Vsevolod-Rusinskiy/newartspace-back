'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Добавить новую колонку isChecked с значением по умолчанию false
    await queryInterface.addColumn('Attributes', 'isChecked', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    })
  },

  down: async (queryInterface, Sequelize) => {
    // Удалить колонку isChecked
    await queryInterface.removeColumn('Attributes', 'isChecked')
  }
}
