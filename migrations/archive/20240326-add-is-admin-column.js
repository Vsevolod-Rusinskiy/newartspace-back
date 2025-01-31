'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'isAdmin', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    })

    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET "isAdmin" = false
      WHERE "isAdmin" IS NULL
    `)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'isAdmin')
  }
}
