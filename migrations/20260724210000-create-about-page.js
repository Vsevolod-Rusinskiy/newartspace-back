'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AboutPage', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      imgUrl: {
        type: Sequelize.STRING,
        allowNull: true
      },
      mainText: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      additionalText1: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      additionalText2: {
        type: Sequelize.TEXT,
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
    await queryInterface.dropTable('AboutPage')
  }
}
