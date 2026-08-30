const cache = new Map();
let dbRef = null;
let defaultColor = 0x00AE86;

function parse(raw) {
    if (raw == null) return defaultColor;
    if (typeof raw === 'number') return raw;
    const s = String(raw).trim().replace('#', '').replace('0x', '').replace('0X', '');
    const n = parseInt(s, 16);
    return Number.isFinite(n) ? n : defaultColor;
}

async function init(db, config) {
    dbRef = db;
    if (config && config.color) defaultColor = parse(config.color);
    try {
        const all = await db.all();
        for (const entry of all) {
            if (entry && typeof entry.id === 'string' && entry.id.startsWith('embed_color_')) {
                const gid = entry.id.slice('embed_color_'.length);
                cache.set(gid, parse(entry.value));
            }
        }
    } catch (e) {
        console.error('embedColor init error:', e);
    }
}

function color(guildId) {
    if (!guildId) return defaultColor;
    if (cache.has(guildId)) return cache.get(guildId);
    if (dbRef) {
        dbRef.get(`embed_color_${guildId}`).then(v => {
            cache.set(guildId, v ? parse(v) : defaultColor);
        }).catch(() => {});
    }
    return defaultColor;
}

function setGuildColor(guildId, raw) {
    if (!guildId) return;
    cache.set(guildId, parse(raw));
}

function gid(ctx) {
    if (!ctx) return null;
    if (typeof ctx === 'string') return ctx;
    if (ctx.guild && ctx.guild.id) return ctx.guild.id;
    if (ctx.guildId) return ctx.guildId;
    return null;
}

module.exports = { init, color, setGuildColor, gid };
