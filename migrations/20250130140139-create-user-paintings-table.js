'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserPaintings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      paintingId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Paintings',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.ENUM('favorite', 'cart'),
        allowNull: false
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

    // Добавляем составной индекс для уникальности комбинации userId, paintingId и type
    await queryInterface.addIndex(
      'UserPaintings',
      ['userId', 'paintingId', 'type'],
      {
        unique: true,
        name: 'user_painting_type_unique'
      }
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('UserPaintings')
  }
}
