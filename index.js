require('module-alias/register');
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const sugerencias = require('@/systems/sugerencias/sugerencia');
const { enviarInformacionSiNoExiste } = require('@/systems/informacion/informacion');
const boostSystem = require('@/systems/boosts/boost');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Reaction]
});

client.once('ready', async () => {
    console.log(`✅ Bot conectado como: ${client.user.tag}`);

    await enviarInformacionSiNoExiste(client);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    await boostSystem.execute(oldMember, newMember);
});

sugerencias(client);
client.login(process.env.BOT_TOKEN);