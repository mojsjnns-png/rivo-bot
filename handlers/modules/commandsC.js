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

module.exports = function registerCommandsC(
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
            case "warns":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }
                    const guildId = i.guild.id;
                    const { member, guild } = i;

                    try {
                        // استرجاع بيانات المتجر من قاعدة البيانات
                        const shopData = await db.get(
                            `shop_${i.channel.id}_${guildId}`,
                        );
                        if (!shopData) {
                            return await i.reply({
                                content: `❌ **هذا الشات ليس متجرا.**`,
                                ephemeral: true,
                            });
                        }

                        // استرجاع عدد التحذيرات
                        const warns = shopData.warns || 0;

                        // استرجاع رابط الصورة من قاعدة البيانات
                        const imageUrl = await db.get(`image_${guildId}`);

                        // إعداد الـ Embed
                        const embed = new EmbedBuilder()
                            .setAuthor({
                                name: `${i.guild.name}`,
                                iconURL: i.guild.iconURL({ size: 1024 }),
                            })
                            .setTitle(" تحذيرات المتجر")
                            .setColor(_ec.color(guildId))
                            .addFields([
                                {
                                    name: "عدد التحذيرات:",
                                    value: `${warns}`,
                                },
                            ])
                            .setFooter({
                                text: i.guild?.name || "Server",
                            })
                            .setTimestamp();

                        // إضافة الصورة إذا كانت موجودة
                        if (imageUrl) {
                            embed.setImage(imageUrl);
                        }

                        // إرسال الـ Embed
                        await i.reply({ embeds: [embed] });
                    } catch (error) {
                        console.error(error);
                        await i.reply({
                            content: "❌ **حدثت مشكلة أثناء تنفيذ الأمر.**",
                            ephemeral: true,
                        });
                    }
                }
                break;
            case "warn":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }
                    const guildId = i.guild.id;
                    const { member } = i;

                    try {
                        await i.deferReply({ ephemeral: true });

                        const sellerId = await db.get(
                            `shop_${i.channel.id}_${guildId}.sellerId`,
                        );
                        const admins = await db.get(`shopad_${guildId}`);
                        const shop = i.options.getChannel("shop") || i.channel;
                        const pic = i.options.getAttachment("pic")?.url;
                        const thewarn =
                            i.options.getString("thewarn") ||
                            "لا يوجد سبب محدد.";
                        let amount = i.options.get("amount")?.value ?? 1;

                        // التحقق من الصلاحيات
                        if (!admins) {
                            return await i.editReply({
                                content:
                                    "❌ يرجى تحديد الأدمن باستخدام الأمر: `/setup`",
                            });
                        }

                        if (!member.roles.cache.has(admins)) {
                            return await i.editReply({
                                content: `❌ لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـة <@&${admins}>`,
                            });
                        }

                        // التحقق من العدد
                        if (amount < 1 || !Number.isInteger(amount)) {
                            return await i.editReply({
                                content:
                                    "❌ يجب أن يكون عدد التحذيرات عددًا صحيحًا أكبر من أو يساوي 1.",
                            });
                        }

                        if (amount > 999) {
                            return i.editReply({
                                content: `❌ **لا يمكنك تحذير أكثر من 999 تحذير ._.**
-# يا ساتر المتجر وش مسوي `,
                                ephemeral: true,
                            });
                        }

                        const shopData = await db.get(
                            `shop_${shop.id}_${guildId}`,
                        );
                        if (!shopData) {
                            return await i.editReply({
                                content: `❌ **هذا الشات ليس متجرا.**`,
                            });
                        }

                        // تحديث التحذيرات
                        const updatedWarns = shopData.warns + amount;
                        await db.add(
                            `shop_${shop.id}_${guildId}.warns`,
                            amount,
                        );

                        // إنشاء Embed التحذير
                        const warningEmbed = new EmbedBuilder()
                            .setTitle(
                                `**تم تحذير المتجر ${shop} ${config.whaitshop}**`,
                            )
                            .setDescription(ED.commandsC_001({ config }))
                            .addFields(
                                {
                                    name: `صـاحب الـمـتجــر ${config.whaitshop}`,
                                    value: `<@!${sellerId}>`,
                                    inline: true,
                                },
                                {
                                    name: `عـدد تـحذيـرات الـمتجـر ${config.whaitshop}`,
                                    value: `${updatedWarns}`,
                                    inline: true,
                                },
                                {
                                    name: `سـبب تحـذير الــمتجر ${config.whaitshop}`,
                                    value: `${thewarn}`,
                                    inline: true,
                                },
                                {
                                    name: `المــسؤول ${config.whaitshop}`,
                                    value: `<@${i.user.id}>`,
                                    inline: true,
                                },
                            )
                            .setImage(pic)
                            .setTimestamp();

                        // إرسال التحذير في القناة
                        await shop.send({ embeds: [warningEmbed] });

                        // إرسال Embed في قناة السجلات إذا كانت موجودة
                        const logsChannelId = await db.get(`logs_${guildId}`);
                        if (logsChannelId) {
                            const logsChannel =
                                await i.guild.channels.fetch(logsChannelId);
                            if (logsChannel) {
                                await logsChannel.send({
                                    embeds: [warningEmbed],
                                });
                            }
                        }

                        // إرسال رابط الصورة إذا كان موجودًا
                        const imageUrl = await db.get(`image_${guildId}`);
                        if (imageUrl) {
                            await shop.send({ content: imageUrl });
                            if (logsChannelId) {
                                const logsChannel =
                                    await i.guild.channels.fetch(logsChannelId);
                                if (logsChannel) {
                                    await logsChannel.send({
                                        content: imageUrl,
                                    });
                                }
                            }
                        }

                        // الرد على المستخدم
                        await i.editReply({
                            content: `✅ **تـم تحذير مـتـجـر ${shop} \n بـ ${amount} تـحـذيـر \n عـدد تـحـذيـرات المـتـجـر الآن: ${updatedWarns}**`,
                        });
                    } catch (error) {
                        console.error(error);
                        await i.editReply({
                            content: "❌ **حدثت مشكلة أثناء تنفيذ الأمر.**",
                        });
                    }
                }
                break;
            case "unwarn":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }
                    const { member, channel } = i;
                    const guildId = i.guild.id;
                    await i.deferReply({ ephemeral: true });

                    let amount = i.options.get("amount")?.value || 1;
                    let shop = i.options.getChannel("shop") || channel;

                    shop = i.guild.channels.cache.get(shop.id);
                    const data = await db.get(`shop_${shop.id}_${guildId}`);
                    const admins = await db.get(`shopad_${guildId}`);

                    if (!admins) {
                        await i.editReply({
                            content:
                                "يرجى تحديد الادمن عن طريق استخدام الامر الاتي: /setup",
                        });
                        return;
                    }

                    if (!member.roles.cache.has(admins)) {
                        await i.editReply(
                            `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر تـحـتـاج رتـبـه <@&${admins}>`,
                        );
                        return;
                    }

                    if (!data) {
                        await i.editReply({
                            content: `** هـذة الـروم لـيـسـت مـتـجـرا  **`,
                        });
                        return;
                    }

                    // التحقق من العدد
                    if (amount < 1 || !Number.isInteger(amount)) {
                        return await i.editReply({
                            content:
                                "❌ يجب أن يكون عدد التحذيرات المراد إزالتها عددًا صحيحًا أكبر من أو يساوي 1.",
                        });
                    }

                    if (data.warns - amount < 0) {
                        await i.editReply({
                            content: `** بـتـشـيـل ${amount} كـيـف و عـدد تـحـذيـرات المـتـجـر ${data.warns} اصـلا **`,
                        });
                        return;
                    }

                    if (shop && data) {
                        // تحديث عدد التحذيرات
                        await db.sub(
                            `shop_${shop.id}_${guildId}.warns`,
                            amount,
                        );
                        const updatedWarns = data.warns - amount;

                        // إنشاء Embed لإزالة التحذيرات
                        const removeWarnEmbed = new EmbedBuilder()
                            .setTitle(" **تـم ازالـة تحـذيـر مـن مـتـجـر**")
                            .addFields(
                                {
                                    name: `${config.whaitshop} **الـمـتـجـر**`,
                                    value: `${shop}`,
                                    inline: true,
                                },
                                {
                                    name: `${config.whaitshop} **عدد التحذيرات التي تمت إزالتها**`,
                                    value: `${data.warns}`,
                                    inline: true,
                                },
                                {
                                    name: `${config.whaitshop} **التحذيرات المتبقية**`,
                                    value: `0`,
                                    inline: true,
                                },
                                {
                                    name: `${config.whaitshop} **صاحب المتجر**`,
                                    value: `<@${data.sellerId}>`,
                                    inline: true,
                                },
                                {
                                    name: `${config.whaitshop} **المسؤول**`,
                                    value: `<@${i.user.id}>`,
                                    inline: true,
                                },
                            )
                            .setTimestamp()
                            .setFooter({ text: "تم حذف التحذيرات بنجاح" });

                        // إرس �ل الإيمبد في المتجر
                        await shop.send({ embeds: [removeWarnEmbed] });

                        // إرسال الإيمبد في السجلات
                        const logsChannelId = await db.get(`logs_${guildId}`);
                        if (logsChannelId) {
                            const logsChannel = await i.guild.channels
                                .fetch(logsChannelId)
                                .catch(() => null);
                            if (logsChannel) {
                                await logsChannel.send({
                                    embeds: [removeWarnEmbed],
                                });
                            }
                        }

                        // الرد على المستخدم
                        await i.editReply({
                            content: `✅ **تـم ازالـة ${amount} تـحـذيـرات مـن مـتـجـر ${shop}\nعـدد تـحـذيـرات المـتـجـر الآن: ${data.warns}**`,
                        });
                    }
                }
                break;
            case "unwarn-all":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const { member, channel } = i;
                    const guildId = i.guild.id;
                    await i.deferReply({ ephemeral: true });

                    let shop = i.options.getChannel("shop");

                    //const { member} = i;
                    const highstaff = await db.get(`highstaff_${guildId}`);
                    if (!highstaff) {
                        await i.editReply({
                            content:
                                "يرجى تحديد رتبة العليا (highstaff) عن طريق استخدام الامر الاتي: /setup",
                            ephemeral: true,
                        });
                        return;
                    }

                    if (!member.roles.cache.has(highstaff)) {
                        await i.editReply({
                            content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    // زر التأكيد
                    const confirmButton = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("confirm_unwarn_all")
                            .setLabel("تأكيد حذف التحذيرات")
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji(emojis.delete),
                    );

                    await i.editReply({
                        content: "❗ هل أنت متأكد من رغبتك بحذف التحذيرات؟",
                        components: [confirmButton],
                    });

                    const filter = (interaction) =>
                        interaction.customId === "confirm_unwarn_all" &&
                        interaction.user.id === i.user.id;
                    const collector = channel.createMessageComponentCollector({
                        filter,
                        time: 60000,
                    });

                    collector.on("collect", async (interaction) => {
                        if (!shop) {
                            // حذف التحذيرات من جميع المتاجر
                            const shops = await db.all();
                            const shopKeys = shops.filter(
                                (entry) =>
                                    entry.id.startsWith(`shop_`) &&
                                    entry.id.endsWith(`_${guildId}`),
                            );

                            for (const shopKey of shopKeys) {
                                await db.set(shopKey.id, {
                                    ...shopKey.value,
                                    warns: 0,
                                });
                            }

                            await interaction.update({
                                content: `✅ **تـم ازالـة جـمـيـع الـتـحـذيـرات مـن كـل الـمـتـاجـر**`,
                                components: [],
                            });
                        } else {
                            shop = i.guild.channels.cache.get(shop.id);
                            const data = await db.get(
                                `shop_${shop.id}_${guildId}`,
                            );

                            if (!data) {
                                await interaction.update({
                                    content: `** هـذة الـروم لـيـسـت مـتـجـرا  **`,
                                    components: [],
                                });
                                return;
                            }

                            await db.set(`shop_${shop.id}_${guildId}.warns`, 0);

                            const removeAllWarnsEmbed = new EmbedBuilder()
                                .setTitle(
                                    " **تـم ازالـة كـل تـحـذيـرات مـتـجـر**",
                                )
                                .addFields(
                                    {
                                        name: `${config.whaitshop} **الـمـتـجـر**`,
                                        value: `${shop}`,
                                        inline: true,
                                    },
                                    {
                                        name: `${config.whaitshop} **عدد التحذيرات التي تمت إزالتها**`,
                                        value: `${data.warns}`,
                                        inline: true,
                                    },
                                    {
                                        name: `${config.whaitshop} **التحذيرات المتبقية**`,
                                        value: `0`,
                                        inline: true,
                                    },
                                    {
                                        name: `${config.whaitshop} **صاحب المتجر**`,
                                        value: `<@${data.sellerId}>`,
                                        inline: true,
                                    },
                                    {
                                        name: `${config.whaitshop} **المسؤول**`,
                                        value: `<@${i.user.id}>`,
                                        inline: true,
                                    },
                                )
                                .setTimestamp()
                                .setFooter({
                                    text: "تم حذف جميع التحذيرات بنجاح",
                                });

                            await shop.send({ embeds: [removeAllWarnsEmbed] });

                            const logsChannelId = await db.get(
                                `logs_${guildId}`,
                            );
                            if (logsChannelId) {
                                const logsChannel = await i.guild.channels
                                    .fetch(logsChannelId)
                                    .catch(() => null);
                                if (logsChannel) {
                                    await logsChannel.send({
                                        embeds: [removeAllWarnsEmbed],
                                    });
                                }
                            }

                            await interaction.update({
                                content: `✅ **تـم ازالـة جـمـيـع الـتـحـذيـرات مـن مـتـجـر ${shop}**`,
                                components: [],
                            });
                        }

                        collector.stop();
                    });

                    collector.on("end", async (_, reason) => {
                        if (reason !== "collect") {
                            const disabledButton =
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId("confirm_unwarn_all")
                                        .setLabel("تأكيد حذف التحذيرات")
                                        .setStyle(ButtonStyle.Danger)
                                        .setDisabled(true)
                                        .setEmoji(emojis.delete),
                                );

                            await i.editReply({
                                content:
                                    "❗ هل أنت متأكد من رغبتك بحذف التحذيرات؟",
                                components: [disabledButton],
                            });
                        }
                    });
                }
                break;
            case "order":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }
                    const guildId = i.guild.id;
                    const ordersroomId = await db.get(`orderroom_${guildId}`);
                    const ch = i.guild.channels.cache.get(ordersroomId);
                    const imageUrl = await db.get(`image_${guildId}`);
                    // let Ourderadmins = i.guild.roles.cache.get(config.Ourderadmins)
                    const Ourderadmins = await db.get(`orderad_${guildId}`);
                    const ui = i.options.getUser(`الشخص`);
                    const re = i.options.getString(`الطلب`);
                    const men = i.options.getInteger(`المنشن`);

                    if (!i.member.roles.cache.has(`${Ourderadmins}`)) {
                        return i.reply({
                            content:
                                "** انت لا تمتلك الصلاحيات الكافيه لأستخدام هذا الامر **",
                            ephemeral: true,
                        });
                    }
                    let op;
                    if (men === 0) {
                        op = "everyone";
                    } else if (men === 1) {
                        op = "here";
                    }
                    const embed = {
                        description: `**- الطلـــلـب : ${re}\n\n- صـاحـب الطلـــلـب : <@${ui.id}>**`,
                        image: imageUrl ? { url: imageUrl } : undefined,
                        footer: { text: `By: ${i.user.username}` },
                    };
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket-order")
                            .setLabel("شــراء طــلب")
                            .setEmoji(emojis.order)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId("order-price")
                            .setLabel("اســـعار الـــطلــبات")
                            .setEmoji(emojis.order)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setLabel("صاحب الطــلب")
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://discord.com/users/${ui.id}`)
                            .setEmoji(emojis.user),
                    );
                    await ch.send({
                        content: `@${op}
`,
                        embeds: [embed],
                        components: [row],
                    });

                    i.reply({ content: "** Done ✅ **", ephemeral: true });
                }
                break;
            case "owner": {
                const blacklist = (await db.get("blacklist")) || [];
                if (blacklist.includes(i.user.id)) {
                    return i.reply(
                        "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                    );
                }
                await i.deferReply();
                const interaction = i;
                const shop =
                    interaction.options.getChannel("shop") || i.channel;
                let newOwner = interaction.options.getMember("new-owner");
                const guildId = i.guild.id;
                const { member, guild } = i;
                const admins = await db.get(`shopad_${guildId}`);
                const imageUrl = await db.get(`image_${guildId}`);

                if (!admins) {
                    await i.editReply({
                        content:
                            "يرجى تحديد الادمن عن طريق استخدام الامر الاتي: /setup",
                        ephemeral: true,
                    });
                    return;
                }

                if (!member.roles.cache.has(admins)) {
                    await i.editReply(
                        `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر تـحـتـاج رتـبـه <@&${admins}>`,
                    );
                    return;
                }

                try {
                    const shopData = await db.get(`shop_${shop.id}_${guildId}`);
                    const settings = shopData;
                    if (!settings) {
                        return interaction.editReply({
                            content: "هـذة الـروم لـيـست مـتـجـرا.",
                            ephemeral: true,
                        });
                    }

                    const oldOwnerId = shopData.sellerId;
                    const oldOwner =
                        interaction.guild.members.cache.get(oldOwnerId);
                    if (!newOwner) {
                        return interaction.editReply({
                            content: "المـالـك الجـديـد غـيـر صـحـيـح.",
                            ephemeral: true,
                        });
                    }

                    if (oldOwnerId === newOwner.id) {
                        return interaction.editReply({
                            content: `هـذا الشـخـص : <@${newOwner.id}> هـو مـالـك المـتـجـر بـالفـعـل.`,
                            ephemeral: true,
                        });
                    }

                    // تحديث الأذونات
                    await shop.permissionOverwrites.delete(oldOwnerId);
                    await shop.permissionOverwrites.edit(newOwner, {
                        ViewChannel: true,
                        SendMessages: true,
                        EmbedLinks: true,
                        AddReactions: true,
                        UseExternalEmojis: true,
                        ReadMessageHistory: true,
                        MentionEveryone: true,
                        AttachFiles: true,
                    });

                    // تحديث قاعدة البيانات
                    await db.set(
                        `shop_${shop.id}_${guildId}.sellerId`,
                        newOwner.id,
                    );

                    // إرسال الرد في الرسالة المؤقتة
                    await interaction.editReply({
                        content: `تـم نـقـل مـلـكـيـة المـتـجـر :${shop} الـي : ${newOwner}`,
                    });

                    // إرسال الرسالة في قناة السجلات
                    const channelToSendId = await db.get(`logs_${guildId}`);
                    const channelToSend =
                        await i.guild.channels.fetch(channelToSendId);

                    // إنشاء Embed لتفاصيل نقل الملكية
                    const transferEmbed = new EmbedBuilder()
                        .setTitle("نقل ملكية المتجر")
                        .setDescription(ED.commandsC_002({ shop }))
                        .addFields(
                            {
                                name: "صاحب المتجر القديم",
                                value: oldOwner
                                    ? `<@${oldOwner.id}>`
                                    : "غير محدد",
                                inline: true,
                            },
                            {
                                name: "صاحب المتجر الجديد",
                                value: `<@${newOwner.id}>`,
                                inline: true,
                            },
                            {
                                name: "المسؤول",
                                value: `<@${i.user.id}>`,
                                inline: true,
                            },
                            {
                                name: "تاريخ النقل",
                                value: new Date().toLocaleString(),
                                inline: true,
                            },
                            {
                                name: "اسم المتجر",
                                value: shop.name,
                                inline: true,
                            },
                        );

                    // إرسال الـ Embed في قناة السجلات وفي المتجر
                    await channelToSend.send({ embeds: [transferEmbed] });
                    await shop.send({ embeds: [transferEmbed] });

                    // إرسال رابط الصورة إذا كانت موجودة
                    if (imageUrl) {
                        await shop.send({ content: imageUrl });
                        await channelToSend.send({ content: imageUrl });
                    }

                    const logs = await db.get(`logs_${guildId}`);
                    const logg = guild.channels.cache.get(logs);
                    if (logg) {
                        await logg.send({ embeds: [transferEmbed] });
                    } else {
                        console.log(
                            `i can't fined log channel ${i.guild.name} .`,
                        );
                    }
                } catch (error) {
                    console.error("Error transferring ownership:", error);
                    await interaction.editReply({
                        content: "حـدثـت مـشـكـلـة مـا.",
                        ephemeral: true,
                    });
                }
                break;
            }

            case "mentions":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const guildId = i.guild.id;
                    const data = await db.get(
                        `shop_${i.channel.id}_${guildId}`,
                    );
                    if (!data)
                        return await i.reply({
                            content: `❌ **هذا الروم ليس مسجل كمتجر**`,
                            ephemeral: true,
                        });

                    const imageUrl = await db.get(`image_${guildId}`);

                    const container = new ContainerBuilder()
                        .setAccentColor(0x00ccff) // لون جانبي مثل الإيمبد
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) =>
                                    td.setContent(
                                        `**\`-\`. 𒆜__Everyone__ : ${data.everyoneMentions}**`,
                                    ),
                                )
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId("dashboardshop")
                                        .setLabel("تحكــم بـ المــتجــر")
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) =>
                                    td.setContent(
                                        `**\`-\`. 𒆜__Here__ : ${data.hereMentions}**`,
                                    ),
                                )
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId("tashfeerk")
                                        .setLabel("تشفــير")
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        )
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((td) =>
                                    td.setContent(
                                        `**\`-\`. 𒆜 __Shop mention__ : ${data.shopRoleMentions}**`,
                                    ),
                                )
                                .setButtonAccessory((btn) =>
                                    btn
                                        .setCustomId("mention")
                                        .setLabel("شراء منشات")
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                        );

                    await i.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
                break;

            case "add-tax-channel":
                {
                    const guildId = i.guild.id;
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    const channelId = i.options.get("channel").value;
                    if (!channelId) {
                        return i.reply({
                            content: "** لـم يـتـم ادخـال ايـدي روم . **",
                        });
                    }

                    const channel = i.guild.channels.cache.get(channelId);
                    if (!channel) {
                        return i.reply({
                            content: "** تـم ادخـال ايـدي روم خـاطـئ. **",
                        });
                    }

                    // حفظ روم الضرائب بحيث يكون واحدًا فقط لكل سيرفر
                    await db.set(`tax-channel_${guildId}`, channelId);

                    i.reply({
                        content: `**تـم تعيين الروم : <#${channelId}> كـ روم الضرائب للسيرفر.**`,
                    });
                }
                break;
            case "remove-tax-channel":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }
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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    const taxChannel = await db.get(
                        `tax-channel_${i.guild.id}`,
                    );
                    if (!taxChannel) {
                        return i.reply({
                            content:
                                "** لا يوجد روم ضرائب معين لهذا السيرفر. **",
                        });
                    }

                    // إزالة روم الضرائب
                    await db.delete(`tax-channel_${i.guild.id}`);

                    i.reply({
                        content: `**تـم ازالـة روم الضرائب : <#${taxChannel}> بـ نـجـاح.**`,
                    });
                }
                break;
            case "show-tax-channels":
                {
                    const taxChannel =
                        (await db.get(`tax-channel_${i.guild.id}`)) ||
                        "غير مسجل";
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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(" روم الضرائب")
                        .setDescription(ED.commandsC_003({ taxChannel }))
                        .setColor(_ec.color(i.guild?.id)) // لون مختلف بناءً على الحالة
                        .setTimestamp();

                    await i.reply({ embeds: [embed] }); // إرسال الـ Embed
                }
                break;
            case "add-emoji-channel":
                {
                    const guildId = i.guild.id;
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }
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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    const channelId = i.options.get("channel").value;
                    if (!channelId) {
                        return i.reply({
                            content: "** لـم يـتـم ادخـال ايـدي روم . **",
                        });
                    }

                    const channel = i.guild.channels.cache.get(channelId);
                    if (!channel) {
                        return i.reply({
                            content: "** تـم ادخـال ايـدي روم خـاطـئ. **",
                        });
                    }

                    // حفظ القناة لكل سيرفر فقط
                    const existingChannels = (await db.get(`emoji-channel_${guildId}`)) || [];
                    const channelArray = Array.isArray(existingChannels) ? existingChannels : (existingChannels ? [existingChannels] : []);
                    if (!channelArray.includes(channelId)) channelArray.push(channelId);
                    await db.set(`emoji-channel_${guildId}`, channelArray);

                    i.reply({
                        content: `**تـم تعيين الروم : <#${channelId}> كـ روم الإيموجي للسيرفر.**`,
                    });
                }
                break;
            case "remove-emoji-channel":
                {
                    const guildId = i.guild.id;
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }
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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    const emojiChannel = await db.get(
                        `emoji-channel_${i.guild.id}`,
                    );
                    if (!emojiChannel) {
                        return i.reply({
                            content:
                                "** لا يوجد روم إيموجي معين لهذا السيرفر. **",
                        });
                    }

                    // إزالة روم الإيموجي
                    await db.delete(`emoji-channel_${i.guild.id}`);

                    i.reply({
                        content: `**تـم ازالـة روم الإيموجي : <#${emojiChannel}> بـ نـجـاح.**`,
                    });
                }
                break;
            case "show-emoji-channels":
                {
                    const guildId = i.guild.id;
                    const emojiChannel =
                        (await db.get(`emoji-channel_${i.guild.id}`)) ||
                        "غير مسجل";
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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(" روم الإيموجي")
                        .setDescription(ED.commandsC_004({ emojiChannel }))
                        .setColor(_ec.color(guildId)) // لون مختلف بناءً على الحالة
                        .setTimestamp();

                    await i.reply({ embeds: [embed] }); // إرسال الـ Embed
                }
                break;
            case "add-sticker-channel":
                {
                    const guildId = i.guild.id;
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }
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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    const sticker = i.options.getChannel("channel");

                    const oldSticker = await db.get(`sticker_${guildId}`);

                    if (oldSticker) {
                        if (oldSticker === sticker.id) {
                            i.reply("هذا هو روم لوقات المتاجر بالفعل.");
                        } else {
                            await db.set(`sticker_${guildId}`, sticker.id);
                            i.reply(
                                `تم تحديد ${sticker.name} كروم ستيكر جديد لهذا السيرفر.`,
                            );
                        }
                    } else {
                        await db.set(`sticker_${guildId}`, sticker.id);
                        i.reply(`تم تحديد ${sticker.name} كروم ستيكر.`);
                    }
                }
                break;

            // أمر حذف روم الاستيكر
            case "remove-sticker-channel":
                {
                    const guildId = i.guild.id;
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const oldSticker = await db.get(`sticker_${guildId}`);
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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    if (oldSticker) {
                        await db.delete(`sticker_${guildId}`);
                        i.reply("تم حذف روم الاستيكر بنجاح.");
                    } else {
                        i.reply("لا يوجد روم استيكر محدد لهذا السيرفر.");
                    }
                }
                break;
            case "show-sticker-channels":
                {
                    const blacklist = (await db.get("blacklist")) || [];
                    if (blacklist.includes(i.user.id)) {
                        return i.reply(
                            "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
                        );
                    }

                    const guildId = i.guild.id;
                    const stickerChannelId =
                        (await db.get(`sticker_${guildId}`)) || "غير مسجل";
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
                            ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                        });
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle("روم الاستيكر")
                        .setDescription(ED.commandsC_005({ stickerChannelId }))
                        .setColor(_ec.color(guildId)) // لون مختلف بناءً على الحالة
                        .setTimestamp();

                    await i.reply({ embeds: [embed] }); // إرسال الـ Embed
                }
                break;
        }
    });
};
