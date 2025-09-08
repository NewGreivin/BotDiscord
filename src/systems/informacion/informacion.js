const { EmbedBuilder } = require('discord.js');
const { INFORMACION_CHANNEL_ID } = require('@/utils/constantsUtil');

function crearInformacionEmbed() {
    return new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Información de FlowMC')
        .setDescription(
            `<:flowMc:1362871535102328925> **IP:** flowmc.us\n` +
            `<:dinero:1362649147789938851> **Tienda:** [tienda.flowmc.us](https://tienda.flowmc.us/)\n` +
            `<:bedrock:1345178129211199518> **Puerto:** 19132`
        );
}

async function enviarInformacionSiNoExiste(client) {
    try {
        const canal = await client.channels.fetch(INFORMACION_CHANNEL_ID);
        if (!canal) return console.error('Canal de información no encontrado');

        const mensajes = await canal.messages.fetch({ limit: 1});
        const yaExiste = mensajes.some(msg =>
            msg.author.id === client.user.id && msg.embeds.length > 0
        );

        if (!yaExiste) await canal.send({ embeds: [crearInformacionEmbed()] });

    } catch (error) {
        console.error('Error: Mensaje de información ya existe, no se envía:', error);
    }
}

module.exports = { enviarInformacionSiNoExiste };