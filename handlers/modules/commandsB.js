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
} = require("discord.js");
const D = require("./descriptions");
const _ec = require("./embedColor");
const fs = require("fs");
const ms = require("ms");
const path = require("path");
const emojis = require("./emojis");
const ED = require("./embedDescriptions");
module.exports = function registerCommandsB(
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
    client.on("interactionCreate", async (i) => {
        if (!i.isChatInputCommand()) return;
        const guildId = i.guild.id;
        const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
        const sellerId = await db.get(
            `shop_${i.channel.id}_${guildId}.sellerId`,
        );
        switch (i.commandName) {
            case "مزاد":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id))
                        return i.reply("**أنت في البلاك لست!**");

                    const channelssend = i.options.getChannel("channel");
                    const ui = i.options.getUser("الشخص");
                    const re = i.options.getString("السلعة");
                    const pr = i.options.getString("السعر");
                    const ti = i.options.getInteger("وقت");
                    const men = i.options.getInteger("المنشن");
                    const attachments = [
                        i.options.getAttachment("صوره"),
                        i.options.getAttachment("صوره2"),
                        i.options.getAttachment("صوره3"),
                        i.options.getAttachment("صوره4"),
                        i.options.getAttachment("صوره5"),
                    ].filter((a) => a !== null);

                    const guildId = i.guild.id;
                    const admins = await db.get(`auctionad_${guildId}`);

                    if (!admins || !i.member.roles.cache.has(admins)) {
                        return i.reply({
                            content: `لـيـس لـديـك صـلاحـيـة، تـحـتـاج رتـبـه <@&${admins}>`,
                            ephemeral: true,
                        });
                    }

                    let op = men === 0 ? "@everyone" : "@here";
                    const files = attachments.map((att, index) => ({
                        attachment: att.attachment,
                        name: `image${index + 1}.png`,
                    }));

                    // 1. فتح الروم فوراً
                    await channelssend.permissionOverwrites.edit(
                        i.guild.roles.everyone,
                        { SendMessages: true },
                    );

                    const endTimestamp = Math.floor(
                        (Date.now() + ti * 60000) / 1000,
                    );

                    // 2. إرسال رسالة المزاد مع زر الإنهاء اليدوي للمسؤول
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("stop_auction_now")
                            .setLabel("إنهاء المزاد الآن")
                            .setStyle(ButtonStyle.Danger),
                    );

                    const auctionMsg = await channelssend.send({
                        content: `> **__\n> \`#\` ${config.mzademoji} الـسـلعـة : ${re}\n>\n> \`#\` ${config.mzademoji} صـاحـب السـلعـة : <@${ui.id}>\n>\n> \`#\` ${config.mzademoji} الـسعر المـبـدئـي : ${pr}\n>\n> \`#\` ${config.mzademoji} يـنـتـهـي : <t:${endTimestamp}:R>\n>\n> \`#\` ${config.mzademoji} الـمـنـشـن : ${op}\n> __**`,
                        files: files.length > 0 ? files : undefined,
                        components: [row],
                    });

                    await i.reply({
                        content: "✅ تم بدء المزاد وفتح الروم.",
                        ephemeral: true,
                    });

                    // وظيفة الإنهاء المشتركة (تُستدعى عند انتهاء الوقت أو ضغط الزر)
                    const endAuction = async (byAdmin = false) => {
                        try {
                            // قفل الروم
                            await channelssend.permissionOverwrites.edit(
                                i.guild.roles.everyone,
                                { SendMessages: false },
                            );
                            // حذف رسالة المزاد
                            if (auctionMsg.deletable)
                                await auctionMsg.delete().catch(() => {});
                            // إرسال رسالة النهاية
                            await channelssend.send({
                                content: `**# انـتـهى وقـت الـمـزاد ${byAdmin ? "بواسطة الإدارة" : "تـلـقـائـيـاً"} **\n**__\nيـرجى الـتواصل مع صاحب السلعة: <@${ui.id}>\nيـنـصح بـطـلـب وسـيـط لـضـمـان حـقـك.\n__**`,
                            });
                        } catch (e) {
                            console.error(e);
                        }
                    };

                    // 3. كوليكتور للزر (للمسؤولين فقط)
                    const filter = (btnInt) =>
                        btnInt.customId === "stop_auction_now" &&
                        btnInt.member.roles.cache.has(admins);
                    const collector =
                        auctionMsg.createMessageComponentCollector({
                            filter,
                            time: ti * 60000,
                        });

                    let finished = false;
                    collector.on("collect", async (btnInt) => {
                        finished = true;
                        await btnInt.reply({
                            content: "تم إنهاء المزاد يدوياً وقفل الروم.",
                            ephemeral: true,
                        });
                        collector.stop();
                        await endAuction(true);
                    });

                    // 4. لو خلص الوقت وما حد ضغط الزر
                    collector.on("end", async () => {
                        if (!finished) {
                            await endAuction(false);
                        }
                    });
                }
                break;

            case "send-tashfeer":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const guildId = _ec.gid(i); // استخدام الدالة من ملفك لجلب الأيدي
                    const { member } = i;

                    const highstaff = await db.get(`highstaff_${guildId}`);
                    if (!highstaff) {
                        await i.reply({
                            content:
                                "يرجى تحديد رتبة العليا (highstaff) عن طريق استخدام الامر الاتي: /setup",
                            ephemeral: true,
                        });
                        return;
                    }

                    if (!member.roles.cache.has(highstaff)) {
                        await i.reply({
                            content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
                            ephemeral: true,
                        });
                        return;
                    }

                    // جلب الصورة واللون باستخدام نظامك الجديد
                    const imageUrl = await db.get(`image_${guildId}`);
                    const color = _ec.color(guildId); // جلب اللون من الكاش مباشرة

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("tashfeerk")
                            .setLabel("تـشـفـيـر مـنشـورك")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(emojis.encryption),
                    );

                    await i.reply({ content: "done", ephemeral: true });

                    const tashfeerEmbed = new EmbedBuilder()
                        .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> **التـشـفـيـر**`)
                        .setDescription(
                            `**❦\`-\` __ لتشفير منشورك يرجى الضغط على اسفل الايمبد، \`وكتابة منشورك\`.__**`,
                        )
                        .setAuthor({
                            name: `${i.guild.name}`,
                            iconURL: i.guild.iconURL({ size: 1024 }),
                        })
                        .setFooter({ text: `${i.guild?.name || "Server"}` })
                        .setTimestamp()
                        .setColor(color); // استخدام متغير اللون من ملفك

                    if (imageUrl) {
                        tashfeerEmbed.setImage(imageUrl);
                    }

                    await i.channel.send({
                        embeds: [tashfeerEmbed],
                        components: [row],
                    });
                }
                break;

            case "afk":
                {
                    const reason =
                        i.options.getString("reason") || "لا يوجد سبب"; // Ensure default value is used correctly
                    const userId = i.user.id; // الحصول على معرف المستخدم الذي قام بتنفيذ الأمر

                    const linkRegex =
                        /\b((https?:\/\/|www\.)[^\s]+(?:\.[a-z]{2,}|\/[^\s]*)?|https?:\/\/(?:discord\.gg|discord\.com\/invite|discord\.com\/channels\/[0-9]+\/[0-9]+\/[0-9]+))/gi;

                    if (linkRegex.test(reason)) {
                        return i.channel.send({
                            content:
                                "❌ **غير مسموح بوضع روابط في سبب الـ AFK.**",
                            ephemeral: true,
                        });
                    }

                    await db.set(`afk_${userId}`, reason); // تعيين حالة AFK للمستخدم

                    const afkEmbed = new EmbedBuilder()
                        .setColor("#FF0000")
                        .setDescription(ED.commandsB_002({ reason }));

                    await i.reply({ embeds: [afkEmbed], ephemeral: true }); // الرد برسالة AFK
                }
                break;
            case "ping":
                {
                    // جلب البيانات الأساسية (اللون والصورة الافتراضية)
                    const guildId = i.guild?.id;
                    const embedColor = await getColor(guildId, db, config);
                    const imageUrl = await db.get(`image_${guildId}`);

                    // حساب الـ Uptime
                    let days = Math.floor(i.client.uptime / 86400000);
                    let hours = Math.floor(i.client.uptime / 3600000) % 24;
                    let minutes = Math.floor(i.client.uptime / 60000) % 60;
                    let seconds = Math.floor(i.client.uptime / 1000) % 60;
                    const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

                    // قياس البنق
                    const sent = await i.reply({
                        content: "⏳ **Measuring performance...**",
                        fetchReply: true,
                    });
                    const ping = sent.createdTimestamp - i.createdTimestamp;
                    const apiPing = Math.round(i.client.ws.ping);

                    // تحديد الإيموجي بناءً على سرعة الاستجابة
                    let emoji = ping < 300 ? "🟢" : ping < 400 ? "🟡" : "🔴";

                    // بناء الإمبد باستخدام Builder
                    const embed = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> **Pong!**")
                        .addFields(
                            {
                                name: "**Latency(ping)**",
                                value: `**${emoji} ${ping}ms**`,
                                inline: true,
                            },
                            {
                                name: "**API Latency**",
                                value: `**${apiPing}ms**`,
                                inline: true,
                            },
                            {
                                name: "**Uptime**",
                                value: `**${uptimeString}**`,
                            },
                        )
                        .setColor(embedColor) // استخدام دالة اللون حقتك
                        .setTimestamp()
                        .setFooter({
                            text: `Requested by ${i.user.username}`,
                            iconURL: i.user.displayAvatarURL({ dynamic: true }),
                        });

                    // إضافة صورة الـ Line حقك إذا كانت موجودة
                    if (imageUrl) {
                        embed.setImage(imageUrl);
                    }

                    // الأزرار
                    const button = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel("انضم لـسيرفر السبورت")
                            .setStyle(ButtonStyle.Link)
                            .setURL("https://discord.gg/mEdX6D7Bjz")
                            .setEmoji(emojis.supportServer || "🛡️"),
                        new ButtonBuilder()
                            .setLabel("ضيف البوت")
                            .setStyle(ButtonStyle.Link)
                            .setURL(
                                `https://discord.com/oauth2/authorize?client_id=${i.client.user.id}&permissions=8&scope=bot%20applications.commands`,
                            )
                            .setEmoji(emojis.addBot || "🤖"),
                    );

                    // تعديل الرد الأصلي
                    await i.editReply({
                        content: null,
                        embeds: [embed],
                        components: [button],
                    });
                }
                break;
            case "help":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const guildId = i.guild.id;
                    const embedColor = await getColor(guildId, db, config);
                    const imageUrl = await db.get(`image_${guildId}`); // الخط العام للسيرفر

                    try {
                        const embed = new EmbedBuilder()
                            .setColor(embedColor)
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> **قائمة المساعدة**")
                            .setDescription(ED.commandsB_003())
                            .setThumbnail(
                                client.user.displayAvatarURL({ dynamic: true }),
                            )
                            // الأولوية لصورة الهلب المخصصة، وإذا مو موجودة يحط الـ Line العام
                            .setImage("https://postimg.cc" || imageUrl)
                            .setTimestamp();

                        const buttonsRow1 =
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setLabel("اوامر الاونر")
                                    .setStyle(ButtonStyle.Secondary)
                                    .setCustomId("ownerCommands")
                                    .setEmoji(emojis.ownerCmds),
                                new ButtonBuilder()
                                    .setLabel("اوامر الاداره")
                                    .setStyle(ButtonStyle.Secondary)
                                    .setCustomId("adminCommands")
                                    .setEmoji(emojis.adminCmds),
                            );

                        const buttonsRow2 =
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setLabel("اضافة البوت")
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(
                                        `https://discord.com{client.user.id}`,
                                    )
                                    .setEmoji(emojis.addBot),
                                new ButtonBuilder()
                                    .setLabel("سيرفر السبورت")
                                    .setStyle(ButtonStyle.Link)
                                    .setURL("https://discord.gg")
                                    .setEmoji(emojis.supportServer),
                            );

                        const selectMenuRow =
                            new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId("helpMenu")
                                    .setPlaceholder(
                                        "اختر الامر اللذي تريد المساعده فيه.",
                                    )
                                    .addOptions(
                                        {
                                            label: "كيف تضبط البوت بسيرفرك",
                                            value: "multiBot",
                                        },
                                        {
                                            label: "كيف تسوي متاجر",
                                            value: "createStore",
                                        },
                                        {
                                            label: "كيف تسوي بيع تلقائي للطلبات",
                                            value: "autoSellOrders",
                                        },
                                        {
                                            label: "كيف تسوي بيع تلقائي للمزاد",
                                            value: "autoAuction",
                                        },
                                        {
                                            label: "معلومات عن البوت",
                                            value: "botInfo",
                                        },
                                        {
                                            label: "إعادة تشغيل القائمة",
                                            value: "resetMenu",
                                        },
                                    ),
                            );

                        const sentMessage = await i.reply({
                            embeds: [embed],
                            components: [
                                buttonsRow1,
                                buttonsRow2,
                                selectMenuRow,
                            ],
                            ephemeral: true,
                            fetchReply: true,
                        });

                        setTimeout(async () => {
                            try {
                                const disabledButtonsRow1 =
                                    ActionRowBuilder.from(buttonsRow1);
                                disabledButtonsRow1.components.forEach((c) =>
                                    c.setDisabled(true),
                                );
                                const disabledSelectMenuRow =
                                    ActionRowBuilder.from(selectMenuRow);
                                disabledSelectMenuRow.components.forEach((c) =>
                                    c.setDisabled(true),
                                );

                                await i.editReply({
                                    components: [
                                        disabledButtonsRow1,
                                        buttonsRow2,
                                        disabledSelectMenuRow,
                                    ],
                                });
                            } catch (e) {}
                        }, 300000);
                    } catch (error) {
                        console.error(error);
                        await i.reply({
                            content: "حدث خطأ أثناء عرض قائمة المساعدة.",
                            ephemeral: true,
                        });
                    }
                }
                break;

            case "price-panel":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const guildId = _ec.gid(i);
                    const { member } = i;
                    const highstaff = await db.get(`highstaff_${guildId}`);

                    if (!highstaff || !member.roles.cache.has(highstaff)) {
                        return i.reply({
                            content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
                            ephemeral: true,
                        });
                    }

                    const text = i.options.getString("embed-text");

                    // جلب اللون من ملف المودل حقك
                    const color = _ec.color(guildId);

                    // جلب صورة انفو الأسعار المخصصة أو الخط العام
                    const imageUrl =
                        (await db.get(`priceImage_${guildId}`)) ||
                        (await db.get(`image_${guildId}`));

                    const row1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`mzad2_prices_${guildId}`)
                            .setLabel("أسعار المزاد الخاص")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(emojis.auction),
                        new ButtonBuilder()
                            .setCustomId(`roles_prices_${guildId}`)
                            .setLabel("أسعار الرتب")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(emojis.roles),
                        new ButtonBuilder()
                            .setCustomId(`additions_prices_${guildId}`)
                            .setLabel("أسعار الإضافات")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(emojis.additionsPrices),
                    );

                    const row2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("order-price")
                            .setLabel("اســـعار الـــطلــبات")
                            .setEmoji(emojis.order)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId("auctionpri")
                            .setLabel("اسعار الــمــزادات")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(emojis.auction),
                        new ButtonBuilder()
                            .setCustomId("shoppri")
                            .setLabel("اسعار المــتاجــر")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(emojis.shop),
                    );

                    const priceEmbed = new EmbedBuilder()
                        .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> الاســعــار`)
                        .setDescription(
                            text ||
                                `**اهلا و ســهلا هــنا قسـم الاســعار لــسيرفر**\n__${i.guild.name}__\nكل الي عليك عشان تعرف الاســعار \nتــختار زر مــن الازرار الــي تـحت\nنأمل ان تنــال اســعارنا رضـــاكم`,
                        )
                        .setAuthor({
                            name: i.guild.name,
                            iconURL: i.guild.iconURL({ size: 1024 }),
                        })
                        .setFooter({ text: i.guild.name })
                        .setTimestamp()
                        .setColor(color);

                    if (imageUrl) priceEmbed.setImage(imageUrl);

                    await i.reply({ content: "done", ephemeral: true });
                    await i.channel.send({
                        embeds: [priceEmbed],
                        components: [row1, row2],
                    });
                }
                break;

            case "shop-panel":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const guildId = _ec.gid(i);
                    const { member } = i;
                    const highstaff = await db.get(`highstaff_${guildId}`);

                    if (!highstaff || !member.roles.cache.has(highstaff)) {
                        return i.reply({
                            content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
                            ephemeral: true,
                        });
                    }

                    const text = i.options.getString("embed-text");
                    const color = _ec.color(guildId);

                    // استخدام تعريف الصورة الصحيح اللي ضفناه في السيت اب (buyshopimage)
                    const imageUrl =
                        (await db.get(`buyshopimage_${guildId}`)) ||
                        (await db.get(`image_${guildId}`));

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("buy_shop")
                            .setLabel("شــراء مـتـجـر")
                            .setEmoji(emojis.shop)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId("shoppri")
                            .setLabel("أسـعـار الـمـتـاجـر")
                            .setEmoji(emojis.shop)
                            .setStyle(ButtonStyle.Secondary),
                    );

                    const shopEmbed = new EmbedBuilder()
                        .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> بـانـل شــراء مـتـاجـر`)
                        .setDescription(
                            text ||
                                `** أهـلاً و سـهلاً بـك فـي قـسـم شـراء الـمـتـاجـر لـسـيـرفـر**\n__${i.guild.name}__\n\nنأمل ان تنــال خدماتنا رضـــاكم`,
                        )
                        .setAuthor({
                            name: i.guild.name,
                            iconURL: i.guild.iconURL({ size: 1024 }),
                        })
                        .setFooter({ text: i.guild?.name || "Server" })
                        .setTimestamp()
                        .setColor(color);

                    if (imageUrl) shopEmbed.setImage(imageUrl);

                    await i.reply({ content: "✅ done", ephemeral: true });
                    await i.channel.send({
                        embeds: [shopEmbed],
                        components: [row],
                    });
                }
                break;
            case "order-panel":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const guildId = _ec.gid(i);
                    const { member } = i;
                    const highstaff = await db.get(`highstaff_${guildId}`);

                    if (!highstaff || !member.roles.cache.has(highstaff)) {
                        return i.reply({
                            content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
                            ephemeral: true,
                        });
                    }

                    const text = i.options.getString("embed-text");
                    const color = _ec.color(guildId);
                    // الأولوية لصورة شراء الطلبات ثم الـ Line العام
                    const imageUrl =
                        (await db.get(`buyorderimage_${guildId}`)) ||
                        (await db.get(`image_${guildId}`));

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket-order")
                            .setLabel("شــراء طـــلب")
                            .setEmoji(emojis.order)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId("order-price")
                            .setLabel("اســـعار الـــطلــبات")
                            .setEmoji(emojis.order)
                            .setStyle(ButtonStyle.Secondary),
                    );

                    const orderEmbed = new EmbedBuilder()
                        .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> بانل شــراء طــلبات`)
                        .setDescription(
                            text ||
                                `** اهلا و ســهلا هــنا قسـم شراء الـطلبات لــسيرفر**\n__${i.guild.name}__\nنأمل ان تنــال اســعارنا رضـــاكم`,
                        )
                        .setAuthor({
                            name: i.guild.name,
                            iconURL: i.guild.iconURL({ size: 1024 }),
                        })
                        .setFooter({ text: i.guild?.name || "Server" })
                        .setTimestamp()
                        .setColor(color);

                    if (imageUrl) orderEmbed.setImage(imageUrl);

                    await i.reply({ content: "done", ephemeral: true });
                    await i.channel.send({
                        embeds: [orderEmbed],
                        components: [row],
                    });
                }
                break;

            case "auction-panel":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const guildId = _ec.gid(i);
                    const { member } = i;
                    const highstaff = await db.get(`highstaff_${guildId}`);

                    if (!highstaff || !member.roles.cache.has(highstaff)) {
                        return i.reply({
                            content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
                            ephemeral: true,
                        });
                    }

                    const text = i.options.getString("embed-text");
                    const color = _ec.color(guildId);
                    // الأولوية لصورة المزاد المخصصة ثم الـ Line العام
                    const imageUrl =
                        (await db.get(`buyauctionimage_${guildId}`)) ||
                        (await db.get(`image_${guildId}`));

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket-auction")
                            .setLabel("شــراء مــزاد")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(emojis.auction),
                        new ButtonBuilder()
                            .setCustomId("auctionpri")
                            .setLabel("اسعار المزادات")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(emojis.auction),
                    );

                    const auctionEmbed = new EmbedBuilder()
                        .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> بانل شــراء مــزاد`)
                        .setDescription(
                            text ||
                                `**اهلا و ســهلا هــنا قسـم شراء مـزادات لــسيرفر**\n__${i.guild.name}__\nنأمل ان تنــال اســعارنا رضـــاكم`,
                        )
                        .setAuthor({
                            name: i.guild.name,
                            iconURL: i.guild.iconURL({ size: 1024 }),
                        })
                        .setFooter({ text: i.guild?.name || "Server" })
                        .setTimestamp()
                        .setColor(color);

                    if (imageUrl) auctionEmbed.setImage(imageUrl);

                    await i.reply({ content: "done", ephemeral: true });
                    await i.channel.send({
                        embeds: [auctionEmbed],
                        components: [row],
                    });
                }
                break;

            case "say-all-shops":
                {
                    await i.deferReply({ flags: MessageFlags.Ephemeral });

                    const guildId = _ec.gid(i);
                    const { member } = i;

                    // 1. الـتـحـقـق مـن الـبـلاك لـسـت والـصـلاحـيـات
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id))
                        return i.editReply({
                            content:
                                "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال إلـى سـيـرفـر الـدعـم!**",
                        });

                    const highstaff = await db.get(`highstaff_${guildId}`);
                    if (!highstaff || !member.roles.cache.has(highstaff))
                        return i.editReply({
                            content: `لـيـس لـد يـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر.`,
                        });

                    const messageContent = i.options.getString("message");
                    const color = _ec.color(guildId);
                    const linePreview = await db.get(`image_${guildId}`);

                    // 2. واجـهـة الـبـدا يـة (اخـتـيار الـفـئـة)
                    const targetRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("target_all")
                            .setLabel("جـمـيـع الـمـتـاجـر")
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId("target_types")
                            .setLabel("تـحـد يـد نـوع مـعـيـن")
                            .setStyle(ButtonStyle.Secondary),
                    );

                    const initialEmbed = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـهـيـئـة الإر سـال الـجـمـاعـي")
                        .setDescription(
                            `الـمـحـتـوى الـمـطـلـوب إر سـالـه:\n\`\`\`${messageContent}\`\`\`\n\n**اخـتـر الـفـئـة الـمـسـتـهـدفـة مـن الأزرار بـالأد نـى:**`,
                        )
                        .setColor(color);
                    if (linePreview) initialEmbed.setImage(linePreview);

                    const msg = await i.editReply({
                        embeds: [initialEmbed],
                        components: [targetRow],
                    });

                    let selectedTarget = "all";
                    let selectedType = null;

                    const collector = msg.createMessageComponentCollector({
                        filter: (int) => int.user.id === i.user.id,
                        time: 120000,
                    });

                    collector.on("collect", async (interaction) => {
                        // --- اخـتـيار جـمـيـع الـمـتـاجـر ---
                        if (interaction.customId === "target_all") {
                            selectedTarget = "all";
                            const formatRow =
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId("send_embed")
                                        .setLabel("إر سـال كـإmـبـيـد")
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId("send_text")
                                        .setLabel("إر سـال كـرّسـالـة عـاد يـة")
                                        .setStyle(ButtonStyle.Secondary),
                                );
                            await interaction.update({
                                content:
                                    "✅ تـم اخـتـيار جـمـيـع الـمـتـاجـر. الآن اخـتـر نـوع الـرّسـالـة:",
                                components: [formatRow],
                            });
                        }

                        // --- اخـتـيار نـوع مـعـيـن (جـلـب الـكـاتـيـجـور يـز) ---
                        if (interaction.customId === "target_types") {
                            const allEntries = await db.all();
                            const types = allEntries
                                .filter(
                                    (e) =>
                                        e.id.startsWith("categoryMentions_") &&
                                        e.id.endsWith(`_${guildId}`),
                                )
                                .map((e) => ({
                                    label:
                                        e.value.nametype || e.value.categoryId,
                                    value: e.value.categoryId,
                                }));

                            if (types.length === 0)
                                return interaction.reply({
                                    content:
                                        "❌ لا يـوجـد أنـواع مـتـاجـر مـسـجـلـة.",
                                    ephemeral: true,
                                });

                            const typeSelect =
                                new ActionRowBuilder().addComponents(
                                    new StringSelectMenuBuilder()
                                        .setCustomId("select_shop_type")
                                        .setPlaceholder(
                                            "اخـتـر نـوع الـمـتـجـر الـمـسـتـهـدف",
                                        )
                                        .addOptions(types.slice(0, 25)),
                                );
                            await interaction.update({
                                content: "👇 اخـتـر الـنـوع مـن الـقـائـمـة:",
                                components: [typeSelect],
                            });
                        }

                        // --- بـعـد اخـتـيار الـنـوع مـن الـسـلـكـت ---
                        if (
                            interaction.isStringSelectMenu() &&
                            interaction.customId === "select_shop_type"
                        ) {
                            selectedTarget = "type";
                            selectedType = interaction.values[0];
                            const formatRow =
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId("send_embed")
                                        .setLabel("إرسـال كـإمـبـيـد")
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId("send_text")
                                        .setLabel("إرسـال كـرّسـالـة عـاديـة")
                                        .setStyle(ButtonStyle.Secondary),
                                );
                            await interaction.update({
                                content: `✅ تـم تـحـديـد الـنـوع. الآن اخـتـر نـوع الـرّسـالـة:`,
                                components: [formatRow],
                            });
                        }

                        // --- عـمـلـيـة الإر سـال الـنـهـائـيـة ---
                        if (
                            interaction.customId === "send_embed" ||
                            interaction.customId === "send_text"
                        ) {
                            const isEmbed =
                                interaction.customId === "send_embed";
                            await interaction.deferUpdate();

                            const allData = await db.all();
                            const shops = allData.filter(
                                (entry) =>
                                    entry.id.startsWith(`shop_`) &&
                                    entry.id.endsWith(`_${guildId}`),
                            );

                            let count = 0;
                            for (const shop of shops) {
                                const parts = shop.id.split("_");
                                const channelId = parts[1];
                                const channel =
                                    i.guild.channels.cache.get(channelId);
                                const sellerId = shop.value.sellerId;
                                const shopCatId = shop.value.categoryId;

                                // فـلـتـرة حـسـب الـنـوع
                                if (
                                    selectedTarget === "type" &&
                                    shopCatId !== selectedType
                                )
                                    continue;

                                if (channel && sellerId) {
                                    try {
                                        if (isEmbed) {
                                            const bEmbed = new EmbedBuilder()
                                                .setDescription(messageContent)
                                                .setColor(color);
                                            if (linePreview)
                                                bEmbed.setImage(linePreview);
                                            await channel.send({
                                                content: `<@${sellerId}>`,
                                                embeds: [bEmbed],
                                            });
                                        } else {
                                            await channel.send({
                                                content: `<@${sellerId}>\n\n${messageContent}`,
                                            });
                                        }
                                        count++;
                                    } catch (err) {}
                                }
                            }

                            await i.editReply({
                                content: `✅ تـم إر سـال الـتـعـمـيـم إلـى **${count}** مـتـجـر بـنـجـاح.`,
                                embeds: [],
                                components: [],
                            });

                            // سـجـل الـلـوق
                            const logId = await db.get(`logs_${guildId}`);
                            const logCh = i.guild.channels.cache.get(logId);
                            if (logCh) {
                                const logEmbed = new EmbedBuilder()
                                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> سـجـل تـعـمـيـم")
                                    .addFields(
                                        {
                                            name: "الـمـسـؤول",
                                            value: `${i.user}`,
                                            inline: true,
                                        },
                                        {
                                            name: "الـعـدد",
                                            value: `${count}`,
                                            inline: true,
                                        },
                                        {
                                            name: "الـنـص",
                                            value: messageContent,
                                        },
                                    )
                                    .setColor(color)
                                    .setTimestamp();
                                if (linePreview) logEmbed.setImage(linePreview);
                                await logCh.send({ embeds: [logEmbed] });
                            }
                            collector.stop();
                        }
                    });

                    collector.on("end", (collected, reason) => {
                        if (reason === "time")
                            i.editReply({
                                content: "⌛ انـتـهـى الـوقـت.",
                                components: [],
                            }).catch(() => {});
                    });
                }
                break;
        }
    });
};
