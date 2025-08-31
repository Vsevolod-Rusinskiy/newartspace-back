'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // Удаляем старое поле status с ENUM
    await queryInterface.removeColumn('Orders', 'status')

    // Добавляем новое поле statusId
    await queryInterface.addColumn('Orders', 'statusId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1, // ID статуса NEW
      references: {
        model: 'OrderStatuses',
        key: 'id'
      }
    })
  },

  async down(queryInterface, Sequelize) {
    // Удаляем поле statusId
    await queryInterface.removeColumn('Orders', 'statusId')

    // Возвращаем старое поле status
    await queryInterface.addColumn('Orders', 'status', {
      type: Sequelize.ENUM(
        'NEW',
        'PENDING',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED'
      ),
      defaultValue: 'NEW',
      allowNull: false
    })
  }
}
