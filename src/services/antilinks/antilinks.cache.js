/**
 * ════════════════════════════════════════════════════════════════════════════
 * ANTILINKS CACHE - Sistema Anti-Spam en Memoria
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Detectar usuarios que envían múltiples enlaces en poco tiempo
 * - Mantener un registro temporal en memoria (Map)
 * - Limpiar automáticamente registros antiguos
 * - Prevenir spam por repetición de enlaces
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Configuración del sistema anti-spam
 */
const SPAM_CONFIG = {
    // Tiempo en milisegundos para considerar spam (5 segundos)
    timeWindow: 5000,
    
    // Número máximo de enlaces permitidos en el timeWindow
    maxLinks: 3,
    
    // Tiempo de limpieza automática del caché (30 segundos)
    cleanupInterval: 30000,
    
    // Número máximo de usuarios en caché (prevenir memory leak)
    maxCacheSize: 1000
};

/**
 * Map para almacenar el historial de enlaces por usuario
 * Estructura: Map<userId, Array<timestamp>>
 */
const linkSpamCache = new Map();

/**
 * Registra un intento de envío de enlace por un usuario
 * 
 * @param {string} userId - ID del usuario que envió el enlace
 * @returns {boolean} - true si es spam, false si está dentro del límite
 */
function recordLinkAttempt(userId) {
    const now = Date.now();
    
    // Obtener o crear el historial del usuario
    if (!linkSpamCache.has(userId)) {
        linkSpamCache.set(userId, []);
    }
    
    const userHistory = linkSpamCache.get(userId);
    
    // Filtrar solo los intentos dentro de la ventana de tiempo
    const recentAttempts = userHistory.filter(
        timestamp => now - timestamp < SPAM_CONFIG.timeWindow
    );
    
    // Agregar el nuevo intento
    recentAttempts.push(now);
    
    // Actualizar el caché con los intentos recientes
    linkSpamCache.set(userId, recentAttempts);
    
    // Verificar si excede el límite
    return recentAttempts.length > SPAM_CONFIG.maxLinks;
}

/**
 * Verifica si un usuario está haciendo spam de enlaces
 * sin registrar un nuevo intento
 * 
 * @param {string} userId - ID del usuario a verificar
 * @returns {boolean} - true si está spameando, false si no
 */
function isSpamming(userId) {
    if (!linkSpamCache.has(userId)) {
        return false;
    }
    
    const now = Date.now();
    const userHistory = linkSpamCache.get(userId);
    
    // Contar intentos recientes
    const recentAttempts = userHistory.filter(
        timestamp => now - timestamp < SPAM_CONFIG.timeWindow
    );
    
    return recentAttempts.length > SPAM_CONFIG.maxLinks;
}

/**
 * Limpia el historial de un usuario específico
 * 
 * @param {string} userId - ID del usuario a limpiar
 */
function clearUserHistory(userId) {
    linkSpamCache.delete(userId);
}

/**
 * Limpia todo el caché
 * Útil para reinicios o mantenimiento
 */
function clearAllCache() {
    linkSpamCache.clear();
}

/**
 * Limpia entradas antiguas del caché
 * Elimina usuarios cuyo último intento fue hace más de timeWindow
 * También limita el tamaño total del caché
 */
function cleanupOldEntries() {
    const now = Date.now();
    const usersToDelete = [];
    
    // Iterar sobre todos los usuarios
    for (const [userId, timestamps] of linkSpamCache.entries()) {
        // Filtrar solo timestamps recientes
        const recentTimestamps = timestamps.filter(
            timestamp => now - timestamp < SPAM_CONFIG.timeWindow
        );
        
        if (recentTimestamps.length === 0) {
            // No hay intentos recientes, marcar para eliminar
            usersToDelete.push(userId);
        } else {
            // Actualizar con solo los timestamps recientes
            linkSpamCache.set(userId, recentTimestamps);
        }
    }
    
    // Eliminar usuarios inactivos
    for (const userId of usersToDelete) {
        linkSpamCache.delete(userId);
    }
    
    // PROTECCIÓN ADICIONAL: Si el caché sigue siendo muy grande
    // eliminar los usuarios más antiguos
    if (linkSpamCache.size > SPAM_CONFIG.maxCacheSize) {
        const sortedEntries = Array.from(linkSpamCache.entries())
            .map(([userId, timestamps]) => ({
                userId,
                lastAttempt: Math.max(...timestamps)
            }))
            .sort((a, b) => a.lastAttempt - b.lastAttempt);
        
        // Eliminar el 20% más antiguo
        const toRemove = Math.floor(linkSpamCache.size * 0.2);
        for (let i = 0; i < toRemove; i++) {
            linkSpamCache.delete(sortedEntries[i].userId);
        }
    }
}

/**
 * Obtiene estadísticas del caché
 * Útil para debugging y monitoreo
 * 
 * @returns {Object} - Objeto con estadísticas
 */
function getCacheStats() {
    return {
        totalUsers: linkSpamCache.size,
        config: SPAM_CONFIG,
        users: Array.from(linkSpamCache.entries()).map(([userId, timestamps]) => ({
            userId,
            attempts: timestamps.length,
            lastAttempt: timestamps[timestamps.length - 1] || null
        }))
    };
}

/**
 * Obtiene el número de intentos recientes de un usuario
 * 
 * @param {string} userId - ID del usuario
 * @returns {number} - Número de intentos recientes
 */
function getUserAttempts(userId) {
    if (!linkSpamCache.has(userId)) {
        return 0;
    }
    
    const now = Date.now();
    const userHistory = linkSpamCache.get(userId);
    
    return userHistory.filter(
        timestamp => now - timestamp < SPAM_CONFIG.timeWindow
    ).length;
}

/**
 * Inicializa el sistema de limpieza automática
 * Debe llamarse al iniciar el bot
 * 
 * @returns {NodeJS.Timeout} - ID del intervalo para poder cancelarlo si es necesario
 */
function initAutoCleanup() {
    return setInterval(() => {
        cleanupOldEntries();
    }, SPAM_CONFIG.cleanupInterval);
}

/**
 * Actualiza la configuración del anti-spam
 * 
 * @param {Object} newConfig - Nueva configuración
 * @param {number} [newConfig.timeWindow] - Nueva ventana de tiempo
 * @param {number} [newConfig.maxLinks] - Nuevo máximo de enlaces
 * @param {number} [newConfig.cleanupInterval] - Nuevo intervalo de limpieza
 */
function updateConfig(newConfig) {
    if (newConfig.timeWindow !== undefined) {
        SPAM_CONFIG.timeWindow = newConfig.timeWindow;
    }
    if (newConfig.maxLinks !== undefined) {
        SPAM_CONFIG.maxLinks = newConfig.maxLinks;
    }
    if (newConfig.cleanupInterval !== undefined) {
        SPAM_CONFIG.cleanupInterval = newConfig.cleanupInterval;
    }
}

/**
 * Exportación de funciones públicas
 */
module.exports = {
    recordLinkAttempt,
    isSpamming,
    clearUserHistory,
    clearAllCache,
    cleanupOldEntries,
    getCacheStats,
    getUserAttempts,
    initAutoCleanup,
    updateConfig,
    SPAM_CONFIG
};
