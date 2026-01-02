/**
 * ════════════════════════════════════════════════════════════════════════════
 * ANTILINKS DETECTOR - Sistema de Detección de Enlaces AVANZADO
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Detectar enlaces en mensajes usando regex profesional
 * - Detectar enlaces ofuscados (espacios, caracteres especiales, l33t speak)
 * - Detectar IPs y dominios numéricos
 * - Detectar homóglifos (caracteres similares visualmente)
 * - Extraer dominios de los enlaces detectados
 * - Validar contra listas blancas y negras
 * - Proporcionar funciones reutilizables para el análisis de enlaces
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Mapeo de caracteres l33t speak a caracteres normales
 */
const LEET_SPEAK_MAP = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', 
    '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
    '|': 'i', '()': 'o', '[]': 'i', '<': 'c', '>': 'c'
};

/**
 * Mapeo de homóglifos (caracteres Unicode similares) a caracteres normales
 */
const HOMOGLYPH_MAP = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y',
    'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ց': 'g', 'һ': 'h', 'ӏ': 'l',
    'ο': 'o', 'ν': 'v', 'κ': 'k', 'ε': 'e', 'ρ': 'p', 'τ': 't', 'υ': 'u'
};

/**
 * Regex profesional para detección de enlaces
 * Detecta: http://, https://, www., IPs, enlaces camuflados
 */
const LINK_REGEX = /(https?:\/\/|www\.)[^\s]+/gi;

/**
 * Regex para detectar IPs (IPv4)
 */
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

/**
 * Regex para detectar dominios con TLD comunes (incluso ofuscados)
 */
const DOMAIN_REGEX = /\b[\w\-]+\s*\.\s*(com|org|net|io|gg|me|tv|co|us|uk|de|fr|es|ru|cn|jp|br|in|au)\b/gi;

/**
 * Normaliza un texto removiendo espacios, caracteres especiales y ofuscaciones
 * @param {string} text - Texto a normalizar
 * @returns {string} - Texto normalizado
 */
function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    
    let normalized = text.toLowerCase();
    
    // Remover espacios entre caracteres de URLs
    normalized = normalized.replace(/\s+/g, '');
    
    // Convertir l33t speak
    for (const [leet, normal] of Object.entries(LEET_SPEAK_MAP)) {
        normalized = normalized.replace(new RegExp(leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), normal);
    }
    
    // Convertir homóglifos
    for (const [homo, normal] of Object.entries(HOMOGLYPH_MAP)) {
        normalized = normalized.replace(new RegExp(homo, 'g'), normal);
    }
    
    // Remover caracteres Unicode invisibles y de formato
    normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    return normalized;
}

/**
 * Detecta si un mensaje contiene una IP
 * @param {string} content - Contenido del mensaje
 * @returns {Array<string>} - Array de IPs encontradas
 */
function detectIPs(content) {
    if (!content || typeof content !== 'string') return [];
    
    // Buscar IPs normales
    const normalIPs = content.match(IP_REGEX) || [];
    
    // Buscar IPs ofuscadas con espacios (ej: "192 . 168 . 1 . 1")
    const spacedIPRegex = /\b\d{1,3}\s*\.\s*\d{1,3}\s*\.\s*\d{1,3}\s*\.\s*\d{1,3}\b/g;
    const spacedIPs = (content.match(spacedIPRegex) || []).map(ip => ip.replace(/\s+/g, ''));
    
    return [...new Set([...normalIPs, ...spacedIPs])];
}

/**
 * Detecta enlaces ofuscados con espacios o caracteres especiales
 * Ejemplo: "discord . gg / abc" -> "discord.gg/abc"
 * @param {string} content - Contenido a analizar
 * @returns {Array<string>} - Enlaces ofuscados encontrados
 */
function detectObfuscatedLinks(content) {
    if (!content || typeof content !== 'string') return [];
    
    const links = [];
    
    // Buscar patrones como "palabra . com" o "palabra . gg"
    DOMAIN_REGEX.lastIndex = 0;
    const matches = content.matchAll(DOMAIN_REGEX);
    
    for (const match of matches) {
        const obfuscatedLink = match[0];
        // Normalizar removiendo espacios
        const normalizedLink = obfuscatedLink.replace(/\s+/g, '');
        if (normalizedLink.includes('.')) {
            links.push(normalizedLink);
        }
    }
    
    return links;
}

/**
 * Detecta si un mensaje contiene enlaces (incluyendo ofuscados)
 * @param {string} content - Contenido del mensaje a analizar
 * @returns {boolean} - true si contiene enlaces, false si no
 */
function hasLinks(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }

    // Resetear el índice del regex para evitar problemas con múltiples llamadas
    LINK_REGEX.lastIndex = 0;
    
    // Verificar enlaces normales
    if (LINK_REGEX.test(content)) return true;
    
    // Verificar IPs
    if (detectIPs(content).length > 0) return true;
    
    // Verificar enlaces ofuscados
    if (detectObfuscatedLinks(content).length > 0) return true;
    
    // Verificar enlaces en texto normalizado
    const normalized = normalizeText(content);
    LINK_REGEX.lastIndex = 0;
    if (LINK_REGEX.test(normalized)) return true;
    
    return false;
}

/**
 * Extrae todos los enlaces encontrados en un mensaje (incluyendo ofuscados)
 * @param {string} content - Contenido del mensaje a analizar
 * @returns {Array<string>} - Array con todos los enlaces encontrados
 */
function extractLinks(content) {
    if (!content || typeof content !== 'string') {
        return [];
    }

    const allLinks = [];

    // 1. Extraer enlaces normales
    LINK_REGEX.lastIndex = 0;
    const normalLinks = content.match(LINK_REGEX) || [];
    allLinks.push(...normalLinks);
    
    // 2. Extraer IPs
    const ips = detectIPs(content);
    allLinks.push(...ips.map(ip => `http://${ip}`));
    
    // 3. Extraer enlaces ofuscados
    const obfuscatedLinks = detectObfuscatedLinks(content);
    allLinks.push(...obfuscatedLinks.map(link => 
        link.startsWith('http') ? link : `http://${link}`
    ));
    
    // 4. Buscar enlaces en texto normalizado
    const normalized = normalizeText(content);
    if (normalized !== content.toLowerCase().replace(/\s+/g, '')) {
        LINK_REGEX.lastIndex = 0;
        const normalizedLinks = normalized.match(LINK_REGEX) || [];
        allLinks.push(...normalizedLinks);
    }
    
    return [...new Set(allLinks)]; // Eliminar duplicados
}

/**
 * Extrae el dominio de una URL
 * Maneja URLs con y sin protocolo
 * 
 * @param {string} url - URL de la cual extraer el dominio
 * @returns {string|null} - Dominio extraído o null si no es válida
 */
function extractDomain(url) {
    try {
        // Normalizar la URL agregando protocolo si no existe
        let normalizedUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            normalizedUrl = 'http://' + url;
        }

        // Crear objeto URL para extraer el hostname
        const urlObject = new URL(normalizedUrl);
        let domain = urlObject.hostname;

        // Remover 'www.' si está presente
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }

        return domain.toLowerCase();
    } catch (error) {
        // Si la URL no es válida, intentar extracción manual
        return extractDomainManually(url);
    }
}

/**
 * Extracción manual de dominio como fallback
 * Para casos donde URL() no funciona
 * 
 * @param {string} url - URL a procesar
 * @returns {string|null} - Dominio o null
 */
function extractDomainManually(url) {
    try {
        // Remover protocolo
        let domain = url.replace(/^(https?:\/\/)?(www\.)?/, '');
        
        // Tomar solo la parte del dominio (antes del primer /)
        domain = domain.split('/')[0];
        
        // Tomar solo la parte del dominio (antes de ?)
        domain = domain.split('?')[0];
        
        // Tomar solo la parte del dominio (antes de #)
        domain = domain.split('#')[0];

        return domain.toLowerCase() || null;
    } catch (error) {
        return null;
    }
}

/**
 * Verifica si un dominio está en la lista de bloqueados
 * Soporta coincidencias exactas y subdominios
 * 
 * @param {string} domain - Dominio a verificar
 * @param {Array<string>} blockedDomains - Lista de dominios bloqueados
 * @returns {boolean} - true si está bloqueado, false si no
 */
function isBlockedDomain(domain, blockedDomains) {
    if (!domain || !Array.isArray(blockedDomains)) {
        return false;
    }

    const lowerDomain = domain.toLowerCase();

    // Verificar coincidencia exacta o si es subdominio
    return blockedDomains.some(blocked => {
        const lowerBlocked = blocked.toLowerCase();
        
        // Coincidencia exacta
        if (lowerDomain === lowerBlocked) {
            return true;
        }
        
        // Verificar si es un subdominio (ej: test.instagram.com)
        if (lowerDomain.endsWith('.' + lowerBlocked)) {
            return true;
        }

        return false;
    });
}

/**
 * Verifica si un dominio está en la lista blanca (permitidos)
 * @param {string} domain - Dominio a verificar
 * @param {Array<string>} allowedDomains - Lista de dominios permitidos
 * @returns {boolean} - true si está permitido, false si no
 */
function isAllowedDomain(domain, allowedDomains = []) {
    if (!domain || !Array.isArray(allowedDomains) || allowedDomains.length === 0) {
        return false;
    }

    const lowerDomain = domain.toLowerCase();

    return allowedDomains.some(allowed => {
        const lowerAllowed = allowed.toLowerCase();
        
        // Coincidencia exacta
        if (lowerDomain === lowerAllowed) {
            return true;
        }
        
        // Verificar si es un subdominio
        if (lowerDomain.endsWith('.' + lowerAllowed)) {
            return true;
        }

        return false;
    });
}

/**
 * Analiza un mensaje completo y devuelve información detallada
 * sobre los enlaces encontrados
 * 
 * @param {string} content - Contenido del mensaje
 * @param {Array<string>} blockedDomains - Lista de dominios bloqueados
 * @param {Array<string>} allowedDomains - Lista de dominios permitidos
 * @returns {Object} - Objeto con información del análisis
 */
function analyzeMessage(content, blockedDomains = [], allowedDomains = []) {
    const links = extractLinks(content);
    const domains = [];
    const blockedLinks = [];
    const allowedLinks = [];
    const detectedIPs = detectIPs(content);
    const obfuscatedLinks = detectObfuscatedLinks(content);

    for (const link of links) {
        const domain = extractDomain(link);
        
        if (domain) {
            domains.push(domain);
            
            // Verificar si está en la lista blanca primero
            if (isAllowedDomain(domain, allowedDomains)) {
                allowedLinks.push({
                    link: link,
                    domain: domain,
                    reason: 'whitelist'
                });
                continue;
            }
            
            // Verificar si el dominio está bloqueado
            if (isBlockedDomain(domain, blockedDomains)) {
                blockedLinks.push({
                    link: link,
                    domain: domain,
                    reason: 'blacklist'
                });
            }
        }
    }

    return {
        hasLinks: links.length > 0,
        linksCount: links.length,
        links: links,
        domains: [...new Set(domains)], // Dominios únicos
        hasBlockedLinks: blockedLinks.length > 0,
        blockedLinks: blockedLinks,
        allowedLinks: allowedLinks,
        detectedIPs: detectedIPs,
        hasIPs: detectedIPs.length > 0,
        obfuscatedLinks: obfuscatedLinks,
        hasObfuscation: obfuscatedLinks.length > 0
    };
}

/**
 * Exportación de funciones públicas
 */
module.exports = {
    hasLinks,
    extractLinks,
    extractDomain,
    isBlockedDomain,
    isAllowedDomain,
    analyzeMessage,
    normalizeText,
    detectIPs,
    detectObfuscatedLinks
};
