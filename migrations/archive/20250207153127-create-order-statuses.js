'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // Создаем таблицу статусов
    await queryInterface.createTable('OrderStatuses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      displayName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      color: {
        type: Sequelize.STRING,
        allowNull: true
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    // Добавляем базовые статусы
    await queryInterface.bulkInsert('OrderStatuses', [
      {
        name: 'NEW',
        displayName: 'Новый',
        description: 'Заказ только что создан',
        color: '#3498db',
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'PENDING',
        displayName: 'Ожидает оплаты',
        description: 'Ожидается оплата заказа',
        color: '#f1c40f',
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'PROCESSING',
        displayName: 'В обработке',
        description: 'Заказ обрабатывается',
        color: '#e67e22',
        sortOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'SHIPPED',
        displayName: 'Отправлен',
        description: 'Заказ отправлен',
        color: '#2ecc71',
        sortOrder: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'DELIVERED',
        displayName: 'Доставлен',
        description: 'Заказ доставлен',
        color: '#27ae60',
        sortOrder: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'CANCELLED',
        displayName: 'Отменен',
        description: 'Заказ отменен',
        color: '#e74c3c',
        sortOrder: 6,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'REFUNDED',
        displayName: 'Возврат',
        description: 'Оформлен возврат',
        color: '#c0392b',
        sortOrder: 7,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ])
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('OrderStatuses')
  }
}
