'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Artists', 'artistDescription', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Artists', 'artistDescription', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  }
};
