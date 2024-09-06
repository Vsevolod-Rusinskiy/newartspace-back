'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('Paintings', 'author');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Paintings', 'author', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};
