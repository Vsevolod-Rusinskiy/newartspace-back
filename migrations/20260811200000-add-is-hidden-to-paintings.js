'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('Paintings')
    if (columns.isHidden) return

    await queryInterface.addColumn('Paintings', 'isHidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    })
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('Paintings')
    if (!columns.isHidden) return

    await queryInterface.removeColumn('Paintings', 'isHidden')
  }
}
