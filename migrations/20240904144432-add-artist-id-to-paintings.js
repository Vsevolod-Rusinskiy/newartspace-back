'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Добавляем колонку artistId в таблицу Paintings
    await queryInterface.addColumn('Paintings', 'artistId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Artists',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('Paintings', 'artistId');
  }
};