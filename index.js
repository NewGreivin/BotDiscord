require('module-alias/register');
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Importar sistema de sugerencias
const sugerencias = require('@/systems/sugerencias/sugerencia');
const systemInformacion = require('@/systems/informacion/informacion');

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

    await systemInformacion(client);
});

sugerencias(client);
client.login(process.env.BOT_TOKEN);