'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('Paintings', 'paintingUrl', 'imgUrl');
    await queryInterface.renameColumn('Artists', 'artistUrl', 'imgUrl');
  },

  async down(queryInterface) {
    await queryInterface.renameColumn('Paintings', 'imgUrl', 'paintingUrl');
    await queryInterface.renameColumn('Artists', 'imgUrl', 'artistUrl');
  }
};
