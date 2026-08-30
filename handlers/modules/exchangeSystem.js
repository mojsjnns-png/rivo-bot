// =====================================================================
// نظام التبادل المتكامل (Exchange System) — نسخة محسّنة
// • نسخة واحدة قابلة للتشغيل مجاناً (price=0) أو مدفوعاً (price>0)
// • Slash command واحد فقط للأدمن: /exchange-setup
// • المستخدمون يصلون عبر زر "نشر تلقائي" في embed يُنشر بقناة عامة
// • listener واحد لكل الـ interactions لتفادي 10062 (Unknown interaction)
// =====================================================================

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");
const cron = require("node-cron");
const emojis = require("./emojis");
const ED = require("./embedDescriptions");

// ---------- ثوابت ----------
const MAX_IMAGES = 4;
const MAX_POST_LENGTH = 1800;
const PAYMENT_TIME_MS = 3 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.85;

const FORBIDDEN_PATTERNS_SRC = [
    "@everyone",
    "@here",
    "discord\\.gg/\\S+",
    "discord\\.com/invite/\\S+",
    "dsc\\.gg/\\S+",
    "(twitter\\.com|x\\.com)/\\S+",
    "instagram\\.com/\\S+",
    "facebook\\.com/\\S+",
    "tiktok\\.com/\\S+",
    "(youtube\\.com|youtu\\.be)/\\S+",
    "snapchat\\.com/\\S+",
    "(telegram\\.me|t\\.me)/\\S+",
    "whatsapp\\.com/\\S+",
    "wa\\.me/\\S+",
    "bit\\.ly/\\S+",
    "tinyurl\\.com/\\S+",
    "rb\\.gy/\\S+",
    "cutt\\.ly/\\S+",
    "\\b\\d{10,15}\\b",
    "\\b[\\w.-]+@[\\w.-]+\\.\\w+\\b",
];

const SCHEDULES = [
    { label: "كل 5 دقائق", value: "*/5 * * * *", emoji: "⏱️" },
    { label: "كل 10 دقائق", value: "*/10 * * * *", emoji: "⏰" },
    { label: "كل 15 دقيقة", value: "*/15 * * * *", emoji: "⌛" },
    { label: "كل 30 دقيقة", value: "*/30 * * * *", emoji: "🕒" },
    { label: "كل ساعة", value: "0 * * * *", emoji: "🕐" },
    { label: "كل ساعتين", value: "0 */2 * * *", emoji: "🕑" },
    { label: "كل 6 ساعات", value: "0 */6 * * *", emoji: "🕕" },
    { label: "كل 12 ساعة", value: "0 */12 * * *", emoji: "🕛" },
];

// ---------- أدوات ----------
function containsForbidden(text) {
    if (!text) return false;
    for (const src of FORBIDDEN_PATTERNS_SRC) {
        if (new RegExp(src, "i").test(text)) return true;
    }
    const urlRe = /\bhttps?:\/\/([^\s/?#]+)(\S*)/gi;
    const allowedHosts =
        /^(?:[\w-]+\.)?(?:discordapp\.com|discordapp\.net|discord\.com|imgur\.com)$/i;
    let m;
    while ((m = urlRe.exec(text)) !== null) {
        if (!allowedHosts.test(m[1].toLowerCase())) return true;
    }
    return false;
}

function isValidImageUrl(url) {
    if (!url) return false;
    let u;
    try {
        u = new URL(url);
    } catch {
        return false;
    }
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    return (
        /(?:^|\.)(?:discordapp\.com|discordapp\.net|discord\.com|imgur\.com)$/.test(
            host,
        ) || /\.(?:jpg|jpeg|png|gif|webp|bmp)$/.test(path)
    );
}

function scheduleLabel(value) {
    return SCHEDULES.find((s) => s.value === value)?.label || value;
}

function similarity(a, b) {
    const wa = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
    const wb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
    if (wa.size === 0 || wb.size === 0) return 0;
    let inter = 0;
    for (const w of wa) if (wb.has(w)) inter++;
    return inter / new Set([...wa, ...wb]).size;
}

// ===================================================================
module.exports = function registerExchangeSystem(client, { db, config }) {
    const cfgKey = (gid) => `xch_cfg_${gid}`;
    const postsKey = (gid) => `xch_posts_${gid}`;
    const idxKey = (gid) => `xch_idx_${gid}`;
    const pendKey = (uid) => `xch_pend_${uid}`;
    const tempKey = (uid) => `xch_temp_${uid}`;

    const defaultCfg = () => ({
        enabled: false,
        allowedRoles: [],
        rooms: [],
        schedule: "*/15 * * * *",
        userLimit: 5,
        price: 0,
        transferRoom: null,
        bankId: null,
        logRoom: null,
        totalPublished: 0,
    });

    const getCfg = async (gid) => (await db.get(cfgKey(gid))) || defaultCfg();
    const setCfg = async (gid, c) => db.set(cfgKey(gid), c);
    const getPosts = async (gid) => (await db.get(postsKey(gid))) || [];
    const setPosts = async (gid, p) => db.set(postsKey(gid), p);

    async function getColor(guildId) {
        let c = await db.get(`color_${guildId}`);
        if (!c) c = (config && config.color) || "#9B59B6";
        if (typeof c === "number") return c;
        if (typeof c === "string") {
            const s = c.trim();
            if (/^#[0-9a-f]{6}$/i.test(s)) return s;
            const hex = s.replace(/^0x/i, "").replace(/^#/, "");
            if (/^[0-9a-f]{6}$/i.test(hex)) return parseInt(hex, 16);
        }
        return "#9B59B6";
    }

    // ---------- جدولة cron ----------
    const cronJobs = new Map();

    async function startCronFor(guildId) {
        const old = cronJobs.get(guildId);
        if (old) {
            try {
                old.stop();
            } catch {}
            cronJobs.delete(guildId);
        }
        const cfg = await getCfg(guildId);
        if (!cfg.enabled || !cron.validate(cfg.schedule)) return;
        const job = cron.schedule(cfg.schedule, () =>
            publishNext(guildId).catch((e) => {
                console.error(`[exchange] publishNext ${guildId}:`, e.message);
            }),
        );
        cronJobs.set(guildId, job);
    }

    function stopCronFor(guildId) {
        const j = cronJobs.get(guildId);
        if (j) {
            try {
                j.stop();
            } catch {}
            cronJobs.delete(guildId);
        }
    }

    // ---------- إدارة webhooks (واحد لكل قناة، اسمه Exchange) ----------
    async function getOrCreateWebhook(channel) {
        try {
            const hooks = await channel.fetchWebhooks();
            let hook = hooks.find(
                (h) => h.name === "Exchange" && h.owner?.id === client.user.id,
            );
            if (!hook) {
                hook = await channel.createWebhook({
                    name: "Exchange",
                    avatar: client.user.displayAvatarURL({ extension: "png" }),
                    reason: "نظام التبادل التلقائي",
                });
            }
            return hook;
        } catch (e) {
            console.error("[exchange] webhook err:", e.message);
            return null;
        }
    }

    // ---------- نشر تلقائي (عبر webhook كرسالة عادية) ----------
    async function publishNext(guildId) {
        const cfg = await getCfg(guildId);
        if (!cfg.enabled) return;
        const posts = await getPosts(guildId);
        if (posts.length === 0 || cfg.rooms.length === 0) return;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        let idx = (await db.get(idxKey(guildId))) || 0;
        if (idx >= posts.length) idx = 0;
        const post = posts[idx];
        await db.set(idxKey(guildId), (idx + 1) % posts.length);

        const room =
            guild.channels.cache.get(post.roomId) ||
            guild.channels.cache.get(cfg.rooms[0]);
        if (!room) return;

        const hook = await getOrCreateWebhook(room);
        if (!hook) return;

        // اسم وصورة الناشر
        let authorName = post.authorTag || "مستخدم";
        let authorAvatar = null;
        try {
            const member = await guild.members
                .fetch(post.authorId)
                .catch(() => null);
            if (member) {
                authorName = member.displayName || member.user.username;
                authorAvatar = member.displayAvatarURL({
                    extension: "png",
                    size: 256,
                });
            } else {
                const user = await client.users
                    .fetch(post.authorId)
                    .catch(() => null);
                if (user)
                    authorAvatar = user.displayAvatarURL({
                        extension: "png",
                        size: 256,
                    });
            }
        } catch {}

        // محتوى الرسالة العادية + الصور كروابط (Discord يعرضها inline)
        let content = post.content;
        if (post.images?.length) content += "\n" + post.images.join("\n");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`xch_contact_${post.authorId}`)
                .setLabel("تواصل")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.contact || "💬"),
            new ButtonBuilder()
                .setLabel("بروفايل الناشر")
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/users/${post.authorId}`)
                .setEmoji(emojis.user || "👤"),
        );

        const sent = await hook
            .send({
                content: content.slice(0, 2000),
                username: authorName.slice(0, 80),
                avatarURL: authorAvatar || undefined,
                components: [row],
                allowedMentions: { parse: [] },
            })
            .catch((e) => {
                console.error("[exchange] hook send:", e.message);
                return null;
            });

        if (!sent) return;

        const fresh = await getPosts(guildId);
        const target = fresh.find((p) => p.id === post.id);
        if (target) {
            target.timesPublished = (target.timesPublished || 0) + 1;
            await setPosts(guildId, fresh);
        }
        const freshCfg = await getCfg(guildId);
        freshCfg.totalPublished = (freshCfg.totalPublished || 0) + 1;
        await setCfg(guildId, freshCfg);
    }

//==============================================================================
// 1. بـانـل الـنـشـر الـعـلـنـي (Public Panel - الـرد ظـاهـر ومُـدمـج داخـل الـإمـبـيـد)
//==============================================================================
//==============================================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

//==============================================================================
// 1. بـانـل الـنـشـر الـعـلـنـي (Public Panel - الـرد ظـاهـر بـالـصـيـغـة الـجـد يـد ة)
//==============================================================================
async function buildPublicPanel(guild) {
    const cfg = await getCfg(guild.id);
    const isPaid = cfg.price > 0;
    const embedColor = await getColor(guild.id);

    // بناء الإمبيد الجديد بالاعتماد على EmbedBuilder المباشر كمثالك
    const embed = new EmbedBuilder()
        .setAuthor({
            name: guild.name,
            iconURL: guild.iconURL({ dynamic: true }) || undefined,
        })
        .setTitle(`نظام التبادل — ${isPaid ? "مدفوع" : "مجاني"}`)
        .setDescription(ED.exchangeSystem_003({ cfg, isPaid, scheduleLabel }))
        .setColor(embedColor)
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("xch_open_panel")
            .setLabel("نشر تلقائي")
            .setStyle(ButtonStyle.Secondary)
          .setEmoji("<a:011_1367454588252454943:1542937524274470974>")
    
    );

    return { 
        embeds: [embed], 
        components: [row],
        ephemeral: false
    };
}

//==============================================================================
// 2. بـانـل الـمُ...سـتـخـد م (User Panel - الـرد مـخـفـي بـالـصـيـغـة الـجـد يـد ة)
//==============================================================================
async function buildUserPanel(interaction, cfg, posts) {
    const userPosts = posts.filter((p) => p.authorId === interaction.user.id);
    const isPaid = cfg.price > 0;
    const embedColor = await getColor(interaction.guild.id);

    // بناء الإمبيد الجديد بالاعتماد على EmbedBuilder المباشر كمثالك
    const embed = new EmbedBuilder()
        .setAuthor({
            name: interaction.guild.name,
            iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined,
        })
        .setTitle(`نظام التبادل — ${isPaid ? "مدفوع" : "مجاني"}`)
        .setDescription(ED.exchangeSystem_001({ cfg, isPaid, scheduleLabel, userPosts }))
        .setColor(embedColor)
        .setTimestamp();

    const menu = new StringSelectMenuBuilder()
        .setCustomId("xch_user_menu")
        .setPlaceholder("⋮  اختر إجراء")
        .addOptions([
            {
                label: "إضافة منشور",
                value: "add",
                description: isPaid ? `السعر: ${cfg.price}` : "منشور مجاني جديد",
            },
            {
                label: "منشوراتي",
                value: "list",
                description: "عرض كل منشوراتك",
            },
            {
                label: "تعديل منشور",
                value: "edit",
                description: "تعديل محتوى أو صور",
            },
            {
                label: "حذف منشور",
                value: "del",
                description: "إزالة منشور نهائياً",
            },
        ]);

    const row = new ActionRowBuilder().addComponents(menu);

    return {
        embeds: [embed],
        components: [row],
        ephemeral: true
    };
}

//==============================================================================
// 3. بـانـل الـإ عـد ا د ا ت (Setup Panel - الـرد ظـاهـر بـالـصـيـغـة الـجـد يـد ة)
//==============================================================================
//==============================================================================
// بانل الإعدادات (Setup Panel v2) - تعديل الإمبيد والأزرار فقط بدون تغيير نظام الرد
//==============================================================================
async function buildSetupPanel(guild) {
    const gid = guild.id;
    const cfg = await getCfg(gid);
    const embedColor = await getColor(gid);

    // صياغة تحديث الإمبيد الجديد (Embed v2)
    const embed = new EmbedBuilder()
        .setTitle(" إعدادات نظام التبادل")
        .setColor(embedColor)
        .setDescription(ED.exchangeSystem_002({ cfg, scheduleLabel }));

    // صياغة تحديث الأزرار الجديد (Components v2) - الصف الأول
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("xch_set_roles")
            .setLabel("الرتب المسموحة")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
        new ButtonBuilder()
            .setCustomId("xch_set_rooms")
            .setLabel("قنوات النشر")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
        new ButtonBuilder()
            .setCustomId("xch_set_schedule")
            .setLabel("وقت النشر")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
        new ButtonBuilder()
            .setCustomId("xch_set_limit")
            .setLabel("الحد للشخص")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
        new ButtonBuilder()
            .setCustomId("xch_set_price")
            .setLabel("السعر")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
    );

    // صياغة تحديث الأزرار (Components v2) - الصف الثاني
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("xch_set_transfer")
            .setLabel("روم التحويل")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>")
            .setDisabled(cfg.price === 0),
        new ButtonBuilder()
            .setCustomId("xch_set_bank")
            .setLabel("البنك")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>")
            .setDisabled(cfg.price === 0),
        new ButtonBuilder()
            .setCustomId("xch_set_log")
            .setLabel("روم اللوق")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>")
            .setDisabled(cfg.price === 0),
        new ButtonBuilder()
            .setCustomId("xch_set_toggle")
            .setLabel(cfg.enabled ? "إيقاف" : "تفعيل")
            .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(cfg.enabled ? "<a:emoji_82:1542937626569482260>" : "<a:emoji_83:1542937629560152064>"),
        new ButtonBuilder()
            .setCustomId("xch_set_publish_now")
            .setLabel("نشر الآن")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
    );

    // صياغة تحديث الأزرار (Components v2) - الصف الثالث
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("xch_set_send_panel")
            .setLabel("إرسال بانل لقناة")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
        new ButtonBuilder()
            .setCustomId("xch_set_stats")
            .setLabel("الإحصائيات")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
    );

    // الحفاظ على سطر الإرجاع الأصلي حقك حرفياً بدون إضافات خارجية
    return { embeds: [embed], components: [row1, row2, row3] };
}
    
    async function buildStatsEmbed(guild) {
        const gid = guild.id;
        const cfg = await getCfg(gid);
        const posts = await getPosts(gid);
        const top = [...posts]
            .sort((a, b) => (b.timesPublished || 0) - (a.timesPublished || 0))
            .slice(0, 5);
        const byUser = posts.reduce((acc, p) => {
            acc[p.authorId] = (acc[p.authorId] || 0) + 1;
            return acc;
        }, {});
        const topUsers = Object.entries(byUser)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return new EmbedBuilder()
            .setTitle(" إحصائيات نظام التبادل")
            .setColor(await getColor(gid))
            .addFields(
                {
                    name: " المنشورات النشطة",
                    value: `\`${posts.length}\``,
                    inline: true,
                },
                {
                    name: " إجمالي مرات النشر",
                    value: `\`${cfg.totalPublished || 0}\``,
                    inline: true,
                },
                {
                    name: " وقت النشر",
                    value: `\`${scheduleLabel(cfg.schedule)}\``,
                    inline: true,
                },
                {
                    name: " أكثر المنشورات نشراً",
                    value: top.length
                        ? top
                              .map(
                                  (p, i) =>
                                      `${i + 1}. <@${p.authorId}> — \`${p.timesPublished || 0}\``,
                              )
                              .join("\n")
                        : "—",
                },
                {
                    name: " أكثر الأعضاء نشاطاً",
                    value: topUsers.length
                        ? topUsers
                              .map(
                                  ([uid, c], i) =>
                                      `${i + 1}. <@${uid}> — \`${c}\` منشور`,
                              )
                              .join("\n")
                        : "—",
                },
            )
            .setTimestamp();
    }

    // ---------- التحقق من صلاحية المستخدم في النظام ----------
    function userAllowed(member, cfg) {
        if (member.permissions.has(PermissionFlagsBits.Administrator))
            return true;
        if (cfg.allowedRoles.length === 0) return true;
        return member.roles.cache.some((r) => cfg.allowedRoles.includes(r.id));
    }

    // ===================================================================
    // معالجات منفصلة لكل نوع interaction (تُستدعى من listener موحّد)
    // ===================================================================

    async function handleSlash(interaction) {
        if (interaction.commandName !== "exchange-setup") return;
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        )
            return interaction.reply({
                content: "**❌ هذا الأمر للأدمنستريتور فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        const panel = await buildSetupPanel(interaction.guild);
        return interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
    }

async function handleButton(interaction) {
    const id = interaction.customId;
    const gid = interaction.guild.id;

    // =========================================================================
    // [1] الـقـسـم الأول: زر الـتـواصـل (عـام)
    // =========================================================================
    if (id && id.startsWith("xch_contact_")) {
        const targetId = id.replace("xch_contact_", "");
        try {
            const target = await client.users.fetch(targetId);
            await target.send({
                content: `**📩 <@${interaction.user.id}> يريد التواصل معك بخصوص منشورك في ${interaction.guild.name}**`,
                allowedMentions: { users: [interaction.user.id] },
            });
            return interaction.reply({
                content: `**✅ أُرسلت رسالة إلى <@${targetId}>.**`,
                flags: MessageFlags.Ephemeral,
            });
        } catch {
            return interaction.reply({
                content: `**⚠️ لا يمكن مراسلة <@${targetId}> (DMs مغلقة).**\nاضغط "بروفايل الناشر" للتواصل.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    // =========================================================================
    // [2] الـقـسـم الـثـانـي: بـاقـي أزرار الـمُـسـتـخـدم والإعـدادات
    // =========================================================================
    
    // زر فتح بانل المستخدم (عام)
    if (id === "xch_open_panel") {
        const cfg = await getCfg(gid);
        if (!userAllowed(interaction.member, cfg)) {
            return interaction.reply({
                content: `**❌ لا تملك رتبة مناسبة.**\nالرتب المطلوبة: ${cfg.allowedRoles.map((r) => `<@&${r}>`).join(" ")}`,
                flags: MessageFlags.Ephemeral,
            });
        }
        const posts = await getPosts(gid);
        const panel = await buildUserPanel(interaction, cfg, posts);
        return interaction.reply({
            ...panel,
            flags: MessageFlags.Ephemeral,
        });
    }

    // أزرار الإعدادات (للأدمن فقط)
    if (id && id.startsWith("xch_set_")) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "**❌ للأدمنستريتور فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const action = id.replace("xch_set_", "");
        const cfg = await getCfg(gid);

        if (action === "roles") {
            const menu = new RoleSelectMenuBuilder()
                .setCustomId("xch_pick_roles")
                .setPlaceholder("اختر الرتب (فارغ = الكل)")
                .setMinValues(0)
                .setMaxValues(10);
            return interaction.reply({
                content: "**اختر الرتب المسموح لها استخدام النظام:**",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (action === "rooms") {
            const menu = new ChannelSelectMenuBuilder()
                .setCustomId("xch_pick_rooms")
                .setPlaceholder("اختر قنوات النشر")
                .addChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(10);
            return interaction.reply({
                content: "**اختر قنوات نشر التبادل:**",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (action === "transfer") {
            const menu = new ChannelSelectMenuBuilder()
                .setCustomId("xch_pick_transfer")
                .setPlaceholder("اختر روم التحويلات")
                .addChannelTypes(ChannelType.GuildText);
            return interaction.reply({
                content: "**اختر روم التحويلات:**",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (action === "log") {
            const menu = new ChannelSelectMenuBuilder()
                .setCustomId("xch_pick_log")
                .setPlaceholder("اختر روم اللوق")
                .addChannelTypes(ChannelType.GuildText);
            return interaction.reply({
                content: "**اختر روم اللوق:**",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (action === "send_panel") {
            const menu = new ChannelSelectMenuBuilder()
                .setCustomId("xch_pick_panel_room")
                .setPlaceholder("اختر قناة لنشر البانل")
                .addChannelTypes(ChannelType.GuildText);
            return interaction.reply({
                content: "**اختر القناة التي ستحتوي على بانل التبادل العام:**",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (action === "schedule") {
            const menu = new StringSelectMenuBuilder()
                .setCustomId("xch_pick_schedule")
                .setPlaceholder("اختر فترة النشر")
                .addOptions(SCHEDULES);
            return interaction.reply({
                content: "**اختر وقت النشر:**",
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (action === "bank") {
            const modal = new ModalBuilder()
                .setCustomId("xch_modal_bank")
                .setTitle(" ID البنك");
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("bank")
                        .setLabel("ID بوت البنك")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder("123456789012345678"),
                ),
            );
            return interaction.showModal(modal);
        }
        if (action === "limit") {
            const modal = new ModalBuilder()
                .setCustomId("xch_modal_limit")
                .setTitle(" الحد للشخص");
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("val")
                        .setLabel("الحد الأقصى لمنشورات العضو")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setValue(String(cfg.userLimit)),
                ),
            );
            return interaction.showModal(modal);
        }
        if (action === "price") {
            const modal = new ModalBuilder()
                .setCustomId("xch_modal_price")
                .setTitle(" السعر");
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("val")
                        .setLabel("السعر للمنشور (0 = مجاني)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setValue(String(cfg.price)),
                ),
            );
            return interaction.showModal(modal);
        }
        if (action === "toggle") {
            cfg.enabled = !cfg.enabled;
            await setCfg(gid, cfg);
            if (cfg.enabled) await startCronFor(gid);
            else stopCronFor(gid);
            const panel = await buildSetupPanel(interaction.guild);
            return interaction.update(panel);
        }
        if (action === "publish_now") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await publishNext(gid);
            return interaction.editReply("** تم النشر يدوياً.**");
        }
        if (action === "stats") {
            const embed = await buildStatsEmbed(interaction.guild);
            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }
    }
} // <--- القفلة الموزونة والنهائية للدالة كاملة بدون نقص

    async function handleStringSelect(interaction) {
        const id = interaction.customId;
        const gid = interaction.guild.id;

        if (id === "xch_user_menu") {
            const cfg = await getCfg(gid);
            const posts = await getPosts(gid);
            const userPosts = posts.filter(
                (p) => p.authorId === interaction.user.id,
            );
            const action = interaction.values[0];

            if (action === "add") {
                if (cfg.rooms.length === 0)
                    return interaction.reply({
                        content: "**❌ لا توجد قنوات نشر محدّدة.**",
                        flags: MessageFlags.Ephemeral,
                    });
                if (userPosts.length >= cfg.userLimit)
                    return interaction.reply({
                        content: `**❌ وصلت للحد الأقصى (\`${cfg.userLimit}\`).**`,
                        flags: MessageFlags.Ephemeral,
                    });
                const opts = cfg.rooms
                    .slice(0, 25)
                    .map((rid) => {
                        const ch = interaction.guild.channels.cache.get(rid);
                        return ch
                            ? {
                                  label: `#${ch.name}`.slice(0, 90),
                                  value: rid,
                                  emoji: "<a:emoji_83:1542937629560152064>",
                              }
                            : null;
                    })
                    .filter(Boolean);
                if (opts.length === 0)
                    return interaction.reply({
                        content: "**❌ القنوات المحدّدة غير موجودة.**",
                        flags: MessageFlags.Ephemeral,
                    });
                const menu = new StringSelectMenuBuilder()
                    .setCustomId("xch_pick_room")
                    .setPlaceholder("اختر القناة المستهدفة")
                    .addOptions(opts);
                return interaction.reply({
                    content: "**اختر قناة النشر:**",
                    components: [new ActionRowBuilder().addComponents(menu)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            if (action === "list") {
                if (userPosts.length === 0)
                    return interaction.reply({
                        content: "**📭 لا توجد منشورات لك.**",
                        flags: MessageFlags.Ephemeral,
                    });
                const list = userPosts
                    .map(
                        (p, i) =>
                            `**${i + 1}.** ${p.content.slice(0, 80)}${p.content.length > 80 ? "..." : ""} — <#${p.roomId}> — نشر \`${p.timesPublished || 0}\` مرة`,
                    )
                    .join("\n");
                return interaction.reply({
                    content: `**📋 منشوراتك:**\n${list}`,
                    flags: MessageFlags.Ephemeral,
                });
            }
            if (action === "edit" || action === "del") {
                if (userPosts.length === 0)
                    return interaction.reply({
                        content: "**📭 لا توجد منشورات لك.**",
                        flags: MessageFlags.Ephemeral,
                    });
                const opts = userPosts.slice(0, 25).map((p) => ({
                    label: p.content.slice(0, 90),
                    value: String(p.id),
                    emoji: action === "del" ? "🗑️" : "✏️",
                }));
                const menu = new StringSelectMenuBuilder()
                    .setCustomId(`xch_post_${action}`)
                    .setPlaceholder(
                        action === "del" ? "اختر للحذف" : "اختر للتعديل",
                    )
                    .addOptions(opts);
                return interaction.reply({
                    content:
                        action === "del"
                            ? "**اختر المنشور للحذف:**"
                            : "**اختر المنشور للتعديل:**",
                    components: [new ActionRowBuilder().addComponents(menu)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return;
        }

        if (id === "xch_pick_room") {
            const roomId = interaction.values[0];
            await db.set(tempKey(interaction.user.id), { roomId, mode: "add" });
            const modal = new ModalBuilder()
                .setCustomId("xch_add_modal")
                .setTitle("➕ إضافة منشور تبادل");
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("content")
                        .setLabel(`المحتوى (حتى ${MAX_POST_LENGTH} حرف)`)
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(MAX_POST_LENGTH),
                ),
            );
            for (let i = 1; i <= MAX_IMAGES; i++) {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId(`img${i}`)
                            .setLabel(` رابط صورة ${i} (اختياري)`)
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setPlaceholder("https://..."),
                    ),
                );
            }
            return interaction.showModal(modal);
        }

        if (id === "xch_post_edit" || id === "xch_post_del") {
            const postId = Number(interaction.values[0]);
            const posts = await getPosts(gid);
            const post = posts.find(
                (p) => p.id === postId && p.authorId === interaction.user.id,
            );
            if (!post)
                return interaction.reply({
                    content: "**❌ المنشور غير موجود.**",
                    flags: MessageFlags.Ephemeral,
                });

            if (id === "xch_post_del") {
                await setPosts(
                    gid,
                    posts.filter((p) => p.id !== postId),
                );
                return interaction.reply({
                    content: "** تم حذف المنشور.**",
                    flags: MessageFlags.Ephemeral,
                });
            }
            await db.set(tempKey(interaction.user.id), {
                postId,
                mode: "edit",
            });
            const modal = new ModalBuilder()
                .setCustomId("xch_edit_modal")
                .setTitle("✏️ تعديل المنشور");
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("content")
                        .setLabel("المحتوى الجديد")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(MAX_POST_LENGTH)
                        .setValue(post.content.slice(0, MAX_POST_LENGTH)),
                ),
            );
            for (let i = 1; i <= MAX_IMAGES; i++) {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId(`img${i}`)
                            .setLabel(`🖼 صورة ${i} (اختياري)`)
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setValue(
                                (post.images?.[i - 1] || "").slice(0, 100),
                            ),
                    ),
                );
            }
            return interaction.showModal(modal);
        }

        // إعدادات: schedule
        if (id === "xch_pick_schedule") {
            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator,
                )
            )
                return;
            const cfg = await getCfg(gid);
            cfg.schedule = interaction.values[0];
            await setCfg(gid, cfg);
            if (cfg.enabled) await startCronFor(gid);
            return interaction.reply({
                content: `**✅ وقت النشر: \`${scheduleLabel(cfg.schedule)}\`**`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    async function handleRoleSelect(interaction) {
        if (interaction.customId !== "xch_pick_roles") return;
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        )
            return;
        const cfg = await getCfg(interaction.guild.id);
        cfg.allowedRoles = [...interaction.values];
        await setCfg(interaction.guild.id, cfg);
        return interaction.reply({
            content: `**✅ تم حفظ \`${cfg.allowedRoles.length}\` رتبة.**`,
            flags: MessageFlags.Ephemeral,
        });
    }

    async function handleChannelSelect(interaction) {
        const id = interaction.customId;
        const gid = interaction.guild.id;
        if (
            ![
                "xch_pick_rooms",
                "xch_pick_transfer",
                "xch_pick_log",
                "xch_pick_panel_room",
            ].includes(id)
        )
            return;
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        )
            return;

        const cfg = await getCfg(gid);
        if (id === "xch_pick_rooms") {
            cfg.rooms = [...interaction.values];
            await setCfg(gid, cfg);
            return interaction.reply({
                content: `**✅ تم حفظ \`${cfg.rooms.length}\` قناة.**`,
                flags: MessageFlags.Ephemeral,
            });
        }
        if (id === "xch_pick_transfer") {
            cfg.transferRoom = interaction.values[0];
            await setCfg(gid, cfg);
            return interaction.reply({
                content: `**✅ روم التحويل: <#${cfg.transferRoom}>**`,
                flags: MessageFlags.Ephemeral,
            });
        }
        if (id === "xch_pick_log") {
            cfg.logRoom = interaction.values[0];
            await setCfg(gid, cfg);
            return interaction.reply({
                content: `**✅ روم اللوق: <#${cfg.logRoom}>**`,
                flags: MessageFlags.Ephemeral,
            });
        }
        if (id === "xch_pick_panel_room") {
            const ch = interaction.guild.channels.cache.get(
                interaction.values[0],
            );
            if (!ch)
                return interaction.reply({
                    content: "**❌ القناة غير موجودة.**",
                    flags: MessageFlags.Ephemeral,
                });
            const panel = await buildPublicPanel(interaction.guild);
            await ch.send(panel).catch(() => null);
            return interaction.reply({
                content: `**✅ تم نشر البانل في <#${ch.id}>.**`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    async function handleModal(interaction) {
        const id = interaction.customId;
        const gid = interaction.guild.id;

        if (
            id === "xch_modal_limit" ||
            id === "xch_modal_price" ||
            id === "xch_modal_bank"
        ) {
            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator,
                )
            )
                return;
            const cfg = await getCfg(gid);
            if (id === "xch_modal_limit") {
                const v = parseInt(
                    interaction.fields.getTextInputValue("val"),
                    10,
                );
                if (!Number.isFinite(v) || v < 1)
                    return interaction.reply({
                        content: "**❌ أدخل رقماً ≥ 1.**",
                        flags: MessageFlags.Ephemeral,
                    });
                cfg.userLimit = v;
                await setCfg(gid, cfg);
                return interaction.reply({
                    content: `**✅ الحد للشخص: \`${v}\`**`,
                    flags: MessageFlags.Ephemeral,
                });
            }
            if (id === "xch_modal_price") {
                const v = parseInt(
                    interaction.fields.getTextInputValue("val"),
                    10,
                );
                if (!Number.isFinite(v) || v < 0)
                    return interaction.reply({
                        content: "**❌ أدخل رقماً ≥ 0.**",
                        flags: MessageFlags.Ephemeral,
                    });
                cfg.price = v;
                await setCfg(gid, cfg);
                return interaction.reply({
                    content: `**✅ السعر: \`${v.toLocaleString()}\`** ${v === 0 ? "(مجاني)" : "(مدفوع)"}`,
                    flags: MessageFlags.Ephemeral,
                });
            }
            if (id === "xch_modal_bank") {
                const v = interaction.fields.getTextInputValue("bank").trim();
                if (!/^\d{17,20}$/.test(v))
                    return interaction.reply({
                        content: "**❌ ID غير صالح.**",
                        flags: MessageFlags.Ephemeral,
                    });
                cfg.bankId = v;
                await setCfg(gid, cfg);
                return interaction.reply({
                    content: `**✅ البنك: <@${v}>**`,
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        if (id === "xch_add_modal" || id === "xch_edit_modal") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const temp = await db.get(tempKey(interaction.user.id));
            if (!temp)
                return interaction.editReply(
                    "**❌ انتهت الجلسة. أعد المحاولة.**",
                );

            const content = interaction.fields
                .getTextInputValue("content")
                .trim();
            if (containsForbidden(content))
                return interaction.editReply(
                    "**❌ المحتوى يحتوي على روابط/منشنات/أرقام تواصل ممنوعة.**",
                );

            const images = [];
            for (let i = 1; i <= MAX_IMAGES; i++) {
                const v = (
                    interaction.fields.getTextInputValue(`img${i}`) || ""
                ).trim();
                if (!v) continue;
                if (!isValidImageUrl(v))
                    return interaction.editReply(
                        `**❌ رابط الصورة \`${i}\` غير صالح.**`,
                    );
                images.push(v);
            }

            const cfg = await getCfg(gid);
            const posts = await getPosts(gid);

            if (id === "xch_edit_modal") {
                const post = posts.find(
                    (p) =>
                        p.id === temp.postId &&
                        p.authorId === interaction.user.id,
                );
                if (!post)
                    return interaction.editReply("**❌ المنشور غير موجود.**");
                post.content = content;
                post.images = images;
                post.editedAt = new Date().toISOString();
                await setPosts(gid, posts);
                await db.delete(tempKey(interaction.user.id));
                return interaction.editReply("**✅ تم تعديل المنشور.**");
            }

            // إضافة جديدة
            const userPosts = posts.filter(
                (p) => p.authorId === interaction.user.id,
            );
            if (userPosts.length >= cfg.userLimit)
                return interaction.editReply(
                    `**❌ تجاوزت الحد (\`${cfg.userLimit}\`).**`,
                );
            for (const p of posts) {
                if (similarity(p.content, content) >= SIMILARITY_THRESHOLD)
                    return interaction.editReply(
                        "**❌ يوجد منشور مشابه جداً — عدّل صياغتك.**",
                    );
            }

            const newPost = {
                id: Date.now(),
                content,
                images,
                roomId: temp.roomId,
                authorId: interaction.user.id,
                authorTag: interaction.user.tag,
                createdAt: new Date().toISOString(),
                timesPublished: 0,
            };

            if (cfg.price === 0) {
                posts.push(newPost);
                await setPosts(gid, posts);
                await db.delete(tempKey(interaction.user.id));
                return interaction.editReply(
                    `**✅ أُضيف منشورك. سيُنشر تلقائياً ${scheduleLabel(cfg.schedule)}.**`,
                );
            }

            // مدفوع
            if (!cfg.transferRoom || !cfg.bankId)
                return interaction.editReply(
                    "**❌ النظام المدفوع غير مكتمل الإعدادات.**",
                );
            const transferCh = interaction.guild.channels.cache.get(
                cfg.transferRoom,
            );
            if (!transferCh)
                return interaction.editReply("**❌ روم التحويل غير موجود.**");

            const tax = Math.floor(cfg.price * (20 / 19) + 1);
            await db.set(pendKey(interaction.user.id), {
                post: newPost,
                guildId: gid,
                ts: Date.now(),
                tax,
            });

            await transferCh.send({
                content: `<@${interaction.user.id}> حوّل **${tax.toLocaleString()}** إلى <@${cfg.bankId}> خلال **3 دقائق**.`,
                allowedMentions: { users: [interaction.user.id] },
            });
            await transferCh.send(`c ${cfg.bankId} ${tax}`);

            const filter = (m) => m.author.id === cfg.bankId;
            const collector = transferCh.createMessageCollector({
                filter,
                time: PAYMENT_TIME_MS,
            });
            const userId = interaction.user.id;
            let paid = false;
            collector.on("collect", (m) => {
                const allText =
                    (m.content || "") +
                    " " +
                    (m.embeds || [])
                        .map((e) => `${e.title || ""} ${e.description || ""}`)
                        .join(" ");
                const mentionsUser =
                    allText.includes(`<@${userId}>`) ||
                    allText.includes(`<@!${userId}>`);
                const mentionsBank =
                    allText.includes(`<@${cfg.bankId}>`) ||
                    allText.includes(`<@!${cfg.bankId}>`);
                const hasAmount =
                    allText.includes(String(tax)) ||
                    allText.includes(tax.toLocaleString());
                const isTransfer =
                    /has transferred|قام بتحويل|تم التحويل|transferred/i.test(
                        allText,
                    );
                if (mentionsUser && mentionsBank && hasAmount && isTransfer) {
                    paid = true;
                    collector.stop("PAID");
                }
            });
            collector.on("end", async () => {
                const pend = await db.get(pendKey(userId));
                await db.delete(pendKey(userId));
                if (paid && pend) {
                    const cur = await getPosts(gid);
                    cur.push(pend.post);
                    await setPosts(gid, cur);
                    if (cfg.logRoom) {
                        const log = interaction.guild.channels.cache.get(
                            cfg.logRoom,
                        );
                        if (log)
                            await log
                                .send({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setTitle(" دفع منشور تبادل")
                                            .setDescription(
                                                ED.exchangeSystem_004({
                                                    pend,
                                                    userId,
                                                }),
                                            )
                                            .setColor(await getColor(gid))
                                            .setTimestamp(),
                                    ],
                                })
                                .catch(() => {});
                    }
                    interaction
                        .followUp({
                            content: "**✅ تم الدفع وأُضيف منشورك.**",
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                } else {
                    interaction
                        .followUp({
                            content: "**❌ انتهى وقت الدفع — أُلغي الطلب.**",
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }
            });

            await db.delete(tempKey(interaction.user.id));
            return interaction.editReply(
                `** تم إرسال طلب الدفع في <#${cfg.transferRoom}> — لديك 3 دقائق.**`,
            );
        }
    }

    // ===================================================================
    // Listener موحّد — يفلتر ويوزّع لمعالج واحد فقط
    // ===================================================================
    client.on("interactionCreate", async (interaction) => {
        try {
            if (!interaction.guild) return;

            if (interaction.isChatInputCommand?.()) {
                if (interaction.commandName?.startsWith("exchange"))
                    return await handleSlash(interaction);
                return;
            }
            if (interaction.isButton?.()) {
                if (interaction.customId?.startsWith("xch_"))
                    return await handleButton(interaction);
                return;
            }
            if (interaction.isStringSelectMenu?.()) {
                if (interaction.customId?.startsWith("xch_"))
                    return await handleStringSelect(interaction);
                return;
            }
            if (interaction.isRoleSelectMenu?.()) {
                if (interaction.customId?.startsWith("xch_"))
                    return await handleRoleSelect(interaction);
                return;
            }
            if (interaction.isChannelSelectMenu?.()) {
                if (interaction.customId?.startsWith("xch_"))
                    return await handleChannelSelect(interaction);
                return;
            }
            if (interaction.isModalSubmit?.()) {
                if (interaction.customId?.startsWith("xch_"))
                    return await handleModal(interaction);
                return;
            }
        } catch (err) {
            console.error("[exchange] interaction error:", err.message);
            try {
                if (
                    interaction.isRepliable?.() &&
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content: `**⚠️ حدث خطأ: ${err.message}**`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } catch {}
        }
    });

    // ---------- Cron startup ----------
    client.once("clientReady", async () => {
        try {
            const all = await db.all();
            const keys = (all || []).filter((e) => e.id.startsWith("xch_cfg_"));
            for (const e of keys) {
                const gid = e.id.replace("xch_cfg_", "");
                if (e.value?.enabled) await startCronFor(gid);
            }
            console.log(
                `✅ نظام التبادل: تم تفعيل ${cronJobs.size} مهمة جدولة`,
            );
        } catch (e) {
            console.error("[exchange] startup cron load failed:", e.message);
        }
    });
};
