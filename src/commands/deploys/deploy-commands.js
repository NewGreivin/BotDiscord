require('module-alias/register');
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const encuestaSystem = require('@/systems/encuestas/encuesta');
const actualizacionesSystem = require('@/systems/actualizaciones/actualizaciones');

const commands = [
    encuestaSystem.data.toJSON(),
    actualizacionesSystem.data.toJSON()
];

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log(`🔄 Registrando ${commands.length} comando(s) slash...`);
        if (process.env.GUILD_ID) {
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`✅ ${data.length} comando(s) registrado(s) en el servidor!`);
        } else {
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`✅ ${data.length} comando(s) registrado(s) globalmente!`);
        }
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();
