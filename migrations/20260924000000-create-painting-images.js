'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables()
    if (!tables.includes('PaintingImages')) {
      await queryInterface.createTable('PaintingImages', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        paintingId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Paintings', key: 'id' },
          onDelete: 'CASCADE'
        },
        imgUrl: { type: Sequelize.STRING, allowNull: false },
        position: { type: Sequelize.INTEGER, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      })
    }
    const indexes = await queryInterface.showIndex('PaintingImages')
    if (
      !indexes.some(
        (index) => index.name === 'painting_images_painting_id_img_url_unique'
      )
    ) {
      await queryInterface.addIndex(
        'PaintingImages',
        ['paintingId', 'imgUrl'],
        {
          name: 'painting_images_painting_id_img_url_unique',
          unique: true
        }
      )
    }
    if (
      !indexes.some(
        (index) => index.name === 'painting_images_painting_id_position_unique'
      )
    ) {
      await queryInterface.addIndex(
        'PaintingImages',
        ['paintingId', 'position'],
        {
          name: 'painting_images_painting_id_position_unique',
          unique: true
        }
      )
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables()
    if (tables.includes('PaintingImages'))
      await queryInterface.dropTable('PaintingImages')
  }
}
