const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder,
    StringSelectMenuBuilder,
    SelectMenuBuilder,
    PermissionsBitField,
    REST,
    Routes,
    ApplicationCommandOptionType,
    WebhookClient,
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType,
    Events,
    ActivityType,
} = require("discord.js");
const D = require("./descriptions");
const _ec = require("./embedColor");
const fs = require("fs");
const ms = require("ms");
const path = require("path");
const sharp = require("sharp");
const { getAudioUrl } = require("google-tts-api");
const googleTTS = require("google-tts-api");
const emojis = require("./emojis");
const ED = require("./embedDescriptions");
const { verifyPayment } = require("./paymentVerification");

// in-memory auction timer storage
const auctionTimers = new Map();

const PAYMENT_BOT_ID = "1535048804078977164";

// helper: resolve embed color (per-server or global config fallback)
async function getColor(guildId, _db, _config) {
    const stored = guildId ? await _db.get(`embed_color_${guildId}`) : null;
    const raw = stored || _config?.color || "0x00AE86";
    return parseInt(raw.replace("#", "").replace("0x", ""), 16);
}

// helper: pick shop category (round-robin among extra categories of a type)
async function pickShopCategory(_db, guildId, categoryId) {
    const data = await _db.get(`categoryMentions_${categoryId}_${guildId}`);
    const cats =
        data && Array.isArray(data.categories) && data.categories.filter(Boolean).length
            ? data.categories.filter(Boolean)
            : [categoryId];
    const idxKey = `shopCatRotate_${guildId}_${categoryId}`;
    let idx = Number(await _db.get(idxKey)) || 0;
    const picked = cats[idx % cats.length];
    await _db.set(idxKey, (idx + 1) % Math.max(1, cats.length));
    return picked;
}

async function _buildAuctionMsg(draft, rem, db, guildId) {
    const m = Math.floor(rem / 60),
        s = rem % 60;
    const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    const taxStr = draft.includesTax ? "نعم" : "لا";
    const template = await db.get(`auction_msg_template_${guildId}`);
    if (template) {
        return template
            .replace(/{mention}/g, draft.mentionType || "")
            .replace(/{item}/g, draft.itemName || "")
            .replace(/{price}/g, draft.startPrice || "")
            .replace(/{tax}/g, taxStr)
            .replace(/{owner}/g, `<@${draft.owner}>`)
            .replace(/{time}/g, timeStr);
    }
    return `${draft.mentionType}\nالمزاد\n\nالسلعة: ${draft.itemName}\nالسعر الابتدائي: ${draft.startPrice}\nالضريبة: ${taxStr}\nصاحب المزاد: <@${draft.owner}>\n\nالوقت المتبقي: ${timeStr}`;
}

function _buildControlRow(roomId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pause_auction_${roomId}`)
            .setLabel("توقيف")
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.pause),
        new ButtonBuilder()
            .setCustomId(`resume_auction_${roomId}`)
            .setLabel("استمرار")
            .setStyle(ButtonStyle.Success)
            .setEmoji(emojis.resume),
        new ButtonBuilder()
            .setCustomId(`revive_auction_${roomId}`)
            .setLabel("انعاش")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.revive),
        new ButtonBuilder()
            .setCustomId(`extend_auction_${roomId}`)
            .setLabel("تمديد")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.extend),
        new ButtonBuilder()
            .setCustomId(`cancel_active_auction_${roomId}`)
            .setLabel("إلغاء")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis.cancelAuction),
    );
}

module.exports = function registerShopInteractions(
    client,
    {
        db,
        config,
        botOwner,
        allowedUserId,
        owner,
        TARGET_ROLE_ID,
        TARGET_CHANNEL_ID,
        logJoinChannel,
        allowedBotId,
        prefix,
        TARGET_GUILD_ID,
        reportsChannelId,
        reportsGuildId,
        chsd,
    },
) {
    // ====== دالة: إرسال تقييم الخدمة بالخاص بعد إغلاق التكت ======
    async function sendTicketRatingDM(userId, guildId, type) {
        const ratingChId = await db.get(`rating_ch_${guildId}`);
        if (!ratingChId) return;
        try {
            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) return;
            const typeLabels = {
                support: " دعم فني",
                scam: " تشهير",
                order: " طلبات",
                auction: " مزاد",
                roles: " رتب",
            };
            const ratingRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tr_1_${guildId}_${type}`)
                    .setLabel("")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId(`tr_2_${guildId}_${type}`)
                    .setLabel("")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId(`tr_3_${guildId}_${type}`)
                    .setLabel("")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId(`tr_4_${guildId}_${type}`)
                    .setLabel("")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId(`tr_5_${guildId}_${type}`)
                    .setLabel("")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis.rate),
            );
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تقييم الخدمة")
                        .setDescription(
                            ED.shopInteractions_001({ type, typeLabels }),
                        )
                        .setFooter({ text: "اضغط على النجوم لإرسال تقييمك" })
                        .setTimestamp(),
                ],
                components: [ratingRow],
            });
        } catch (e) {
            console.log(`[Rating DM] فشل إرسال لـ ${userId}: ${e.message}`);
        }
    }

    //////////////////////////////////////////////shop
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const serverColor = _ec.color(guildId); // جـلـب لـون الـسـيـرفـر
        const linePreview = await db.get(`image_${guildId}`); // جـلـب صـورة الـخـط

        //==============================================================================
        // 1. تـفـاعـل عـرض قـائـمـة أنـواع الـمـتـاجـر (shoppri)
        //==============================================================================
        if (interaction.customId === "shoppri") {
            await interaction.deferReply({ ephemeral: true });
            const categories = interaction.guild.channels.cache.filter(
                (c) => c.type === ChannelType.GuildCategory,
            );

            if (!categories.size) {
                return interaction.editReply({
                    content: `**❌ لا تـوجـد انـواع مـتـاجـر فـي هـذا الـسـيـرفـر**`,
                });
            }

            const bank = await db.get(`bank_${guildId}`);
            const buyshopimage = await db.get(`buyshopimage_${guildId}`);

            const buttons = [];
            for (const [categoryId, category] of categories) {
                const categoryData = await db.get(
                    `categoryMentions_${categoryId}_${guildId}`,
                );
                if (!categoryData) continue;

                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`select_shop_price_${categoryId}`)
                        .setLabel(categoryData.nametype || "نـوع غـيـر مـحـدد")
                        .setEmoji(emojis.shop || "🛒")
                        .setStyle(ButtonStyle.Secondary),
                );
            }

            if (buttons.length === 0) {
                return interaction.editReply({
                    content: "**❌ لا تـوجـد بـيـانـات مـسـجـلـة لـلأنـواع.**",
                });
            }

            const row = new ActionRowBuilder().addComponents(
                buttons.slice(0, 5),
            );

            const shop_prices_embed = new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ** أسـعـار الـمـتـاجـر الـحـالـيـة **`)
                .setDescription(
                    `# - أسـعـار الـمـتـاجـر فـي ${interaction.guild.name}\n\n` +
                        `يـرجــى اخـتـيـار الـنــوع الـذي تـرغـب فــي مـعـرفــة سـعـره و مـواصــفـاتــه مـن الأزرار أد نـاه.\n\n` +
                        `**الـتـحـو يـل لـحـسـاب الـبـنـك:** <@!${bank || "غـيـر مـحـدد"}>`,
                )
                .setAuthor({
                    name: interaction.guild.name,
                    iconURL: interaction.guild.iconURL({ size: 1024 }),
                })
                .setThumbnail(interaction.guild.iconURL())
                .setColor(serverColor)
                .setTimestamp();

            if (buyshopimage) shop_prices_embed.setImage(buyshopimage);
            else if (linePreview) shop_prices_embed.setImage(linePreview);

            await interaction.editReply({
                embeds: [shop_prices_embed],
                components: [row],
            });
        }

        //==============================================================================
        // 2. تـفـاعـل عـرض تـفـاصـيـل الـسـعـر لـلـنـوع الـمـحـدد
        //==============================================================================
        if (interaction.customId.startsWith("select_shop_price_")) {
            await interaction.deferReply({ ephemeral: true });
            const categoryId = interaction.customId.split("_")[3];
            const categoryData = await db.get(
                `categoryMentions_${categoryId}_${guildId}`,
            );

            if (!categoryData)
                return interaction.editReply({
                    content:
                        "❌ عـفـواً، لـم يـتـم الـعـثـور عـلـى بـيـانـات هـذا الـنـوع.",
                });

            const {
                shopPrice: pric,
                shoprole,
                hasTax,
                taxPrice,
                everyoneMentions: evcount,
                hereMentions: hecount,
                shopmen,
                maxWarns,
                shopRoleMentions: shcount,
                nametype,
            } = categoryData;
            const shopPrice = Math.floor(pric * (20 / 19) + 1);
            const bank = await db.get(`bank_${guildId}`);
            const buyshopimage = await db.get(`buyshopimage_${guildId}`);

            if (!pric) {
                return interaction.editReply({
                    content:
                        "❌ عـفـواً، لـم أسـتـطـع الـعـثـور عـلـى سـعـر لـهـذا الـنـوع.",
                });
            }

            const detailEmbed = new EmbedBuilder()
                .setTitle(
                    `** تـفـاصـيـل الـنـوع: ${nametype || "غـيـر مـحـدد"} **`,
                )
                .setDescription(
                    ED.shopInteractions_002({
                        bank,
                        config,
                        evcount,
                        hasTax,
                        hecount,
                        maxWarns,
                        nametype,
                        shcount,
                        shopPrice,
                        shopmen,
                        shoprole,
                        taxPrice,
                    }),
                )
                .setColor(serverColor)
                .setTimestamp();

            if (buyshopimage) detailEmbed.setImage(buyshopimage);
            else if (linePreview) detailEmbed.setImage(linePreview);

            await interaction.editReply({ embeds: [detailEmbed] });
        }
    });

    
    
    // 1. قائمة التشفير الشاملة بنمط (ـ,ـ) وبدون مسافات
const replacements = {
    // القديمة
    "باونتي": "بـ,ـاونـ,ـتي", 
    "لعبه": "لـ,ـ3ـ,ـبة", 
    "ماب": "مـ,ـاب", 
    "يوزر": "يـ,ـوزر", 
    "خاص": "خـ,ـ1ص", 
    "العاب": "الـ,ـ3ـ,ـاب",
    "سعركم": "سـ,ـ3ـ,ـركم", 
    "كريديت": "كـ,ـريدـ,ـت", 
    "يوزرات": "يـ,ـوزرات", 
    "تواصل": "تـ,ـواصل", 
    "موجود": "مـ,ـوجـ,ـود", 
    "ضمان": "ضـ,ـمان", 
    "طلبات": "طـ,ـلبـ,ـات", 
    "طلب": "طـ,ـلب", 
    "ميزانيه": "مـ,ـيزاـ,ـنيه", 
    "سعرك": "سـ,ـ3ـ,ـرك", 
    "تصاميم": "تـ,ـصاـ,ـميم", 
    "تصميم": "تـ,ـصمـ,ـيم",
    "روبوكس": "روبـ,ـوكـس", 
    "نتفلكس": "نـ,ـتفـ,ـلكـس", 
    "شاهد": "شـ,ـ1هـ,ـد", 
    "بلوكس": "بـ,ـلوكـس", 
    "ديسكورد": "ديـ,ـسكـ,ـورد", 
    "فيزا": "فـ,ـيز1", 
    "نيترو": "نـ,ـيتـ,ـرو", 
    "اسيا": "1سـ,ـيا", 
    "عملات": "عـ,ـمـ,ـلات", 
    "دولار": "دولـ,ـ1ر", 
    "رصيد": "رصـ,ـيد", 
    "شوب": "شـ,ـوب", 
    "بيع": "بـ,ـيـ,ـع", 
    "شراء": "شـ,ـر1ء", 
    "تبادل": "تـ,ـبـ,ـ1دل", 
    "تبديل": "تـ,ـبديـ,ـل", 
    "عروضكم": "عـ,ـروضـ,ـكم", 
    "عروض": "عـ,ـروض", 
    "متوفر": "مـ,ـتـ,ـوفـ,ـر", 
    "مطلوب": "مـ,ـطـ,ـل9ب", 
    "دفع": "دـ,ـفـ,ـ9", 
    "تحويل": "تـ,ـحـ,ـويـ,ـل", 
    "سوم": "سـ,ـوم", 
    "شارة": "شـ,ـ1رة", 
    "انستقرام": "انـ,ـسـ,ـتـ,ـقـ,ـرام", 
    "كمية": "كـ,ـميـ,ـة", 
    "سريع": "سـ,ـريـ,ـ9",
    "كردت": "كـ,ـردت",
    "عرض": "عـ,ـرض",
    "عرضك": "عـ,ـرضـ,ـك",
    "فلوس": "فـ,ـلـ,ـوس",
    "قارما": "قـ,ـ1رمـ,ـا",
    "سعر": "سـ,ـ3ـ,ـر",
    "تبدخاص": "تـ,ـبدـ,ـخـ,ـ1ص",
    "اطلب": "اطـ,ـلب",
    "مقابل": "مـ,ـقـ,ـ1بـ,ـل",
    "تجار": "تـ,ـجـ,ـ1ر",
    "اوفر": "اوفـ,ـر",
    "متجر": "مـ,ـتـ,ـجر",

    // الجديدة - متجر
    "متجري": "مـ,ـتـ,ـجـ,ـري",
    "متجرها": "مـ,ـتـ,ـجـ,ـرهـ,ـا",
    "متجره": "مـ,ـتـ,ـجـ,ـره",
    "متجرك": "مـ,ـتـ,ـجـ,ـرك",
    "متجركم": "مـ,ـتـ,ـجـ,ـركـ,ـم",
    "متجرهم": "مـ,ـتـ,ـجـ,ـرهـ,ـم",
    "متجرنا": "مـ,ـتـ,ـجـ,ـرنـ,ـا",

    // عرض
    "عرضي": "عـ,ـرضـ,ـي",
    "عرضكم": "عـ,ـرضـ,ـكم",
    "عرضهم": "عـ,ـرضـ,ـهـ,ـم",
    "عرضنا": "عـ,ـرضـ,ـنـ,ـا",

    // عروض
    "عروضي": "عـ,ـروضـ,ـي",
    "عروضك": "عـ,ـروضـ,ـك",
    "عروضهم": "عـ,ـروضـ,ـهـ,ـم",
    "عروضنا": "عـ,ـروضـ,ـنـ,ـا",

    // حساب
    "حساب": "حـ,ـسـ,ـ1ب",
    "حسابي": "حـ,ـسـ,ـ1بـ,ـي",
    "حسابك": "حـ,ـسـ,ـ1بـ,ـك",
    "حسابكم": "حـ,ـسـ,ـ1بـ,ـكـ,ـم",
    "حسابهم": "حـ,ـسـ,ـ1بـ,ـهـ,ـم",
    "حسابنا": "حـ,ـسـ,ـ1بـ,ـنـ,ـا",
    "حسابات": "حـ,ـسـ,ـ1بـ,ـ1ت",
    "حساباتي": "حـ,ـسـ,ـ1بـ,ـ1تـ,ـي",
    "حساباتك": "حـ,ـسـ,ـ1بـ,ـ1تـ,ـك",
    "حساباتكم": "حـ,ـسـ,ـ1بـ,ـ1تـ,ـكـ,ـم",
    "حساباتهم": "حـ,ـسـ,ـ1بـ,ـ1تـ,ـهـ,ـم",
    "حساباتنا": "حـ,ـسـ,ـ1بـ,ـ1تـ,ـنـ,ـا",

    // متوفر
    "متوفري": "مـ,ـتـ,ـوفـ,ـري",
    "متوفرها": "مـ,ـتـ,ـوفـ,ـرهـ,ـا",
    "متوفره": "مـ,ـتـ,ـوفـ,ـره",
    "متوفرك": "مـ,ـتـ,ـوفـ,ـرك",
    "متوفركم": "مـ,ـتـ,ـوفـ,ـركـ,ـم",
    "متوفرهم": "مـ,ـتـ,ـوفـ,ـرهـ,ـم",
    "متوفرنا": "مـ,ـتـ,ـوفـ,ـرنـ,ـا",

    // شوب
    "شوبك": "شـ,ـوبـ,ـك",
    "شوبكم": "شـ,ـوبـ,ـكـ,ـم",
    "شوبهم": "شـ,ـوبـ,ـهـ,ـم",
    "شوبنا": "شـ,ـوبـ,ـنـ,ـا",

    // اوفر
    "اوفرها": "اوفـ,ـرهـ,ـا",
    "اوفره": "اوفـ,ـره",
    "اوفرك": "اوفـ,ـرك",
    "اوف ركم": "اوفـ,ـركـ,ـم",
    "اوفرهم": "اوفـ,ـرهـ,ـم",
    "اوفرنا": "اوفـ,ـرنـ,ـا",

    // بيع
    "بيعي": "بـ,ـيـ,ـعـ,ـي",
    "بيعك": "بـ,ـيـ,ـعـ,ـك",
    "بيعكم": "بـ,ـيـ,ـعـ,ـكـ,ـم",
    "بيعهم": "بـ,ـيـ,ـعـ,ـهـ,ـم",
    "بيعنا": "بـ,ـيـ,ـعـ,ـنـ,ـا",
    "للبيع": "لـ,ـلـ,ـبـ,ـيـ,ـع",
    "للبيعي": "لـ,ـلـ,ـبـ,ـيـ,ـعـ,ـي",
    "للبيعك": "لـ,ـلـ,ـبـ,ـيـ,ـعـ,ـك",
    "للبيعكم": "لـ,ـلـ,ـبـ,ـيـ,ـعـ,ـكـ,ـم",
    "للبيعهم": "لـ,ـلـ,ـبـ,ـيـ,ـعـ,ـهـ,ـم",
    "للبيعنا": "لـ,ـلـ,ـبـ,ـيـ,ـعـ,ـنـ,ـا",
    "ابيع": "ابـ,ـيـ,ـع",
    "ابيعك": "ابـ,ـيـ,ـعـ,ـك",
    "ابيعكم": "ابـ,ـيـ,ـعـ,ـكـ,ـم",
    "ابيعهم": "ابـ,ـيـ,ـعـ,ـهـ,ـم",
    "ابيعنا": "ابـ,ـيـ,ـعـ,ـنـ,ـا",

    // بوست
    "بوست": "بـ,ـوسـ,ـت",
    "بوستك": "بـ,ـوسـ,ـتـ,ـك",
    "بوستكم": "بـ,ـوسـ,ـتـ,ـكـ,ـم",
    "بوستهم": "بـ,ـوسـ,ـتـ,ـهـ,ـم",
    "بوستنا": "بـ,ـوسـ,ـتـ,ـنـ,ـا",

    // نيترو
    "نيتروك": "نـ,ـيتـ,ـروك",
    "نيتروكم": "نـ,ـيتـ,ـروكـ,ـم",
    "نيتروهم": "نـ,ـيتـ,ـروهـ,ـم",
    "نيترونا": "نـ,ـيتـ,ـرونـ,ـا",

    // روبكس
    "روبكس": "روبـ,ـكـس",
    "روبكسك": "روبـ,ـكـسـ,ـك",
    "روبكسكم": "روبـ,ـكـسـ,ـكـ,ـم",
    "روبكسهم": "روبـ,ـكـسـ,ـهـ,ـم",
    "روبكسنا": "روبـ,ـكـسـ,ـنـ,ـا",

    // سعر
    "سعري": "سـ,ـ3ـ,ـري",
    "سعرها": "سـ,ـ3ـ,ـرهـ,ـا",
    "سعره": "سـ,ـ3ـ,ـره",
    "سعرهم": "سـ,ـ3ـ,ـرهـ,ـم",
    "سعرنا": "سـ,ـ3ـ,ـرنـ,ـا",
"كريدت":"كـ,ريـ,دت",
    // تبدخاص
    "تبدخاصك": "تـ,ـبدـ,ـخـ,ـ1صـ,ـك",
    "تبدخاصكم": "تـ,ـبدـ,ـخـ,ـ1صـ,ـكـ,ـم",
    "تبدخاصهم": "تـ,ـبدـ,ـخـ,ـ1صـ,ـهـ,ـم",
    "تبدخاصنا": "تـ,ـبدـ,ـخـ,ـ1صـ,ـنـ,ـا",

    // مطلوب
    "مطلوبة": "مـ,ـطـ,ـل9بـ,ـة",
    "مطلوبك": "مـ,ـطـ,ـل9بـ,ـك",
    "مطلوبكم": "مـ,ـطـ,ـل9بـ,ـكـ,ـم",
    "مطلوبهم": "مـ,ـطـ,ـل9بـ,ـهـ,ـم",
    "مطلوبنا": "مـ,ـطـ,ـل9بـ,ـنـ,ـا",

    // اطلب
    "اطلبك": "اطـ,ـلبـ,ـك",
    "اطلبكم": "اطـ,ـلبـ,ـكـ,ـم",
    "اطلبهم": "اطـ,ـلبـ,ـهـ,ـم",
    "اطلبنا": "اطـ,ـلبـ,ـنـ,ـا",

    // كريدت
    "كريدة": "كـ,ـريـ,ـدة",
};
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const serverColor = _ec.color(guildId);
    const linePreview = await db.get('image_' + guildId);

    // --- زر tashfeerk ---
    if (interaction.isButton() && interaction.customId === "tashfeerk") {
        const modal = new ModalBuilder()
            .setCustomId("encryptModal")
            .setTitle("تشفير الرسالة");

        const textInput = new TextInputBuilder()
            .setCustomId("messageInput")
            .setLabel("اكـتـب رسـالـتـك هـنـا:")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
        await interaction.showModal(modal);
    }

    // --- مـعـالـجـة إرسـال الـمـود ل ---
    if (interaction.isModalSubmit() && interaction.customId === "encryptModal") {
        const text = interaction.fields.getTextInputValue("messageInput");

        let encodedText = text;
        // تـرتـيـب الـكـلـمـات مـن الأطـول لـلأقـصـر لـضـمـان الـدقـة
        const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
        
        sortedKeys.forEach(original => {
            const regex = new RegExp(original, "gi"); 
            encodedText = encodedText.replace(regex, replacements[original]);
        });

        const copyButton = new ButtonBuilder()
            .setCustomId("copyMessage")
            .setLabel("🖥️")
            .setStyle(ButtonStyle.Secondary);

        const resultEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـم الـتـشـفـيـر بـنـجـاح")
            .setDescription(`${encodedText}`)
            .setColor(serverColor)
            .setTimestamp();

        if (linePreview) resultEmbed.setImage(linePreview);

        await interaction.reply({
            embeds: [resultEmbed],
            components: [new ActionRowBuilder().addComponents(copyButton)],
            ephemeral: true,
        });
        
        await db.set('temp_encrypt_' + interaction.user.id, encodedText);
    }

    // --- زر الـنـسـخ ---
    if (interaction.isButton() && interaction.customId === "copyMessage") {
        const savedText = await db.get('temp_encrypt_' + interaction.user.id);
        
        await interaction.reply({
            content: `\`\`\`\n${savedText || "انـتـهـت الـبـيـانـات"}\n\`\`\``,
            ephemeral: true,
        });
    }
});//==============================================================================
    // أمـر تـصـفـيـة الـد اتـا وحـذف روم الـتـكـت
    //==============================================================================
    client.on("messageCreate", async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content === "!داتا") {
            const guildId = message.guild.id;
            const userId = message.author.id;

            // 1. جـلـب بـيـانـات الـتـكـت لـحـذف الـروم فـعـلـيـاً
            const shopData = await db.get(`shop_ticket_${userId}_${guildId}`);
            if (shopData && shopData.channelId) {
                const existingChannel = message.guild.channels.cache.get(
                    shopData.channelId,
                );
                if (existingChannel) {
                    await existingChannel
                        .delete(`تـطـهـيـر بـيـانـات بـوا سـطـة الـمـسـتـخـدم`)
                        .catch(() => {});
                }
            }

            // 2. حـذف الـسـجـلات مـن الـد اتـابـيـز
            await db.delete(`shop_ticket_${userId}_${guildId}`);
            await db.delete(`shop_credit_${userId}_${guildId}`);

            // 3. تـنـسـيـق الـرد بـلـون الـسـيـرفـر وصـورة الـخـط
            const serverColor = _ec.color(guildId);
            const linePreview = await db.get(`image_${guildId}`);

            const dataEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تطهير السجلات")
                .setDescription(
                    `تـم حـذف روم الـتـكـت الـخـاص بـك ومـسـح كـافـة بـيـانـات الـشـراء الـمـعـلـقـة بـنـجـاح.\nيـمـكـنـك الـآن فـتـح تـذكـرة جـد يـدة.`,
                )
                .setColor(serverColor)
                .setTimestamp();

            if (linePreview) dataEmbed.setImage(linePreview);

            await message.reply({ embeds: [dataEmbed] });
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton() && !interaction.isStringSelectMenu())
            return;

        const guildId = _ec.gid(interaction);
        const userId = interaction.user.id;
        const channel = interaction.channel;
        const serverColor = _ec.color(guildId);
        const linePreview = await db.get(`image_${guildId}`);

        //==============================================================================
        // 1. تـفـاعـل فـتـح تـكـت شـراء مـتـجـر (buy_shop)
        //==============================================================================
        if (interaction.customId === "buy_shop") {
            const shopcat = await db.get(`catbuy_shop_${guildId}`);
            const adminRoleId = await db.get(`shopad_${guildId}`);
            if (!shopcat || !adminRoleId)
                return interaction.reply({
                    content:
                        "❌ يـرجـى تـحـديـد كـتـا غـور ي الـشـراء والـمـسـؤول مـن `/setup`",
                    ephemeral: true,
                });

            const shopData = await db.get(`shop_ticket_${userId}_${guildId}`);
            if (
                shopData &&
                interaction.guild.channels.cache.get(shopData.channelId)
            ) {
                return interaction.reply({
                    content: `❌ لـد يـك تـذكـرة مـفـتـوحـة بـالـفـعـل: <#${shopData.channelId}>`,
                    ephemeral: true,
                });
            }

            await interaction.deferReply({ ephemeral: true });
            const ticketChannel = await interaction.guild.channels.create({
                name: `shop-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: shopcat,
                permissionOverwrites: [
                    {
                        id: userId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: adminRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages,
                        ],
                    },
                ],
            });

            await db.set(`shop_ticket_${userId}_${guildId}`, {
                userId,
                channelId: ticketChannel.id,
            });
            await db.set(`shop_ticket_channel_${ticketChannel.id}`, {
                ownerId: userId,
                guildId,
            });

            const categories = interaction.guild.channels.cache.filter(
                (c) => c.type === ChannelType.GuildCategory,
            );
            const buttons = [];
            const priceLines = [];

            for (const [catId, cat] of categories) {
                const catData = await db.get(
                    `categoryMentions_${catId}_${guildId}`,
                );
                if (!catData) continue;
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`select_shop_type_${catId}`)
                        .setLabel(catData.nametype)
                        .setEmoji(emojis.shop || "🛒")
                        .setStyle(ButtonStyle.Secondary),
                );
                const taxStr = catData.hasTax
                    ? ` (مـع ضـر يـبـة: ${Math.floor(catData.shopPrice * (20 / 19) + 1)})`
                    : "";
                priceLines.push(
                    `${emojis.shop || "•"} **${catData.nametype}:** ${catData.shopPrice || "0"}${taxStr}`,
                );
            }

            const bank = await db.get(`bank_${guildId}`);
            const buyshopimage = await db.get(`buyshopimage_${guildId}`);

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504>  ** تـكـت شـراء مـتـجـر جـد يـد ** `)
                .setDescription(
                    `${priceLines.length > 0 ? `### أسـعـار الـمـتـاجـر\n${priceLines.join("\n")}\n\n` : ""}الـتـحـو يـل لـحـسـاب الـبـنـك: <@!${bank || "غـيـر مـحـدد"}>`,
                )
                .setAuthor({
                    name: interaction.guild.name,
                    iconURL: interaction.guild.iconURL({ size: 1024 }),
                })
                .setColor(serverColor)
                .setTimestamp();

            if (buyshopimage) ticketEmbed.setImage(buyshopimage);
            else if (linePreview) ticketEmbed.setImage(linePreview);

            // --- نـظـام تـقـسـيـم الأزرار الـذ كـي ---
            const allRows = [];

            // الـصـف الأول: أزرار الـتـحـكـم
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("closeshop")
                    .setLabel("إغـلاق الـتـكـت")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.close || "🔒"),
                new ButtonBuilder()
                    .setCustomId("shoppri")
                    .setLabel("الأسـعـار")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.shop || "💰"),
            );
            allRows.push(row1);

            // تـقـسـيـم أزرار الأنـواع (5 أزرار لـكـل صـف)
            for (let i = 0; i < buttons.length; i += 5) {
                if (allRows.length < 5) {
                    // د يـسـكـورد يـسـمـح بـ 5 صـفـوف فـقـط
                    const row = new ActionRowBuilder().addComponents(
                        buttons.slice(i, i + 5),
                    );
                    allRows.push(row);
                }
            }

            await ticketChannel.send({
                content: `<@${userId}> | <@&${adminRoleId}>`,
                embeds: [ticketEmbed],
                components: allRows,
            });

            await interaction.reply({
                content: `✅ **تـم إنـشـاء تـذكـرتـك بـنـجـاح:** <#${ticketChannel.id}>`,
            });
        }
if (interaction.customId.startsWith("select_shop_type_")) {
    await interaction.deferReply({ ephemeral: true });
    const categoryId = interaction.customId.split("_")[3];
    const categoryData = await db.get(
        `categoryMentions_${categoryId}_${guildId}`,
    );
    const shopPrice = categoryData.shopPrice;

    if (!shopPrice) {
        await interaction.editReply({
            content: "عفوا لم استطع العثور على سعر نوع هاذا المتجر",
        });
        return;
    }

    const bank = await db.get(`bank_${guildId}`);
    if (!bank) {
        await interaction.editReply({
            content: "يرجى تحديد البنك عن طريق استخدام الامر الاتي: /setup",
        });
        return;
    }

    const data = await db.get(`shop_credit_${userId}_${guildId}`);
    if (data) {
        return await interaction.editReply({
            content: `** يـوجد لـديـك عـمـلـيـة شــراء فـ الـوقـت الحـالـي بـ الفـعـل **`,
        });
    }

    const datauser = await db.get(
        `shop_ticket_${interaction.member.id}_${guildId}.userId`,
    );
    if (datauser !== interaction.user.id) {
        return await interaction.editReply({
            content: `**يمكن ل صاحب التكت فقط استعمال الازرار**`,
        });
    }

    try {
        const totalPriceC = Math.floor(shopPrice * (20 / 19) + 1);
        const totalPriceRe = Math.ceil(totalPriceC / 5);
        
        // عرض قائمة اختيار طريقة الدفع
        const currencyRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`pay_currency_${userId}`)
                .setPlaceholder("اختر طريقة الدفع")
                .addOptions([
                    {
                        label: `Re - ${totalPriceRe.toLocaleString()}`,
                        description: "الدفع بالروبوتس",
                        value: "Re",
                        emoji: "💎",
                    },
                    {
                        label: `c - ${totalPriceC.toLocaleString()}`,
                        description: "الدفع بالكاش",
                        value: "c",
                        emoji: "💰",
                    },
                ]),
        );

        const currencyMsg = await interaction.channel.send({
            content: `**اختر طريقة الدفع** <@!${userId}>`,
            components: [currencyRow],
        });

        const currencyFilter = (i) => i.user.id === userId && i.customId === `pay_currency_${userId}`;
        const currencyCollector = interaction.channel.createMessageComponentCollector({
            filter: currencyFilter,
            max: 1,
            time: 60000,
        });

        currencyCollector.on("collect", async (i) => {
            await i.deferUpdate();
            const chosen = i.values[0];
            const totalPrice = chosen === "c" ? totalPriceC : totalPriceRe;

            // حذف قائمة الاختيار
            await currencyMsg.delete().catch(() => {});

            // إرسال أمر التحويل
            await interaction.channel.send(
                `${chosen} <@!${bank}> ${totalPrice}`,
            );
            await interaction.channel.send(
                `\`\`\`${chosen} ${bank} ${totalPrice}\`\`\``,
            );
            await interaction.channel.send(
                ` . \` يرجى التحويل في أسرع وقت ممكن هنا\` <@!${userId}>`,
            );

            await db.set(`shop_credit_${userId}_${guildId}`, userId);

            const paymentResult = await verifyPayment({
                channel: interaction.channel,
                userId,
                requiredAmount: totalPrice,
                bankId: bank,
                timeout: 120000,
            });

            if (!paymentResult.success) {
                await db.delete(`shop_credit_${userId}_${guildId}`);
                try {
                    await interaction.channel.send(
                        `**⏰ انتهى وقت التحقق من التحويل. <@${userId}> يرجى إعادة المحاولة أو التواصل مع الإدارة.**`,
                    );
                } catch {}
                return;
            }

            // الدفع ناجح - عرض زر فتح النموذج
            const openModalRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`open_shop_modal_${userId}`)
                    .setLabel("🏪 إدخال بيانات المتجر")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(emojis.yes),
            );

            await interaction.channel.send({
                content: `**تم التحقق من التحويل بنجاح. يرجى الضغط على الزر لإدخال بيانات المتجر.** <@!${userId}>`,
                components: [openModalRow],
            });
        });

        currencyCollector.on("end", async (_collected, reason) => {
            if (reason !== "user") {
                await currencyMsg.delete().catch(() => {});
                await interaction.channel.send(
                    `**⏰ انتهى الوقت ولم يتم اختيار طريقة الدفع.** <@!${userId}>`,
                );
            }
        });
    } catch (error) {
        console.error("Error handling shop type selection:", error);
        await interaction.editReply({
            content: "❌ حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى لاحقًا.",
        });
    }
}

        // === فتح النموذج (Modal) بعد الدفع ===
        if (interaction.customId.startsWith("open_shop_modal_")) {
            const targetUserId = interaction.customId.split("_")[3];
            if (interaction.user.id !== targetUserId) {
                return interaction.reply({ content: "**هذا الزر ليس لك!**", ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`shop_modal_${targetUserId}`)
                .setTitle("بيانات المتجر");

            const shopNameInput = new TextInputBuilder()
                .setCustomId("shop_name")
                .setLabel("🏪 اسم المتجر")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("أدخل اسم المتجر")
                .setRequired(true)
                .setMaxLength(100);

            const shopDescInput = new TextInputBuilder()
                .setCustomId("shop_description")
                .setLabel("📝 وصف المتجر")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("أدخل وصف المتجر")
                .setRequired(true)
                .setMaxLength(500);

            const shopEmojiInput = new TextInputBuilder()
                .setCustomId("shop_emoji")
                .setLabel("😀 إيموجي المتجر")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("مثال: 🏪")
                .setRequired(true)
                .setMaxLength(10);

            modal.addComponents(
                new ActionRowBuilder().addComponents(shopNameInput),
                new ActionRowBuilder().addComponents(shopDescInput),
                new ActionRowBuilder().addComponents(shopEmojiInput),
            );

            await interaction.showModal(modal);
            return;
        }

        // === معالجة بيانات النموذج (Modal) لإنشاء المتجر ===
        if (interaction.isModalSubmit() && interaction.customId.startsWith("shop_modal_")) {
            await interaction.deferReply({ ephemeral: true });
            const targetUserId = interaction.customId.split("_")[2];
            if (interaction.user.id !== targetUserId) {
                return interaction.editReply({ content: "**هذا النموذج ليس لك!**" });
            }

            const shopName = interaction.fields.getTextInputValue("shop_name");
            const shopDescription = interaction.fields.getTextInputValue("shop_description");
            const shopEmoji = interaction.fields.getTextInputValue("shop_emoji");

            // جلب بيانات التكت
            const ticketData = await db.get(`shop_ticket_${interaction.member.id}_${guildId}`);
            if (!ticketData) {
                return interaction.editReply({ content: "**❌ لم يتم العثور على بيانات التكت.**" });
            }

            const categoryId = ticketData.categoryId;
            const categoryData = await db.get(`categoryMentions_${categoryId}_${guildId}`);
            if (!categoryData) {
                return interaction.editReply({ content: "**❌ لم يتم العثور على بيانات الفئة.**" });
            }

            const pirefix = categoryData.pirefix;
            const name = shopName.replaceAll(" ", "・");
            const admin = await db.get(`shopad_${guildId}`);
            const parentCat = await pickShopCategory(db, guildId, categoryId);

            const shopChannel = await interaction.guild.channels.create({
                name: `${pirefix}${name}`,
                type: ChannelType.GuildText,
                parent: parentCat,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.CreatePublicThreads,
                            PermissionFlagsBits.CreatePrivateThreads,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks,
                        ],
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.MentionEveryone,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.UseExternalEmojis,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                    {
                        id: admin,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.MentionEveryone,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.UseExternalEmojis,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                ],
            });

            const datecreated = `<t:${parseInt(Date.now() / 1000)}:R>`;
            const shopData = {
                channelId: shopChannel.id,
                categoryId: categoryId,
                sellerId: interaction.user.id,
                everyoneMentions: categoryData.everyoneMentions,
                hereMentions: categoryData.hereMentions,
                shopmen: categoryData.shopmen,
                shoprole: categoryData.shoprole,
                shopRoleMentions: categoryData.shopRoleMentions,
                maxWarns: categoryData.maxWarns,
                date: datecreated,
                taxPrice: categoryData.taxPrice,
                hasTax: categoryData.hasTax,
                nametype: categoryData.nametype,
                pirefix: pirefix,
                shopname: shopName,
                shopEmoji: shopEmoji,
                shopDescription: shopDescription,
            };

            await db.set(`shop_${shopChannel.id}_${guildId}`, shopData);
            await db.set(`shop_${shopChannel.id}_${guildId}.warns`, "0");
            await db.set(`shop_${shopChannel.id}_${guildId}.status`, "1");
            await db.delete(`shop_credit_${targetUserId}_${guildId}`);

            // منح رتبة المتجر
            if (categoryData.shoprole) {
                if (interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                    try {
                        const seller = await interaction.guild.members.fetch(interaction.user.id);
                        await seller.roles.add(categoryData.shoprole);
                    } catch (error) {
                        console.error(`Failed to add role to seller: ${error}`);
                    }
                } else {
                    await interaction.channel.send("**عذرا البوت لا يمتلاك الصلاحيات لمنح رتبة المتجر.**");
                }
            }

            // رسالة التأكيد
            const em5 = new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ${shopEmoji} تم انشاء متجر: ${shopName}`)
                .setDescription(`**${shopDescription}**`)
                .setAuthor({
                    name: interaction.guild.name,
                    iconURL: interaction.guild.iconURL({ size: 1024 }),
                })
                .setFooter(D.footer(interaction.guild))
                .setThumbnail(D.thumb(interaction.guild))
                .setTimestamp();

            await shopChannel.send({ embeds: [em5] });

            // فاتورة الشراء
            const bank = await db.get(`bank_${guildId}`);
            const shopPrice = categoryData.shopPrice;
            const totalPriceC = Math.floor(shopPrice * (20 / 19) + 1);
            const totalPriceRe = Math.ceil(totalPriceC / 5);
            const guildName = interaction.guild.name;

            const invoiceEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                .setDescription(
                    `**تمت عملية الشراء بنجاح!**\n` +
                        `- اسم المتجر: **${shopName}**\n` +
                        `- وصف المتجر: ${shopDescription}\n` +
                        `- إيموجي المتجر: ${shopEmoji}\n` +
                        `- التحويل لـ: <@!${bank}>\n` +
                        `- السعر (c): \`${totalPriceC}\`\n` +
                        `- السعر (Re): \`${totalPriceRe}\``,
                )
                .setFooter(D.thanksFooter(interaction.guild))
                .setThumbnail(D.thumb(interaction.guild))
                .setTimestamp();

            try {
                await interaction.user.send({ embeds: [invoiceEmbed] });
            } catch {
                await interaction.channel.send({
                    content: `<@${interaction.user.id}> ** فاتورتك (تعذّر إرسالها بـ DM):**`,
                    embeds: [invoiceEmbed],
                });
            }

            // Shop log
            const shopLogId = await db.get(`logs_${guildId}`);
            if (shopLogId) {
                const shopLogCh = interaction.guild.channels.cache.get(shopLogId);
                if (shopLogCh) {
                    const shopLog = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم إنشاء متجر جديد")
                        .setColor(await getColor(guildId, db, config))
                        .addFields(
                            { name: "المتجر", value: `${shopChannel}`, inline: true },
                            { name: "المالك", value: `<@${interaction.user.id}>`, inline: true },
                            { name: "النوع", value: categoryData.nametype || "—", inline: true },
                            { name: "الإطار", value: shopEmoji, inline: true },
                        )
                        .setTimestamp();
                    await shopLogCh.send({ embeds: [shopLog] });
                }
            }

            await db.delete(`shop_ticket_channel_${interaction.channel.id}`);
            await interaction.editReply({ content: `**✅ تم إنشاء المتجر بنجاح: <#${shopChannel.id}>**` });
            await interaction.channel.delete();
            return;
        }

        if (interaction.customId === "closeshop") {
            await interaction.deferReply();
            const shopChannelMeta = await db.get(
                `shop_ticket_channel_${channel.id}`,
            );
            const shopTicketOwnerId = shopChannelMeta?.ownerId || userId;
            const shopTicketGuildId = shopChannelMeta?.guildId || guildId;
            await db.delete(
                `shop_credit_${shopTicketOwnerId}_${shopTicketGuildId}`,
            );
            await db.delete(
                `shop_ticket_${shopTicketOwnerId}_${shopTicketGuildId}`,
            );

            const closingEmbed = new EmbedBuilder()
                .setDescription(ED.shopInteractions_005())
                .setColor(await getColor(guildId, db, config));

            await interaction.editReply({ embeds: [closingEmbed] });

            setTimeout(async () => {
                await channel.permissionOverwrites.edit(guildId, {
                    ViewChannel: false,
                });
                await channel.permissionOverwrites.edit(shopTicketOwnerId, {
                    ViewChannel: false,
                });
                const shopAdminRoleId = await db.get(`shopad_${guildId}`);
                const shopAdminRole =
                    interaction.guild.roles.cache.get(shopAdminRoleId);
                if (shopAdminRole) {
                    await channel.permissionOverwrites.edit(shopAdminRole.id, {
                        ViewChannel: true,
                    });
                }

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("reopenshop")
                        .setLabel("فتح التذكرة")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(emojis.reopen),
                    new ButtonBuilder()
                        .setCustomId("deleteshop")
                        .setLabel("حذف التذكرة")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(emojis.delete),
                );

                const closedEmbed = new EmbedBuilder()
                    .setDescription(ED.shopInteractions_006())
                    .setColor(await getColor(guildId, db, config));

                await channel.send({
                    embeds: [closedEmbed],
                    components: [actionRow],
                });
            }, 5000);
        } 
        else if (interaction.customId === "reopenshop") {
            await interaction.deferReply();
            const shopAdminRoleId = await db.get(`shopad_${guildId}`);
            const shopAdminRole =
                interaction.guild.roles.cache.get(shopAdminRoleId);
            const shopReopenMeta = await db.get(
                `shop_ticket_channel_${channel.id}`,
            );
            const shopReopenOwnerId = shopReopenMeta?.ownerId || userId;

            await channel.permissionOverwrites.set([
                {
                    id: guildId,
                    deny: ["ViewChannel"],
                },
                {
                    id: shopReopenOwnerId,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "EmbedLinks",
                        "AttachFiles",
                    ],
                },
                {
                    id: shopAdminRole.id,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "MentionEveryone",
                        "EmbedLinks",
                        "AttachFiles",
                    ],
                },
            ]);

            const reopenedEmbed = new EmbedBuilder()
                .setDescription(ED.shopInteractions_007())
                .setColor(await getColor(guildId, db, config));

            const newActionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("closeshop")
                    .setLabel("إغلاق التذكرة")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.close),
            );

            await interaction.editReply({
                embeds: [reopenedEmbed],
                components: [newActionRow],
            });

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("reopenshop")
                    .setLabel("فتح التذكرة")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
                    .setEmoji(emojis.reopen),
                new ButtonBuilder()
                    .setCustomId("deleteshop")
                    .setLabel("حذف التذكرة")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
                    .setEmoji(emojis.delete),
            );

            await interaction.message.edit({ components: [disabledRow] });
        } else if (interaction.customId === "deleteshop") {
            await db.delete(`shop_ticket_channel_${interaction.channel.id}`);
            await interaction.channel.delete();
        }
    });

    
    // ========== ticket-auction: إنشاء تكت المزاد ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    
    const guildId = _ec.gid(interaction);
    const userId = interaction.user.id;
    
    if (interaction.customId === "ticket-auction") {
        const auctionCategoryId = await db.get(`catbuy_auction_${guildId}`);
        if (!auctionCategoryId) {
            return interaction.reply({
                content: "❌ يرجى تحديد كتاغوري الشراء باستخدام الأمر: /setup",
                ephemeral: true,
            });
        }
        
        const auctionAdminRoleId = await db.get(`auctionad_${guildId}`);
        const auctionAdminRole = interaction.guild.roles.cache.get(auctionAdminRoleId);
        
        if (!auctionAdminRole) {
            return interaction.reply({
                content: "❌ يرجى تحديد مسؤول المزاد باستخدام الأمر: /setup",
                ephemeral: true,
            });
        }
        
        try {
            const auctionData = await db.get(`auction_ticket_${userId}_${guildId}`);
            if (auctionData) {
                const existingChannel = interaction.guild.channels.cache.get(auctionData.channelId);
                if (existingChannel) {
                    return interaction.reply({
                        content: `❌ لديك تذكرة مفتوحة بالفعل: <#${existingChannel.id}>`,
                        ephemeral: true,
                    });
                } else {
                    await db.delete(`auction_ticket_${userId}_${guildId}`);
                }
            }
            
            await interaction.deferReply({ ephemeral: true });
            
            const ticketChannel = await interaction.guild.channels.create({
                name: `auction-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: auctionCategoryId,
                permissionOverwrites: [
                    {
                        id: userId,
                        allow: ["SendMessages", "EmbedLinks", "AttachFiles", "ViewChannel"],
                    },
                    {
                        id: interaction.guild.roles.everyone,
                        deny: ["ViewChannel"],
                    },
                    {
                        id: auctionAdminRole.id,
                        allow: ["SendMessages", "ViewChannel", "MentionEveryone"],
                    },
                ],
            });
            
            await db.set(`auction_ticket_${userId}_${guildId}`, {
                userId,
                channelId: ticketChannel.id,
            });
            await db.set(`auction_ticket_channel_${ticketChannel.id}`, {
                ownerId: userId,
                guildId,
            });
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("every-auction").setLabel("مـنشـن ايفري").setStyle(ButtonStyle.Secondary).setEmoji(emojis.auction),
                new ButtonBuilder().setCustomId("here-auction").setLabel("مـنشـن هـيـر").setStyle(ButtonStyle.Secondary).setEmoji(emojis.auction),
                new ButtonBuilder().setCustomId("mzad-auction").setLabel("مـنشـن مـزاد").setStyle(ButtonStyle.Secondary).setEmoji(emojis.auction),
                new ButtonBuilder().setCustomId("closeauction").setLabel("اغـلاق الـتـكت").setStyle(ButtonStyle.Danger).setEmoji(emojis.close || "🔒"),
            );
            
            const auctionEveryPrice = await db.get(`auction-evrypri_${guildId}`);
            const auctionHerePrice = await db.get(`auction-herepri_${guildId}`);
            const auctionMzadPrice = await db.get(`auction-mzadpri_${guildId}`);
            const bank = await db.get(`bank_${guildId}`);
            const auctionImage = await db.get(`buyauctionimage_${guildId}`);
            const line = await db.get(`image_${guildId}`);
            const color = _ec.color(guildId);
            
            const auctionEmbed = new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504>  ** تـكـت المـزادات ** `)
                .setDescription(
                    `# - اسعار المزادات ${interaction.guild.name} \n\n` +
                    `### أسـعـار المـزادات \n` +
                    `${config.money} - مـنـشـن ( @everyone ) : \`${auctionEveryPrice || "غير محدد"}\`\n` +
                    `${config.money} - مـنـشـن ( @here ) : \`${auctionHerePrice || "غير محدد"}\`\n` +
                    `${config.money} - مـنـشـن مـزاد (رول) : \`${auctionMzadPrice || "غير محدد"}\`\n\n` +
                    `التـحـويـل لـ <@!${bank || "غير محدد"}>`,
                )
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 1024 }) })
                .setFooter({ text: interaction.guild.name })
                .setTimestamp()
                .setColor(color);
            
            if (auctionImage) auctionEmbed.setImage(auctionImage);
            
            await ticketChannel.send({
                content: `<@${userId}> <@&${auctionAdminRole.id}>`,
                embeds: [auctionEmbed],
                components: [row],
            });
            
            if (line) { const lineEmbed = new EmbedBuilder().setColor(_ec.color(guildId)); if (line.startsWith("http")) lineEmbed.setImage(line); else lineEmbed.setDescription(line); await ticketChannel.send({ embeds: [lineEmbed] }); }
            
            await interaction.reply({
                content: `**__ تم انشاء تذكرتك بنجاح : <#${ticketChannel.id}> __**`,
            });
        } catch (error) {
            console.error(error);
            if (interaction.deferred) {
                await interaction.reply({ content: "❌ حدث خطأ أثناء إنشاء التذكرة." });
            }
        }
    }
});

// ========== auctionpri: زر عرض الأسعار ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    
    const guildId = _ec.gid(interaction);
    
    if (interaction.customId === "auctionpri") {
        await interaction.deferReply({ ephemeral: true });
        try {
            const auctionEveryPrice = await db.get(`auction-evrypri_${guildId}`);
            const auctionHerePrice = await db.get(`auction-herepri_${guildId}`);
            const auctionMzadPrice = await db.get(`auction-mzadpri_${guildId}`);
            const bank = await db.get(`bank_${guildId}`);
            const imageUrl = (await db.get(`priceAuctionImage_${guildId}`)) || (await db.get(`image_${guildId}`));
            const color = _ec.color(guildId);
            
            const auction_prices_embed = new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504>  ** اسعار المـزادات ** `)
                .setDescription(
                    `# - اسعار المزادات في سيرفر ${interaction.guild.name} \n\n` +
                    `### أسـعـار المـزادات المتاحة: \n` +
                    `${config.money} - مـنـشـن ( @everyone ) : \`${auctionEveryPrice || "غير محدد"}\`\n` +
                    `${config.money} - مـنـشـن ( @here ) : \`${auctionHerePrice || "غير محدد"}\`\n` +
                    `${config.money} - مـنـشـن مـزاد (رول) : \`${auctionMzadPrice || "غير محدد"}\` \n\n` +
                    `**التـحـويـل لـ:** <@!${bank || "غير محدد"}>`,
                )
                .setAuthor({ name: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL({ size: 1024 }) })
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: interaction.guild?.name || "Server", iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp()
                .setColor(color);
            
            if (imageUrl) auction_prices_embed.setImage(imageUrl);
            
            await interaction.editReply({ embeds: [auction_prices_embed] });
        } catch (error) {
            console.error("Error in auction prices button:", error);
            if (!interaction.deferred) {
                await interaction.editReply({ content: "❌ حدث خطأ أثناء جلب الأسعار." });
            }
        }
    }
});
    // ========== دالة موحدة لأزرار الدفع ==========
async function handleAuctionPayment(interaction, db, config, type) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const priceMap = {
        every: { key: "auction-evrypri_", mention: "@everyone" },
        here: { key: "auction-herepri_", mention: "@here" },
        mzad: { key: "auction-mzadpri_", mention: "mzad" },
    };

    const p = priceMap[type];
    if (!p) return;

    const bank = await db.get(`bank_${guildId}`);
    const price = await db.get(`${p.key}${guildId}`);
    const mzadRoleId = type === "mzad" ? await db.get(`auctionmzadrole_${guildId}`) : null;

    if (!bank) return interaction.editReply({ content: "يرجى تحديد البنك: /setup" });
    if (!price) return interaction.editReply({ content: `يرجى تحديد سعر منشن ${p.mention}: /setup-prices` });
    if (type === "mzad" && !mzadRoleId) return interaction.editReply({ content: "يرجى تحديد رول المزاد: /setup" });

    const activePurchase = await db.get(`auction_credit_${userId}_${guildId}`);
    if (activePurchase) return interaction.editReply({ content: `**لديك عملية شراء قيد التنفيذ بالفعل.**` });

    const ticketOwner = await db.get(`auction_ticket_${interaction.member.id}_${guildId}.userId`);
    if (ticketOwner !== interaction.user.id) return interaction.editReply({ content: `**يمكن لصاحب التكت فقط استعمال الأزرار**` });

    const totalPrice = Math.floor(price * (20 / 19) + 1);
    await interaction.editReply({ content: `**\`السعر مع الضريبة: ${totalPrice}\`**` });
    await interaction.channel.send(`Re <@!${bank}> ${totalPrice}`);
    await interaction.channel.send(`\`\`\`Re ${bank} ${totalPrice}\`\`\``);
    await interaction.channel.send(`. \`يرجى التحويل في أسرع وقت ممكن هنا\` <@!${userId}>`);
    await db.set(`auction_credit_${userId}_${guildId}`, userId);

    const bankBotId = PAYMENT_BOT_ID;
    const collector = interaction.channel.createMessageCollector({
        filter: (m) => m.author.id === bankBotId,
        time: 120000,
    });

    collector.on("collect", (c) => {
        const content = c.content;
        let paidAmount = 0;
        const btMatch = content.match(/`\$?([\d,]+(?:\.\d+)?)`/);
        const engMatch = content.match(/transferred\s+\$?([\d,]+)/i);
        const arMatch = content.match(/بتحويل\s+\$?([\d,]+)/);
        const found = btMatch || engMatch || arMatch;
        if (found) paidAmount = Number(found[1].replace(/,/g, ""));

        const bankMentionOk = content.includes(`<@!${bank}>`) || content.includes(`<@${bank}>`);
        const isTransfer = content.includes("has transferred") || content.includes("قام بتحويل");

        if (isTransfer && bankMentionOk && paidAmount >= price) {
            collector.stop("DONE");
        }
    });

    const auctionadmin = await db.get(`auctionad_${guildId}`);
    collector.on("end", async (collected, reason) => {
        await db.delete(`auction_credit_${userId}_${guildId}`);
        if (reason === "DONE") {
            await db.add(`ernss_${guildId}.erns`, Number(price));
            await db.add(`ernsg.ernsg`, Number(price));
            try {
                const invoiceEmbed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                    .setDescription(ED.shopInteractions_012({ bank, config, price, totalPrice, type, mzadRoleId }))
                    .setFooter(D.thanksFooter(interaction.guild))
                    .setThumbnail(D.thumb(interaction.guild))
                    .setTimestamp();
                await interaction.user.send({ embeds: [invoiceEmbed] });
            } catch {}

            let mentionType = type === "every" ? "@everyone" : type === "here" ? "@here" : `<@&${mzadRoleId}>`;

            await runAuctionQuestionFlow(
                interaction.channel, db, config, mentionType,
                totalPrice, price, guildId, userId, auctionadmin,
            );
        } else {
            await interaction.channel.send({ content: `**انتهى الوقت ولم يتم التحويل.** <@!${userId}>` });
        }
    });
}

// ========== الأزرار الثلاثة ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;

    if (interaction.customId === "every-auction") await handleAuctionPayment(interaction, db, config, "every");
    if (interaction.customId === "here-auction") await handleAuctionPayment(interaction, db, config, "here");
    if (interaction.customId === "mzad-auction") await handleAuctionPayment(interaction, db, config, "mzad");
});
    
    // ========== runAuctionQuestionFlow ==========
async function runAuctionQuestionFlow(channel, db, config, mentionType, paidPrice, originalPrice, guildId, userId, auctionadmin) {
    const timeoutMsg = `**⏳ انتهى الوقت.** <@!${userId}>`;

    // 1. اسم السلعة
    await channel.send(`<@${userId}> ** ما هي السلعة؟** *(لديك 3 دقائق)*`);
    let itemName;
    try {
        const c = await channel.awaitMessages({ filter: (m) => m.author.id === userId, max: 1, time: 180000, errors: ["time"] });
        itemName = c.first().content;
    } catch {
        await channel.send(timeoutMsg);
        await channel.send("**🔒 سيتم إغلاق التكت تلقائياً خلال 5 ثواني...**");
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return;
    }

    // 2. الضريبة
    const taxRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`atax_yes_${userId}`).setLabel("نعم - بضريبة").setStyle(ButtonStyle.Success).setEmoji(emojis.tax),
        new ButtonBuilder().setCustomId(`atax_no_${userId}`).setLabel("لا - بدون ضريبة").setStyle(ButtonStyle.Danger).setEmoji(emojis.cancel),
    );
    const taxMsg = await channel.send({ content: `<@${userId}> ** هل السلعة بضريبة؟**`, components: [taxRow] });
    let includesTax;
    try {
        const btnI = await taxMsg.awaitMessageComponent({ filter: (i) => i.user.id === userId, time: 180000 });
        includesTax = btnI.customId === `atax_yes_${userId}`;
        await btnI.reply({ content: `**✅ تم الاختيار: ${includesTax ? "بضريبة" : "بدون ضريبة"}**`, ephemeral: true });
        await taxMsg.edit({ components: [] });
    } catch {
        await channel.send(timeoutMsg);
        await channel.send("**🔒 سيتم إغلاق التكت تلقائياً خلال 5 ثواني...**");
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return;
    }

    // 3. السعر المبدئي
    await channel.send(`<@${userId}> **💵 أرسل السعر المبدئي للسلعة:**`);
    let startPrice;
    try {
        const c = await channel.awaitMessages({ filter: (m) => m.author.id === userId, max: 1, time: 180000, errors: ["time"] });
        startPrice = c.first().content;
    } catch {
        await channel.send(timeoutMsg);
        await channel.send("**🔒 سيتم إغلاق التكت تلقائياً خلال 5 ثواني...**");
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return;
    }

    const durationMinutes = 5;

    // 4. الصور والفيديو
    const imgRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`aimg_yes_${userId}`).setLabel("نعم").setStyle(ButtonStyle.Success).setEmoji(emojis.confirm),
        new ButtonBuilder().setCustomId(`aimg_no_${userId}`).setLabel("لا").setStyle(ButtonStyle.Danger).setEmoji(emojis.cancel),
    );
    const imgPromptMsg = await channel.send({ content: `<@${userId}> ** هل تريد إضافة صور أو فيديو؟**`, components: [imgRow] });
    let imageUrl = null;
    let videoUrl = null;
    try {
        const btnI = await imgPromptMsg.awaitMessageComponent({ filter: (i) => i.user.id === userId, time: 180000 });
        const wantsImages = btnI.customId === `aimg_yes_${userId}`;
        await btnI.deferUpdate();
        await imgPromptMsg.edit({ components: [] });
        if (wantsImages) {
            await channel.send(`<@${userId}> ** أرسل الصورة أو الفيديو (مرفق مباشر أو رابط):** *(لديك 3 دقائق)*`);
            try {
                const imgC = await channel.awaitMessages({ filter: (m) => m.author.id === userId, max: 1, time: 180000, errors: ["time"] });
                const imgMsg = imgC.first();
                if (imgMsg.attachments.size > 0) {
                    const att = imgMsg.attachments.first();
                    if (att.contentType?.startsWith("video/")) {
                        videoUrl = att.url;
                    } else {
                        imageUrl = att.url;
                    }
                } else if (imgMsg.content && imgMsg.content.startsWith("http")) {
                    const url = imgMsg.content.trim();
                    if (url.match(/\.(mp4|webm|mov|gif)$/i)) {
                        videoUrl = url;
                    } else {
                        imageUrl = url;
                    }
                }
            } catch { /* continue without media */ }
        }
    } catch {
        await channel.send(timeoutMsg);
        await channel.send("**🔒 سيتم إغلاق التكت تلقائياً خلال 5 ثواني...**");
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return;
    }

    // حفظ المسودة
    const draft = {
        itemName, includesTax, startPrice, durationMinutes,
        imageUrl, videoUrl, mentionType, owner: userId, paidPrice, originalPrice,
    };
    await db.set(`auction_draft_${userId}_${guildId}`, draft);

    // عرض الملخص
    const auctionadminId = await db.get(`auctionad_${guildId}`);
    await showAuctionSummary(channel, draft, userId, guildId, auctionadminId);
}

// ========== عرض ملخص المزاد مع أزرار التعديل ==========
async function showAuctionSummary(channel, draft, userId, guildId, auctionadmin) {
    const summaryEmbed = new EmbedBuilder()
        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> ** ملخص تفاصيل المزاد**")
        .setDescription(
            ED.shopInteractions_011({
                config, durationMinutes: draft.durationMinutes,
                includesTax: draft.includesTax, itemName: draft.itemName,
                mentionType: draft.mentionType, startPrice: draft.startPrice, userId,
            }),
        )
        .setColor(await getColor(guildId, db, config))
        .setTimestamp();
    if (draft.imageUrl) summaryEmbed.setImage(draft.imageUrl);

    const publishRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`publish_auction_${userId}`).setLabel("نشر المزاد").setStyle(ButtonStyle.Secondary).setEmoji(emojis.auction),
        new ButtonBuilder().setCustomId(`edit_auction_${userId}`).setLabel("تعديل المزاد").setStyle(ButtonStyle.Primary).setEmoji("✏️"),
        new ButtonBuilder().setCustomId(`cancel_auction_${userId}`).setLabel("إلغاء المزاد").setStyle(ButtonStyle.Danger).setEmoji(emojis.cancelAuction),
    );

    return await channel.send({
        content: `<@&${auctionadmin}>`,
        embeds: [summaryEmbed],
        components: [publishRow],
    });
}

// ========== زر التعديل ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("edit_auction_")) return;
    if (!interaction.guild) return;

    const ownerId = interaction.customId.replace("edit_auction_", "");
    const guildId = interaction.guild.id;

    if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "**❌ فقط صاحب المزاد يمكنه التعديل.**", ephemeral: true });
    }

    const draft = await db.get(`auction_draft_${ownerId}_${guildId}`);
    if (!draft) return interaction.reply({ content: "**❌ لا توجد بيانات مزاد للتعديل.**", ephemeral: true });

    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => {});

    const editMenu = new StringSelectMenuBuilder()
        .setCustomId(`edit_field_${ownerId}`)
        .setPlaceholder("اختر الحقل المراد تعديله")
        .addOptions([
            { label: "اسم السلعة", value: "itemName", description: draft.itemName?.slice(0, 50) || "—", emoji: "📦" },
            { label: "السعر المبدئي", value: "startPrice", description: String(draft.startPrice).slice(0, 50), emoji: "💵" },
            { label: "الضريبة", value: "includesTax", description: draft.includesTax ? "بضريبة" : "بدون ضريبة", emoji: "🧾" },
            { label: "الصورة/الفيديو", value: "media", description: "تغيير الوسائط", emoji: "🖼️" },
            { label: "تم الانتهاء", value: "done", description: "العودة للملخص", emoji: "✅" },
        ]);

    await interaction.channel.send({
        content: `**✏️ اختر ما تريد تعديله:**`,
        components: [new ActionRowBuilder().addComponents(editMenu)],
    });
});

// ========== استقبال اختيار التعديل ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith("edit_field_")) return;
    if (!interaction.guild) return;

    const ownerId = interaction.customId.replace("edit_field_", "");
    const guildId = interaction.guild.id;
    const field = interaction.values[0];

    if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "**❌ فقط صاحب المزاد يمكنه التعديل.**", ephemeral: true });
    }

    const draft = await db.get(`auction_draft_${ownerId}_${guildId}`);
    if (!draft) return interaction.reply({ content: "**❌ لا توجد بيانات.**", ephemeral: true });
    const auctionadmin = await db.get(`auctionad_${guildId}`);

    if (field === "done") {
        await interaction.deferUpdate();
        await interaction.message.delete().catch(() => {});
        await showAuctionSummary(interaction.channel, draft, ownerId, guildId, auctionadmin);
        return;
    }

    await interaction.reply({ content: `**✏️ أرسل القيمة الجديدة لـ \`${field}\`:**`, ephemeral: true });

    try {
        const msgs = await interaction.channel.awaitMessages({
            filter: (m) => m.author.id === ownerId, max: 1, time: 120000, errors: ["time"],
        });
        const msg = msgs.first();

        if (field === "includesTax") {
            draft.includesTax = msg.content.toLowerCase().includes("نعم") || msg.content.toLowerCase().includes("yes");
        } else if (field === "media") {
            if (msg.attachments.size > 0) {
                const att = msg.attachments.first();
                if (att.contentType?.startsWith("video/")) {
                    draft.videoUrl = att.url;
                    draft.imageUrl = null;
                } else {
                    draft.imageUrl = att.url;
                    draft.videoUrl = null;
                }
            } else if (msg.content.startsWith("http")) {
                if (msg.content.match(/\.(mp4|webm|mov|gif)$/i)) {
                    draft.videoUrl = msg.content.trim();
                    draft.imageUrl = null;
                } else {
                    draft.imageUrl = msg.content.trim();
                    draft.videoUrl = null;
                }
            }
        } else {
            draft[field] = msg.content;
        }

        await db.set(`auction_draft_${ownerId}_${guildId}`, draft);
        await interaction.channel.send({ content: `**✅ تم تحديث \`${field}\` بنجاح.**` });
        await showAuctionSummary(interaction.channel, draft, ownerId, guildId, auctionadmin);

    } catch {
        await interaction.channel.send({ content: "**⏰ انتهى الوقت.**" });
        await showAuctionSummary(interaction.channel, draft, ownerId, guildId, auctionadmin);
    }
});

    // ========== publish_auction ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("publish_auction_")) return;
    if (!interaction.guild) return;

    const ownerId = interaction.customId.replace("publish_auction_", "");
    const guildId = interaction.guild.id;

    const auctionadminId = await db.get(`auctionad_${guildId}`);
    if (!auctionadminId || !interaction.member.roles.cache.has(auctionadminId)) {
        return interaction.reply({ content: `**🚫 يجب أن تملك رتبة <@&${auctionadminId || "?"}> لنشر المزاد.**`, ephemeral: true });
    }

    let rooms = (await db.get(`auctionrooms_${guildId}`)) || [];
    const singleRoom = await db.get(`auctionroom_${guildId}`);
    if (rooms.length === 0 && singleRoom) rooms = [singleRoom];
    if (rooms.length === 0) {
        return interaction.reply({ content: "**❌ لا يوجد رومات مزاد. استخدم `/add-mzad-room`.**", ephemeral: true });
    }

    const options = [];
    for (const roomId of rooms) {
        const roomChannel = interaction.guild.channels.cache.get(roomId);
        if (!roomChannel) continue;
        const isActive = await db.get(`active_auction_${roomId}`);
        options.push({
            label: roomChannel.name,
            value: roomId,
            description: isActive ? "🔴 يوجد مزاد شغال" : "🟢 متاح للنشر",
        });
    }

    if (options.length === 0) return interaction.reply({ content: "**❌ لا يوجد رومات صالحة.**", ephemeral: true });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`auction_room_select_${ownerId}`)
        .setPlaceholder("اختر روم المزاد")
        .addOptions(options);

    await interaction.reply({
        content: "**اختر روم المزاد:**",
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true,
    });
});

// ========== cancel_auction ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("cancel_auction_")) return;
    if (!interaction.guild) return;

    const ownerId = interaction.customId.replace("cancel_auction_", "");
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const auctionadminId = await db.get(`auctionad_${guildId}`);
    if (userId !== ownerId && (!auctionadminId || !interaction.member.roles.cache.has(auctionadminId))) {
        return interaction.reply({ content: "**🚫 ليس لديك صلاحية إلغاء هذا المزاد.**", ephemeral: true });
    }

    await db.delete(`auction_draft_${ownerId}_${guildId}`);
    await db.delete(`auction_ticket_${ownerId}_${guildId}`);

    await interaction.deferUpdate().catch(() => {});

    try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        if (messages.size > 0) await interaction.channel.bulkDelete(messages, true).catch(() => {});
    } catch {}

    const cancelEmbed = new EmbedBuilder()
        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم إلغاء المزاد")
        .setDescription(ED.shopInteractions_015({ userId }))
        .setColor(await getColor(guildId, db, config))
        .setTimestamp();

    await interaction.channel.send({ embeds: [cancelEmbed] }).catch(() => {});
    await sendTicketRatingDM(ownerId, guildId, "auction").catch(() => {});

    setTimeout(async () => {
        try { await interaction.channel.delete(); } catch {}
    }, 5000);
});

// ========== closeauction: إغلاق التكت ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "closeauction") return;
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const channel = interaction.channel;

    const meta = await db.get(`auction_ticket_channel_${channel.id}`);
    const ownerId = meta?.ownerId || interaction.user.id;
    const gId = meta?.guildId || guildId;

    await db.delete(`auction_ticket_${ownerId}_${gId}`);
    await db.delete(`auction_ticket_channel_${channel.id}`);
    await db.delete(`auction_credit_${ownerId}_${gId}`);
    await db.delete(`auction_draft_${ownerId}_${gId}`);

    await interaction.reply({ content: "**🔒 سيتم إغلاق التكت...**" });
    setTimeout(() => channel.delete().catch(() => {}), 3000);
});

// ========== auction_room_select: نشر المزاد في الروم ==========
const auctionTimers = new Map();
const activeAuctions = new Set();

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith("auction_room_select_")) return;
    if (!interaction.guild) return;

    const ownerId = interaction.customId.replace("auction_room_select_", "");
    const guildId = interaction.guild.id;
    const roomId = interaction.values[0];

    const isActive = await db.get(`active_auction_${roomId}`);
    if (isActive) return interaction.reply({ content: "**❌ يوجد مزاد شغال، اختر روماً آخر.**", ephemeral: true });

    const draft = await db.get(`auction_draft_${ownerId}_${guildId}`);
    if (!draft) return interaction.reply({ content: "**❌ انتهت صلاحية بيانات المزاد.**", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const roomChannel = interaction.guild.channels.cache.get(roomId);
    if (!roomChannel) return interaction.editReply("**❌ الروم غير موجود.**");

    await roomChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });

    const initRem = draft.durationMinutes * 60;
    const auctionMsg = await roomChannel.send({ content: await _buildAuctionMsg(draft, initRem, db, guildId) });

    if (draft.videoUrl) {
        try {
            await roomChannel.send({ content: `** فيديو السلعة:**\n${draft.videoUrl}` });
        } catch {}
    } else if (draft.imageUrl) {
        try {
            await roomChannel.send({ files: [{ attachment: draft.imageUrl, name: "auction.png" }] });
        } catch {
            await roomChannel.send(`**صورة السلعة:**\n${draft.imageUrl}`);
        }
    }

    const auctionRules = await db.get(`mzad_rules_${guildId}`);
    if (auctionRules && auctionRules.trim()) {
        await roomChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  قوانين المزاد")
                    .setDescription(ED.shopInteractions_018({ auctionRules }))
                    .setColor(await getColor(guildId, db, config))
                    .setTimestamp(),
            ],
        });
    }

    const controlMsg = await roomChannel.send({
        content: "**— لوحة تحكم المزاد (للمسؤولين فقط) —**",
        components: [_buildControlRow(roomId)],
    });

    await db.set(`active_auction_${roomId}`, {
        ownerId, guildId, startedAt: Date.now(), draft,
        remainingTime: initRem, auctionMsgId: auctionMsg.id, controlMsgId: controlMsg.id,
    });

    const timerData = {
        remainingTime: initRem, paused: false,
        guild: interaction.guild, roomChannel, draft, guildId,
        auctionMsg, controlMsg, oneMinuteNoticeSent: false,
        interval: null, lastBidder: null, lastBidAmount: null,
    };

    if (activeAuctions.has(roomId)) {
        const oldTd = auctionTimers.get(roomId);
        if (oldTd) clearInterval(oldTd.interval);
    }

    startAuctionInterval(timerData, roomId);

    await db.delete(`auction_draft_${ownerId}_${guildId}`);
    await db.delete(`auction_ticket_${ownerId}_${guildId}`);
    await interaction.reply(`**✅ تم نشر المزاد في ${roomChannel}**`);
    setTimeout(async () => { try { await interaction.channel.delete(); } catch {} }, 4000);
});

// ========== التايمر ==========
function startAuctionInterval(timerData, roomId) {
    if (activeAuctions.has(roomId)) {
        clearInterval(timerData.interval);
    }
    activeAuctions.add(roomId);

    timerData.interval = setInterval(async () => {
        if (timerData.paused) return;

        timerData.remainingTime--;
        const rem = timerData.remainingTime;

        if (rem % 5 === 0) {
            try { await timerData.auctionMsg.edit({ content: await _buildAuctionMsg(timerData.draft, rem, db, timerData.guildId) }); } catch {}
        }

        if (rem === 60 && !timerData.oneMinuteNoticeSent) {
            timerData.oneMinuteNoticeSent = true;
            await timerData.roomChannel.send("**⏰ دقيقة واحدة متبقية!**").catch(() => {});
        }

        if (rem <= 0) {
            clearInterval(timerData.interval);
            auctionTimers.delete(roomId);
            activeAuctions.delete(roomId);

            try { await timerData.auctionMsg.edit({ content: `**🔒 انتهى المزاد!**\n${await _buildAuctionMsg(timerData.draft, 0, db, timerData.guildId)}` }); } catch {}

            await endAuction(timerData, roomId);
        }
    }, 1000);

    auctionTimers.set(roomId, timerData);
}

// ========== نهاية المزاد (5s → حذف → 5s → إمبد) ==========
async function endAuction(timerData, roomId) {
    const { roomChannel, draft, guildId } = timerData;

    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        const messages = await roomChannel.messages.fetch({ limit: 100 });
        const nonPinned = messages.filter(m => !m.pinned);
        if (nonPinned.size > 0) await roomChannel.bulkDelete(nonPinned, true).catch(() => {});
    } catch {}

    await new Promise(resolve => setTimeout(resolve, 5000));

    const finalEmbed = new EmbedBuilder()
        .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  انتهى المزاد")
        .setDescription(
            ED.shopInteractions_021({
                draft,
                winner: timerData.lastBidder || "لا يوجد",
                lastBid: timerData.lastBidAmount || draft.startPrice,
            }),
        )
        .setColor(await getColor(guildId, db, config))
        .setTimestamp();
    if (draft.imageUrl) finalEmbed.setImage(draft.imageUrl);

    await roomChannel.send({ embeds: [finalEmbed] });

    await roomChannel.permissionOverwrites.edit(roomChannel.guild.roles.everyone, { SendMessages: false }).catch(() => {});

    await sendAuctionPricesEmbed(roomChannel, db, config, guildId);
    await db.delete(`active_auction_${roomId}`);
    await sendAuctionLog(roomChannel.guild, draft, guildId, roomId, "ended");
}

// ========== تنظيف عند حذف الروم ==========
client.on("channelDelete", async (channel) => {
    const td = auctionTimers.get(channel.id);
    if (td) {
        clearInterval(td.interval);
        auctionTimers.delete(channel.id);
        activeAuctions.delete(channel.id);
        await db.delete(`active_auction_${channel.id}`);
    }
});
    
    // ========== requireAuctionAdmin ==========
async function requireAuctionAdmin(interaction, db) {
    const auctionadminId = await db.get(`auctionad_${interaction.guild.id}`);
    if (!auctionadminId || !interaction.member.roles.cache.has(auctionadminId)) {
        await interaction.reply({ content: `**🚫 يجب أن تملك رتبة مسؤول المزاد.**`, flags: MessageFlags.Ephemeral });
        return false;
    }
    return true;
}

// ========== cancel_active_auction ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("cancel_active_auction_")) return;
    if (!interaction.guild) return;
    if (!(await requireAuctionAdmin(interaction, db))) return;

    const roomId = interaction.customId.replace("cancel_active_auction_", "");
    const guildId = interaction.guild.id;
    const td = auctionTimers.get(roomId);

    if (td) { clearInterval(td.interval); auctionTimers.delete(roomId); activeAuctions.delete(roomId); }
    await db.delete(`active_auction_${roomId}`);

    const roomChannel = interaction.guild.channels.cache.get(roomId);
    if (roomChannel) {
        try { if (td?.auctionMsg) await td.auctionMsg.delete(); } catch {}
        try { if (td?.controlMsg) await td.controlMsg.delete(); } catch {}
        await roomChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });

        const cancelRoomEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم إلغاء المزاد")
            .setDescription(ED.shopInteractions_020({ interaction, td }))
            .setColor(await getColor(guildId, db, config))
            .setTimestamp();
        await roomChannel.send({ embeds: [cancelRoomEmbed] });
        await sendAuctionPricesEmbed(roomChannel, db, config, guildId);
    }

    await sendAuctionLog(interaction.guild, td?.draft || {}, guildId, roomId, "cancelled", interaction.user.id);
    await interaction.reply({ content: "**✅ تم إلغاء المزاد.**", flags: MessageFlags.Ephemeral });
});

// ========== pause_auction ==========

    client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("pause_auction_")) return;
    if (!interaction.guild) return;
    if (!(await requireAuctionAdmin(interaction, db))) return;

    const roomId = interaction.customId.replace("pause_auction_", "");
    const td = auctionTimers.get(roomId);
    if (!td) return interaction.reply({ content: "**❌ لا يوجد مزاد نشط.**", flags: MessageFlags.Ephemeral });
    if (td.paused) return interaction.reply({ content: "**⚠️ المزاد متوقف بالفعل.**", flags: MessageFlags.Ephemeral });

    td.paused = true;
    await interaction.reply({ content: `**⏸ تم توقيف المزاد من قِبل <@${interaction.user.id}>**` });
});

// ========== resume_auction ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("resume_auction_")) return;
    if (!interaction.guild) return;
    if (!(await requireAuctionAdmin(interaction, db))) return;

    const roomId = interaction.customId.replace("resume_auction_", "");
    const td = auctionTimers.get(roomId);
    if (!td) return interaction.reply({ content: "**❌ لا يوجد مزاد نشط.**", flags: MessageFlags.Ephemeral });
    if (!td.paused) return interaction.reply({ content: "**⚠️ المزاد يعمل بالفعل.**", flags: MessageFlags.Ephemeral });

    td.paused = false;
    await interaction.reply({ content: `**▶️ تم استئناف المزاد من قِبل <@${interaction.user.id}>**` });
});

// ========== revive_auction ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("revive_auction_")) return;
    if (!interaction.guild) return;
    if (!(await requireAuctionAdmin(interaction, db))) return;

    const roomId = interaction.customId.replace("revive_auction_", "");
    if (!auctionTimers.has(roomId)) return interaction.reply({ content: "**❌ لا يوجد مزاد نشط.**", flags: MessageFlags.Ephemeral });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`revive_pick_${roomId}_every`).setLabel("@everyone").setStyle(ButtonStyle.Danger).setEmoji(emojis.mention),
        new ButtonBuilder().setCustomId(`revive_pick_${roomId}_here`).setLabel("@here").setStyle(ButtonStyle.Secondary).setEmoji(emojis.mention),
    );
    await interaction.reply({ content: "**📢 اختر نوع المنشن:**", components: [row], flags: MessageFlags.Ephemeral });
});

// ========== revive_pick ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("revive_pick_")) return;
    if (!interaction.guild) return;
    if (!(await requireAuctionAdmin(interaction, db))) return;

    const parts = interaction.customId.replace("revive_pick_", "").split("_");
    const mentionType = parts.pop();
    const roomId = parts.join("_");

    const roomChannel = interaction.guild.channels.cache.get(roomId);
    if (!roomChannel) return interaction.reply({ content: "**❌ الروم غير موجود.**", flags: MessageFlags.Ephemeral });

    const mention = mentionType === "every" ? "@everyone" : "@here";
    await roomChannel.send(mention);
    await interaction.update({ content: `**✅ تم إرسال ${mention}.**`, components: [] });
});

// ========== extend_auction ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("extend_auction_")) return;
    if (!interaction.guild) return;
    if (!(await requireAuctionAdmin(interaction, db))) return;

    const roomId = interaction.customId.replace("extend_auction_", "");
    if (!auctionTimers.has(roomId)) return interaction.reply({ content: "**❌ لا يوجد مزاد نشط.**", flags: MessageFlags.Ephemeral });

    const select = new StringSelectMenuBuilder()
        .setCustomId(`extend_pick_${roomId}`)
        .setPlaceholder("اختر مدة التمديد...")
        .addOptions(
            { label: "دقيقة واحدة", value: "1" },
            { label: "دقيقتان", value: "2" },
            { label: "3 دقائق", value: "3" },
            { label: "4 دقائق", value: "4" },
            { label: "5 دقائق", value: "5" },
        );
    await interaction.reply({ content: "**⏱ اختر مدة التمديد:**", components: [new ActionRowBuilder().addComponents(select)], flags: MessageFlags.Ephemeral });
});

// ========== extend_pick ==========
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith("extend_pick_")) return;
    if (!interaction.guild) return;
    if (!(await requireAuctionAdmin(interaction, db))) return;

    const roomId = interaction.customId.replace("extend_pick_", "");
    const td = auctionTimers.get(roomId);
    if (!td) return interaction.reply({ content: "**❌ لا يوجد مزاد نشط.**", flags: MessageFlags.Ephemeral });

    const addMinutes = parseInt(interaction.values[0]);
    td.remainingTime += addMinutes * 60;
    if (td.remainingTime > 60 && td.oneMinuteNoticeSent) td.oneMinuteNoticeSent = false;

    const roomChannel = interaction.guild.channels.cache.get(roomId);
    if (roomChannel) await roomChannel.send(`**⏱ تم تمديد المزاد ${addMinutes} دقيقة من قِبل <@${interaction.user.id}>**`);
    await interaction.update({ content: `**✅ تم التمديد ${addMinutes} دقيقة.**`, components: [] });
});
    // ========== !طرد-مزاد @منشن ==========
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith("!طرد")) return;
    if (!message.guild) return;

    const guildId = message.guild.id;

    // صلاحية: مسؤول المزاد أو أدمن
    const auctionadminId = await db.get(`auctionad_${guildId}`);
    if (
        !auctionadminId ||
        !message.member.roles.cache.has(auctionadminId) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
        return message.reply("**❌ هذه الصلاحية لمسؤولي المزاد فقط.**");
    }

    const target = message.mentions.members.first();
    if (!target) {
        return message.reply("**❌ استخدم: `!طرد-مزاد @منشن`**");
    }

    // التحقق من أن الروم هو روم مزاد
    const isActive = await db.get(`active_auction_${message.channel.id}`);
    if (!isActive) {
        return message.reply("**❌ هذا الأمر يعمل فقط في روم المزاد النشط.**");
    }

    // منع المستخدم من الكتابة
    await message.channel.permissionOverwrites.edit(target.id, {
        SendMessages: false,
    });

    await message.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تم الطرد من المزاد")
                .setDescription(`**تم منع <@${target.id}> من الكتابة لمدة 5 دقائق**`)
                .addFields(
                    { name: "المطرود", value: `<@${target.id}>`, inline: true },
                    { name: "بواسطة", value: `<@${message.author.id}>`, inline: true },
                    { name: "المدة", value: "5 دقائق", inline: true },
                )
                .setColor(0xFF0000)
                .setTimestamp(),
        ],
    });

    // رجوع الصلاحية بعد 5 دقائق
    setTimeout(async () => {
        try {
            await message.channel.permissionOverwrites.edit(target.id, {
                SendMessages: true,
            });
            await message.channel.send(`**✅ تم إعادة صلاحية الكتابة لـ <@${target.id}>**`).catch(() => {});
        } catch {}
    }, 5 * 60 * 1000);
});
    // ========== !الغاء-مزاد ==========
// ========== !الغاء-مزاد ==========
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith("!الغاء مزاد")) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const channel = message.channel;

    // صلاحية: مسؤول المزاد أو أدمن
    const auctionadminId = await db.get(`auctionad_${guildId}`);
    if (
        !auctionadminId ||
        (!message.member.roles.cache.has(auctionadminId) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator))
    ) {
        return message.reply("**❌ هذه الصلاحية لمسؤولي المزاد فقط.**");
    }

    // جلب بيانات المزاد النشط
    const activeAuction = await db.get(`active_auction_${channel.id}`);
    if (!activeAuction) {
        return message.reply("**❌ لا يوجد مزاد نشط في هذه القناة.**");
    }

    // إيقاف التايمر
    const td = auctionTimers.get(channel.id);
    if (td) {
        clearInterval(td.interval);
        auctionTimers.delete(channel.id);
        activeAuctions.delete(channel.id);
    }

    // حذف بيانات المزاد
    await db.delete(`active_auction_${channel.id}`);

    // حذف رسائل المزاد إذا وجدت
    try {
        if (td?.auctionMsg) await td.auctionMsg.delete().catch(() => {});
        if (td?.controlMsg) await td.controlMsg.delete().catch(() => {});
    } catch {}

    // قفل الروم
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false,
    });

    // إرسال إمبد الإلغاء
    const cancelEmbed = new EmbedBuilder()
        .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تم إلغاء المزاد")
        .setDescription(`**تم إلغاء المزاد من قِبل <@${message.author.id}>**`)
        .addFields(
            { name: "السلعة", value: activeAuction.draft?.itemName || "—", inline: true },
            { name: "السعر المبدئي", value: activeAuction.draft?.startPrice || "—", inline: true },
            { name: "صاحب المزاد", value: `<@${activeAuction.ownerId}>`, inline: true },
        )
        .setColor(0xFF0000)
        .setTimestamp();

    await channel.send({ embeds: [cancelEmbed] });

    // إرسال إمبد الأسعار مع زر فتح تكت
    await sendAuctionPricesEmbed(channel, db, config, guildId);

    // لوق
    await sendAuctionLog(message.guild, activeAuction.draft || {}, guildId, channel.id, "cancelled", message.author.id);

    await message.react("✅").catch(() => {});
});  
    
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "closeauction") return;
    if (!interaction.guild) return;

    await interaction.deferReply();
    const guildId = interaction.guild.id;
    const channel = interaction.channel;

    const meta = await db.get(`auction_ticket_channel_${channel.id}`);
    const ownerId = meta?.ownerId || interaction.user.id;
    const gId = meta?.guildId || guildId;
    const userId = interaction.user.id;

    if (userId !== ownerId) {
        const highstaff = await db.get(`highstaff_${guildId}`);
        const auctionAdmin = await db.get(`auctionad_${guildId}`);
        const hasHighStaff = highstaff && interaction.member.roles.cache.has(highstaff);
        const hasAuctionAdmin = auctionAdmin && interaction.member.roles.cache.has(auctionAdmin);

        if (!hasHighStaff && !hasAuctionAdmin) {
            return interaction.editReply({
                content: "**❌ فقط صاحب التكت أو العليا/مسؤول المزاد يمكنه إغلاق التذكرة.**",
            });
        }
    }

    await db.delete(`auction_ticket_${ownerId}_${gId}`);
    await db.delete(`auction_ticket_channel_${channel.id}`);
    await db.delete(`auction_credit_${ownerId}_${gId}`);
    await db.delete(`auction_draft_${ownerId}_${gId}`);

    await interaction.editReply({ content: "**🔒 سيتم إغلاق التكت...**" });
    setTimeout(() => channel.delete().catch(() => {}), 3000);
});
    // ========== !قفل-تكت ==========
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith("!قفل-تكت")) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const channel = message.channel;
    const userId = message.author.id;

    // البحث عن نوع التكت
    const shopTicket = await db.get(`shop_ticket_channel_${channel.id}`);
    const auctionTicket = await db.get(`auction_ticket_channel_${channel.id}`);
    const orderTicket = await db.get(`order_ticket_channel_${channel.id}`);
    const rolesTicket = await db.get(`roles_ticket_channel_${channel.id}`);
    const supportTicket = await db.get(`support_ticket_ch_${channel.id}`);

    const ticketData = shopTicket || auctionTicket || orderTicket || rolesTicket || supportTicket;
    const ownerId = ticketData?.ownerId;

    if (!ticketData) {
        return message.reply("**❌ هذه القناة ليست تذكرة.**");
    }

    // صلاحية: صاحب التكت أو أدمن
  const highstaff = await db.get(`highstaff_${guildId}`);
const shopAdmin = await db.get(`shopad_${guildId}`);
const orderAdmin = await db.get(`orderad_${guildId}`);
const auctionAdmin = await db.get(`auctionad_${guildId}`);

const hasHighStaff = highstaff && message.member.roles.cache.has(highstaff);
const hasShopAdmin = shopAdmin && message.member.roles.cache.has(shopAdmin);
const hasOrderAdmin = orderAdmin && message.member.roles.cache.has(orderAdmin);
const hasAuctionAdmin = auctionAdmin && message.member.roles.cache.has(auctionAdmin);

if (userId !== ownerId && !hasHighStaff && !hasShopAdmin && !hasOrderAdmin && !hasAuctionAdmin) {
    return message.reply("**❌ فقط صاحب التكت أو رتبة العليا أو مسؤول المتاجر/الطلبات/المزادات يمكنه إغلاق التذكرة.**");
}
    // حذف بيانات التكت من الداتابيس
    if (shopTicket) {
        await db.delete(`shop_ticket_${ownerId}_${guildId}`);
        await db.delete(`shop_ticket_channel_${channel.id}`);
        await db.delete(`shop_credit_${ownerId}_${guildId}`);
    }
    if (auctionTicket) {
        await db.delete(`auction_ticket_${ownerId}_${guildId}`);
        await db.delete(`auction_ticket_channel_${channel.id}`);
        await db.delete(`auction_credit_${ownerId}_${guildId}`);
        await db.delete(`auction_draft_${ownerId}_${guildId}`);
    }
    if (orderTicket) {
        await db.delete(`order_ticket_${ownerId}_${guildId}`);
        await db.delete(`order_ticket_channel_${channel.id}`);
        await db.delete(`order_credit_${ownerId}_${guildId}`);
    }
    if (rolesTicket) {
        await db.delete(`roles_ticket_${ownerId}_${guildId}`);
        await db.delete(`roles_ticket_channel_${channel.id}`);
    }
    if (supportTicket) {
        const ticketKey = supportTicket.dbKey || `support_ticket_${ownerId}_${guildId}`;
        await db.delete(ticketKey);
        await db.delete(`support_ticket_ch_${channel.id}`);
    }

    await message.channel.send("**🔒 سيتم إغلاق التذكرة خلال 3 ثواني...**");
    setTimeout(() => channel.delete().catch(() => {}), 3000);
});
    //-------- ticket-order: فتح تكت طلبات --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "ticket-order") return;
        if (!interaction.guild) return;

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const orderCat = await db.get(`catbuy_order_${guildId}`);
        if (!orderCat)
            return interaction.reply({
                content:
                    "**❌ لم يتم إعداد كتاغوري الطلبات. استخدم `/setup`.**",
                flags: MessageFlags.Ephemeral,
            });
        const orderAdmin = await db.get(`orderad_${guildId}`);
        if (!orderAdmin)
            return interaction.reply({
                content: "**❌ لم يتم إعداد مسؤول الطلبات. استخدم `/setup`.**",
                flags: MessageFlags.Ephemeral,
            });

        const existing = await db.get(`order_ticket_${userId}_${guildId}`);
        if (existing) {
            const existingCh = interaction.guild.channels.cache.get(
                existing.channelId,
            );
            if (existingCh)
                return interaction.reply({
                    content: `**❌ لديك تذكرة مفتوحة بالفعل: <#${existingCh.id}>**`,
                    flags: MessageFlags.Ephemeral,
                });
            await db.delete(`order_ticket_${userId}_${guildId}`);
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const adminRole = interaction.guild.roles.cache.get(orderAdmin);
        const safeName =
            interaction.user.username
                .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")
                .slice(0, 24) || "user";
        const ticketChannel = await interaction.guild.channels.create({
            name: `order-${safeName}`,
            type: ChannelType.GuildText,
            parent: orderCat,
            permissionOverwrites: [
                {
                    id: userId,
                    allow: [
                        "SendMessages",
                        "EmbedLinks",
                        "AttachFiles",
                        "ViewChannel",
                    ],
                },
                {
                    id: interaction.guild.roles.everyone,
                    deny: ["SendMessages", "ViewChannel"],
                },
                {
                    id: adminRole?.id || orderAdmin,
                    allow: [
                        "SendMessages",
                        "MentionEveryone",
                        "EmbedLinks",
                        "AttachFiles",
                        "ViewChannel",
                    ],
                },
            ],
        });

        await db.set(`order_ticket_${userId}_${guildId}`, {
            userId,
            channelId: ticketChannel.id,
        });
        await db.set(`order_ticket_channel_${ticketChannel.id}`, {
            ownerId: userId,
            guildId,
        });

        const evrypri = await db.get(`order-evrypri_${guildId}`);
        const herepri = await db.get(`order-herepri_${guildId}`);
        const orderpri = await db.get(`order-orderpri_${guildId}`);
        const ordermentionrole = await db.get(`order-mentionrole_${guildId}`);
        const bank = await db.get(`bank_${guildId}`);
        const orderImage = await db.get(`buyorderimage_${guildId}`);

        const priceLines = [];
        if (evrypri)
            priceLines.push(`${config.mzademoji} **@everyone:** ${evrypri}`);
        if (herepri)
            priceLines.push(`${config.mzademoji} **@here:** ${herepri}`);
        if (orderpri && ordermentionrole)
            priceLines.push(`${config.mzademoji} **منشن طلبات:** ${orderpri}`);

        const typeButtons = [];
        if (evrypri)
            typeButtons.push(
                new ButtonBuilder()
                    .setCustomId(`order_type_every_${userId}`)
                    .setLabel("منشن @everyone")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.auction),
            );
        if (herepri)
            typeButtons.push(
                new ButtonBuilder()
                    .setCustomId(`order_type_here_${userId}`)
                    .setLabel("منشن @here")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.auction),
            );
        if (orderpri && ordermentionrole)
            typeButtons.push(
                new ButtonBuilder()
                    .setCustomId(`order_type_order_${userId}`)
                    .setLabel("منشن طلبات")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.auction),
            );
        typeButtons.push(
            new ButtonBuilder()
                .setCustomId(`order_close_${userId}`)
                .setLabel("إغلاق التكت")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.close),
        );

        const { EmbedBuilder, ActionRowBuilder } = require("discord.js");

        // إنشاء الإمبد باستخدام Builder
        const initEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> ** تc�كـت الطـلـبـات **")
            .setDescription(
                `${priceLines.length > 0 ? `### أسـعـار الطـلـبـات\n${priceLines.join("\n")}\n\n` : ""}التـحـويـل لـ <@!${bank || "غير محدد"}>`,
            )
            .setAuthor({
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL({ size: 1024 }),
            })
            .setTimestamp()
            .setColor(await getColor(guildId, db, config)); // إضافة اللون مع await

        // إضافة الصورة إذا كانت موجودة
        if (orderImage) {
            initEmbed.setImage(orderImage);
        }

        // إرسال الرسالة (ضروري await هنا)
        await ticketChannel.send({
            content: `<@${userId}> <@&${orderAdmin}>`,
            embeds: [initEmbed],
            components: [new ActionRowBuilder().addComponents(...typeButtons)],
        });
        await interaction.reply({
            content: `**✅ تم إنشاء تذكرتك: <#${ticketChannel.id}>**`,
        });
    });

    //-------- order_close button --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("order_close_")) return;
        if (!interaction.guild) return;

        await interaction.deferReply();
        const meta = await db.get(
            `order_ticket_channel_${interaction.channel.id}`,
        );
        const ownerId = meta?.ownerId || interaction.user.id;
        const gId = meta?.guildId || interaction.guild.id;
        await db.delete(`order_ticket_${ownerId}_${gId}`);
        await db.delete(`order_ticket_channel_${interaction.channel.id}`);
        await sendTicketRatingDM(ownerId, gId, "order").catch(() => {});
        await interaction.editReply({ content: "**🔒 سيتم إغلاق التكت...**" });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    });

    //-------- order_type handlers (everyone / here) --------
    async function _handleOrderType(interaction, mentionLabel, price) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const channel = interaction.channel;

    const bank = await db.get(`bank_${guildId}`);
    if (!bank) return interaction.editReply({ content: "يرجى تحديد البنك باستخدام الأمر: /setup" });

    const activePurchase = await db.get(`order_credit_${userId}_${guildId}`);
    if (activePurchase) return interaction.editReply({ content: "**لديك عملية شراء قيد التنفيذ بالفعل.**" });

    const meta = await db.get(`order_ticket_channel_${channel.id}`);
    const ticketOwnerId = meta?.ownerId;
    if (ticketOwnerId && ticketOwnerId !== userId) {
        return interaction.editReply({ content: "**يمكن لصاحب التكت فقط استعمال الأزرار**" });
    }

    // حساب السعر النهائي مع ضريبة البروبوت
    const totalPrice = Math.floor(price * (20 / 19) + 1);

    await interaction.editReply({
        content: `**\`السعر مع الضريبة: ${totalPrice}\`**`,
    });

    await channel.send(`Re ${bank} ${totalPrice}`);
    await channel.send(`\`\`\`Re ${bank} ${totalPrice}\`\`\``);
    await channel.send(`. \`يرجى التحويل في أسرع وقت ممكن هنا\` <@!${userId}>`);
    
    await db.set(`order_credit_${userId}_${guildId}`, userId);

    // التحقق من التحويل (بنفس طريقة كود المزاد الناجحة)
    const collector = channel.createMessageCollector({
        filter: (m) => m.author.id === PAYMENT_BOT_ID,
        time: 120000,
    });

    let done = false;
    collector.on("collect", (c) => {
        const content = c.content;
        let paidAmount = 0;
        const btMatch = content.match(/`\$?([\d,]+(?:\.\d+)?)`/);
        const engMatch = content.match(/transferred\s+\$?([\d,]+)/i);
        const arMatch = content.match(/بتحويل\s+\$?([\d,]+)/);
        const found = btMatch || engMatch || arMatch;
        if (found) paidAmount = Number(found[1].replace(/,/g, ""));

        const bankMentionOk = content.includes(`<@!${bank}>`) || content.includes(`<@${bank}>`);
        const isTransfer = content.includes("has transferred") || content.includes("قام بتحويل");

        if (isTransfer && bankMentionOk && paidAmount >= price) {
            done = true;
            collector.stop("DONE");
        }
    });

    collector.on("end", async (collected, reason) => {
        await db.delete(`order_credit_${userId}_${guildId}`);
        
        if (reason !== "DONE") {
            await channel.send({ content: `**انتهى الوقت ولم يتم التحويل.** <@!${userId}>` });
            setTimeout(() => channel.delete().catch(() => {}), 5000);
            return;
        }

        // --- مرحلة كتابة الطلب بعد نجاح التحويل ---
        await channel.send("✅ **تم التحقق من التحويل بنجاح!** يرجى كتابة طلبك الآن هنا");
        
        let requestText;
        try {
            const msgs = await channel.awaitMessages({
                filter: (m) => m.author.id === userId,
                max: 1,
                time: 300000,
                errors: ["time"],
            });
            requestText = msgs.first().content;

            // فلتر الروابط والدعوات لحماية السيرفر
            const linkRegex = /(https?:\/\/[^\s]+)|(discord\.(gg|io|me|li|com\/invite)\/.+[a-z])/gi;
            if (linkRegex.test(requestText)) {
                await channel.send("❌ **ممنوع إرسال الروابط أو دعوات السيرفرات!** تم إلغاء الطلب.");
                setTimeout(() => channel.delete().catch(() => {}), 5000);
                return;
            }
        } catch {
            await channel.send("**⌛ انتهى وقت كتابة الطلب.**");
            setTimeout(() => channel.delete().catch(() => {}), 5000);
            return;
        }

        const emojis = require("./emojis");
        const orderRoomId = await db.get(`orderroom_${guildId}`);
        const orderRoom = interaction.guild.channels.cache.get(orderRoomId);
        
        if (orderRoom) {
            const orderMsg = 
                `${mentionLabel}\n` +
                `**- ${emojis.order} \`-\` صاحب الطلب : <@${userId}>\n` +
                `- ${emojis.order1} \`-\` الطلب : ${requestText}\n` +
                `- ${emojis.order2} \`-\` المنشن : ${mentionLabel}**`;

            const reqButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`order_thread_${userId}`).setLabel("تواصل").setStyle(ButtonStyle.Secondary).setEmoji(emojis.contact),
         new ButtonBuilder()
  .setLabel("بايو")
  .setStyle(ButtonStyle.Link)
  .setURL(`https://discord.com/users/${userId}`)
  .setEmoji(emojis.user),
                new ButtonBuilder().setCustomId(`order_delete_${userId}`).setLabel("حذف الطلب").setStyle(ButtonStyle.Secondary).setEmoji(emojis.deleteOrder),
                new ButtonBuilder().setCustomId(`order_prices_${guildId}`).setLabel("الأسعار").setStyle(ButtonStyle.Secondary).setEmoji(emojis.prices),
                new ButtonBuilder().setCustomId("ticket-order").setLabel("فتح تكت طلب").setStyle(ButtonStyle.Secondary).setEmoji(emojis.ticketOrder),
            );

            await orderRoom.send({ content: orderMsg, components: [reqButtons] });
        }

        await db.delete(`order_ticket_${userId}_${guildId}`);
        await db.delete(`order_ticket_channel_${channel.id}`);
        await channel.send("✅ **تم نشر طلبك بنجاح في روم الطلبات، سيتم حذف التكت الآن.**");
        setTimeout(() => channel.delete().catch(() => {}), 3000);
    });
}

client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("order_type_order_")) return;
        if (!interaction.guild) return;
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guild.id;
        const price = await db.get(`order-orderpri_${guildId}`);
        if (!price)
            return interaction.editReply({
                content:
                    "**❌ سعر منشن الطلبات غير محدد. استخدم `/setup-prices`.**",
            });
        const roleId = await db.get(`order-mentionrole_${guildId}`);
        if (!roleId)
            return interaction.editReply({
                content: "**❌ رول منشن الطلبات غير محدد. استخدم `/setup`.**",
            });
        await _handleOrderType(interaction, `<@&${roleId}>`, price);
    });

client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("order_type_every_")) return;
        if (!interaction.guild) return;
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guild.id;
        const price = await db.get(`order-evrypri_${guildId}`);
        if (!price)
            return interaction.editReply({
                content: "**❌ السعر غير محدد.**",
            });
        await _handleOrderType(interaction, "@everyone", price);
    });
client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("order_type_here_")) return;
        if (!interaction.guild) return;
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guild.id;
        const price = await db.get(`order-herepri_${guildId}`);
        if (!price)
            return interaction.editReply({
                content: "**❌ السعر غير محدد.**",
            });
        await _handleOrderType(interaction, "@here", price);
    });

    //-------- order_thread: فتح ثريد خاص --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("order_thread_")) return;
        if (!interaction.guild) return;

        const ownerId = interaction.customId.replace("order_thread_", "");
        const openerId = interaction.user.id;
        const guildId = interaction.guild.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const thread = await interaction.channel.threads.create({
                name: ` ثريد-طلب-${interaction.user.username}`,
                type: ChannelType.PrivateThread,
                invitable: false,
            });
            await thread.members.add(ownerId);
            await thread.members.add(openerId);

            const threadEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  ثريد خاص تواصل")
                .setDescription(ED.shopInteractions_016({ openerId, ownerId }))
                .setColor(await getColor(guildId, db, config))
                .setTimestamp();

            const threadButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ot_call_opener_${ownerId}_${openerId}`)
                    .setLabel("استدعاء فاتح الثريد")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.callOpener),
                new ButtonBuilder()
                    .setCustomId(`ot_call_owner_${ownerId}_${openerId}`)
                    .setLabel("استدعاء صاحب الطلب")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.callOwner),
                new ButtonBuilder()
                    .setCustomId(`ot_delete_${ownerId}_${openerId}`)
                    .setLabel("حذف الثريد")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.deleteThread),
            );

            await thread.send({
                embeds: [threadEmbed],
                components: [threadButtons],
            });
            await interaction.reply({
                content: `**✅ تم فتح ثريد خاص: ${thread}**`,
            });
        } catch (e) {
            await interaction.reply({
                content: "**❌ تعذّر إنشاء الثريد. تأكد من صلاحيات البوت.**",
            });
        }
    });

    //-------- ot_call_opener: استدعاء فاتح الثريد --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("ot_call_opener_")) return;
        if (!interaction.guild) return;

        const parts = interaction.customId
            .replace("ot_call_opener_", "")
            .split("_");
        const ownerId = parts[0];
        const openerId = parts[1];

        if (
            interaction.user.id !== ownerId &&
            interaction.user.id !== openerId
        ) {
            return interaction.reply({
                content: "**🚫 هذا الزر للطرفين فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.reply({
            content: `<@${openerId}> ** استدعاء من <@${interaction.user.id}>**`,
        });
    });

    //-------- ot_call_owner: استدعاء صاحب الطلب --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("ot_call_owner_")) return;
        if (!interaction.guild) return;

        const parts = interaction.customId
            .replace("ot_call_owner_", "")
            .split("_");
        const ownerId = parts[0];
        const openerId = parts[1];

        if (
            interaction.user.id !== ownerId &&
            interaction.user.id !== openerId
        ) {
            return interaction.reply({
                content: "**🚫 هذا الزر للطرفين فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.reply({
            content: `<@${ownerId}> ** استدعاء من <@${interaction.user.id}>**`,
        });
    });

    //-------- ot_delete: حذف الثريد --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("ot_delete_")) return;
        if (!interaction.guild) return;

        const parts = interaction.customId.replace("ot_delete_", "").split("_");
        const ownerId = parts[0];
        const openerId = parts[1];

        if (
            interaction.user.id !== ownerId &&
            interaction.user.id !== openerId
        ) {
            return interaction.reply({
                content: "**🚫 هذا الزر للطرفين فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            await interaction.reply({ content: "** سيتم حذف الثريد...**" });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch {}
            }, 2000);
        } catch {
            await interaction
                .reply({
                    content: "**❌ تعذّر حذف الثريد.**",
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    });

    //-------- order_delete: حذف رسالة الطلب --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("order_delete_")) return;
        if (!interaction.guild) return;

        const ownerId = interaction.customId.replace("order_delete_", "");
        const guildId = interaction.guild.id;
        const orderAdmin = await db.get(`orderad_${guildId}`);
        const isAdmin =
            orderAdmin && interaction.member.roles.cache.has(orderAdmin);
        const isOwner = interaction.user.id === ownerId;

        if (!isOwner && !isAdmin) {
            return interaction.reply({
                content: "**🚫 ليس لديك صلاحية لحذف هذا الطلب.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            await interaction.message.delete();
            await interaction.reply({
                content: "**✅ تم حذف الطلب.**",
                flags: MessageFlags.Ephemeral,
            });
        } catch {
            await interaction.reply({
                content: "**❌ تعذّر حذف الرسالة.**",
                flags: MessageFlags.Ephemeral,
            });
        }
    });

    //-------- order_prices: عرض أسعار الطلبات --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("order_prices_")) return;
        if (!interaction.guild) return;

        const guildId = interaction.customId.replace("order_prices_", "");
        const evrypri = await db.get(`order-evrypri_${guildId}`);
        const herepri = await db.get(`order-herepri_${guildId}`);
        const bank = await db.get(`bank_${guildId}`);
        const orderImage = await db.get(`buyorderimage_${guildId}`);

        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  أسعار الطلبات")
            .setDescription(
                ED.shopInteractions_017({ bank, config, evrypri, herepri }),
            )
            .setColor(await getColor(guildId, db, config))
            .setTimestamp();
        if (orderImage) embed.setImage(orderImage);

        const ticketBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket-order")
                .setLabel("فتح تكت طلب")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.ticketOrder),
        );
        await interaction.reply({
            embeds: [embed],
            components: [ticketBtn],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- auction_room_select string select menu --------
   
    //-------- extend_pick select menu --------
   
    //-------- /mzad-list slash command --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "mzad-list") return;
        if (!interaction.guild) return;

        const guildId = interaction.guild.id;
        const rooms = (await db.get(`auctionrooms_${guildId}`)) || [];

        if (rooms.length === 0) {
            return interaction.reply({
                content:
                    "**❌ لا توجد رومات مزاد مضبوطة. استخدم `/add-mzad-room` لإضافة رومات.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const lines = rooms.map((id, i) => {
            const isActive = auctionTimers.has(id);
            const td = auctionTimers.get(id);
            let status = "⚪ فارغ";
            if (isActive) {
                const m = Math.floor(td.remainingTime / 60),
                    s = td.remainingTime % 60;
                status = `${td.paused ? "⏸" : "🟢"} نشط — ${td.draft?.itemName || "؟"} — \`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}\``;
            }
            return `**${i + 1}.** <#${id}> — ${status}`;
        });

        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  قائمة رومات المزاد")
            .setDescription(ED.shopInteractions_021({ lines }))
            .setColor(await getColor(guildId, db, config))
            .setFooter({ text: `إجمالي الرومات: ${rooms.length}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    });

    //-------- /start-mzad slash command --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "start-mzad") return;
        if (!interaction.guild) return;

        const guildId = interaction.guild.id;
        if (!(await requireAuctionAdmin(interaction, db))) return;

        const room = interaction.options.getChannel("room");
        const itemName = interaction.options.getString("item");
        const startPrice = interaction.options.getString("start-price");
        const durationMinutes = interaction.options.getInteger("duration");
        const mentionRaw = interaction.options.getString("mention-type");
        const includesTax = interaction.options.getBoolean("tax");
        const ownerUser =
            interaction.options.getUser("owner") || interaction.user;
        const imageUrl = interaction.options.getString("image-url") || null;

        let mentionType;
        if (mentionRaw === "everyone") mentionType = "@everyone";
        else if (mentionRaw === "here") mentionType = "@here";
        else {
            const mzadRoleId = await db.get(`auctionmzadrole_${guildId}`);
            if (!mzadRoleId)
                return interaction.reply({
                    content:
                        "**❌ لم يتم تعيين رول المزاد. استخدم `/setup auction-mzad-role` أولاً.**",
                    flags: MessageFlags.Ephemeral,
                });
            mentionType = `<@&${mzadRoleId}>`;
        }

        const roomId = room.id;
        const isActive = await db.get(`active_auction_${roomId}`);
        if (isActive)
            return interaction.reply({
                content: "**❌ يوجد مزاد نشط في هذا الروم.**",
                flags: MessageFlags.Ephemeral,
            });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const roomChannel = interaction.guild.channels.cache.get(roomId);
        if (!roomChannel)
            return interaction.editReply("**❌ الروم غير موجود.**");

        const draft = {
            itemName,
            includesTax,
            startPrice,
            durationMinutes,
            imageUrl,
            mentionType,
            owner: ownerUser.id,
            paidPrice: 0,
            originalPrice: 0,
        };
        const initRem = durationMinutes * 60;

        await roomChannel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            { SendMessages: true },
        );

        const auctionMsg = await roomChannel.send({
            content: await _buildAuctionMsg(draft, initRem, db, guildId),
        });

        if (imageUrl) {
            try {
                await roomChannel.send({
                    files: [{ attachment: imageUrl, name: "auction.png" }],
                });
            } catch {
                try {
                    await roomChannel.send(`**صورة السلعة:**\n${imageUrl}`);
                } catch {}
            }
        }

        const auctionRules = await db.get(`mzad_rules_${guildId}`);
        if (auctionRules && auctionRules.trim()) {
            await roomChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  قوانين المزاد")
                        .setDescription(
                            ED.shopInteractions_022({ auctionRules }),
                        )
                        .setColor(await getColor(guildId, db, config))
                        .setTimestamp(),
                ],
            });
        }

        const controlMsg = await roomChannel.send({
            content: "**— لوحة تحكم المزاد (للمسؤولين فقط) —**",
            components: [_buildControlRow(roomId)],
        });

        await db.set(`active_auction_${roomId}`, {
            ownerId: ownerUser.id,
            guildId,
            startedAt: Date.now(),
            draft,
            remainingTime: initRem,
            auctionMsgId: auctionMsg.id,
            controlMsgId: controlMsg.id,
        });

        const timerData = {
            remainingTime: initRem,
            paused: false,
            guild: interaction.guild,
            roomChannel,
            draft,
            guildId,
            auctionMsg,
            controlMsg,
            oneMinuteNoticeSent: false,
            interval: null,
        };
        auctionTimers.set(roomId, timerData);
        startAuctionInterval(timerData, roomId);

        await interaction.reply(
            `**✅ تم إطلاق المزاد في ${roomChannel} بنجاح.**`,
        );
    });

    //-------- /mzad-stats slash command --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "mzad-stats") return;
        if (!interaction.guild) return;

        const guildId = interaction.guild.id;
        const stats = (await db.get(`auction_stats_${guildId}`)) || {
            total: 0,
            ended: 0,
            cancelled: 0,
            earnings: 0,
        };
        const active = [];
        for (const [roomId] of auctionTimers) {
            const td = auctionTimers.get(roomId);
            if (td?.guildId === guildId) {
                const m = Math.floor(td.remainingTime / 60),
                    s = td.remainingTime % 60;
                active.push(
                    `<#${roomId}> — ${td.draft?.itemName || "؟"} — ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${td.paused ? "⏸" : "▶️"}`,
                );
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  إحصائيات المزادات")
            .setColor(await getColor(guildId, db, config))
            .addFields(
                {
                    name: " إجمالي المزادات",
                    value: `${stats.total || 0}`,
                    inline: true,
                },
                {
                    name: " انتهت بنجاح",
                    value: `${stats.ended || 0}`,
                    inline: true,
                },
                {
                    name: " ملغاة",
                    value: `${stats.cancelled || 0}`,
                    inline: true,
                },
                {
                    name: " إجمالي الأرباح",
                    value: `${stats.earnings || 0}`,
                    inline: false,
                },
                {
                    name: ` مزادات نشطة (${active.length})`,
                    value: active.length > 0 ? active.join("\n") : "لا يوجد",
                    inline: false,
                },
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    });

    // ---- core: interval runner ----
    function startAuctionInterval(td, roomId) {
        let dbTick = 0;
        td.interval = setInterval(async () => {
            if (td.paused) return;
            td.remainingTime--;
            dbTick++;

            if (dbTick % 10 === 0) {
                try {
                    const snap = await db.get(`active_auction_${roomId}`);
                    if (snap)
                        await db.set(`active_auction_${roomId}`, {
                            ...snap,
                            remainingTime: td.remainingTime,
                        });
                } catch {}
            }

            try {
                await td.auctionMsg.edit({
                    content: await _buildAuctionMsg(td.draft, td.remainingTime, db, td.guildId),
                });
            } catch {
                clearInterval(td.interval);
                auctionTimers.delete(roomId);
                return;
            }

            if (td.remainingTime === 60 && !td.oneMinuteNoticeSent) {
                td.oneMinuteNoticeSent = true;
                await td.roomChannel.send(
                    "**⚠️ سينتهي المزاد بعد دقيقة واحدة.**",
                );
            }

            if (td.remainingTime <= 0) {
                clearInterval(td.interval);
                auctionTimers.delete(roomId);
                await db.delete(`active_auction_${roomId}`);
                try {
                    await td.controlMsg.delete();
                } catch {}
                await td.roomChannel.send("**# انتهى وقت المزاد**");
                await sendAuctionLog(
                    td.guild,
                    td.draft,
                    td.guildId,
                    roomId,
                    "ended",
                    null,
                );
                await new Promise((r) => setTimeout(r, 6000));
                await td.roomChannel.permissionOverwrites.edit(
                    td.guild.roles.everyone,
                    { SendMessages: false },
                );
                await td.roomChannel.send(
                    `**__\nيرجى التواصل مع صاحب المزاد\n<@${td.draft.owner}>\nويرجى طلب وسيط لضمان عدم السرقة\n__**`,
                );
                await sendAuctionPricesEmbed(
                    td.roomChannel,
                    db,
                    config,
                    td.guildId,
                );
            }
        }, 1000);
    }

    // ---- core: send auction log + update stats ----
    async function sendAuctionLog(
        guild,
        draft,
        guildId,
        roomId,
        reason,
        cancelledBy,
    ) {
        try {
            const logsId = await db.get(`logs_${guildId}`);
            if (logsId) {
                const logsChannel = guild.channels.cache.get(logsId);
                if (logsChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(
                            reason === "ended"
                                ? "✅ انتهى مزاد بنجاح"
                                : "❌ تم إلغاء مزاد",
                        )
                        .setColor(await getColor(guildId, db, config))
                        .addFields(
                            {
                                name: "السلعة",
                                value: draft?.itemName || "—",
                                inline: true,
                            },
                            {
                                name: "صاحب المزاد",
                                value: draft?.owner ? `<@${draft.owner}>` : "—",
                                inline: true,
                            },
                            {
                                name: "السعر المبدئي",
                                value: draft?.startPrice || "—",
                                inline: true,
                            },
                            {
                                name: "الضريبة",
                                value: draft?.includesTax ? "نعم" : "لا",
                                inline: true,
                            },
                            {
                                name: "المنشن",
                                value: draft?.mentionType || "—",
                                inline: true,
                            },
                            {
                                name: "الروم",
                                value: `<#${roomId}>`,
                                inline: true,
                            },
                            ...(cancelledBy
                                ? [
                                      {
                                          name: "ألغاه",
                                          value: `<@${cancelledBy}>`,
                                          inline: true,
                                      },
                                  ]
                                : []),
                        )
                        .setTimestamp();
                    await logsChannel.send({ embeds: [logEmbed] });
                }
            }
            const stats = (await db.get(`auction_stats_${guildId}`)) || {
                total: 0,
                ended: 0,
                cancelled: 0,
                earnings: 0,
            };
            stats.total = (stats.total || 0) + 1;
            if (reason === "ended") stats.ended = (stats.ended || 0) + 1;
            else stats.cancelled = (stats.cancelled || 0) + 1;
            if (draft?.paidPrice)
                stats.earnings = (stats.earnings || 0) + draft.paidPrice;
            await db.set(`auction_stats_${guildId}`, stats);
        } catch (e) {
            console.error("sendAuctionLog error:", e);
        }
    }

    // ---- core: restore timers on bot restart ----
    async function restoreAuctionTimers() {
        try {
            await new Promise((r) => setTimeout(r, 3000));
            const allData = await db.all();
            const activeKeys = allData.filter(
                (e) => e.id && e.id.startsWith("active_auction_"),
            );
            for (const entry of activeKeys) {
                const roomId = entry.id.replace("active_auction_", "");
                const data = entry.value;
                if (!data || !data.draft || !data.guildId) continue;

                const guild = client.guilds.cache.get(data.guildId);
                if (!guild) continue;
                const roomChannel = guild.channels.cache.get(roomId);
                if (!roomChannel) continue;

                const rem =
                    typeof data.remainingTime === "number"
                        ? data.remainingTime
                        : 60;
                if (rem <= 0) {
                    await db.delete(`active_auction_${roomId}`);
                    continue;
                }

                await roomChannel.send(
                    "**🔄 جارٍ استعادة المزاد بعد إعادة تشغيل البوت...**",
                );
                const auctionMsg = await roomChannel.send({
                    content: await _buildAuctionMsg(data.draft, rem, db, data.guildId),
                });

                if (data.draft.imageUrl) {
                    try {
                        await roomChannel.send({
                            files: [
                                {
                                    attachment: data.draft.imageUrl,
                                    name: "auction.png",
                                },
                            ],
                        });
                    } catch {
                        try {
                            await roomChannel.send(
                                `**صورة السلعة:**\n${data.draft.imageUrl}`,
                            );
                        } catch {}
                    }
                }

                const controlMsg = await roomChannel.send({
                    content: "**— لوحة تحكم المزاد (للمسؤولين فقط) —**",
                    components: [_buildControlRow(roomId)],
                });

                await db.set(`active_auction_${roomId}`, {
                    ...data,
                    remainingTime: rem,
                    auctionMsgId: auctionMsg.id,
                    controlMsgId: controlMsg.id,
                });

                const td = {
                    remainingTime: rem,
                    paused: false,
                    guild,
                    roomChannel,
                    draft: data.draft,
                    guildId: data.guildId,
                    auctionMsg,
                    controlMsg,
                    oneMinuteNoticeSent: rem <= 60,
                    interval: null,
                };
                auctionTimers.set(roomId, td);
                startAuctionInterval(td, roomId);
                console.log(
                    `[Auction] Restored timer for room ${roomId} (${rem}s remaining)`,
                );
            }
        } catch (e) {
            console.error("restoreAuctionTimers error:", e);
        }
    }

    if (client.isReady()) {
        restoreAuctionTimers();
    } else {
        client.once("ready", () => restoreAuctionTimers());
    }

    //======================================================
    //              نظام تكت شراء الرتب
    //======================================================

    //-------- ticket-roles: فتح تكت شراء رتبة --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "ticket-roles") return;
        if (!interaction.guild) return;

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const rolesCat = await db.get(`roles_cat_${guildId}`);
        if (!rolesCat)
            return interaction.reply({
                content:
                    "**❌ لم يتم إعداد كتاغوري شراء الرتب. استخدم `/setup`.**",
                flags: MessageFlags.Ephemeral,
            });
        const rolesAdmin = await db.get(`roles_admin_${guildId}`);
        if (!rolesAdmin)
            return interaction.reply({
                content:
                    "**❌ لم يتم إعداد مسؤول شراء الرتب. استخدم `/setup`.**",
                flags: MessageFlags.Ephemeral,
            });
        const buyRoles = (await db.get(`buy_roles_${guildId}`)) || [];
        if (buyRoles.length === 0)
            return interaction.reply({
                content: "**❌ لا توجد رتب متاحة للشراء حالياً.**",
                flags: MessageFlags.Ephemeral,
            });

        const existing = await db.get(`roles_ticket_${userId}_${guildId}`);
        if (existing) {
            const existingCh = interaction.guild.channels.cache.get(
                existing.channelId,
            );
            if (existingCh)
                return interaction.reply({
                    content: `**❌ لديك تذكرة مفتوحة بالفعل: <#${existingCh.id}>**`,
                    flags: MessageFlags.Ephemeral,
                });
            await db.delete(`roles_ticket_${userId}_${guildId}`);
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const adminRole = interaction.guild.roles.cache.get(rolesAdmin);
        const safeName =
            interaction.user.username
                .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")
                .slice(0, 24) || "user";
        const bankBotIdForRoles = PAYMENT_BOT_ID;
        const ticketChannel = await interaction.guild.channels.create({
            name: `roles-${safeName}`,
            type: ChannelType.GuildText,
            parent: rolesCat,
            permissionOverwrites: [
                {
                    id: userId,
                    allow: [
                        "SendMessages",
                        "EmbedLinks",
                        "AttachFiles",
                        "ViewChannel",
                        "ReadMessageHistory",
                    ],
                },
                {
                    id: interaction.guild.roles.everyone,
                    deny: ["SendMessages", "ViewChannel"],
                },
                {
                    id: adminRole?.id || rolesAdmin,
                    allow: [
                        "SendMessages",
                        "EmbedLinks",
                        "AttachFiles",
                        "ViewChannel",
                        "ManageRoles",
                        "ReadMessageHistory",
                    ],
                },
                {
                    id: bankBotIdForRoles,
                    allow: [
                        "SendMessages",
                        "ViewChannel",
                        "ReadMessageHistory",
                        "EmbedLinks",
                    ],
                },
            ],
        });

        await db.set(`roles_ticket_${userId}_${guildId}`, {
            userId,
            channelId: ticketChannel.id,
        });
        await db.set(`roles_ticket_channel_${ticketChannel.id}`, {
            ownerId: userId,
            guildId,
        });

        const bank = await db.get(`bank_${guildId}`);
        const rolesImage = await db.get(`buyrolesimage_${guildId}`);

        const priceLines = buyRoles
            .map(
                (r) =>
                    `${config.mzademoji} **<@&${r.roleId}>** — السعر: \`${r.price}\``,
            )
            .join("\n");
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`roles_pick_${userId}`)
            .setPlaceholder("اختر الرتبة التي تريد شراءها")
            .addOptions(
                buyRoles.map((r) => ({
                    label: r.name,
                    description: `السعر: ${r.price} | ${r.benefits.slice(0, 50)}`,
                    value: r.roleId,
                })),
            );

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`roles_close_${userId}`)
                .setLabel("إغلاق التكت")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.close),
        );

        const { EmbedBuilder } = require("discord.js");

        // بناء الإمبد باستخدام Builder
        const initEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> ** تـكـت شـراء الـرتـب **")
            .setDescription(
                `### أسعار الرتب المتاحة\n${priceLines}\n\nالتحويل لـ <@!${bank || "غير محدد"}>\n**اختر الرتبة من القائمة أدناه**`,
            )
            .setAuthor({
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL({ size: 1024 }),
            })
            .setTimestamp()
            .setColor(await getColor(guildId, db, config)); // إضافة اللون مع await

        // إضافة الصورة إذا كانت موجودة
        if (rolesImage) {
            initEmbed.setImage(rolesImage);
        }

        // إرسال الرسالة في التيكت
        await ticketChannel.send({
            content: `<@${userId}> <@&${rolesAdmin}>`,
            embeds: [initEmbed],
            components: [
                new ActionRowBuilder().addComponents(selectMenu),
                closeBtn,
            ],
        });
        await interaction.reply({
            content: `**✅ تم إنشاء تذكرتك: <#${ticketChannel.id}>**`,
        });
    });

    //-------- roles_close button --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("roles_close_")) return;
        if (!interaction.guild) return;

        const meta = await db.get(
            `roles_ticket_channel_${interaction.channel.id}`,
        );
        const ownerId = meta?.ownerId || interaction.user.id;
        const gId = meta?.guildId || interaction.guild.id;
        await db.delete(`roles_ticket_${ownerId}_${gId}`);
        await db.delete(`roles_ticket_channel_${interaction.channel.id}`);
        await sendTicketRatingDM(ownerId, gId, "roles").catch(() => {});
        await interaction.reply({ content: "**🔒 سيتم إغلاق التكت...**" });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    });

    //-------- roles_pick select menu: اختيار الرتبة وبدء الدفع --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith("roles_pick_")) return;
        if (!interaction.guild) return;

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const channel = interaction.channel;

        const meta = await db.get(`roles_ticket_channel_${channel.id}`);
        const ticketOwnerId = meta?.ownerId;
        if (ticketOwnerId && ticketOwnerId !== userId) {
            return interaction.reply({
                content: "**🚫 هذا الخيار لصاحب التكت فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const selectedRoleId = interaction.values[0];
        const buyRoles = (await db.get(`buy_roles_${guildId}`)) || [];
        const roleData = buyRoles.find((r) => r.roleId === selectedRoleId);
        if (!roleData)
            return interaction.reply({
                content: "**❌ الرتبة لم تعد متاحة.**",
                flags: MessageFlags.Ephemeral,
            });

        const bank = await db.get(`bank_${guildId}`);
        if (!bank)
            return interaction.reply({
                content: "**❌ لم يتم تحديد البنك.**",
                flags: MessageFlags.Ephemeral,
            });

        const guildRole = interaction.guild.roles.cache.get(selectedRoleId);
        const basePrice = Number(roleData.price);
        const roleTax = Math.floor(basePrice * (20 / 19) + 1);
        await interaction.reply({
            content: `**✅ اخترت: <@&${selectedRoleId}> — السعر: \`${basePrice}\`**\nجارٍ بدء عملية الدفع...`,
            flags: MessageFlags.Ephemeral,
        });
        await channel.send(
            `Re <@!${bank}> ${roleTax}\n\`\`\`Re ${bank} ${roleTax}\`\`\``,
        );
        await channel.send(
            `يرجى التحويل الآن <@${userId}> — المبلغ: **${roleTax}** (السعر ${basePrice} + رسوم ProBot)`,
        );

        const bankBotId = PAYMENT_BOT_ID;
        const bankMember =
            interaction.guild.members.cache.get(bank) ||
            (await interaction.guild.members.fetch(bank).catch(() => null));
        const bankUsername = bankMember?.user?.username || "";
        const bankDisplayName = bankMember?.displayName || "";
        const collector = channel.createMessageCollector({
            filter: (m) => m.author.id === bankBotId,
            time: 300000,
        });
        let done = false;
        collector.on("collect", async (m) => {
            // فحص كل المحتوى: النص العادي + محتوى الـ embeds
            const rawContent = m.content || "";
            const embedDesc = m.embeds?.[0]?.description || "";
            const embedTitle = m.embeds?.[0]?.title || "";
            const fullText = `${rawContent} ${embedDesc} ${embedTitle}`;
            // استخراج المبلغ — يدعم $X وX وbackticks
            let paidAmount = 0;
            const btMatch = fullText.match(/`\$?([\d,]+(?:\.\d+)?)`/);
            const engMatch = fullText.match(/transferred\s+\$?([\d,]+)/i);
            const arMatch = fullText.match(/بتحويل\s+\$?([\d,]+)/);
            const found = btMatch || engMatch || arMatch;
            if (found) paidAmount = Number(found[1].replace(/,/g, ""));
            const bankOk =
                fullText.includes(`<@!${bank}>`) ||
                fullText.includes(`<@${bank}>`) ||
                (bankUsername && fullText.includes(bankUsername)) ||
                (bankDisplayName && fullText.includes(bankDisplayName));
            const isTransfer =
                fullText.includes("has transferred") ||
                fullText.includes("قام بتحويل");
            const priceOk = paidAmount >= basePrice;
            console.log(
                `[RolesTicket] ProBot msg | amount=${paidAmount}/${basePrice}(tax=${roleTax}) | bankOk=${bankOk} | isTransfer=${isTransfer} | priceOk=${priceOk} | text=${fullText.slice(0, 100)}`,
            );
            if (isTransfer && bankOk && priceOk) {
                done = true;
                collector.stop("DONE");
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason !== "DONE") {
                // انتهى الوقت بدون تأكيد دفع — يبقى التكت مفتوحاً للمراجعة
                const adminRoleId = await db.get(`shopad_${guildId}`);
                try {
                    await channel.send({
                        content: adminRoleId ? `<@&${adminRoleId}>` : "",
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهى وقت التحويل")
                                .setDescription(
                                    ED.shopInteractions_023({
                                        basePrice,
                                        roleTax,
                                        selectedRoleId,
                                        userId,
                                    }),
                                )
                                .setColor(await getColor(guildId, db, config))
                                .setTimestamp(),
                        ],
                    });
                } catch {}
                return;
            }

            // إعطاء الرتبة
            let roleGiven = false;
            try {
                let member = interaction.guild.members.cache.get(userId);
                if (!member)
                    member = await interaction.guild.members
                        .fetch(userId)
                        .catch(() => null);
                if (!member) throw new Error("Member not found");
                await member.roles.add(selectedRoleId);
                roleGiven = true;
                await channel.send(
                    `** تهانينا <@${userId}>! تم منحك رتبة <@&${selectedRoleId}>.**`,
                );

        // لوق في قناة اللوق
        const logsChannelId = (meta.type === "scam" ? await db.get(`scam_logs_${guildId}`) : null) || await db.get(`logs_${guildId}`);
                const logsChannel =
                    interaction.guild.channels.cache.get(logsChannelId);
                if (logsChannel) {
                    await logsChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  شراء رتبة جديدة")
                                .addFields(
                                    {
                                        name: " العضو",
                                        value: `<@${userId}>`,
                                        inline: true,
                                    },
                                    {
                                        name: " الرتبة",
                                        value: `<@&${selectedRoleId}>`,
                                        inline: true,
                                    },
                                    {
                                        name: " المبلغ",
                                        value: `${roleData.price}`,
                                        inline: true,
                                    },
                                )
                                .setColor(await getColor(guildId, db, config))
                                .setTimestamp(),
                        ],
                    });
                }
            } catch (e) {
                console.error(
                    `[roles.add] فشل منح الرتبة ${selectedRoleId} للعضو ${userId}:`,
                    e.message,
                );
                // فشل إعطاء الرتبة — يبقى التكت مفتوحاً للمراجعة
                const adminRoleId = await db.get(`shopad_${guildId}`);
                let reason = "";
                if (e.code === 50013)
                    reason =
                        "\n> **السبب:** البوت لا يملك صلاحية كافية (رتبة البوت يجب أ � تكون أعلى من الرتبة المراد منحها)";
                else if (e.code === 10011)
                    reason = "\n> **السبب:** الرتبة غير موجودة في السيرفر";
                else reason = `\n> **السبب:** ${e.message}`;
                await channel.send({
                    content: adminRoleId ? `<@&${adminRoleId}>` : "",
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "⚠️ تم استلام الدفع — خطأ في إعطاء الرتبة",
                            )
                            .setDescription(
                                ED.shopInteractions_024({
                                    reason,
                                    roleData,
                                    selectedRoleId,
                                    userId,
                                }),
                            )
                            .setColor(_ec.color(guildId))
                            .setTimestamp(),
                    ],
                });
                return;
            }

            if (roleGiven) {
                // نجح كل شي — حذف التكت بعد 15 ثانية
                await channel.send(
                    "**✅ سيتم إغلاق هذا التكت تلقائياً خلال 15 ثانية...**",
                );
                await db.delete(`roles_ticket_${userId}_${guildId}`);
                await db.delete(`roles_ticket_channel_${channel.id}`);
                setTimeout(() => channel.delete().catch(() => {}), 15000);
            }
        });
    });

    //-------- roles_prices button: عرض أسعار الرتب --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("roles_prices_")) return;
        if (!interaction.guild) return;

        const guildId = _ec.gid(interaction); // استخدام gid من ملفك
        const buyRoles = (await db.get(`buy_roles_${guildId}`)) || [];

        if (buyRoles.length === 0) {
            return interaction.reply({
                content: "**❌ لا توجد رتب مضافة بعد.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        // جلب اللون من الكاش وصورة أسعار الرتب المخصصة (أو الخط العام)
        const color = _ec.color(guildId);
        const imageUrl =
            (await db.get(`priceRolesImage_${guildId}`)) ||
            (await db.get(`image_${guildId}`));

        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  أسعار الرتب المتاحة")
            .setDescription(ED.shopInteractions_025({ buyRoles }))
            .setColor(color) // اللون الجاهز من ملفك
            .setTimestamp();

        // إضافة الصورة باستخدام if كما اتفقنا
        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        const buyBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket-roles")
                .setLabel("شراء رتبة")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.ticketRoles),
        );

        await interaction.reply({
            embeds: [embed],
            components: [buyBtn],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- roles_delete_panel: زر حذف رتبة من /list-roles --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("roles_delete_panel_")) return;
        if (!interaction.guild) return;
        if (!interaction.member.permissions.has("Administrator")) {
            return interaction.reply({
                content: "**❌ يجب أن تكون لديك صلاحية Administrator.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const guildId = interaction.customId.replace("roles_delete_panel_", "");
        const roles = (await db.get(`buy_roles_${guildId}`)) || [];
        if (roles.length === 0) {
            return interaction.reply({
                content: "**❌ لا توجد رتب مضافة.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`roles_delete_select_${guildId}`)
            .setPlaceholder("اختر الرتبة التي تريد حذفها")
            .addOptions(
                roles.map((r) => ({
                    label: r.name,
                    description: `السعر: ${r.price}`,
                    value: r.roleId,
                })),
            );
        await interaction.reply({
            content: "**اختر الرتبة للحذف:**",
            components: [new ActionRowBuilder().addComponents(menu)],
            flags: MessageFlags.Ephemeral,
        });
    });

    //======================================================
    //              نظام القوانين (rule buttons)
    //======================================================

    //======================================================
    //           نظام تكتات الدعم الفني والتشهير
    //======================================================

    // دالة مشتركة لإنشاء تكت
    async function _createTicket(interaction, type) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const isScam = type === "scam";

        const supportCat = await db.get(`support_cat_${guildId}`);
        if (!supportCat)
            return interaction.reply({
                content: "**❌ لم يتم إعداد كتاغوري الدعم. استخدم `/setup`.**",
                flags: MessageFlags.Ephemeral,
            });

        const adminKey = isScam
            ? `scam_admin_${guildId}`
            : `support_admin_${guildId}`;
        let adminRoleId = await db.get(adminKey);
        if (!adminRoleId)
            adminRoleId = await db.get(`support_admin_${guildId}`);
        if (!adminRoleId)
            return interaction.reply({
                content: "**❌ لم يتم إعداد مسؤول الدعم. استخدم `/setup`.**",
                flags: MessageFlags.Ephemeral,
            });

        const dbKey = `${type}_ticket_${userId}_${guildId}`;
        const existing = await db.get(dbKey);
        if (existing) {
            const existingCh = interaction.guild.channels.cache.get(
                existing.channelId,
            );
            if (existingCh)
                return interaction.reply({
                    content: `**❌ لديك تذكرة مفتوحة بالفعل: <#${existingCh.id}>**`,
                    flags: MessageFlags.Ephemeral,
                });
            await db.delete(dbKey);
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketNum = Math.floor(Math.random() * 9000) + 1000;
        const prefix = isScam ? "🚨-تشهير" : "🎫-دعم";
        const adminRole = interaction.guild.roles.cache.get(adminRoleId);
        const safeName =
            interaction.user.username
                .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")
                .slice(0, 20) || "user";

        const ticketChannel = await interaction.guild.channels.create({
            name: `${prefix}-${ticketNum}-${safeName}`,
            type: ChannelType.GuildText,
            parent: supportCat,
            permissionOverwrites: [
                {
                    id: userId,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "AttachFiles",
                        "EmbedLinks",
                    ],
                },
                { id: interaction.guild.roles.everyone, deny: ["ViewChannel"] },
                {
                    id: adminRole?.id || adminRoleId,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "AttachFiles",
                        "EmbedLinks",
                        "ManageMessages",
                    ],
                },
            ],
        });

        const ticketData = {
            userId,
            channelId: ticketChannel.id,
            guildId,
            ticketNum,
            type,
            createdAt: Date.now(),
            claimedBy: null,
            status: "open",
        };
        await db.set(dbKey, ticketData);
        await db.set(`support_ticket_ch_${ticketChannel.id}`, {
            ...ticketData,
            dbKey,
        });

        const imageUrl = await db.get(`image_${guildId}`);

        // أزرار التحكم — تختلف بين الدعم والتشهير
        const controlBtns = [
            new ButtonBuilder()
                .setCustomId(`sup_claim_${ticketChannel.id}`)
                .setLabel("استلام")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.claim),
        ];
        if (isScam)
            controlBtns.push(
                new ButtonBuilder()
                    .setCustomId(`scam_form_${ticketChannel.id}`)
                    .setLabel("بدء التشهير")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.report),
            );
        controlBtns.push(
            new ButtonBuilder()
                .setCustomId(`sup_add_${ticketChannel.id}`)
                .setLabel("إضافة عضو")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.addMember),
            new ButtonBuilder()
                .setCustomId(`sup_remove_${ticketChannel.id}`)
                .setLabel("إزالة عضو")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.removeMember),
            new ButtonBuilder()
                .setCustomId(`sup_close_${ticketChannel.id}`)
                .setLabel("إغلاق")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.close),
        );
        const controlRow = new ActionRowBuilder().addComponents(...controlBtns);

        const initEmbed = new EmbedBuilder()
            .setAuthor({
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL({ size: 1024 }),
            })
            .setTitle(
                isScam
                    ? `🚨 تكت تشهير | #${ticketNum}`
                    : `🎫 تكت دعم فني | #${ticketNum}`,
            )
            .setDescription(
                ED.shopInteractions_026({ interaction, isScam, ticketNum }),
            )
            .setColor(await getColor(guildId, db, config))
            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
            .setFooter({
                text: `${interaction.guild.name} | نظام التكتات`,
                iconURL: interaction.guild.iconURL({ size: 64 }),
            })
            .setTimestamp();
        if (imageUrl) initEmbed.setImage(imageUrl);

        await ticketChannel.send({
            content: `<@${userId}> <@&${adminRoleId}>`,
            embeds: [initEmbed],
            components: [controlRow],
        });
        await interaction.reply({
            content: `**✅ تم إنشاء تذكرتك: <#${ticketChannel.id}>**`,
        });
    }

    //-------- ticket-support --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "ticket-support") return;
        if (!interaction.guild) return;
        await _createTicket(interaction, "support");
    });

    //-------- ticket-scam --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "ticket-scam") return;
        if (!interaction.guild) return;
        await _createTicket(interaction, "scam");
    });

    //-------- sup_claim: استلام التكت --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("sup_claim_")) return;
        if (!interaction.guild) return;

        const channelId = interaction.customId.replace("sup_claim_", "");
        const guildId = interaction.guild.id;
        const meta = await db.get(`support_ticket_ch_${channelId}`);
        if (!meta)
            return interaction.reply({
                content: "**❌ بيانات التكت غير موجودة.**",
                flags: MessageFlags.Ephemeral,
            });

        const adminKey =
            meta.type === "scam"
                ? `scam_admin_${guildId}`
                : `support_admin_${guildId}`;
        let adminRoleId =
            (await db.get(adminKey)) ||
            (await db.get(`support_admin_${guildId}`));
        if (
            adminRoleId &&
            !interaction.member.roles.cache.has(adminRoleId) &&
            !interaction.member.permissions.has("Administrator")
        ) {
            return interaction.reply({
                content: `**❌ هذا الزر لمسؤولي الدعم فقط.**`,
                flags: MessageFlags.Ephemeral,
            });
        }
        if (meta.claimedBy)
            return interaction.reply({
                content: `**⚠️ التكت مُستلَم بالفعل من <@${meta.claimedBy}>.**`,
                flags: MessageFlags.Ephemeral,
            });

        meta.claimedBy = interaction.user.id;
        meta.claimedAt = Date.now();
        meta.status = "claimed";
        await db.set(`support_ticket_ch_${channelId}`, meta);
        await db.set(meta.dbKey, meta);

        // ➕ نقطة للمسؤول
        const currentPts =
            (await db.get(`ticket_pts_${interaction.user.id}_${guildId}`)) || 0;
        await db.set(
            `ticket_pts_${interaction.user.id}_${guildId}`,
            currentPts + 1,
        );

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تم استلام التكت")
                    .setDescription(ED.shopInteractions_027({ interaction }))
                    .addFields(
                        {
                            name: " وقت الاستلام",
                            value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                            inline: true,
                        },
                        {
                            name: " نقاطك الحالية",
                            value: `**${currentPts + 1}** نقطة`,
                            inline: true,
                        },
                    )
                    .setColor(await getColor(guildId, db, config))
                    .setTimestamp(),
            ],
        });

        // لوق في قناة اللوق
        const logsChannelId = await db.get(`logs_${guildId}`);
        const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
        if (logsChannel) {
            const ticketOwner = await interaction.guild.members
                .fetch(meta.userId)
                .catch(() => null);
            await logsChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            `${meta.type === "scam" ? "🚨 استلام تكت تشهير" : "🎫 استلام تكت دعم فني"}`,
                        )
                        .addFields(
                            {
                                name: "المسؤول المستلم",
                                value: `<@${interaction.user.id}>`,
                                inline: true,
                            },
                            {
                                name: "صاحب التكت",
                                value: `<@${meta.userId}>`,
                                inline: true,
                            },
                            {
                                name: "اسم التكت",
                                value: `<#${channelId}>`,
                                inline: true,
                            },
                            {
                                name: "رقم التكت",
                                value: `#${meta.ticketNum}`,
                                inline: true,
                            },
                            {
                                name: "وقت الاستلام",
                                value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                                inline: true,
                            },
                            {
                                name: "الحالة",
                                value: "قيد المعالجة",
                                inline: true,
                            },
                        )
                        .setColor(await getColor(guildId, db, config))
                        .setTimestamp(),
                ],
            });
        }
    });

    //-------- scam_form: فورم التشهير التلقائي خطوة بخطوة --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("scam_form_")) return;
        if (!interaction.guild) return;

        const channelId = interaction.customId.replace("scam_form_", "");
        const guildId = interaction.guild.id;
        const meta = await db.get(`support_ticket_ch_${channelId}`);
        if (!meta)
            return interaction.reply({
                content: "**❌ بيانات التكت غير موجودة.**",
                flags: MessageFlags.Ephemeral,
            });

        // المسؤول أو العليا فقط يشغّلون الفورم
        const adminRoleId =
            (await db.get(`scam_admin_${guildId}`)) ||
            (await db.get(`support_admin_${guildId}`));
        if (
            adminRoleId &&
            !interaction.member.roles.cache.has(adminRoleId) &&
            !interaction.member.permissions.has("Administrator")
        ) {
            return interaction.reply({
                content: "**❌ فقط مسؤولو الدعم يمكنهم بدء التقرير.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({
            content: `** بدأ الإداري <@${interaction.user.id}> استمارة التشهير — جاري طرح الأسئلة...**`,
        });

        const questions = [
            {
                key: "scammer_name",
                label: "1️⃣ **اسم/معرف الشخص النصاب في Discord؟**\n*(يفضّل إرسال **منشن** `@user` أو **ID** الرقمي ليتم بانه تلقائياً عند النشر — خلال دقيقتين)*",
            },
            {
                key: "what_happened",
                label: "2️⃣ **كيف قام بالنصب؟**\n*(اشرح ما حدث بالتفصيل)*",
            },
            {
                key: "what_lost",
                label: "3️⃣ **ماذا خسرت؟**\n*(المبلغ أو الشيء الذي أُخذ منك)*",
            },
            {
                key: "evidence",
                label: "4️⃣ **أرسل الأدلة الآن**\n*(صور، مقاطع، أو روابط — عند الانتهاء اكتب `تم`)*",
            },
        ];

        const answers = {};
        const evidenceTexts = [];
        const evidenceImages = [];
        const ticketOwner = meta.userId;

        // دالة ترسل سؤال وتنتظر رد صاحب التكت
        const askQuestion = (q) =>
            new Promise(async (resolve) => {
                const qMsg = await interaction.channel.send({
                    content: q.label,
                });
                const collector = interaction.channel.createMessageCollector({
                    filter: (m) => m.author.id === ticketOwner,
                    time: 120000,
                });

                if (q.key === "evidence") {
                    // للأدلة: يجمع عدة رسائل حتى يكتب "تم" — نفصل النصوص عن الصور
                    collector.on("collect", async (m) => {
                        if (m.content.trim() === "تم") {
                            collector.stop("done");
                            return;
                        }
                        if (m.attachments.size > 0)
                            m.attachments.forEach((att) =>
                                evidenceImages.push(att.url),
                            );
                        if (m.content && m.content.trim() !== "تم")
                            evidenceTexts.push(m.content.trim());
                    });
                    collector.on("end", (_, reason) => {
                        qMsg.delete().catch(() => {});
                        const all = [...evidenceTexts, ...evidenceImages];
                        resolve(
                            reason === "done"
                                ? all.length
                                    ? all.join("\n")
                                    : "لا توجد أدلة"
                                : "⏰ انتهى الوقت",
                        );
                    });
                } else {
                    collector.on("collect", async (m) => {
                        answers[q.key] = m.content;
                        m.delete().catch(() => {});
                        collector.stop("answered");
                    });
                    collector.on("end", (collected, reason) => {
                        qMsg.delete().catch(() => {});
                        if (reason !== "answered")
                            answers[q.key] = "⏰ لم يتم الإجابة";
                        resolve(answers[q.key]);
                    });
                }
            });

        // طرح الأسئلة بالتسلسل
        for (const q of questions) {
            await askQuestion(q);
        }

        // ملخص التقرير
        const imageUrl = await db.get(`image_${guildId}`);
        const reportEmbed = new EmbedBuilder()
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> تقرير تشهير — #${meta.ticketNum}`)
            .setColor(await getColor(guildId, db, config))
            .addFields(
                {
                    name: " صاحب التقرير",
                    value: `<@${ticketOwner}>`,
                    inline: true,
                },
                {
                    name: " المسؤول المُعالج",
                    value: `<@${interaction.user.id}>`,
                    inline: true,
                },
                { name: "\u200B", value: "\u200B", inline: false },
                {
                    name: " اسم/معرف النصاب",
                    value: answers.scammer_name || "—",
                    inline: false,
                },
                {
                    name: " القصه ",
                    value: answers.what_happened || "—",
                    inline: false,
                },
                {
                    name: " ماذا خُسر",
                    value: answers.what_lost || "—",
                    inline: false,
                },
                {
                    name: " الدليل ",
                    value: evidenceTexts.length
                        ? evidenceTexts.join("\n").slice(0, 1024)
                        : "—",
                    inline: false,
                },
                {
                    name: " المنشن (صور/مرفقات)",
                    value: evidenceImages.length
                        ? evidenceImages.join("\n").slice(0, 1024)
                        : "—",
                    inline: false,
                },
            )
            .setFooter({ text: `${interaction.guild.name} | نظام التشهير` })
            .setTimestamp();
        if (imageUrl) reportEmbed.setImage(imageUrl);

        const publishBtn = new ButtonBuilder()
            .setCustomId(
                `scam_publish_${meta.ticketNum}_${guildId}_${ticketOwner}_${interaction.channel.id}`,
            )
            .setLabel("نشر التشهير")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.publish);
        const cancelBtn = new ButtonBuilder()
            .setCustomId(`scam_cancel_${interaction.channel.id}`)
            .setLabel("إلغاء التشهير")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.cancelPublish);
        const actionRow = new ActionRowBuilder().addComponents(
            publishBtn,
            cancelBtn,
        );

        await interaction.channel.send({
            content: `**✅ تم إكمال التقرير — في انتظار قرار الإدارة:**`,
            embeds: [reportEmbed],
            components: [actionRow],
        });

        // لوق في قناة اللوق
        const logsChannelId = await db.get(`logs_${guildId}`);
        const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
        if (logsChannel)
            await logsChannel.send({
                content: ` تقرير تشهير جديد من <@${ticketOwner}>`,
                embeds: [reportEmbed],
            });
    });

    //-------- scam_publish: نشر التشهير في الروم + بان تلقائي --------
    // helper: استخراج Discord User ID من نص (mention أو ID مباشر)
    const extractScammerId = (text) => {
        if (!text) return null;
        const m = String(text).match(/(\d{17,20})/);
        return m ? m[1] : null;
    };

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("scam_publish_")) return;
        if (!interaction.guild) return;

        const adminRoleId =
            (await db.get(`scam_admin_${interaction.guild.id}`)) ||
            (await db.get(`support_admin_${interaction.guild.id}`));
        if (
            adminRoleId &&
            !interaction.member.roles.cache.has(adminRoleId) &&
            !interaction.member.permissions.has("Administrator")
        ) {
            return interaction.reply({
                content: "**❌ فقط مسؤولو التشهير يمكنهم النشر.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        // scam_publish_{ticketNum}_{guildId}_{ownerId}_{channelId}
        const parts = interaction.customId
            .replace("scam_publish_", "")
            .split("_");
        const ticketNum = parts[0];
        const guildId = parts[1];
        const ownerId = parts[2];
        const channelId = parts[3];

        const scamRoomId = await db.get(`scam_room_${guildId}`);
        if (!scamRoomId) {
            return interaction.reply({
                content:
                    "**❌ لم يتم تحديد روم التشهير. استخدم `/setup` واختر `scam-room`.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        const scamRoom = interaction.guild.channels.cache.get(scamRoomId);
        if (!scamRoom)
            return interaction.reply({
                content: "**❌ روم التشهير غير موجود.**",
                flags: MessageFlags.Ephemeral,
            });

        // اقرأ بيانات التقرير من الـ embed داخل التكت
        const origEmbed = interaction.message.embeds[0];
        if (!origEmbed)
            return interaction.reply({
                content: "**❌ لم يتم العثور على تق}�ير.**",
                flags: MessageFlags.Ephemeral,
            });

        const getField = (name) => {
            const f = origEmbed.fields.find(
                (x) => x.name && x.name.includes(name),
            );
            return f ? f.value : "—";
        };
        const scammerRaw = getField("اسم/معرف النصاب");
        const whatHappened = getField("القصه ");
        const whatLost = getField("ماذا خُسر");
        const evidenceText = getField("الدليل");
        const evidenceImg = getField("المنشن");

        const scammerId = extractScammerId(scammerRaw);

        // محاولة بان تلقائي للنصاب
        let banStatus = "⚠️ لم يتم البان (لم يُتعرف على ID)";
        if (scammerId) {
            try {
                await interaction.guild.bans.create(scammerId, {
                    reason: `تشهير رسمي #${ticketNum} — بواسطة ${interaction.user.tag}`,
                    deleteMessageSeconds: 0,
                });
                banStatus = ` تم تبنيده <@${scammerId}> تلقائياً`;
            } catch (e) {
                banStatus = ` فشل البان: \`${e.code || e.message}\``;
                console.error("Auto-ban scammer failed:", e);
            }
        }

        // منشن التشهير: رول مخصّص أو @here
        const scamMentionRoleId = await db.get(`scam_mention_${guildId}`);
        const mentionPart = scamMentionRoleId
            ? `<@&${scamMentionRoleId}>`
            : "@here";

        const scammerDisplay = scammerId
            ? `<@${scammerId}>`
            : scammerRaw || "—";

        // رسالة التشهير العادية بصيغة الصورة
        const publishContent =
            `${mentionPart}\n` +
            `**• استمارة النصابين**\n` +
            `\n` +
            `**قصة النصاب:** ${whatHappened}\n` +
            `\n` +
            `**النصاب:** ${scammerDisplay}\n` +
            `**المشتكي:** <@${ownerId}>\n` +
            `**السلعة المنصوبة:** ${whatLost}\n` +
            `\n` +
            `**دليل:** ${evidenceText}\n` +
            `\n` +
            `**المنشن:** ${evidenceImg}`;

        // زر إلغاء التشهير (للأدمنستريتور فقط) — يحمل scammerId
        const cancelPubBtn = new ButtonBuilder()
            .setCustomId(`scam_unpub_${scammerId || "na"}`)
            .setLabel("إلغاء تشهe�ر")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis.cancelPublish);
        const pubRow = new ActionRowBuilder().addComponents(cancelPubBtn);

        const sentMsg = await scamRoom.send({
            content: publishContent.slice(0, 1900),
            components: [pubRow],
            allowedMentions: { parse: ["everyone", "roles", "users"] },
        });

        // تعطيل الأزرار في التكت
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("_done1")
                .setLabel("تم النشر")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji(emojis.done),
            new ButtonBuilder()
                .setCustomId("_done2")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji(emojis.cancel),
        );
        await interaction.update({ components: [disabledRow] });
        await interaction.channel.send(
            `**✅ تم نشر التشهير في <#${scamRoomId}> بواسطة <@${interaction.user.id}>.**\n` +
                `${banStatus}\n` +
                `🔗 [الذهاب للرسالة](${sentMsg.url})\n` +
                `**🔒 سيتم إغلاق التكت خلال 10 ثواني...**`,
        );

        const meta = await db.get(`support_ticket_ch_${channelId}`);
        if (meta) {
            await db.delete(`scam_ticket_${meta.userId}_${guildId}`);
            await db.delete(`support_ticket_ch_${channelId}`);
        }
        setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
    });

    //-------- scam_cancel: إلغاء التشهير وإغلاق التكت --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("scam_cancel_")) return;
        if (!interaction.guild) return;

        const adminRoleId =
            (await db.get(`scam_admin_${interaction.guild.id}`)) ||
            (await db.get(`support_admin_${interaction.guild.id}`));
        if (
            adminRoleId &&
            !interaction.member.roles.cache.has(adminRoleId) &&
            !interaction.member.permissions.has("Administrator")
        ) {
            return interaction.reply({
                content: "**❌ فقط مسؤولو التشهير يمكنهم إلغاء التشهير.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const channelId = interaction.customId.replace("scam_cancel_", "");
        const guildId = interaction.guild.id;

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("_done1")
                .setLabel("تم النشر")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji(emojis.done),
            new ButtonBuilder()
                .setCustomId("_done2")
                .setLabel("تم الإلغاء")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji(emojis.cancel),
        );
        await interaction.update({ components: [disabledRow] });
        await interaction.channel.send(
            `**🚫 تم إلغاء التشهير بواسطة <@${interaction.user.id}>.**\n**🔒 سيتم إغلاق التكت خلال 10 ثواني...**`,
        );

        const meta = await db.get(`support_ticket_ch_${channelId}`);
        if (meta) {
            await db.delete(`scam_ticket_${meta.userId}_${guildId}`);
            await db.delete(`support_ticket_ch_${channelId}`);
        }
        setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
    });

    //-------- scam_unpub_{scammerId}: إلغاء التشهير (حذف الرسالة + فك بان النصاب) --------
    // الزر متاح للأدمنستريتور فقط (Administrator permission)
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("scam_unpub_")) return;
        if (!interaction.guild) return;

        // الأدمنستريتور فقط
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            return interaction.reply({
                content: "**❌ هذا الزر مخصّص للأدمنستريتور فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const scammerId = interaction.customId.replace("scam_unpub_", "");

        // فك البان
        let unbanStatus = "";
        if (scammerId && /^\d{17,20}$/.test(scammerId)) {
            try {
                await interaction.guild.bans.remove(
                    scammerId,
                    `إلغاء تشهير بواسطة ${interaction.user.tag}`,
                );
                unbanStatus = `تم فك البان عن <@${scammerId}>`;
            } catch (e) {
                if (e.code === 10026)
                    unbanStatus = ` <@${scammerId}> غير مبند أصلاً`;
                else
                    unbanStatus = ` تعذّر فك البان: \`${e.code || e.message}\``;
            }
        } else {
            unbanStatus = " لا يوجد ID نصاب لفك البان عنه";
        }

        // حذف الرسالة
        await interaction.message.delete().catch(() => {});

        // إعلام الأدمن سراً
        try {
            await interaction.user.send(
                `**🚫 تم إلغاء التشهير في ${interaction.guild.name}**\n${unbanStatus}`,
            );
        } catch {}
    });

    //-------- sup_add: إضافة عضو للتكت --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("sup_add_")) return;
        if (!interaction.guild) return;

        const channelId = interaction.customId.replace("sup_add_", "");
        const guildId = interaction.guild.id;
        const adminRoleId = await db.get(`support_admin_${guildId}`);
        if (
            adminRoleId &&
            !interaction.member.roles.cache.has(adminRoleId) &&
            !interaction.member.permissions.has("Administrator")
        ) {
            return interaction.reply({
                content: "**❌ هذا الزر لمسؤولي الدعم فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.reply({
            content: "**أرسل معرّف العضو الذي تريد إضافته (ID) خلال دقيقتين:**",
            flags: MessageFlags.Ephemeral,
        });
        try {
            const msgs = await interaction.channel.awaitMessages({
                filter: (m) => m.author.id === interaction.user.id,
                max: 1,
                time: 120000,
                errors: ["time"],
            });
            const memberId = msgs.first().content.trim();
            msgs.first()
                .delete()
                .catch(() => {});
            if (!/^\d{17,20}$/.test(memberId))
                return interaction.followUp({
                    content: "**❌ معرّف غير صالح.**",
                    flags: MessageFlags.Ephemeral,
                });
            const member = await interaction.guild.members
                .fetch(memberId)
                .catch(() => null);
            if (!member)
                return interaction.followUp({
                    content: "**❌ العضو غير موجود في السيرفر.**",
                    flags: MessageFlags.Ephemeral,
                });
            await interaction.channel.permissionOverwrites.edit(member, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            });
            await interaction.channel.send(
                `**✅ تمت إضافة <@${memberId}> للتكت.**`,
            );
        } catch {
            await interaction.followUp({
                content: "**⏰ انتهى الوقت.**",
                flags: MessageFlags.Ephemeral,
            });
        }
    });

    //-------- sup_remove: إزالة عضو من التكت --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("sup_remove_")) return;
        if (!interaction.guild) return;

        const channelId = interaction.customId.replace("sup_remove_", "");
        const guildId = interaction.guild.id;
        const adminRoleId = await db.get(`support_admin_${guildId}`);
        if (
            adminRoleId &&
            !interaction.member.roles.cache.has(adminRoleId) &&
            !interaction.member.permissions.has("Administrator")
        ) {
            return interaction.reply({
                content: "**❌ هذا الزر لمسؤولي الدعم فقط.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.reply({
            content: "**أرسل معرّف العضو الذي تريد إزالته (ID) خلال دقيقتين:**",
            flags: MessageFlags.Ephemeral,
        });
        try {
            const msgs = await interaction.channel.awaitMessages({
                filter: (m) => m.author.id === interaction.user.id,
                max: 1,
                time: 120000,
                errors: ["time"],
            });
            const memberId = msgs.first().content.trim();
            msgs.first()
                .delete()
                .catch(() => {});
            const meta = await db.get(`support_ticket_ch_${channelId}`);
            if (meta && memberId === meta.userId)
                return interaction.followUp({
                    content: "**❌ لا يمكنك إزالة صاحب التكت.**",
                    flags: MessageFlags.Ephemeral,
                });
            await interaction.channel.permissionOverwrites
                .delete(memberId)
                .catch(() => {});
            await interaction.channel.send(
                `**✅ تمت إزالة <@${memberId}> من التكت.**`,
            );
        } catch {
            await interaction.followUp({
                content: "**⏰ انتهى الوقت.**",
                flags: MessageFlags.Ephemeral,
            });
        }
    });

    //-------- sup_close: إغلاق التكت --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("sup_close_")) return;
        if (!interaction.guild) return;

        const channelId = interaction.customId.replace("sup_close_", "");
        const guildId = interaction.guild.id;
        const meta = await db.get(`support_ticket_ch_${channelId}`);
        if (!meta)
            return interaction.reply({
                content: "**❌ بيانات التكت غير موجودة.**",
                flags: MessageFlags.Ephemeral,
            });

        const adminRoleId =
            (await db.get(`support_admin_${guildId}`)) ||
            (await db.get(`scam_admin_${guildId}`));
        const isOwner = interaction.user.id === meta.userId;
        const isAdmin =
            adminRoleId && interaction.member.roles.cache.has(adminRoleId);
        if (
            !isOwner &&
            !isAdmin &&
            !interaction.member.permissions.has("Administrator")
        ) {
            return interaction.reply({
                content: "**❌ فقط صاحب التكت أو الإداري يمكنه الإغلاق.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        // تحديث الداتا
        meta.status = "closed";
        meta.closedBy = interaction.user.id;
        meta.closedAt = Date.now();
        await db.set(`support_ticket_ch_${channelId}`, meta);
        await db.set(meta.dbKey, meta);
        await db.delete(meta.dbKey);

        const deleteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sup_delete_${channelId}`)
                .setLabel("حذف القناة")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.delete),
        );
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم إغلاق التكت")
                    .setDescription(ED.shopInteractions_028({ interaction }))
                    .addFields(
                        {
                            name: "صاحب التكت",
                            value: `<@${meta.userId}>`,
                            inline: true,
                        },
                        {
                            name: "المغلق بواسطة",
                            value: `<@${interaction.user.id}>`,
                            inline: true,
                        },
                        {
                            name: "وقت الإغلاق",
                            value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                            inline: true,
                        },
                    )
                    .setColor(await getColor(guildId, db, config))
                    .setTimestamp(),
            ],
            components: [deleteRow],
        });

        // لوق الإغلاق
        const scamLogsId = await db.get(`scam_logs_${guildId}`);
        const logsChannelId = (meta.type === "scam" && scamLogsId) ? scamLogsId : await db.get(`logs_${guildId}`);
        const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
        if (logsChannel) {
            await logsChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            ` إغلاق تكت ${meta.type === "scam" ? "تشهير" : "دعم"}`,
                        )
                        .addFields(
                            {
                                name: "صاحب التكت",
                                value: `<@${meta.userId}>`,
                                inline: true,
                            },
                            {
                                name: "المغلق بواسطة",
                                value: `<@${interaction.user.id}>`,
                                inline: true,
                            },
                            {
                                name: "رقم التكت",
                                value: `#${meta.ticketNum}`,
                                inline: true,
                            },
                            {
                                name: "المُستلَم بواسطة",
                                value: meta.claimedBy
                                    ? `<@${meta.claimedBy}>`
                                    : "لم يُستلم",
                                inline: true,
                            },
                        )
                        .setColor(await getColor(guildId, db, config))
                        .setTimestamp(),
                ],
            });
        }

        // تقييم الخدمة — يُرسل فقط إذا استُلم التكت (claimedBy موجود)
        if (meta.claimedBy) {
            await sendTicketRatingDM(
                meta.userId,
                guildId,
                meta.type || "support",
            ).catch(() => {});
        }
    });

    //-------- sup_delete: حذف قناة التكت --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("sup_delete_")) return;
        if (!interaction.guild) return;

        const guildId = interaction.guild.id;
        const adminRoleId = await db.get(`support_admin_${guildId}`);
        if (
            adminRoleId &&
            !interaction.member.roles.cache.has(adminRoleId) &&
            !interaction.member.permissions.has("Administrator")
        ) {
            return interaction.reply({
                content: "**❌ فقط الإداري يمكنه حذف القناة.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.reply({ content: "**🗑 جارٍ حذف القناة...**" });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    });
// أمر !اصلاح
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith("!اصلاح")) return;
    if (!message.guild) return;

    const guildId = message.guild.id;

    // صلاحية الأدمن فقط
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("**❌ هذا الأمر للإدارة العليا فقط.**");
    }

    // استخراج المنشن من الرسالة
    const mention = message.mentions.users.first();
    if (!mention) {
        return message.reply("**❌ يرجى منشن المستخدم: `!اصلاح @المستخدم`**");
    }

    const targetId = mention.id;

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`fix_shop_${targetId}_${guildId}`).setLabel("متاجر").setStyle(ButtonStyle.Primary).setEmoji("🛒"),
        new ButtonBuilder().setCustomId(`fix_auction_${targetId}_${guildId}`).setLabel("مزاد").setStyle(ButtonStyle.Primary).setEmoji("🔨"),
        new ButtonBuilder().setCustomId(`fix_order_${targetId}_${guildId}`).setLabel("طلبات").setStyle(ButtonStyle.Primary).setEmoji("📦"),
        new ButtonBuilder().setCustomId(`fix_roles_${targetId}_${guildId}`).setLabel("رتب").setStyle(ButtonStyle.Primary).setEmoji("👑"),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`fix_support_${targetId}_${guildId}`).setLabel("دعم").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
        new ButtonBuilder().setCustomId(`fix_scam_${targetId}_${guildId}`).setLabel("تشهير").setStyle(ButtonStyle.Primary).setEmoji("🚨"),
        new ButtonBuilder().setCustomId(`fix_all_${targetId}_${guildId}`).setLabel("الكل").setStyle(ButtonStyle.Danger).setEmoji("🗑️"),
    );

    await message.channel.send({
        content: `**🛠️ اختر نوع التكت لمسح بيانات <@${targetId}>:**`,
        components: [row1, row2],
    });
});

// معالج الأزرار
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("fix_")) return;

    const parts = interaction.customId.split("_");
    const type = parts[1];
    const targetId = parts[2];
    const guildId = parts[3];

    // صلاحية الأدمن فقط
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: "**❌ هذا الزر للإدارة العليا فقط.**",
            flags: MessageFlags.Ephemeral,
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const deletedChannels = [];
    const deletedKeys = [];

    const pushIfOpen = async (channelId) => {
        try {
            const ch = interaction.guild.channels.cache.get(channelId);
            if (ch) {
                deletedChannels.push(`<#${channelId}>`);
                await ch.delete().catch(() => {});
            }
        } catch {}
    };

    // ========== متاجر ==========
    if (type === "shop" || type === "all") {
        const shopTicket = await db.get(`shop_ticket_${targetId}_${guildId}`);
        if (shopTicket?.channelId) {
            await pushIfOpen(shopTicket.channelId);
            await db.delete(`shop_ticket_${targetId}_${guildId}`);
            await db.delete(`shop_ticket_channel_${shopTicket.channelId}`);
            deletedKeys.push("shop_ticket");
        }
        await db.delete(`shop_credit_${targetId}_${guildId}`);
        deletedKeys.push("shop_credit");
    }

    // ========== مزاد ==========
    if (type === "auction" || type === "all") {
        const auctionTicket = await db.get(`auction_ticket_${targetId}_${guildId}`);
        if (auctionTicket?.channelId) {
            await pushIfOpen(auctionTicket.channelId);
            await db.delete(`auction_ticket_${targetId}_${guildId}`);
            await db.delete(`auction_ticket_channel_${auctionTicket.channelId}`);
            deletedKeys.push("auction_ticket");
        }
        await db.delete(`auction_credit_${targetId}_${guildId}`);
        await db.delete(`auction_draft_${targetId}_${guildId}`);
        deletedKeys.push("auction_credit", "auction_draft");
    }

    // ========== طلبات ==========
    if (type === "order" || type === "all") {
        const orderTicket = await db.get(`order_ticket_${targetId}_${guildId}`);
        if (orderTicket?.channelId) {
            await pushIfOpen(orderTicket.channelId);
            await db.delete(`order_ticket_${targetId}_${guildId}`);
            await db.delete(`order_ticket_channel_${orderTicket.channelId}`);
            deletedKeys.push("order_ticket");
        }
        await db.delete(`order_credit_${targetId}_${guildId}`);
        deletedKeys.push("order_credit");
    }

    // ========== رتب ==========
    if (type === "roles" || type === "all") {
        const rolesTicket = await db.get(`roles_ticket_${targetId}_${guildId}`);
        if (rolesTicket?.channelId) {
            await pushIfOpen(rolesTicket.channelId);
            await db.delete(`roles_ticket_${targetId}_${guildId}`);
            await db.delete(`roles_ticket_channel_${rolesTicket.channelId}`);
            deletedKeys.push("roles_ticket");
        }
    }

    // ========== دعم ==========
    if (type === "support" || type === "all") {
        const supportTicket = await db.get(`support_ticket_${targetId}_${guildId}`);
        if (supportTicket?.channelId) {
            await pushIfOpen(supportTicket.channelId);
            await db.delete(`support_ticket_${targetId}_${guildId}`);
            await db.delete(`support_ticket_ch_${supportTicket.channelId}`);
            deletedKeys.push("support_ticket");
        }
    }

    // ========== تشهير ==========
    if (type === "scam" || type === "all") {
        const scamTicket = await db.get(`scam_ticket_${targetId}_${guildId}`);
        if (scamTicket?.channelId) {
            await pushIfOpen(scamTicket.channelId);
            await db.delete(`scam_ticket_${targetId}_${guildId}`);
            await db.delete(`support_ticket_ch_${scamTicket.channelId}`);
            deletedKeys.push("scam_ticket");
        }
    }

    const resultEmbed = new EmbedBuilder()
        .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  نتيجة الإصلاح")
        .setDescription(
            `**المستخدم:** <@${targetId}>\n` +
            `**النوع:** \`${type === "all" ? "الكل" : type}\`\n\n` +
            `**القنوات المحذوفة:** ${deletedChannels.length > 0 ? deletedChannels.join("، ") : "لا يوجد"}\n` +
            `**المفاتيح المحذوفة:** \`${deletedKeys.join("`, `") || "لا يوجد"}\``
        )
        .setColor(0x00FF00)
        .setTimestamp();

    await interaction.reply({ embeds: [resultEmbed] });

    // لوق
    const logsChannelId = await db.get(`logs_${guildId}`);
    const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
    if (logsChannel) {
        await logsChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم اصلاح")
                    .addFields(
                        { name: "المنفذ", value: `<@${interaction.user.id}>`, inline: true },
                        { name: "المستخدم", value: `<@${targetId}>`, inline: true },
                        { name: "النوع", value: type, inline: true },
                        { name: "القنوات المحذوفة", value: deletedChannels.length.toString(), inline: true },
                    )
                    .setColor(0xFFA500)
                    .setTimestamp(),
            ],
        });
    }
});
    //-------- rule_show: عرض محتوى القانون --------
    client.on("interactionCreate", async (interaction) => {
        // 1. مـعـالـجـة الـتـكـمـلـة الـتـلـقـائـيـة (Autocomplete) لأمـر send-rule
        if (
            interaction.isAutocomplete() &&
            interaction.commandName === "send-rule"
        ) {
            const focusedValue = interaction.options.getFocused();
            const rules =
                (await db.get(`server_rules_${interaction.guild.id}`)) || [];
            const filtered = rules.filter((rule) =>
                rule.label.toLowerCase().includes(focusedValue.toLowerCase()),
            );
            return await interaction.respond(
                filtered
                    .slice(0, 25)
                    .map((rule) => ({ name: rule.label, value: rule.label })),
            );
        }

        // 2. مـعـالـجـة أزرار عـرض الـقـوانـيـن
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("rule_show_")) return;
        if (!interaction.guild) return;

        const parts = interaction.customId.split("_");
        // rule_show_{guildId}_{ruleId}
        const guildId = parts[2];
        const ruleId = parts[3];

        const rules = (await db.get(`server_rules_${guildId}`)) || [];
        const rule = rules.find((r) => r.id === ruleId);

        if (!rule)
            return interaction.reply({
                content: "**❌ هـذا الـقـانـون لـم يـعـد مـوجـوداً.**",
                flags: MessageFlags.Ephemeral,
            });

        const embed = new EmbedBuilder()
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ${rule.emoji || ""} ${rule.label}`)
            .setDescription(ED.shopInteractions_029({ rule }))
            .setColor(await getColor(guildId, db, config))
            .setTimestamp();

        // --- نـظـام الـصـور الـمـطـور ---
        if (rule.image) {
            // إذا كـان الـقـانـون لـه صـورة مـرفـوعـة بـأمـر add-rule
            embed.setImage(rule.image);
        } else {
            // إذا مـا فـي صـورة خـاصـة، يـسـحـب صـورة الـخـط الـعـامـة لـلـسـيـرفـر
            const linePreview = await db.get(`image_${guildId}`);
            if (linePreview) embed.setImage(linePreview);
        }

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- rule_remove_select: حذف قانون من الداتابيز --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith("rule_remove_select_")) return;
        if (!interaction.guild) return;
        if (!interaction.member.permissions.has("Administrator")) {
            return interaction.reply({
                content: "**❌ يجب أن تكون لديك صلاحية Administrator.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const guildId = interaction.customId.replace("rule_remove_select_", "");
        const selectedId = interaction.values[0];
        let rules = (await db.get(`server_rules_${guildId}`)) || [];
        const toDelete = rules.find((r) => r.id === selectedId);
        if (!toDelete)
            return interaction.reply({
                content: "**❌ القانون غير موجود.**",
                flags: MessageFlags.Ephemeral,
            });

        rules = rules.filter((r) => r.id !== selectedId);
        await db.set(`server_rules_${guildId}`, rules);
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف القانون")
                    .setDescription(ED.shopInteractions_030({ toDelete }))
                    .setColor(await getColor(guildId, db, config)),
            ],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- roles_delete_select: حذف الرتبة من القائمة --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith("roles_delete_select_")) return;
        if (!interaction.guild) return;
        if (!interaction.member.permissions.has("Administrator")) {
            return interaction.reply({
                content: "**❌ يجب أن تكون لديك صلاحية Administrator.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const guildId = interaction.customId.replace(
            "roles_delete_select_",
            "",
        );
        const selectedId = interaction.values[0];
        let roles = (await db.get(`buy_roles_${guildId}`)) || [];
        const toDelete = roles.find((r) => r.roleId === selectedId);
        if (!toDelete)
            return interaction.reply({
                content: "**❌ الرتبة غير موجودة.**",
                flags: MessageFlags.Ephemeral,
            });

        roles = roles.filter((r) => r.roleId !== selectedId);
        await db.set(`buy_roles_${guildId}`, roles);
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف الرتبة")
                    .setDescription(ED.shopInteractions_031({ toDelete }))
                    .setColor(await getColor(guildId, db, config)),
            ],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- free_role_select: اختيار رتبة مجانية --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== "free_role_select") return;
        if (!interaction.guild) return;

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const member = await interaction.guild.members.fetch(userId);
        const selectedRoleIds = interaction.values;

        const allSelectRoles = (await db.get(`select_roles_${guildId}`)) || [];
        const validRoleIds = allSelectRoles.map((r) => r.roleId);

        // إزالة الرتب القديمة (اللي في القائمة فقط)
        for (const roleId of validRoleIds) {
            if (member.roles.cache.has(roleId) && !selectedRoleIds.includes(roleId)) {
                try { await member.roles.remove(roleId); } catch {}
            }
        }

        // إضافة الرتب الجديدة
        const added = [];
        for (const roleId of selectedRoleIds) {
            if (!member.roles.cache.has(roleId)) {
                try {
                    await member.roles.add(roleId);
                    added.push(`<@&${roleId}>`);
                } catch {}
            }
        }

        const desc = added.length > 0
            ? `**✅ تم منحك الرتب:**\n${added.join(", ")}`
            : "**✅ تم تحديث رتبك.**";

        await interaction.reply({ content: desc, ephemeral: true });
    });

    //-------- select_role_delete_: حذف رتبة من القائمة المجانية --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith("select_role_delete_")) return;
        if (!interaction.guild) return;
        if (!interaction.member.permissions.has("Administrator")) {
            return interaction.reply({ content: "**❌ Administrator only.**", ephemeral: true });
        }

        const guildId = interaction.customId.replace("select_role_delete_", "");
        const selectedId = interaction.values[0];
        let selectRoles = (await db.get(`select_roles_${guildId}`)) || [];
        const toDelete = selectRoles.find((r) => r.roleId === selectedId);
        if (!toDelete) return interaction.reply({ content: "**❌ الرتبة غير موجودة.**", ephemeral: true });

        selectRoles = selectRoles.filter((r) => r.roleId !== selectedId);
        await db.set(`select_roles_${guildId}`, selectRoles);
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف الرتبة")
                    .setDescription(`تم حذف <@&${toDelete.roleId}> من قائمة الاختيار.`)
                    .setColor(await getColor(guildId, db, config)),
            ],
            ephemeral: true,
        });
    });

    //-------- allinone_prices: بانل الأسعار --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("allinone_prices_")) return;
        if (!interaction.guild) return;
        const gId = interaction.customId.replace("allinone_prices_", "");
        const imageUrl = await db.get(`image_${gId}`);
        const priceImage = await db.get(`priceImage_${gId}`);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  الأسعار")
            .setDescription(ED.shopInteractions_032())
            .setColor(await getColor(gId, db, config))
            .setTimestamp();
        if (priceImage) embed.setImage(priceImage);
        else if (imageUrl) embed.setImage(imageUrl);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("order-price")
                .setLabel("أسعار الطلبات")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.order),
            new ButtonBuilder()
                .setCustomId("auctionpri")
                .setLabel("أسعار المزادات")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.auction),
            new ButtonBuilder()
                .setCustomId("shoppri")
                .setLabel("أسعار المتاجر")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.shop),
            new ButtonBuilder()
                .setCustomId(`roles_prices_${gId}`)
                .setLabel("أسعار الرتب")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.roles),
            new ButtonBuilder()
                .setCustomId(`additions_prices_${gId}`)
                .setLabel("أسعار الإضافات")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.additionsPrices),
        );
        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- additions_prices: أسعار الإضافات (تنظيم متاجر) --------
    const ADDITIONS_LIST = [
        {
            id: "changeshape",
            label: "تغيير شكل المتجر",
            emojiKey: "shape",
            dbKey: "changeshape",
        },
        {
            id: "changetypeprice",
            label: "تغيير نوع المتجر",
            emojiKey: "typeChange",
            dbKey: "changetypeprice",
        },
        {
            id: "changename",
            label: "تغيير اسم المتجر",
            emojiKey: "nameChange",
            dbKey: "changename",
        },
        {
            id: "changeowner",
            label: "تغيير صاحب المتجر",
            emojiKey: "ownerChange",
            dbKey: "changeowner",
        },
        {
            id: "removewarn",
            label: "إزالة تحذيرات",
            emojiKey: "removeWarn",
            dbKey: "removewarncredit",
        },
        {
            id: "shopmention",
            label: "شراء منشن متجر",
            emojiKey: "mention",
            dbKey: "shopprice",
        },
        {
            id: "automessage",
            label: "النشر التلقائي",
            emojiKey: "autoPublish",
            dbKey: "automessage",
        },
        {
            id: "disableauto",
            label: "تعطيل الإرسال التلقائي",
            emojiKey: "disableAuto",
            dbKey: "disableauto",
        },
        {
            id: "shopvacation",
            label: "إجازة المتجر",
            emojiKey: "vacation",
            dbKey: "shopvacation",
        },
        {
            id: "activateshop",
            label: "تفعيل المتجر",
            emojiKey: "activate",
            dbKey: "activateshopprice",
        },
        {
            id: "sellshop",
            label: "بيع المتجر",
            emojiKey: "sell",
            dbKey: "sellshopprice",
        },
    ];

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("additions_prices_")) return;
        if (!interaction.guild) return;
        const gId = interaction.customId.replace("additions_prices_", "");
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  أسعار الإضافات")
            .setDescription("**اضـغـط عـلـى أي زر لـعـرض سـعـر الـخـدمـة**")
            .setTimestamp();
        const rows = [];
        for (let i = 0; i < ADDITIONS_LIST.length; i += 5) {
            const chunk = ADDITIONS_LIST.slice(i, i + 5);
            const row = new ActionRowBuilder().addComponents(
                chunk.map((a) =>
                    new ButtonBuilder()
                        .setCustomId(`addprice_${a.id}_${gId}`)
                        .setLabel(a.label)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.dashboard || "🧩"),
                ),
            );
            rows.push(row);
        }
        await interaction.reply({
            embeds: [embed],
            components: rows,
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- addprice_*: عرض سعر إضافة محددة --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("addprice_")) return;
        if (!interaction.guild) return;
        const rest = interaction.customId.replace("addprice_", "");
        const lastUnderscore = rest.lastIndexOf("_");
        if (lastUnderscore === -1) return;
        const itemId = rest.slice(0, lastUnderscore);
        const gId = rest.slice(lastUnderscore + 1);
        const item = ADDITIONS_LIST.find((a) => a.id === itemId);
        if (!item)
            return interaction.reply({
                content: "**❌ خـدمـة غـيـر مـعـروفـة.**",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`${item.dbKey}_${gId}`);
        const emo = emojis.dashboard || "🧩";
        const embed = new EmbedBuilder()
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ${emo} ${item.label}`)
            .setDescription(
                price
                    ? `**الـسـعـر:** \`${price}\``
                    : "** الـسـعـر غـيـر مـحـدد بـعـد.**",
            )
            .setColor(await getColor(gId, db, config))
            .setTimestamp();
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- allinone_rules: بانل القوانين --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("allinone_rules_")) return;
        if (!interaction.guild) return;
        const gId = interaction.customId.replace("allinone_rules_", "");
        const rules = (await db.get(`server_rules_${gId}`)) || [];
        if (!rules.length)
            return interaction.reply({
                content: "**❌ لا توجد قوانين مضافة بعد.**",
                flags: MessageFlags.Ephemeral,
            });
        const imageUrl = await db.get(`image_${gId}`);
        const rulesImage = await db.get(`rulesImage_${gId}`);
        const embed = new EmbedBuilder()
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504>  قـوانـيـن الـسـيـرفـر${interaction.guild.name}`)
            .setDescription(ED.shopInteractions_033({ interaction }))
            .setColor(await getColor(gId, db, config))
            .setTimestamp();
        if (rulesImage) embed.setImage(rulesImage);
        else if (imageUrl) embed.setImage(imageUrl);
        const btnRow = new ActionRowBuilder().addComponents(
            rules.slice(0, 5).map((r) => {
                const btn = new ButtonBuilder()
                    .setCustomId(`rule_show_${gId}_${r.id}`)
                    .setLabel(r.label.slice(0, 80))
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.rules);
                if (r.emoji)
                    try {
                        btn.setEmoji(r.emoji);
                    } catch {}
                return btn;
            }),
        );
        await interaction.reply({
            embeds: [embed],
            components: [btnRow],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- allinone_tickets: بانل التكتات --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("allinone_tickets_")) return;
        if (!interaction.guild) return;
        const gId = interaction.customId.replace("allinone_tickets_", "");
        const imageUrl = await db.get(`image_${gId}`);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  قسم التكتات")
            .setDescription(ED.shopInteractions_034())
            .setColor(await getColor(gId, db, config))
            .setTimestamp();
        if (imageUrl) embed.setImage(imageUrl);
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("buy_shop")
                .setLabel("شراء متجر")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.shop),
            new ButtonBuilder()
                .setCustomId("ticket-auction")
                .setLabel("تكت مزاد")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.auction),
            new ButtonBuilder()
                .setCustomId("ticket-order")
                .setLabel("تكت طلبات")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.order),
            new ButtonBuilder()
                .setCustomId("ticket-roles")
                .setLabel("شراء رتبة")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.roles),
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket-support")
                .setLabel("الدعم الفني")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.support),
            new ButtonBuilder()
                .setCustomId("ticket-scam")
                .setLabel("تشهير نصاب")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.scam),
        );
        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            flags: MessageFlags.Ephemeral,
        });
    });

    //-------- allinone_roles: بانل الرتب --------
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("allinone_roles_")) return;
        if (!interaction.guild) return;
        const gId = interaction.customId.replace("allinone_roles_", "");
        const rolesList = (await db.get(`buy_roles_${gId}`)) || [];
        if (!rolesList.length)
            return interaction.reply({
                content: "**❌ لا توجد رتب متاحة للبيع حالياً.**",
                flags: MessageFlags.Ephemeral,
            });
        const imageUrl = await db.get(`image_${gId}`);
        const lines = rolesList
            .map(
                (r, idx) =>
                    `**${idx + 1}.** <@&${r.roleId}>\n>  السعر: **${r.price}** كردت\n>  المميزات: ${r.benefits}`,
            )
            .join("\n\n");
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  الرتب المتاحة للشراء")
            .setDescription(ED.shopInteractions_035({ lines }))
            .setColor(await getColor(gId, db, config))
            .setTimestamp();
        if (imageUrl) embed.setImage(imageUrl);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket-roles")
                .setLabel("شراء رتبة")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.roles),
        );
        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    //====== معالج أزرار تقييم التكتات (tr_) — تصل من الخاص ======
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("tr_")) return;

        const parts = interaction.customId.split("_");
        if (parts.length < 4) return;
        const rating = parseInt(parts[1]);
        const guildId = parts[2];
        const type = parts[3];
        if (isNaN(rating) || rating < 1 || rating > 5) return;

        const ratingChId = await db.get(`rating_ch_${guildId}`);
        if (!ratingChId) {
            return interaction
                .update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> لم يتم تحديد روم التقييمات")
                            .setDescription(ED.shopInteractions_036())
                            .setTimestamp(),
                    ],
                    components: [],
                })
                .catch(() => {});
        }

        const typeLabels = {
            support: "🎫 دعم فني",
            scam: "🚨 تشهير",
            order: "📦 طلبات",
            auction: "🏆 مزاد",
            roles: "🎭 رتب",
        };
        const stars = "".repeat(rating);

        try {
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            const ratingCh = guild?.channels?.cache?.get(ratingChId);
            if (ratingCh) {
                const color =
                    rating >= 4 ? 0x00ff88 : rating >= 3 ? 0xffcc00 : 0xff4444;
                await ratingCh
                    .send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(
                                    `${stars} تقييم جديد — ${typeLabels[type] || type}`,
                                )
                                .setDescription(
                                    ED.shopInteractions_037({
                                        interaction,
                                        rating,
                                        stars,
                                        type,
                                        typeLabels,
                                    }),
                                )
                                .setColor(_ec.color(guildId))
                                .setTimestamp(),
                        ],
                    })
                    .catch(() => {});
            }
        } catch (e) {
            console.log(`[tr_] ${e.message}`);
        }

        const disabledRow = new ActionRowBuilder().addComponents(
            ...[1, 2, 3, 4, 5].map((n) =>
                new ButtonBuilder()
                    .setCustomId(`tr_${n}_${guildId}_${type}_done`)
                    .setLabel("".repeat(n))
                    .setStyle(
                        n === rating
                            ? ButtonStyle.Primary
                            : ButtonStyle.Secondary,
                    )
                    .setDisabled(true)
                    .setEmoji(emojis.rate),
            ),
        );
        await interaction
            .update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> شكراً على تقييمك!")
                        .setDescription(ED.shopInteractions_038({ stars }))
                        .setTimestamp(),
                ],
                components: [disabledRow],
            })
            .catch(() => {});
    });
};
