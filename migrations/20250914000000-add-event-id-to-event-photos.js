"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("EventsPhotos", "eventId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Events",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("EventsPhotos", "eventId")
  }
}
