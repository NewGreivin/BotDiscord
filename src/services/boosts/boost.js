const { ChannelType } = require("discord.js");
const { crearEmbed } = require('@/utils/embedUtil');
const { BOOST_CHANNEL_ID } = require('@/utils/constansUtil');

module.exports = {
    name: "guildMemberUpdate",
    async execute(oldMember, newMember) {
        const canal = newMember.guild.channels.cache.get(BOOST_CHANNEL_ID);
        if (!canal || canal.type !== ChannelType.GuildText) return;

        if (!oldMember.premiumSince && newMember.premiumSince) {
            const embed = crearEmbed(
                "Booster",
                "¡Gracias por mejorar nuestro servidor!",
                0xFF73FA 
            );

            embed.addFields({ name: "Booster", value: `${newMember}` });

            canal.send({
                content: `${newMember} acaba de mejorar el servidor.`,
                embeds: [embed]
            });
        }
    }
};
