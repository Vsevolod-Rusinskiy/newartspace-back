'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Добавляем колонку artistId в таблицу Paintings
    await queryInterface.addColumn('Paintings', 'artistId', {
      type: Sequelize.INTEGER,
      allowNull: true,  // Разрешаем временно null для плавного перехода
      references: {
        model: 'Artists',  // Имя таблицы художников
        key: 'id',         // Поле в таблице Artists, на которое ссылаемся
      },
      onUpdate: 'CASCADE',  // Если id художника изменится, обновим его в картинах
      onDelete: 'SET NULL',  // Если художник удалён, поле artistId станет null
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Удаляем колонку artistId, если откатываем миграцию
    await queryInterface.removeColumn('Paintings', 'artistId');
  }
};