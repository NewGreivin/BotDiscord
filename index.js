require('module-alias/register');
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Importar sistema de sugerencias
const sugerencias = require('@/systems/sugerencias/sugerencia');

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
});

sugerencias(client);
client.login(process.env.BOT_TOKEN);