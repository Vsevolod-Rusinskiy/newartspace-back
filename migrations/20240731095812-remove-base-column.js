/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Paintings', 'base');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Paintings', 'base', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
