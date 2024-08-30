'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Paintings', 'priority', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    await queryInterface.addColumn('Artists', 'priority', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Paintings', 'priority');
    await queryInterface.removeColumn('Artists', 'priority');
  }
};

