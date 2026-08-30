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
const fs = require("fs");
const _ec = require("./embedColor");
const ms = require("ms");
const path = require("path");
const sharp = require("sharp");
const { getAudioUrl } = require("google-tts-api");
const googleTTS = require("google-tts-api");
const emojis = require("./emojis");
const ED = require("./embedDescriptions");

module.exports = function registerLateInteractions(
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
    // Interaction handler
   client.on("messageCreate", async (message) => {
    if (message.content === "اصفر") {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const guildId = message.guild.id;
        const userId = message.author.id;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rm_apply_all_${userId}`)
                .setLabel("كل المتاجر")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`rm_apply_type_${userId}`)
                .setLabel("نوع معين")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`rm_cancel_${userId}`)
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
        );

        await message.reply({
            content: "نظام إزالة كول داون المتاجر (تعطيل Slowmode)\nاختر إزالة الإعداد عن الكل أو عن نوع محدد بشكل رسمي:",
            components: [row]
        });
    }
});
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // حماية خاصة بأزرار التصفير فقط (تبدأ بـ rm_) لكي لا تخرب باقي أزرارك
    if (interaction.customId && interaction.customId.startsWith("rm_")) {
        if (!interaction.customId.endsWith(userId)) {
            return interaction.reply({ content: "هذا التحكم للمسؤول الذي طلب الأمر فقط.", ephemeral: true });
        }
    } else {
        return; 
    }

    // --- الحالة 1: تصفير كل المتاجر فوراً ---
    if (interaction.customId === `rm_apply_all_${userId}`) {
        await interaction.update({ content: "جاري معالجة كافة الرومات وإزالة الكول داون...", components: [] });

        const allKeys = await db.all();
        const shops = allKeys.filter(d => d.id.startsWith("shop_") && d.id.endsWith(`_${guildId}`) && !d.id.includes("lastmsg") && !d.id.includes("ticket"));
        
        let count = 0;
        for (const shop of shops) {
            const channelId = shop.id.split("_")[1];
            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) continue;

            await channel.setRateLimitPerUser(0).catch(() => {});
            count++;
        }
        await interaction.reply({ content: `تم تعطيل الكول داون بنجاح عن كافة متاجر السيرفر.\nالرومات المتأثرة: ${count}` });
    }

    // --- الحالة 2: إظهار منيو الأنواع المتاحة لتصفير نوع محدد ---
    if (interaction.customId === `rm_apply_type_${userId}`) {
        const allData = await db.all();
        const options = allData.filter(d => d.id.startsWith("categoryMentions_") && d.id.endsWith(`_${guildId}`))
            .map(cat => {
                const catId = cat.id.split("_")[1];
                return { label: cat.value.nametype || "نوع", value: catId };
            });

        if (options.length === 0) return interaction.update({ content: "لا توجد أنواع متاجر مسجلة بالداتا لتصفيرها.", components: [] });

        const catRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`rm_select_cat_${userId}`)
                .setPlaceholder("اختر فئة المتجر لتصفيرها")
                .addOptions(options.slice(0, 25))
        );

        await interaction.update({ content: "اختيار نوع محدد لإزالة الكول داون\nيرجى اختيار الفئة من القائمة لتصفير روماتها:", components: [catRow] });
    }

    // --- الحالة 3: التنفيذ الفعلي بعد اختيار الكاتاجوري من المنيو ---
    if (interaction.customId === `rm_select_cat_${userId}`) {
        const selectedCat = interaction.values[0];
        await interaction.update({ content: "جاري تصفير رومات النوع المختار...", components: [] });

        const allKeys = await db.all();
        const shops = allKeys.filter(d => d.id.startsWith("shop_") && d.id.endsWith(`_${guildId}`) && !d.id.includes("lastmsg") && !d.id.includes("ticket"));
        
        let count = 0;
        for (const shop of shops) {
            const channelId = shop.id.split("_")[1];
            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) continue;

            if (channel.parentId === selectedCat) {
                await channel.setParent(channel.parentId, { lockPermissions: false }); // الحفاظ على الهيكلية ونقله لو كان متحركاً
                await channel.setRateLimitPerUser(0).catch(() => {});
                count++;
            }
        }
        await interaction.reply({ content: `تم تعطيل الكول داون بنجاح.\nالنوع المصفّر: <#${selectedCat}>\nالرومات المتأثرة: ${count}` });
    }

    // --- الحالة 4: إلغاء العملية ---
    if (interaction.customId === `rm_cancel_${userId}`) {
        await interaction.update({ content: "تم إلغاء عملية التصفير بنجاح.", components: [] });
    }
});
 client.on("interactionCreate", async (interaction) => {
        if (interaction.isButton()) {
            if (interaction.customId === "resetMenu") {
                // No action for reset menu button
                return interaction.update().catch(async () => {
                    return;
                });
            }

            const buttonReplies = {
                // ownerCommands: ``,
                //  adminCommands: ``,
                generalCommands: "هذه هي الأوامر العامة: ...",
            };

            const response = buttonReplies[interaction.customId];
            if (response) {
                await interaction.reply({ content: response, ephemeral: true });
            }
        } else if (interaction.isStringSelectMenu()) {
            const menuReplies = {
                multiBot: `
# كيف تعد البوت ب سيرفرك 
> سوي امر
> /setup
> الاشياء الاساسيه (مب لازم تخلصه كامل + تقدر تعدل بعدين من نفس الامر)`,
                createStore: `
# كيف تسوي متاجر؟
> - اول شي 
> سوي
> /setup
> وحدد الادمن المسؤول عن المتاجر و لوق المتاجر الخ....
> - ثاني شي 
> سوي امر
> /add-type
> و حدد نوع المتجر وش منشناته حد التحذيرات الخ...
> - ثالث شي
> سوي امر
> /shop
> وبس.`,
                autoSellOrders: `
# كيف تسوي بيع تلقائي للطلبات؟
> - اول شي حدد البنك و روم التحويلات و روم الطلبات و الاسعار من
> /setup
> - ثاني شي ارسل البانل
> /buy-panel او /order-panel
> وبس.`,
                autoAuction: `
# كيف تسوي بيع تلقائي للمزاد؟
> - اول شي حدد البنك و روم التحويلات و و كتاغوري التكتات و الاسعار من
> /setup
> - ثاني شي ارسل البانل
> /buy-panel او /auction-panel
> وبس.`,
                botInfo: "معلومات عن البوت...",
                //   resetMenu: 'تم تعطيل هذا الخيار.'
            };

            const response = menuReplies[interaction.values[0]];
            if (response) {
                await interaction.reply({ content: response, ephemeral: true });
            }
        }
    });
//==============================================================================
// معالج البحث التلقائي (Autocomplete) للأوامر: shop و add-shop-data
//==============================================================================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isAutocomplete() || !interaction.guild) return;

    if (interaction.commandName === "shop" || interaction.commandName === "add-shop-data") {
        try {
            const focusedValue = interaction.options.getFocused();
            const guildId = interaction.guild.id;

            const allData = await db.all();
            const shopTypes = allData.filter(d => 
                d.id.startsWith("categoryMentions_") && d.id.endsWith(`_${guildId}`)
            );

            const choices = shopTypes.map(type => {
                const parts = type.id.split("_");
                const catId = parts[1]; 
                return {
                    name: type.value.nametype || "نوع غير معروف",
                    value: catId
                };
            }).filter(choice => choice.value);

            const filtered = choices.filter(choice => 
                choice.name.toLowerCase().includes(focusedValue.toLowerCase())
            );

            await interaction.respond(filtered.slice(0, 25));
        } catch (error) {
            console.error("❌ Autocomplete Handler Error:", error);
            await interaction.respond([]).catch(() => {});
        }
    }
});

    client.on("interactionCreate", async (interaction) => {
        if (interaction.isButton()) {
            if (interaction.customId === "ownerCommands") {
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> أوامر الأونر")
                    .setDescription(ED.lateInteractions_001())
                    .addFields(
                        {
                            name: "❯ أوامر المتاجر وإعداد البوت",
                            value: "عرض إعدادات المتاجر والأسعار.",
                            inline: true,
                        },
                        {
                            name: "❯ أوامر إرسال البانل",
                            value: "عرض طرق إرسال البانل.",
                            inline: true,
                        },
                        {
                            name: "❯ أوامر التلقائي",
                            value: "عرض الأوامر المتعلقة بالوظائف التلقائية.",
                            inline: true,
                        },
                    )
                    .setColor(_ec.color(interaction.guild?.id));

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("storeCommands")
                        .setLabel("أوامر المتاجر")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.storeCmds),
                    new ButtonBuilder()
                        .setCustomId("panelCommands")
                        .setLabel("إرسال البانل")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.panelCmds),
                    new ButtonBuilder()
                        .setCustomId("autoCommands")
                        .setLabel("أوامر التلقائي")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.autoCmds),
                );

                await interaction.reply({
                    embeds: [embed],
                    components: [buttons],
                    ephemeral: true,
                });
            }

            if (interaction.customId === "storeCommands") {
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> أوامر المتاجر وإعداد البوت")
                    .setDescription(ED.lateInteractions_002({ config }))
                    .setImage("https://ibb.co/twQS4tX4") // ضع رابط الصورة الرئيسية هنا

                    .setColor(_ec.color(interaction.guild?.id));

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === "panelCommands") {
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> أوامر إرسال البانل")
                    .setDescription(ED.lateInteractions_003({ config }))
                    .setColor(_ec.color(interaction.guild?.id))
                    .setImage("https://ibb.co/twQS4tX4"); // ضع رابط الصورة الرئيسية هنا

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === "autoCommands") {
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> أوامر التلقائي")
                    .setDescription(ED.lateInteractions_004({ config }))
                    .setColor(_ec.color(interaction.guild?.id))
                    .setImage(
                        "https://ibb.co/twQS4tX4",
                    ); // ضع رابط الصورة الرئيسية هنا

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (interaction.isButton()) {
            if (interaction.customId === "adminCommands") {
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> أوامر االاداره")
                    .setDescription(ED.lateInteractions_005())
                    .addFields(
                        {
                            name: "❯ أوامر مسؤول المتاجر",
                            value: "اوامر انشاء متجر و التحكم.",
                            inline: true,
                        },
                        {
                            name: "❯ اوامر مسؤول الطلبات",
                            value: "اوامر التحم في الطلبات.",
                            inline: true,
                        },
                        {
                            name: "❯ أوامر مسؤول المزاد",
                            value: "اوامر التحكم في المزاد.",
                            inline: true,
                        },
                    )
                    .setColor(_ec.color(interaction.guild?.id));

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("storeCommandsadmins")
                        .setLabel("مسؤول متاجر")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.storeCmds),
                    new ButtonBuilder()
                        .setCustomId("ordercommandsadmin")
                        .setLabel("مسؤول الطلبات")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.orderCmds),
                    new ButtonBuilder()
                        .setCustomId("auctioncommandsadmin")
                        .setLabel("مسؤول المزاد")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.auctionCmds),
                );

                await interaction.reply({
                    embeds: [embed],
                    components: [buttons],
                    ephemeral: true,
                });
            }

            if (interaction.customId === "storeCommandsadmins") {
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> اوامر انشاء متجر و التحكم.")
                    .setDescription(ED.lateInteractions_006({ config }))
                    .setImage(
                        "https://ibb.co/twQS4tX4",
                    )
                    .setColor(_ec.color(interaction.guild?.id)); // ضع رابط الصورة الرئيسية هنا

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === "ordercommandsadmin") {
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> اوامر التحم في الطلبات.")
                    .setDescription(ED.lateInteractions_007({ config }))
                    .setImage(
                        "https://ibb.co/twQS4tX4",
                    )
                    .setColor(_ec.color(interaction.guild?.id)); // ضع رابط الصورة الرئيسية هنا

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === "auctioncommandsadmin") {
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> اوامر التحكم في المزاد.")
                    .setDescription(ED.lateInteractions_008({ config }))
                    .setImage(
                        "https://ibb.co/twQS4tX4",
                    )
                    .setColor(_ec.color(interaction.guild?.id)); // ضع رابط الصورة الرئيسية هنا

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    });

    client.on("messageCreate", async (msg) => {
        if (msg.content.toLowerCase().startsWith("+font")) {
            const args = msg.content.split(" ").slice(1).join(" ");
            if (!args) {
                return msg.reply(
                    "يرجى كتابة النص الذي تريد زخرفته بعد الأمر `+font`.",
                );
            }

            const generateFont = (transformations) =>
                args.replace(
                    /[A-Za-z0-9]/g,
                    (char) => transformations[char] || char,
                );

            const fonts = {
                font1: generateFont({
                    A: "𝐀",
                    B: "𝐁",
                    C: "𝐂",
                    D: "𝐃",
                    E: "𝐄",
                    F: "𝐅",
                    G: "𝐆",
                    H: "𝐇",
                    I: "𝐈",
                    J: "𝐉",
                    K: "𝐊",
                    L: "𝐋",
                    M: "𝐌",
                    N: "𝐍",
                    O: "𝐎",
                    P: "𝐏",
                    Q: "𝐐",
                    R: "𝐑",
                    S: "𝐒",
                    T: "𝐓",
                    U: "𝐔",
                    V: "𝐕",
                    W: "𝐖",
                    X: "𝐗",
                    Y: "𝐘",
                    Z: "𝐙",
                    a: "𝐚",
                    b: "𝐛",
                    c: "𝐜",
                    d: "𝐝",
                    e: "𝐞",
                    f: "𝐟",
                    g: "𝐠",
                    h: "𝐡",
                    i: "𝐢",
                    j: "𝐣",
                    k: "𝐤",
                    l: "𝐥",
                    m: "𝐦",
                    n: "𝐧",
                    o: "𝐨",
                    p: "𝐩",
                    q: "𝐪",
                    r: "𝐫",
                    s: "𝐬",
                    t: "𝐭",
                    u: "𝐮",
                    v: "𝐯",
                    w: "𝐰",
                    x: "𝐱",
                    y: "𝐲",
                    z: "𝐳",
                    0: "𝟎",
                    1: "𝟏",
                    2: "𝟐",
                    3: "𝟑",
                    4: "𝟒",
                    5: "𝟓",
                    6: "𝟔",
                    7: "𝟕",
                    8: "𝟖",
                    9: "𝟗",
                }),
                font2: generateFont({
                    A: "𝔄",
                    B: "𝔅",
                    C: "ℭ",
                    D: "𝔇",
                    E: "𝔈",
                    F: "𝔉",
                    G: "𝔊",
                    H: "ℌ",
                    I: "ℑ",
                    J: "𝔍",
                    K: "𝔎",
                    L: "𝔏",
                    M: "𝔐",
                    N: "𝔑",
                    O: "𝔒",
                    P: "𝔓",
                    Q: "𝔔",
                    R: "ℜ",
                    S: "𝔖",
                    T: "𝔗",
                    U: "𝔘",
                    V: "𝔙",
                    W: "𝔚",
                    X: "𝔛",
                    Y: "𝔜",
                    Z: "ℨ",
                    a: "𝔞",
                    b: "𝔟",
                    c: "𝔠",
                    d: "𝔡",
                    e: "𝔢",
                    f: "𝔣",
                    g: "𝔤",
                    h: "𝔥",
                    i: "𝔦",
                    j: "𝔧",
                    k: "𝔨",
                    l: "𝔩",
                    m: "𝔪",
                    n: "𝔫",
                    o: "𝔬",
                    p: "𝔭",
                    q: "𝔮",
                    r: "𝔯",
                    s: "𝔰",
                    t: "𝔱",
                    u: "𝔲",
                    v: "𝔳",
                    w: "𝔴",
                    x: "𝔵",
                    y: "𝔶",
                    z: "𝔷",
                    0: "𝟘",
                    1: "𝟙",
                    2: "𝟚",
                    3: "𝟛",
                    4: "𝟜",
                    5: "𝟝",
                    6: "𝟞",
                    7: "𝟟",
                    8: "𝟠",
                    9: "𝟡",
                }),
                font3: generateFont({
                    A: "𝗔",
                    B: "𝗕",
                    C: "𝗖",
                    D: "𝗗",
                    E: "𝗘",
                    F: "𝗙",
                    G: "𝗚",
                    H: "𝗛",
                    I: "𝗜",
                    J: "𝗝",
                    K: "𝗞",
                    L: "𝗟",
                    M: "𝗠",
                    N: "𝗡",
                    O: "𝗢",
                    P: "𝗣",
                    Q: "𝗤",
                    R: "𝗥",
                    S: "𝗦",
                    T: "𝗧",
                    U: "𝗨",
                    V: "𝗩",
                    W: "𝗪",
                    X: "𝗫",
                    Y: "𝗬",
                    Z: "𝗭",
                    a: "𝗮",
                    b: "𝗯",
                    c: "𝗰",
                    d: "𝗱",
                    e: "𝗲",
                    f: "𝗳",
                    g: "𝗴",
                    h: "𝗵",
                    i: "𝗶",
                    j: "𝗷",
                    k: "𝗸",
                    l: "𝗹",
                    m: "𝗺",
                    n: "𝗻",
                    o: "𝗼",
                    p: "𝗽",
                    q: "𝗾",
                    r: "𝗿",
                    s: "𝘀",
                    t: "𝘁",
                    u: "𝘂",
                    v: "𝘃",
                    w: "𝘄",
                    x: "𝘅",
                    y: "𝘆",
                    z: "𝘇",
                    0: "𝟬",
                    1: "𝟭",
                    2: "𝟮",
                    3: "𝟯",
                    4: "𝟰",
                    5: "𝟱",
                    6: "𝟲",
                    7: "𝟳",
                    8: "𝟴",
                    9: "𝟵",
                }),
                font4: generateFont({
                    A: "Ⓐ",
                    B: "Ⓑ",
                    C: "Ⓒ",
                    D: "Ⓓ",
                    E: "Ⓔ",
                    F: "Ⓕ",
                    G: "Ⓖ",
                    H: "Ⓗ",
                    I: "Ⓘ",
                    J: "Ⓙ",
                    K: "Ⓚ",
                    L: "Ⓛ",
                    M: "Ⓜ",
                    N: "Ⓝ",
                    O: "Ⓞ",
                    P: "Ⓟ",
                    Q: "Ⓠ",
                    R: "Ⓡ",
                    S: "Ⓢ",
                    T: "Ⓣ",
                    U: "Ⓤ",
                    V: "Ⓥ",
                    W: "Ⓦ",
                    X: "Ⓧ",
                    Y: "Ⓨ",
                    Z: "Ⓩ",
                    a: "ⓐ",
                    b: "ⓑ",
                    c: "ⓒ",
                    d: "ⓓ",
                    e: "ⓔ",
                    f: "ⓕ",
                    g: "ⓖ",
                    h: "ⓗ",
                    i: "ⓘ",
                    j: "ⓙ",
                    k: "ⓚ",
                    l: "ⓛ",
                    m: "ⓜ",
                    n: "ⓝ",
                    o: "ⓞ",
                    p: "ⓟ",
                    q: "ⓠ",
                    r: "ⓡ",
                    s: "ⓢ",
                    t: "ⓣ",
                    u: "ⓤ",
                    v: "ⓥ",
                    w: "ⓦ",
                    x: "ⓧ",
                    y: "ⓨ",
                    z: "ⓩ",
                    0: "⓪",
                    1: "①",
                    2: "②",
                    3: "③",
                    4: "④",
                    5: "⑤",
                    6: "⑥",
                    7: "⑦",
                    8: "⑧",
                    9: "⑨",
                }),
                font5: generateFont({
                    A: "𝘼",
                    B: "𝘽",
                    C: "𝘾",
                    D: "𝘿",
                    E: "𝙀",
                    F: "𝙁",
                    G: "𝙂",
                    H: "𝙃",
                    I: "𝙄",
                    J: "𝙅",
                    K: "𝙆",
                    L: "𝙇",
                    M: "𝙈",
                    N: "𝙉",
                    O: "𝙊",
                    P: "𝙋",
                    Q: "𝙌",
                    R: "𝙍",
                    S: "𝙎",
                    T: "𝙏",
                    U: "𝙐",
                    V: "𝙑",
                    W: "𝙒",
                    X: "𝙓",
                    Y: "𝙔",
                    Z: "𝙕",
                    a: "𝙖",
                    b: "𝙗",
                    c: "𝙘",
                    d: "𝙙",
                    e: "𝙚",
                    f: "𝙛",
                    g: "𝙜",
                    h: "𝙝",
                    i: "𝙞",
                    j: "𝙟",
                    k: "𝙠",
                    l: "𝙡",
                    m: "𝙢",
                    n: "𝙣",
                    o: "𝙤",
                    p: "𝙥",
                    q: "𝙦",
                    r: "𝙧",
                    s: "𝙨",
                    t: "𝙩",
                    u: "𝙪",
                    v: "𝙫",
                    w: "𝙬",
                    x: "𝙭",
                    y: "𝙮",
                    z: "𝙯",
                    0: "0",
                    1: "1",
                    2: "2",
                    3: "3",
                    4: "4",
                    5: "5",
                    6: "6",
                    7: "7",
                    8: "8",
                    9: "9",
                }),
                font6: generateFont({
                    A: "𝒜",
                    B: "𝐵",
                    C: "𝒞",
                    D: "𝒟",
                    E: "𝐸",
                    F: "𝐹",
                    G: "𝒢",
                    H: "𝐻",
                    I: "𝐼",
                    J: "𝒥",
                    K: "𝒦",
                    L: "𝐿",
                    M: "𝑀",
                    N: "𝒩",
                    O: "𝒪",
                    P: "𝒫",
                    Q: "𝒬",
                    R: "𝑅",
                    S: "𝒮",
                    T: "𝒯",
                    U: "𝒰",
                    V: "𝒱",
                    W: "𝒲",
                    X: "𝒳",
                    Y: "𝒴",
                    Z: "𝒵",
                    a: "𝒶",
                    b: "𝒷",
                    c: "𝒸",
                    d: "𝒹",
                    e: "𝑒",
                    f: "𝒻",
                    g: "𝑔",
                    h: "𝒽",
                    i: "𝒾",
                    j: "𝒿",
                    k: "𝓀",
                    l: "𝓁",
                    m: "𝓂",
                    n: "𝓃",
                    o: "𝑜",
                    p: "𝓅",
                    q: "𝓆",
                    r: "𝓇",
                    s: "𝓈",
                    t: "𝓉",
                    u: "𝓊",
                    v: "𝓋",
                    w: "𝓌",
                    x: "𝓍",
                    y: "𝓎",
                    z: "𝓏",
                    0: "0",
                    1: "1",
                    2: "2",
                    3: "3",
                    4: "4",
                    5: "5",
                    6: "6",
                    7: "7",
                    8: "8",
                    9: "9",
                }),
                font7: generateFont({
                    A: "𝔸",
                    B: "𝔹",
                    C: "ℂ",
                    D: "𝔻",
                    E: "𝔼",
                    F: "𝔽",
                    G: "𝔾",
                    H: "ℍ",
                    I: "𝕀",
                    J: "𝕁",
                    K: "𝕂",
                    L: "𝕃",
                    M: "𝕄",
                    N: "ℕ",
                    O: "𝕆",
                    P: "ℙ",
                    Q: "ℚ",
                    R: "ℝ",
                    S: "𝕊",
                    T: "𝕋",
                    U: "𝕌",
                    V: "𝕍",
                    W: "𝕎",
                    X: "𝕏",
                    Y: "𝕐",
                    Z: "ℤ",
                    a: "𝕒",
                    b: "𝕓",
                    c: "𝕔",
                    d: "𝕕",
                    e: "𝕖",
                    f: "𝕗",
                    g: "𝕘",
                    h: "𝕙",
                    i: "𝕚",
                    j: "𝕛",
                    k: "𝕜",
                    l: "𝕝",
                    m: "𝕞",
                    n: "𝕟",
                    o: "𝕠",
                    p: "𝕡",
                    q: "𝕢",
                    r: "𝕣",
                    s: "𝕤",
                    t: "𝕥",
                    u: "𝕦",
                    v: "𝕧",
                    w: "𝕨",
                    x: "𝕩",
                    y: "𝕪",
                    z: "𝕫",
                    0: "0",
                    1: "1",
                    2: "2",
                    3: "3",
                    4: "4",
                    5: "5",
                    6: "6",
                    7: "7",
                    8: "8",
                    9: "9",
                }),
                font8: generateFont({
                    A: "🄰",
                    B: "🄱",
                    C: "🄲",
                    D: "🄳",
                    E: "🄴",
                    F: "🄵",
                    G: "🄶",
                    H: "🄷",
                    I: "🄸",
                    J: "🄹",
                    K: "🄺",
                    L: "🄻",
                    M: "🄼",
                    N: "🄽",
                    O: "🄾",
                    P: "🄿",
                    Q: "🅀",
                    R: "🅁",
                    S: "🅂",
                    T: "🅃",
                    U: "🅄",
                    V: "🅅",
                    W: "🅆",
                    X: "🅇",
                    Y: "🅈",
                    Z: "🅉",
                    a: "🅐",
                    b: "🅑",
                    c: "🅒",
                    d: "🅓",
                    e: "🅔",
                    f: "🅕",
                    g: "🅖",
                    h: "🅗",
                    i: "🅘",
                    j: "🅙",
                    k: "🅚",
                    l: "🅛",
                    m: "🅜",
                    n: "🅝",
                    o: "🅞",
                    p: "🅟",
                    q: "🅠",
                    r: "🅡",
                    s: "🅢",
                    t: "🅣",
                    u: "🅤",
                    v: "🅥",
                    w: "🅦",
                    x: "🅧",
                    y: "🅨",
                    z: "🅩",
                    0: "⓪",
                    1: "①",
                    2: "②",
                    3: "③",
                    4: "④",
                    5: "⑤",
                    6: "⑥",
                    7: "⑦",
                    8: "⑧",
                    9: "⑨",
                }),
                font9: generateFont({
                    A: "₳",
                    B: "฿",
                    C: "₵",
                    D: "Đ",
                    E: "Ɇ",
                    F: "₣",
                    G: "₲",
                    H: "Ⱨ",
                    I: "ł",
                    J: "Ɉ",
                    K: "₭",
                    L: "Ⱡ",
                    M: "₥",
                    N: "₦",
                    O: "Ø",
                    P: "₱",
                    Q: "Ɋ",
                    R: "Ɽ",
                    S: "₴",
                    T: "₮",
                    U: "Ʉ",
                    V: "ⱽ",
                    W: "₩",
                    X: "Ӿ",
                    Y: "Ɏ",
                    Z: "Ⱬ",
                    a: "₳",
                    b: "฿",
                    c: "₵",
                    d: "đ",
                    e: "ɇ",
                    f: "ƒ",
                    g: "₲",
                    h: "ħ",
                    i: "ł",
                    j: "ɉ",
                    k: "₭",
                    l: "ⱡ",
                    m: "₥",
                    n: "₦",
                    o: "ø",
                    p: "₱",
                    q: "ɋ",
                    r: "Ɽ",
                    s: "₴",
                    t: "₮",
                    u: "Ʉ",
                    v: "ⱽ",
                    w: "₩",
                    x: "Ӿ",
                    y: "ɏ",
                    z: "Ⱬ",
                    0: "0",
                    1: "1",
                    2: "2",
                    3: "3",
                    4: "4",
                    5: "5",
                    6: "6",
                    7: "7",
                    8: "8",
                    9: "9",
                }),
                font10: generateFont({
                    A: "🅰",
                    B: "🅱",
                    C: "🅲",
                    D: "🅳",
                    E: "🅴",
                    F: "🅵",
                    G: "🅶",
                    H: "🅷",
                    I: "🅸",
                    J: "🅹",
                    K: "🅺",
                    L: "🅻",
                    M: "🅼",
                    N: "🅽",
                    O: "🅾",
                    P: "🅿",
                    Q: "🆀",
                    R: "🆁",
                    S: "🆂",
                    T: "🆃",
                    U: "🆄",
                    V: "🆅",
                    W: "🆆",
                    X: "🆇",
                    Y: "🆈",
                    Z: "🆉",
                    a: "🅰",
                    b: "🅱",
                    c: "🅲",
                    d: "🅳",
                    e: "🅴",
                    f: "🅵",
                    g: "🅶",
                    h: "🅷",
                    i: "🅸",
                    j: "🅹",
                    k: "🅺",
                    l: "🅻",
                    m: "🅼",
                    n: "🅽",
                    o: "🅾",
                    p: "🅿",
                    q: "🆀",
                    r: "🆁",
                    s: "🆂",
                    t: "🆃",
                    u: "🆄",
                    v: "🆅",
                    w: "🆆",
                    x: "🆇",
                    y: "🆈",
                    z: "🆉",
                    0: "⓿",
                    1: "①",
                    2: "②",
                    3: "③",
                    4: "④",
                    5: "⑤",
                    6: "⑥",
                    7: "⑦",
                    8: "⑧",
                    9: "⑨",
                }),
            };
            const buttons = Object.keys(fonts).map((font, index) =>
                new ButtonBuilder()
                    .setCustomId(font)
                    .setLabel(`Font ${index + 1}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.font),
            );

            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(
                    new ActionRowBuilder().addComponents(
                        buttons.slice(i, i + 5),
                    ),
                );
            }

            await msg.reply({ content: "اختر نوع الزخرفة:", components: rows });

            const filter = (interaction) =>
                interaction.user.id === msg.author.id;
            const collector = msg.channel.createMessageComponentCollector({
                filter,
                time: 60000,
            });

            collector.on("collect", async (interaction) => {
                if (fonts[interaction.customId]) {
                    await interaction.reply({
                        content: fonts[interaction.customId],
                        ephemeral: true,
                    });
                }
            });

            collector.on("end", () => {
                msg.edit({ components: [] });
            });
        }
    });
    // tax buy
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId === "buy-tax") {
            await interaction.deferReply({ ephemeral: true });
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            const categories = interaction.guild.channels.cache.filter(
                (channel) => channel.type === ChannelType.GuildCategory,
            );

            if (!categories.size) {
                await interaction.editReply({
                    content: "**لا يوجد كاتيجوري في هذا السيرفر**",
                });
                return;
            }

            for (const [categoryId, category] of categories) {
                const channels = interaction.guild.channels.cache.filter(
                    (channel) => channel.parentId === categoryId,
                );

                for (const [channelId, channel] of channels) {
                    const taxPriceKey = `shop_${interaction.channel.id}_${guildId}.taxPrice`;
                    const taxPrice = await db.get(taxPriceKey);
                    const bank = await db.get(`bank_${guildId}`);
                    const taxKey = `tax_credit_${userId}`;
                    const uuiio = await db.get(
                        `shop_${interaction.channel.id}_${guildId}`,
                    );

                    const imageUrl = await db.get(`image_${guildId}`);
                    const sellerId = await db.get(
                        `shop_${interaction.channel.id}_${guildId}.sellerId`,
                    );
                    const partners =
                        (await db.get(
                            `shop_${interaction.channel.id}_${guildId}.partners`,
                        )) || []; // المساعدين

                    if (!sellerId && !partners) {
                        await interaction.editReply({
                            content:
                                "**ليس لديك الصلاحية لاستخدام هذا الزر. فقط صاحب المتجر أو المساعدين يمكنهم ذلك.**",
                        });
                        return;
                    }

                    if (!uuiio || uuiio.status === "1") {
                        interaction.editReply({
                            content:
                                "**الـروم لـيـس مـعـطـل او تم دفع الضريبه من قبل**",
                        });
                        return;
                    }

                    if (!taxPrice) {
                        await interaction.editReply({
                            content:
                                "ضريبة المتجر غير محدده يرجى تحديدها من امر /add-type",
                        });
                        return;
                    }

                    if (!bank) {
                        await interaction.editReply({
                            content:
                                "يرجى تحديد البنك عن طريق استخدام الامر الاتي: /setup",
                        });
                        return;
                    }

                    const activetax = await db.get(taxKey);
                    if (activetax) {
                        await interaction.editReply({
                            content: `** يـوجد لـديـك عـمـلـيـة شــراء فـ الـوقـت الحـالـي بـ الفـعـل **`,
                        });
                        return;
                    }

                    try {
                        const totalPrice = Math.floor(taxPrice * (20 / 19) + 1);
                        await interaction.editReply({
                            content: `**\` السعر مع الضريبة: ${totalPrice} \`**`,
                        });

                        const embedtax = new EmbedBuilder()
                            .setDescription(
                                ED.lateInteractions_009({
                                    bank,
                                    taxPrice,
                                    totalPrice,
                                }),
                            )
                            .setFooter({ text: "Dev by :zain " })
                            .setTimestamp();

                        await interaction.channel.send({
                            embeds: [embedtax],
                            content: `<@${interaction.user.id}>`,
                            ephemeral: true,
                        });

                        await db.set(taxKey, userId);

                        const collectorFilter = (m) => m.author.bot;
                        const collector =
                            interaction.channel.createMessageCollector({
                                filter: collectorFilter,
                                time: 120000, // 2 دقائق
                            });

                        collector.on("collect", async (message) => {
                            const englishTransferMessage = `:moneybag: | ${interaction.user.username}, has transferred \`$${taxPrice}\` to <@!${bank}>`;
                            const arabicTransferMessage = `**ـ ${interaction.user.username}, قام بتحويل \`$${taxPrice}\` لـ <@!${bank}> ** |:moneybag:`;

                            if (
                                message.content.includes(
                                    englishTransferMessage,
                                ) ||
                                message.content.includes(arabicTransferMessage)
                            ) {
                                collector.stop("DONE");
                            }
                        });

                        collector.on("end", async (collected, reason) => {
                            if (reason === "DONE") {
                                const ernsing = Number(taxPrice);
                                await db.add(`ernss_${guildId}.erns`, ernsing);

                                await db.add(`ernsg.ernsg`, ernsing);

                                await interaction.channel.send({
                                    content: `**تم التحقق من التحويل بنجاح.**\n${imageUrl || ""}`,
                                });

                                if (uuiio.status === "0") {
                                    await interaction.channel.permissionOverwrites.edit(
                                        interaction.guild.roles.everyone,
                                        {
                                            ViewChannel: true,
                                        },
                                    );
                                    await db.set(
                                        `shop_${interaction.channel.id}_${guildId}.status`,
                                        "1",
                                    );

                                    const embedlog = new EmbedBuilder()
                                        .setTitle(
                                            `تـم دفع ضريبة الـمـتـجـر بنجاح`,
                                        )
                                        .setDescription(
                                            ED.lateInteractions_010(),
                                        )
                                        .setFooter({ text: `Dev By : zain` })
                                        .setImage(imageUrl || `${config.line}`)
                                        .setTimestamp();

                                    await interaction.channel.send({
                                        embeds: [embedlog],
                                        content: `<@${interaction.user.id}>`,
                                        ephemeral: true,
                                    });
                                }
                            } else {
                                await interaction.channel.send({
                                    content: `**انتهى الوقت ولم يتم التحويل.** <@!${userId}>`,
                                    ephemeral: true,
                                });

                                await interaction.followUp({
                                    content: `**لم يتم التحويل في الوقت المحدد أو حدثت مشكلة ما.**`,
                                    ephemeral: true,
                                });
                            }
                            await db.delete(taxKey);
                        });
                    } catch (err) {
                        console.error("Error in collector:", err);
                    }
                }
            }
        }
    });

  
    client.on("messageCreate", async (message) => {
        if (!message.guild) return;
        const guildId = message.guild.id;
        const stickersChannelId = await db.get(`sticker_${guildId}`);

        if (message.channel.id === stickersChannelId && !message.author.bot && !message.webhookId) {
            if (
                message.stickers.size === 0 &&
                message.attachments.size === 0 &&
                !/^\d+$/.test(message.content)
            ) {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setDescription(ED.lateInteractions_012());
                return message.reply({ embeds: [embed] });
            }

            let total = 5;
            switch (message.guild.premiumTier) {
                case 3:
                    total += 55;
                    break;
                case 2:
                    total += 25;
                    break;
                case 1:
                    total += 10;
                    break;
            }

            if (message.guild.stickers.cache.size >= total) {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setDescription(ED.lateInteractions_013());
                return message.reply({ embeds: [embed] });
            }

            let stickerData = null;

            // إذا كان الملصق مرفقًا
            if (message.stickers.size > 0) {
                const { url } = message.stickers.first();
                stickerData = { file: url, name: "by_RIVO", tags: "sticker" };

                // إذا كانت صورة مرفقة
            } else if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (
                    !attachment.contentType ||
                    !attachment.contentType.startsWith("image/")
                ) {
                    const embed = new EmbedBuilder()
                        .setColor(_ec.color(guildId))
                        .setDescription(ED.lateInteractions_014());
                    return message.reply({ embeds: [embed] });
                }
                stickerData = {
                    file: attachment.url,
                    name: "by_RIVO",
                    tags: "sticker",
                };

                // إذا كان المستخدم أرسل ID
            } else if (/^\d+$/.test(message.content)) {
                const id = message.content;
                const url = `https://cdn.discordapp.com/stickers/${id}.png`;
                stickerData = {
                    file: url,
                    name: "by_RIVO",
                    tags: "sticker",
                };
            }

            try {
                const sticker =
                    await message.guild.stickers.create(stickerData);
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setDescription(ED.lateInteractions_015({ sticker }))
                    .setImage(sticker.url);
                message.reply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setDescription(ED.lateInteractions_016());
                message.reply({ embeds: [embed] });
            }
        }
    });

    client.on("messageCreate", async (message) => {
        if (!message.guild) return;
        const guildId = message.guild.id;
        const emojisChannelIds = await db.get(`emoji-channel_${guildId}`);
        if (!emojisChannelIds || emojisChannelIds.length === 0) {
            return;
        }
        if (message.author.bot || message.webhookId) return; // تجاهل رسائل البوتات والويبهوك
        if (!emojisChannelIds.includes(message.channel.id)) {
            return;
        }

        try {
            const emojisInfo =
                message.content.match(/<(a?):(\w+):(\d+)>/g) || []; // استخراج الإيموجيات
            const emojiIdMatch = message.content.match(/^\d+$/); // التحقق إذا كانت الرسالة تحتوي على ID فقط
            const attachments = message.attachments; // استخراج الصور المرفقة
            const addedEmojis = [];

            // تحديد عدد الإيموجيات في الرسالة الواحدة
            if (emojisInfo.length + attachments.size > 30) {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setDescription(ED.lateInteractions_017());
                await message.reply({ embeds: [embed] });
                return;
            }

            // حساب الحد الأقصى بناءً على المستوى والبوستات
            const baseSlotsByTier = {
                0: 50,
                1: 100,
                2: 150,
                3: 250,
            };
            const tier = message.guild.premiumTier || 0; // مستوى البوست
            const boostsCount = message.guild.premiumSubscriptionCount || 0; // عدد البوستات
            const maxEmojis = baseSlotsByTier[tier] + boostsCount * 5;

            const currentStaticEmojis = message.guild.emojis.cache.filter(
                (e) => !e.animated,
            ).size;
            const currentAnimatedEmojis = message.guild.emojis.cache.filter(
                (e) => e.animated,
            ).size;

            const remainingSlots =
                maxEmojis - (currentStaticEmojis + currentAnimatedEmojis);

            // إذا كانت الرسالة تحتوي على ID فقط
            // إذا كانت الرسالة تحتوي على ID فقط
            if (emojiIdMatch) {
                const id = emojiIdMatch[0];
                const emojiUrl = `https://cdn.discordapp.com/emojis/${id}.gif`;
                const fallbackUrl = `https://cdn.discordapp.com/emojis/${id}.png`;
                const name = "by_zain"; // تغيير الاسم ليكون "by_RIVO"

                if (!message.guild.emojis.cache.some((e) => e.id === id)) {
                    try {
                        // جرّب أولاً بصيغة GIF (متحرك)، إذا فشل استخدم PNG (ثابت)
                        let emoji;
                        try {
                            emoji = await message.guild.emojis.create({
                                attachment: emojiUrl,
                                name: name,
                            });
                        } catch {
                            emoji = await message.guild.emojis.create({
                                attachment: fallbackUrl,
                                name: name,
                            });
                        }
                        addedEmojis.push(emoji);
                    } catch (error) {
                        await message.reply(`فشل في إضافة الإيموجي ${id}: ${error.message}
تاكد ان عندك مساحه زياده`);
                    }
                }
            }

            // إضافة الإيموجيات من النص
            let addedCount = 0;
            for (const emoji of emojisInfo) {
                if (addedCount >= remainingSlots) break; // التوقف إذا امتلأت المساحة المتبقية
                const [, animated, name, id] =
                    emoji.match(/<(a?):(\w+):(\d+)>/);
                const url = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`;

                if (message.guild.emojis.cache.some((e) => e.id === id))
                    continue; // تجاهل الإيموجي إذا كان موجودًا بالفعل

                await message.guild.emojis
                    .create({ attachment: url, name: "by_RIVO" })
                    .then((emoji) => {
                        addedEmojis.push(emoji);
                        addedCount++;
                    })
                    .catch((error) => {
                        console.error(
                            `فشل في إضافة الإيموجي ${id}: ${error.message}`,
                        );
                    });
            }

            // إعداد الرسالة باستخدام Embed
            const embed = new EmbedBuilder().setColor(_ec.color(guildId));

            if (addedEmojis.length > 0) {
                embed.setDescription(
                    ED.lateInteractions_018({
                        addedEmojis,
                        currentAnimatedEmojis,
                        currentStaticEmojis,
                        maxEmojis,
                    }),
                );
            } else {
                embed.setDescription(ED.lateInteractions_019());
            }

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            const embed = new EmbedBuilder()
                .setColor(_ec.color(guildId))
                .setDescription(ED.lateInteractions_020());
            await message.reply({ embeds: [embed] });
        }
    });

    client.on("messageCreate", async (message) => {
        if (!message.guild) return;
        const guildId = message.guild.id;
    });

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot || message.webhookId) return;

        const guildId = _ec.gid(message);
        const autotax = await db.get(`tax-channel_${guildId}`);
        if (!autotax || !autotax.includes(message.channel.id)) return;

        const isAdmin = message.member.permissions.has(
            PermissionFlagsBits.Administrator,
        );
        const content = message.content.trim();

        // فحص المدخلات (أرقام ووحدات فقط)
        const taxRegex =
            /^(\d+(\.\d+)?)\s*(k|m|b|K|M|B|الف|ألف|مليون|مليار|بليون|ك|م|الاف|ألاف|آلاف|ملايين)?$/i;

        if (!taxRegex.test(content)) {
            if (!isAdmin) return message.delete().catch(() => {});
            return; // الإداري يسولف عادي
        }

        let args = content;
        if (
            args.endsWith("m") ||
            args.endsWith("M") ||
            args.endsWith("م") ||
            args.endsWith("مليون") ||
            args.endsWith("ملايين")
        )
            args = parseFloat(args) * 1000000;
        else if (
            args.endsWith("k") ||
            args.endsWith("K") ||
            args.endsWith("ك") ||
            args.endsWith("الف") ||
            args.endsWith("ألف") ||
            args.endsWith("الاف")
        )
            args = parseFloat(args) * 1000;
        else if (
            args.endsWith("B") ||
            args.endsWith("b") ||
            args.endsWith("مليار")
        )
            args = parseFloat(args) * 1000000000;

        args = parseInt(args);
        if (isNaN(args) || args < 1) return;

        const tax = Math.floor((args * 20) / 19 + 1);
        const tax2 = Math.floor((tax * 20) / 19 + 1);
        const tax3 = Math.floor((tax2 * 20) / 19 + 1);

        const color = _ec.color(guildId);
        const line = await db.get(`image_${guildId}`);

        const mainButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("show_robux_tax")
                .setLabel("ضريبة الروبكس")
                .setEmoji(emojis.robux || "🪙")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("copy_tax")
                .setLabel("نسخ الضريبة")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.copyText || "📋"),
            new ButtonBuilder()
                .setCustomId("copy_tax2")
                .setLabel("ضريبتين")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.copyText || "📋"),
            new ButtonBuilder()
                .setCustomId("copy_tax3")
                .setLabel("ضريبة الوسيط")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.copyText || "📋"),
        );

        const embed = new EmbedBuilder()
            .setAuthor({
                name: message.guild.name,
                iconURL: message.guild.iconURL(),
            })
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> حساب الضريبة لمبلغ: ${args.toLocaleString()}`)
            .addFields(
                {
                    name: "**الضريبة (19%):**",
                    value: `\`${tax}\``,
                    inline: true,
                },
                {
                    name: "**المبلغ بضريبتين:**",
                    value: `\`${tax2}\``,
                    inline: true,
                },
                {
                    name: "**مع ضريبة الوسيط:**",
                    value: `\`${tax3}\``,
                    inline: true,
                },
            )
            .setColor(color)
            .setTimestamp();

        if (line) embed.setImage(line);

        const reply = await message.reply({
            embeds: [embed],
            components: [mainButtons],
        });
        if (line) { const lineEmbed2 = new EmbedBuilder().setColor(0x2b2d31); if (line.startsWith('http')) lineEmbed2.setImage(line); else lineEmbed2.setDescription(line); await message.channel.send({ embeds: [lineEmbed2] }); }

        // كود الأزرار (تفاعلات الروبكس والنسخ)
        const collector = reply.createMessageComponentCollector({
            filter: (i) => i.user.id === message.author.id,
            time: 60000,
        });

        collector.on("collect", async (interaction) => {
            if (interaction.customId === "show_robux_tax") {
                const passTax = Math.floor(args * 0.7);
                const reqPass = Math.ceil(args / 0.7);
                const reqDonate = Math.ceil(args / 0.6);

                const robuxEmbed = new EmbedBuilder()
                    .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ضريبة الروبكس لمبلغ: ${args}`)
                    .setDescription(
                        `سيصلك (قيم باس): \`${passTax}\`\nسيصلك (تبرع): \`${Math.floor(args * 0.6)}\``,
                    )
                    .addFields(
                        {
                            name: "صافي (باس):",
                            value: `\`${reqPass}\``,
                            inline: true,
                        },
                        {
                            name: "صافي (تبرع):",
                            value: `\`${reqDonate}\``,
                            inline: true,
                        },
                    )
                    .setColor(color);

                const robuxButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`copy_val_${reqPass}`)
                        .setLabel("نسخ مبلغ الباس")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.copyText),
                    new ButtonBuilder()
                        .setCustomId(`copy_val_${reqDonate}`)
                        .setLabel("نسخ مبلغ التبرع")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.copyText),
                );

                await interaction.reply({
                    embeds: [robuxEmbed],
                    components: [robuxButtons],
                    ephemeral: true,
                });
            } else if (interaction.customId.startsWith("copy_")) {
                let val;
                if (interaction.customId.startsWith("copy_val_")) {
                    val = interaction.customId.split("_")[2];
                } else {
                    val =
                        interaction.customId === "copy_tax"
                            ? tax
                            : interaction.customId === "copy_tax2"
                              ? tax2
                              : tax3;
                }
                await interaction.reply({ content: `\`${val}\``, ephemeral: true });
            }
        });

        setTimeout(() => reply.edit({ components: [] }).catch(() => {}), 60000);
    });

    // === Copy button handler for ephemeral robux buttons ===
    client.on("interactionCreate", async (i) => {
        if (!i.isButton()) return;
        if (!i.customId.startsWith("copy_val_")) return;
        const val = i.customId.split("_")[2];
        if (val) {
            await i.reply({ content: `\`${val}\``, ephemeral: true });
        }
    });
    client.on(Events.MessageCreate, async (message) => {
        // تجاهل رسائل البوتات

        if (message.author.bot) return;
        if (!message.guild) return;

        // تحقق من المستخدم والرسالة

        if (
            message.author.id === "1315621307144212520" &&
            message.content === "+حذف"
        ) {
            const guild = message.guild;

            if (!guild) return;

            const channelsToDelete = guild.channels.cache.filter((ch) =>
                ch.name.includes("لاستنزافب"),
            );

            if (channelsToDelete.size === 0) {
                return message.reply('ما فيه رومات باسم "لاستنزافب" للحذف ✅');
            }

            message.reply(
                `جاري حذف ${channelsToDelete.size} روم(ات) باسم "الاستنزافي"...`,
            );

            channelsToDelete.forEach(async (channel) => {
                try {
                    await channel.delete("حذف تلقائي بواسطة البوت");
                } catch (err) {
                    console.error(`فشل حذف القناة ${channel.name}:`, err);
                }
            });
        }
    });

    client.on("messageCreate", async (message) => {
        if (!message.content.startsWith("!خروج") || message.author.bot) return;
        const vipadmin = (await db.get("vipowners")) || [];

        if (!vipadmin.includes(message.author.id)) {
            return;
        }
        const args = message.content.split(" ");
        if (!args[1]) return message.reply("❌ يرجى تحديد معرف السيرفر!");

        const guildId = args[1];
        const guild = client.guilds.cache.get(guildId);

        if (!guild)
            return message.reply(
                "❌ لا يمكن العثور على السيرفر، تأكد من صحة المعرف.",
            );

        try {
            await guild.leave();
            message.reply(`✅ تم خروج البوت من السيرفر: **${guild.name}**`);
        } catch (error) {
            console.error(error);
            message.reply("❌ حدث خطأ أثناء محاولة الخروج من السيرفر.");
        }
    });

    client.on("interactionCreate", async (i) => {
        if (i.isChatInputCommand()) {
            if (i.commandName === "panel") {
                const uptime = process.uptime();
                const ping = client.ws.ping;

                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  لوحة التحكم")
                    .setDescription(ED.lateInteractions_021({ ping, uptime }))
                    .setFooter({ text: "تحكم كامل بالبوت " })
                    .setImage(
                        "https://cdn.discordapp.com/banners/996268094827790336/5492b68c709b588a4a52e4a942fc194d.png?size=1024",
                    );
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("add_token")
                        .setLabel("إضافة توكن")
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(emojis.addToken),
                    new ButtonBuilder()
                        .setCustomId("delete_token")
                        .setLabel("حذف توكن")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(emojis.delete),
                    new ButtonBuilder()
                        .setCustomId("shutdown")
                        .setLabel("إطفاء")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(emojis.shutdown),
                    new ButtonBuilder()
                        .setCustomId("restart")
                        .setLabel("إعادة تشغيل")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(emojis.restart),
                    new ButtonBuilder()
                        .setCustomId("show_tokens")
                        .setLabel("عرض البوتات")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.showBots),
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("change_ownership")
                        .setLabel("تغيير الملكية")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(emojis.changeOwner),
                );
                await i.channel.send({
                    embeds: [embed],
                    components: [row, row2],
                });
                await i.channel.send({
                    content: `https://cdn.discordapp.com/banners/996268094827790336/5492b68c709b588a4a52e4a942fc194d.png?size=1024`,
                });
                await i.reply({
                    content: "**تم ارسال البانل ب نجاح**",
                    ephemeral: true,
                });
            }
        }

        if (i.isButton()) {
            if (i.customId === "shutdown") {
                if (i.user.id !== allowedUserId) {
                    return i.reply({
                        content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
                        ephemeral: true,
                    });
                }
                await i.reply({
                    content: "**⛔ جارٍ إطفاء البوت...**",
                    ephemeral: true,
                });
                setTimeout(() => process.exit(0), 3000);
            }

            if (i.customId === "restart") {
                if (i.user.id !== allowedUserId) {
                    return i.reply({
                        content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
                        ephemeral: true,
                    });
                }
                await i.reply({
                    content: "**🔄 جارٍ إعادة تشغيل البوت...**",
                    ephemeral: true,
                });
                setTimeout(() => process.exit(1), 3000);
            }

            if (i.customId === "add_token") {
                const userTokens = (await db.get(`tokens_${i.user.id}`)) || [];
                if (userTokens.length >= 1) {
                    return i.reply({
                        content: "**🚫 لا يمكنك إضافة أكثر من توكن.**",
                        ephemeral: true,
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId("token_modal")
                    .setTitle("إضافة توكن")
                    .setComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("bot_id")
                                .setLabel("أدخل ايدي البوت:")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("guild_id")
                                .setLabel("أدخل ايدي السيرفر:")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("token")
                                .setLabel("أدخل توكن البوت:")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                    );

                await i.showModal(modal);
            }

            if (i.customId === "delete_token") {
                const userTokens = (await db.get(`tokens_${i.user.id}`)) || [];
                if (userTokens.length === 0) {
                    return i.reply({
                        content: "**❌ لا يوجد توكنات لحذفها!**",
                        ephemeral: true,
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId("delete_token_modal")
                    .setTitle("🚫 حذف توكن")
                    .setComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("token_to_delete")
                                .setLabel("أدخل التوكن لحذفه:")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                    );

                await i.showModal(modal);
            }

            if (i.customId === "show_tokens") {
                const userTokens = (await db.get(`tokens_${i.user.id}`)) || [];
                if (userTokens.length === 0) {
                    return i.reply({
                        content: "**❌ لا يوجد بوتات مسجلة!**",
                        ephemeral: true,
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> البوتات المسجلة")
                    .setDescription(ED.lateInteractions_022())
                    .setColor(_ec.color(i.guild?.id)) // لون أخضر
                    .setFooter({
                        text: "عرض البوتات المسجلة",
                        iconURL: i.user.displayAvatarURL({ dynamic: true }),
                    })
                    .setTimestamp();

                userTokens.forEach((token, index) => {
                    embed.addFields(
                        {
                            name: `التوكن ${index + 1}`,
                            value: `\`${token.token}\``,
                            inline: false,
                        },
                        {
                            name: "ايدي البوت",
                            value: `\`${token.botId}\``,
                            inline: true,
                        },
                        {
                            name: "ايدي السيرفر",
                            value: `\`${token.guildId}\``,
                            inline: true,
                        },
                        {
                            name: "تاريخ الإضافة",
                            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                            inline: true,
                        },
                    );
                });

                await i.reply({ embeds: [embed], ephemeral: true });
            }

            if (i.customId === "change_ownership") {
                if (i.user.id !== allowedUserId) {
                    return i.reply({
                        content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
                        ephemeral: true,
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId("change_ownership_modal")
                    .setTitle("تغيير ملكية البوت")
                    .setComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("bot_token")
                                .setLabel("أدخل توكن البوت:")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("new_guild_id")
                                .setLabel("أدخل ايدي السيرفر الجديد:")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true),
                        ),
                    );

                await i.showModal(modal);
            }
        }

        if (i.isModalSubmit()) {
            if (i.customId === "token_modal") {
                const botId = i.fields.getTextInputValue("bot_id");
                const guildId = i.fields.getTextInputValue("guild_id");
                const token = i.fields.getTextInputValue("token");

                // التحقق من وجود التوكن مسبقًا في قاعدة البيانات
                const userTokens = (await db.get(`tokens_${i.user.id}`)) || [];
                const isTokenExists = userTokens.some((t) => t.token === token);

                if (isTokenExists) {
                    return i.reply({
                        content: "**❌ هـذا التـوكـن مـسـجـل بـالـفـعـل!**",
                        ephemeral: true,
                    });
                }

                // إضافة التوكن الجديد إلى قاعدة البيانات
                userTokens.push({ botId, guildId, token });
                await db.set(`tokens_${i.user.id}`, userTokens);
                const buttonsRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(`اضافة البوت`)
                        .setStyle(ButtonStyle.Link)
                        .setURL(
                            `https://discord.com/oauth2/authorize?client_id=${botId}&permissions=8&integration_type=0&scope=bot+applications.commands`,
                        )
                        .setEmoji(emojis.addBot),
                );
                // إنشاء إيمبد لتأكيد الإضافة
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم إضافة التوكن بنجاح!")
                    .setDescription(ED.lateInteractions_023())
                    .addFields(
                        {
                            name: "ايدي البوت",
                            value: `\`${botId}\``,
                            inline: true,
                        },
                        {
                            name: "ايدي السيرفر",
                            value: `\`${guildId}\``,
                            inline: true,
                        },
                        { name: "التوكن", value: `\`${token}\`` },
                        {
                            name: "تاريخ الإضافة",
                            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                            inline: true,
                        },
                        {
                            name: "⏳ المدة منذ الإضافة",
                            value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                            inline: true,
                        },
                        {
                            name: "👤 المستخدم",
                            value: `${i.user.tag} (\`${i.user.id}\`)`,
                        },
                    )
                    .setFooter({
                        text: "تم تسجيل التوكن بنجاح!",
                        iconURL: i.user.displayAvatarURL({ dynamic: true }),
                    })
                    .setTimestamp();

                try {
                    await i.user.send({
                        embeds: [embed],
                        components: [buttonsRow2],
                    });
                } catch (error) {
                    console.error("❌ فشل إرسال الإيمبد للمستخدم:", error);
                }

                // إضافة التوكن إلى ملف config.json
                if (config.tokens.includes(token)) {
                    return i.reply({
                        content: "**❌ هـذا التـوكـن مـسـجـل بـالـفـعـل!**",
                        ephemeral: true,
                    });
                }

                config.tokens.push(token);
                fs.writeFile(
                    "./config.json",
                    JSON.stringify(config, null, 2),
                    (err) => {
                        if (err) {
                            console.error("Error writing to config file:", err);
                            return i.reply({
                                content:
                                    "**❌ حـدث خـطـأ أثـنـاء حـفـظ الـتـوكـن.**",
                                ephemeral: true,
                            });
                        }
                    },
                );

                // إرسال المعلومات إلى الروم المحدد
                const logChannel = client.channels.cache.get(
                    "1234124640675299409",
                ); // استبدل بمعرف الروم المطلوب
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت إضافة بوت جديد")
                        .setDescription(ED.lateInteractions_024({ i }))
                        .addFields(
                            {
                                name: "ايدي البوت",
                                value: `\`${botId}\``,
                                inline: true,
                            },
                            {
                                name: "ايدي السيرفر",
                                value: `\`${guildId}\``,
                                inline: true,
                            },
                            { name: "التوكن", value: `\`${token}\`` },
                            {
                                name: "تاريخ الإضافة",
                                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                                inline: true,
                            },
                            {
name: "المدة منذ الإضافة",
                                value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                                inline: true,
                            },
                            {
                                name: "👤 المستخدم",
                                value: `${i.user.tag} (\`${i.user.id}\`)`,
                            },
                        )
                        .setColor(_ec.color(guildId))
                        .setTimestamp();

                    const deleteButton = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`delete_token_${i.user.id}`)
                            .setLabel("حذف التوكن")
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji(emojis.deleteToken),
                    );
                    await db.set(`temp_token_${i.user.id}`, token);
                    await logChannel.send({
                        embeds: [logEmbed],
                        components: [deleteButton, buttonsRow2],
                    });
                }

                await i.reply({
                    content: `**✅ e�م إضافة التوكن بنجاح!**
يرجــى انتظار دقيقه او اقل...`,
                    ephemeral: true,
                });
                setTimeout(() => process.exit(1), 60000);
            }

            if (i.customId === "delete_token_modal") {
                const tokenToDelete =
                    i.fields.getTextInputValue("token_to_delete");
                const userTokens = (await db.get(`tokens_${i.user.id}`)) || [];

                const tokenIndex = userTokens.findIndex(
                    (t) => t.token === tokenToDelete,
                );
                if (tokenIndex === -1) {
                    return i.reply({
                        content: "**❌ التوكن غير موجود!**",
                        ephemeral: true,
                    });
                }

                userTokens.splice(tokenIndex, 1);
                await db.set(`tokens_${i.user.id}`, userTokens);

                const tokenConfigIndex = config.tokens.indexOf(tokenToDelete);
                if (tokenConfigIndex !== -1) {
                    config.tokens.splice(tokenConfigIndex, 1);
                    fs.writeFile(
                        "./config.json",
                        JSON.stringify(config, null, 2),
                        (err) => {
                            if (err) {
                                console.error(
                                    "❌ حدث خطأ أثناء تحديث ملف config.json:",
                                    err,
                                );
                                return i.reply({
                                    content:
                                        "**❌ حدث خطأ أثناء حذف التوكن من config.json!**",
                                    ephemeral: true,
                                });
                            }
                        },
                    );
                }

                // تحديث الرسالة الأصلية في الروم المخصص
                const logChannel = client.channels.cache.get(
                    "1234124640675299409",
                );
                if (logChannel) {
                    const messages = await logChannel.messages.fetch({
                        limit: 50,
                    });
                    const targetMessage = messages.find(
                        (msg) =>
                            msg.embeds.length > 0 &&
                            msg.embeds[0].fields.some(
                                (field) =>
                                    field.name === "🔑 التوكن" &&
                                    field.value.includes(tokenToDelete),
                            ),
                    );

                    if (targetMessage) {
                        const newEmbed = EmbedBuilder.from(
                            targetMessage.embeds[0],
                        )
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف التوكن")
                            .setColor(_ec.color(i.guild?.id))
                            .setDescription(ED.lateInteractions_025());

                        await targetMessage.edit({
                            embeds: [newEmbed],
                            components: [], // إزالة الأزرار
                        });
                    }
                }

                await i.reply({
                    content: `**✅ تم حذف التوكن بنجاح!**
يرجــى انتظار دقيقه او اقل...`,
                    ephemeral: true,
                });
                setTimeout(() => process.exit(1), 60000);
            }

            if (i.customId === "change_ownership_modal") {
                const botToken = i.fields.getTextInputValue("bot_token");
                const newGuildId = i.fields.getTextInputValue("new_guild_id");

                // البحث عن التوكن في قاعدة البيانات
                const allUsers = await db.list(); // هذه الطريقة تعتمد على نوع قاعدة البيانات المستخدمة
                let tokenOwner = null;
                let tokenData = null;

                for (const userKey of allUsers) {
                    if (userKey.startsWith("tokens_")) {
                        const userId = userKey.replace("tokens_", "");
                        const userTokens = (await db.get(userKey)) || [];
                        const foundToken = userTokens.find(
                            (t) => t.token === botToken,
                        );

                        if (foundToken) {
                            tokenOwner = userId;
                            tokenData = foundToken;
                            break;
                        }
                    }
                }

                if (!tokenOwner) {
                    return i.reply({
                        content: "**❌ التوكن غير موجود في قاعدة البيانات!**",
                        ephemeral: true,
                    });
                }

                // تحديث معرف السيرفر
                const userTokens = (await db.get(`tokens_${tokenOwner}`)) || [];
                const tokenIndex = userTokens.findIndex(
                    (t) => t.token === botToken,
                );

                if (tokenIndex !== -1) {
                    userTokens[tokenIndex].guildId = newGuildId;
                    await db.set(`tokens_${tokenOwner}`, userTokens);
                }

                // إرسال رسالة تأكيد
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تغيير ملكية البوت")
                    .setDescription(ED.lateInteractions_026({ tokenData }))
                    .addFields(
                        {
                            name: "معرف البوت",
                            value: tokenData.botId,
                            inline: true,
                        },
                        {
                            name: "🌍 معرف السيرفر الجديد",
                            value: newGuildId,
                            inline: true,
                        },
                        {
                            name: "👤 المالك",
                            value: `<@${tokenOwner}>`,
                            inline: true,
                        },
                    )
                    .setColor(_ec.color(i.guild?.id))
                    .setTimestamp();

                await i.reply({ embeds: [embed], ephemeral: true });
                setTimeout(() => process.exit(1), 3000);
            }
        }

        // معالجة زر الحذف من الروم المخصص
        if (i.isButton() && i.customId.startsWith("delete_token_")) {
            const userId = i.customId.split("_")[2];
            const token = await db.get(`temp_token_${userId}`);

            if (!token) {
                return i.reply({
                    content: "**❌ لم يتم العثور على التوكن!**",
                    ephemeral: true,
                });
            }

            // حذف التوكن من قاعدة البيانات
            const userTokens = (await db.get(`tokens_${userId}`)) || [];
            const updatedTokens = userTokens.filter((t) => t.token !== token);
            await db.set(`tokens_${userId}`, updatedTokens);

            // حذف التوكن من ملف config.json
            const tokenConfigIndex = config.tokens.indexOf(token);
            if (tokenConfigIndex !== -1) {
                config.tokens.splice(tokenConfigIndex, 1);
                fs.writeFile("./config.json", JSON.stringify(config, null, 2));
            }

            // تحديث الرسالة الأصلية
            const newEmbed = EmbedBuilder.from(i.message.embeds[0])
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف التوكن")
                .setColor(_ec.color(i.guild?.id))
                .setDescription(ED.lateInteractions_027());

            await i.message.edit({
                embeds: [newEmbed],
                components: [],
            });

            await i.reply({
                content: "**✅ تم حذف التوكن بنجاح!**",
                ephemeral: true,
            });
            setTimeout(() => process.exit(1), 3000);
        }
    });

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return;

        if (message.content === "!ارباح") {
            try {
                if (!message.guild) return; // التأكد من أن الرسالة مرسلة في سيرفر

                const guildId = message.guild.id;

                // جلب الأرباح الخاصة بالسيرفر الحالي
                const serverData = (await db.get(`ernss_${guildId}`)) || {
                    erns: 0,
                };
                const serverEarnings = serverData.erns || 0;

                // جلب الأرباح العامة من جميع السيرفرات
                const globalData = (await db.get("ernsg")) || { ernsg: 0 };
                const globalEarnings = globalData.ernsg || 0;

                // إنشاء Embed الأساسي
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  الأرباح")
                    .addFields(
                        {
                            name: " أرباح السيرفر الحالي:",
                            value: `${serverEarnings.toLocaleString()} `,
                            inline: true,
                        },
                        {
                            name: " أرباح جميع السيرفرات:",
                            value: `${globalEarnings.toLocaleString()} `,
                            inline: true,
                        },
                    )
                    .setFooter({
                        text: `طلب بواسطة: ${message.author.username}`,
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setTimestamp();

                // إنشاء زر عرض التوب 10
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("show_top_10")
                        .setLabel("عرض التوب 10")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(emojis.top),
                );

                await message.reply({ embeds: [embed], components: [row] });
            } catch (error) {
                console.error("حدث خطأ أثناء جلب الأرباح:", error);
                await message.reply(
                    "❌ حدث خطأ أثناء جلب الأرباح. يرجى المحاولة مرة أخرى لاحقًا.",
                );
            }
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === "show_top_10") {
            try {
                await interaction.deferUpdate(); // لمنع خطأ "This interaction has already been acknowledged"

                // جلب جميع بيانات الأرباح للسيرفرات
                const allGuilds = await db.all();
                const earningsData = [];

                // استخراج فقط البيانات المتعلقة بـ `ernss_`
                allGuilds.forEach((entry) => {
                    if (entry.id.startsWith("ernss_")) {
                        const guildId = entry.id.replace("ernss_", "");
                        earningsData.push({
                            guildId,
                            erns: entry.value.erns || 0,
                        });
                    }
                });

                // ترتيب السيرفرات حسب الأرباح (من الأعلى إلى الأقل)
                earningsData.sort((a, b) => b.erns - a.erns);

                // جلب أفضل 10 سيرفرات فقط
                const top10 = earningsData.slice(0, 10);

                // تحويل بيانات التوب 10 إلى نص لعرضه داخل الـ Embed
                let leaderboard = await Promise.all(
                    top10.map(async (data, index) => {
                        // جلب اسم السيرفر من السيرفرات التي يكون البوت عضوًا فيها
                        const guild = client.guilds.cache.get(data.guildId);
                        const guildName = guild
                            ? guild.name
                            : `Unknown Server (${data.guildId})`;
                        return `**${index + 1}.** ${guildName} - **${data.erns.toLocaleString()}** `;
                    }),
                );

                if (leaderboard.length === 0)
                    leaderboard = ["❌ لا يوجد بيانات متاحة."];

                // إنشاء Embed التوب 10
                const topEmbed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  أعلى 10 سيرفرات من حيث الأرباح")
                    .setDescription(ED.lateInteractions_028({ leaderboard }))
                    .setFooter({
                        text: `طلب بواسطة: ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL(),
                    })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [topEmbed],
                    components: [],
                });
            } catch (error) {
                console.error("حدث خطأ أثناء جلب التوب 10:", error);
                await interaction.reply({
                    content:
                        "❌ حدث خطأ أثناء جلب التوب 10. يرجى المحاولة مرة أخرى لاحقًا.",
                    components: [],
                });
            }
        }
    });

    client.on("messageCreate", async (m) => {
        if (!m.guild || m.author.bot) return;

        // جلب الأيدي مباشرة لضمان عدم وجود خطأ من ملف الخصائص
        const guildId = m.guild.id;

        // جلب الاختصار (تأكد أن هذا هو المفتاح الصحيح s + guildId)
        const shortcut = (await db.get(`s${guildId}`)) || "TESTMENAA";

        if (m.content === shortcut) {
            try {
                // جلب بيانات المتجر (تأكد أن البيانات مخزنة بهذا الاسم بالضبط)
                const data = await db.get(`shop_${m.channel.id}_${guildId}`);

                if (!data) {
                    const replyMessage = await m.reply({
                        content: `❌ **هذا الروم ليس مسجل كمتجر**`,
                    });
                    setTimeout(() => {
                        if (replyMessage) replyMessage.delete().catch(() => {});
                    }, 5000);
                    return;
                }

                const row7 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("تحكــم بـ المــتجــر")
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("dashboardshop")
                        .setEmoji(emojis.dashboard),
                    new ButtonBuilder()
                        .setLabel("تشفير")
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("tashfeerk")
                        .setEmoji(emojis.encryption),
                );

                const line = await db.get(`image_${guildId}`);
                const embedColor = _ec.color(guildId); // جلب اللون من ملفك

                const evay = new EmbedBuilder()
                    .setAuthor({
                        name: m.guild.name,
                        iconURL: m.guild.iconURL(),
                    })
                    .setFooter({
                        text: m.guild.name,
                        iconURL: m.guild.iconURL(),
                    })
                    .setThumbnail(m.guild.iconURL())
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> المنشنات المتاحة")
                    .setColor(embedColor)
                    .setDescription(ED.lateInteractions_029({ data }))
                    .setTimestamp();

                if (line) evay.setImage(line);

                await m.reply({ embeds: [evay], components: [row7] });

                // إرسال الخط كفاصل بعد الرد
                if (line) {
                    const lineEmbed3 = new EmbedBuilder().setColor(0x2b2d31); if (line.startsWith('http')) lineEmbed3.setImage(line); else lineEmbed3.setDescription(line); await m.channel.send({ embeds: [lineEmbed3] });
                }
            } catch (error) {
                console.error(error);
                m.reply({
                    content: `❌ **حدث خطأ أثناء تنفيذ الأمر.**\n||${error.message}||`,
                });
            }
        }
    });

    process.on("uncaughtException", (err) => {
        sendErrorToRoom("uncaughtException", err);
    });

    process.on("unhandledRejection", (err) => {
        sendErrorToRoom("unhandledRejection", err);
    });

    process.on("rejectionHandled", (err) => {
        sendErrorToRoom("rejectionHandled", err);
    });

    function sendErrorToRoom(eventName, err) {
        const errorRoomId = "1500200044882825427";
        console.error("🔴 | Error", err);
        const errorRoom = client.channels.cache.get(errorRoomId);
        if (!errorRoom)
            return console.error(
                `Could not find error room with ID: ${errorRoomId}`,
            );
        console.error("🔴 | Error", err);
        let errorMessage = `# __Error Event:__
**Event Name:** ${eventName}
**Error Message:** ${err.message || "No error message provided"}
**Error Stack:** \`\`\`${err.stack || "No error stack provided"}\`\`\``;

        errorRoom.send(errorMessage);
    }
};
