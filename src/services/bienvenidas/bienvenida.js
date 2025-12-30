const { EmbedBuilder, ChannelType, AttachmentBuilder } = require("discord.js");
const { 
    WELCOME_CHANNEL_ID, 
    SHOP_URL, 
    JAVA_IP, 
    BEDROCK_IP, 
    BEDROCK_PUERTO 
} = require('@/utils/constansUtil');
const { WELCOME_BANNER_PATH } = require('@/utils/imagesUtil');

module.exports = {
    name: "guildMemberAdd",
    async execute(member) {
        const canal = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (!canal || canal.type !== ChannelType.GuildText) return;

        // Fecha de ingreso formateada (DD/MM/YYYY)
        const fechaIngreso = member.joinedAt;
        const dia = fechaIngreso.getDate().toString().padStart(2, '0');
        const mes = (fechaIngreso.getMonth() + 1).toString().padStart(2, '0');
        const año = fechaIngreso.getFullYear();
        const fechaFormateada = `${dia}/${mes}/${año}`;

        const attachment = new AttachmentBuilder(WELCOME_BANNER_PATH, { name: 'bienvenida.png' });

        const embed = new EmbedBuilder()
            .setColor("#00AEEF")
            .setDescription(`**¡Bienvenido!**\n <@${member.id}>\nEsperemos que disfrutes tu estadía en ${member.guild.name}!\n\n` +
                `👑 Eres nuestro usuario: #${member.guild.memberCount}\n` +
                `🚀 Fecha de ingreso: ${fechaFormateada}\n\n` +
                `🛒 **Tienda:** ${SHOP_URL}\n` +
                `🌍 **IP:** ${JAVA_IP}\n` +
                `🔌 **Puerto Bedrock:** ${BEDROCK_PUERTO}\n`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setImage('attachment://bienvenida.png')
            .setFooter({ text: `Copyright © ${new Date().getFullYear()} | ${member.guild.name}` });

        canal.send({ embeds: [embed], files: [attachment] });
    }
};