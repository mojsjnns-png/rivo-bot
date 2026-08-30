// =====================================================================
// نصوص ووسوم مركزية للـ Embeds — قابلة لإعادة الاستخدام في كل البوت
// مثل emojis.js لكن للنصوص (footer/thumbnail/labels)
// =====================================================================

/**
 * footer(guild, prefix?) — يُرجع object جاهز لـ .setFooter()
 * • النص: prefix + اسم السيرفر (لو وُفِّر prefix)، أو اسم السيرفر فقط
 * • iconURL: أيقونة السيرفر
 */
function footer(guild, prefix) {
    if (!guild) return { text: prefix || ' ' };
    const name = guild.name || 'Server';
    const text = prefix ? `${prefix} | ${name}` : name;
    const iconURL = guild.iconURL?.({ dynamic: true, size: 64 }) || undefined;
    return { text, iconURL };
}

/**
 * thanksFooter(guild) — Footer "شكراً لتعاملك معنا! | <اسم السيرفر>"
 */
function thanksFooter(guild) {
    return footer(guild, 'شكراً لتعاملك معنا!');
}

/**
 * thumb(guild) — أيقونة السيرفر بحجم مناسب لـ thumbnail
 */
function thumb(guild) {
    return guild?.iconURL?.({ dynamic: true, size: 256 }) || null;
}

module.exports = { footer, thanksFooter, thumb };
