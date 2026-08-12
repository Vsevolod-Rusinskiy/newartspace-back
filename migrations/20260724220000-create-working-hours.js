'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables()
    const exists = tables.some((table) =>
      typeof table === 'string'
        ? table === 'WorkingHours'
        : table.tableName === 'WorkingHours'
    )
    if (exists) return

    await queryInterface.createTable('WorkingHours', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      scheduleText: {
        type: Sequelize.STRING,
        allowNull: true
      },
      appointmentText: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    })
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables()
    const exists = tables.some((table) =>
      typeof table === 'string'
        ? table === 'WorkingHours'
        : table.tableName === 'WorkingHours'
    )
    if (!exists) return

    await queryInterface.dropTable('WorkingHours')
  }
}
