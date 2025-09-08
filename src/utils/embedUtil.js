const { EmbedBuilder } = require('discord.js');

function crearEmbed(title, description, color = 0xA259FF) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: 'Copyright © 2025 | FlowMC Network' })
        .setTimestamp();
}

module.exports = { crearEmbed };