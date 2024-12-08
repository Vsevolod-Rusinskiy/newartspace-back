'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('"Paintings"', 'isReproducible', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    })

    // Обновление существующих записей
    await queryInterface.sequelize.query(`
      UPDATE "Paintings"
      SET "isReproducible" = false
      WHERE "isReproducible" IS NULL
    `)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('"Paintings"', 'isReproducible')
  }
}
