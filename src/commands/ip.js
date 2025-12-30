const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { JAVA_IP, BEDROCK_IP, BEDROCK_PUERTO } = require('@/utils/constansUtil');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ip')
        .setDescription('Muestra la información del servidor de Minecraft'),

    async execute(interaction, returnEmbed = false) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#00AEEF')
                .setTitle('🌐 INFORMACIÓN SERVIDOR')
                .setDescription(
                    `🟡 **JAVA:** ${JAVA_IP || 'minegold.us'}\n` +
                    `🔷 **BEDROCK:** ${BEDROCK_IP || 'minegold.us'} / **PUERTO:** ${BEDROCK_PUERTO || '19132'}`
                )
                .setTimestamp()
                .setFooter({ 
                    text: 'MineGold Network',
                    iconURL: interaction ? interaction.client.user.displayAvatarURL() : undefined
                });

            // Si se llama desde comando con prefijo, retornar el embed
            if (returnEmbed) {
                return embed;
            }

            // Si es slash command, responder normalmente
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[Comando IP] Error:', error);
            
            if (interaction && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al mostrar la información del servidor.',
                    flags: 64
                }).catch(() => {});
            }
            
            if (returnEmbed) {
                throw error;
            }
        }
    }
};
