'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameColumn('Paintings', 'name', 'title');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameColumn('Paintings', 'title', 'name');
  }
};
