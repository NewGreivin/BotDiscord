const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { COMPRAS_CHANNEL_ID, TEBEX_SECRET, WEBHOOK_PORT, SHOP_URL } = require('@/utils/constansUtil');

/**
 * Sistema de alertas de compras de Tebex
 * Este sistema crea un servidor Express que escucha webhooks de Tebex
 * y envía notificaciones formatadas al canal de compras de Discord
 */

class TiendaAlertas {
    constructor(client) {
        this.client = client;
        this.app = express();
        this.server = null; // Referencia al servidor HTTP
        this.app.use(express.json());
        
        // Configurar rutas
        this.setupRoutes();
    }

    setupRoutes() {
        // Ruta de health check
        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'ok', message: 'Webhook server running' });
        });

        // Ruta principal para webhooks de Tebex
        this.app.post('/tebex/webhook', async (req, res) => {
            try {
                // Validar secret de Tebex (seguridad)
                const secretHeader = req.headers['x-tebex-secret'];
                
                if (TEBEX_SECRET && secretHeader !== TEBEX_SECRET) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                const data = req.body;
                
                // Tebex envía diferentes tipos de eventos
                // Nos interesa el evento 'payment.completed'
                if (data.type === 'payment.completed' || data.subject === 'payment.completed') {
                    await this.handleCompra(data);
                }

                res.status(200).json({ received: true });
            } catch (error) {
                console.error('[Tienda] Error procesando webhook:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    }

    async handleCompra(data) {
        try {
            // Extraer información de la compra
            // La estructura puede variar según la versión de Tebex
            const payment = data.payment || data;
            const player = payment.player || {};
            const packages = payment.packages || payment.items || [];

            const playerName = player.name || player.username || 'Usuario Desconocido';
            const playerId = player.uuid || player.id || '';
            const amount = payment.amount || payment.price || '0.00';
            const currency = payment.currency || 'USD';

            // Formatear los paquetes comprados
            let paquetesTexto = '';
            if (packages.length > 0) {
                paquetesTexto = packages.map(pkg => {
                    const cantidad = pkg.quantity || 1;
                    const nombre = pkg.name || 'Paquete Desconocido';
                    return `🔸 ${nombre} x${cantidad}`;
                }).join('\n');
            } else {
                paquetesTexto = '🔸 Información no disponible';
            }

            // Crear el embed
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`👑 ¡NUEVA COMPRA! (${playerName})`)
                .setDescription(
                    `¡El jugador **${playerName}** ha adquirido su **Paquete Deseado** en nuestra Tienda! 🛒\n\n` +
                    `🎉 ¡Queremos darle las gracias por apoyar a nuestro servidor! 🎉`
                )
                .addFields({
                    name: '💎 - Paquete(s) Adquirido(s):',
                    value: paquetesTexto,
                    inline: false
                })
                .setThumbnail('attachment://avatar.png') // Opcional: avatar del jugador
                .setImage('attachment://banner.png') // Banner de la tienda
                .setFooter({ 
                    text: 'Copyright © 2024 | MineGold Network',
                    iconURL: this.client.user.displayAvatarURL()
                })
                .setTimestamp();

            // Obtener el canal de compras
            const canal = await this.client.channels.fetch(COMPRAS_CHANNEL_ID);
            
            if (!canal) {
                return;
            }

            // Validar que el canal existe y es accesible
            if (!canal.isTextBased()) {
                return;
            }

            // Enviar el embed solo al canal designado
            const mensaje = await canal.send({ 
                embeds: [embed]
            });

            // Agregar botón de tienda (opcional) - también en el canal designado
            if (SHOP_URL) {
                await canal.send({
                    content: `🛒 **¡TIENDA OFICIAL!** [Haz clic aquí](${SHOP_URL})`
                });
            }

        } catch (error) {
            console.error('[Tienda] Error al manejar compra:', error);
        }
    }

    start() {
        const PORT = WEBHOOK_PORT || 3000;
        
        try {
            this.server = this.app.listen(PORT, () => {
                console.log(`✅ [Tienda] Servidor de webhooks iniciado en puerto ${PORT}`);
                console.log(`📍 [Tienda] URL: http://localhost:${PORT}/tebex/webhook`);
            });
            
            // Manejar errores del servidor
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`[Tienda] Error: El puerto ${PORT} ya está en uso`);
                    console.error('[Tienda] Cierra la aplicación que está usando el puerto o cambia WEBHOOK_PORT');
                } else {
                    console.error('[Tienda] Error en servidor de webhooks:', error);
                }
            });
        } catch (error) {
            console.error('[Tienda] Error al iniciar servidor:', error);
        }
    }

    stop() {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }
            
            this.server.close((error) => {
                if (error) {
                    console.error('[Tienda] Error al detener servidor:', error);
                    reject(error);
                } else {
                    console.log('[Tienda] Servidor de webhooks detenido correctamente');
                    this.server = null;
                    resolve();
                }
            });
        });
    }
}

module.exports = TiendaAlertas;
