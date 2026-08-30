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

module.exports = function registerOrderInteractions(
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
    //////////////////////////////////////////////////////order

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const channel = interaction.channel;

        if (interaction.customId === "order") {
            const ordercat = await db.get(`catbuy_order_${guildId}`);
            if (!ordercat) {
                await interaction.reply({
                    content:
                        "يرجى تحديد كتاغوري الشراء عن طريق استخدام الامر الاتي: /setup",
                    ephemeral: true,
                });
                return;
            }
            const { member } = interaction;
            const admin = await db.get(`orderad_${guildId}`);
            if (!admin) {
                await interaction.reply({
                    content:
                        "يرجى تحديد مسؤول الطلبات عن طريق الامر الاتي : /setup",
                    ephemeral: true,
                });
                return;
            }

            try {
                const orderAdminRoleId = await db.get(`orderad_${guildId}`);
                const orderAdminRole =
                    interaction.guild.roles.cache.get(orderAdminRoleId);

                const orderData = await db.get(
                    `order_ticket_${userId}_${guildId}`,
                );
                if (orderData) {
                    const existingChannel =
                        interaction.guild.channels.cache.get(
                            orderData.channelId,
                        );
                    if (existingChannel) {
                        return interaction.reply({
                            content: `❌ لديك تذكرة مفتوحة بالفعل: <#${existingChannel.id}>`,
                            ephemeral: true,
                        });
                    } else {
                        await db.delete(`order_ticket_${userId}_${guildId}`);
                        await db.delete(`order_credit_${userId}_${guildId}`);
                    }
                }

                const ticketsBuyCategoryId = await db.get(
                    `catbuy_order_${guildId}`,
                );
                await interaction.deferReply({ ephemeral: true });

                const ticketChannel = await interaction.guild.channels.create({
                    name: `order-${interaction.user.tag}`,
                    type: ChannelType.GuildText,
                    parent: ticketsBuyCategoryId,
                    permissionOverwrites: [
                        {
                            id: interaction.user.id,
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
                            id: orderAdminRole.id,
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
                    userId: interaction.member.id,
                    channelId: ticketChannel.id,
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("every-order")
                        .setLabel("مــنـشـن ايـفـري")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.order),
                    new ButtonBuilder()
                        .setCustomId("horder")
                        .setLabel("مـنـشـن هـيـر")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.order),
                    new ButtonBuilder()
                        .setCustomId("orderclose")
                        .setLabel("اغلاق التكت")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis.close),
                );

                // Fetch prices and other data
                const orderEveryPriceCredit = await db.get(
                    `order-evrypri_${guildId}`,
                );
                const orderHerePriceCredit = await db.get(
                    `order-herepri_${guildId}`,
                );
                const bank = await db.get(`bank_${guildId}`);
                const orderImage = await db.get(`buyorderimage_${guildId}`);

                // Send initial message to the ticket channel
                const { EmbedBuilder } = require("discord.js");

                // بناء الإمبد
                const orderEmbed = new EmbedBuilder()
                    .setTitle(`<a:ggeg1_944745994256438:1541881273658773504>  ** تـكـت الطـلـبـات ** `)
                    .setDescription(
                        `# - اسعار الطلبات  ${interaction.guild.name} 

            ### أسـعـار الطـلـبـات 
            ${config.money}  .・ أسـعـار الطــلبـات ・. ${config.money} 
            مـنـشـن ( @everyone ) :
            ${config.probotemoji}・السـعـر  :  ${orderEveryPriceCredit || "غير محدد"}

            مـنـشـن ( @here ) :
            ${config.probotemoji}・السـعـر  : ${orderHerePriceCredit || "غير محدد"} 

            التـحـويـل لـ <@!${bank || "غير محدد"}>`,
                    )
                    .setAuthor({
                        name: `${interaction.guild.name}`,
                        iconURL: interaction.guild.iconURL({ size: 1024 }),
                    })
                    .setFooter({
                        text: interaction.guild?.name || "Server",
                    })
                    .setTimestamp()
                    .setColor(await getColor(guildId, db, config)); // إضافة اللون هنا

                // إضافة الصورة إذا كانت موجودة
                if (orderImage) {
                    orderEmbed.setImage(orderImage);
                }

                // إرسال الإمبد
                await ticketChannel.send({
                    content: `<@${interaction.user.id}> ${orderAdminRole}`,
                    embeds: [orderEmbed],
                    components: [row],
                });

                // Send additional line (if any)
                const line = await db.get(`image_${guildId}`);
                if (line) {
                    await ticketChannel.send(line);
                }

                // Confirm ticket creation to the user
                await interaction.reply({
                    content: `**__ تم انشاء تذكرتك بنجاح : <#${ticketChannel.id}> __**`,
                    ephemeral: true,
                });
            } catch (error) {
                console.error("Error creating order ticket:", error);
                await interaction.reply({
                    content:
                        "❌ حدث خطأ أثناء إنشاء التذكرة. يرجى المحاولة مرة أخرى لاحقًا.",
                    ephemeral: true,
                });
            }
        } else if (interaction.customId === "orderclose") {
            await db.delete(`order_credit_${userId}_${guildId}`);
            await db.delete(`order_ticket_${userId}_${guildId}`);

            const closingEmbed = new EmbedBuilder()
                .setDescription(ED.orderInteractions_001())
                .setColor(_ec.color(guildId));

            await interaction.reply({ embeds: [closingEmbed] });

            setTimeout(async () => {
                await channel.permissionOverwrites.edit(guildId, {
                    ViewChannel: false,
                });
                await channel.permissionOverwrites.edit(userId, {
                    ViewChannel: false,
                });
                const orderAdminRoleId = await db.get(`orderad_${guildId}`);
                const orderAdminRole =
                    interaction.guild.roles.cache.get(orderAdminRoleId);
                if (orderAdminRole) {
                    await channel.permissionOverwrites.edit(orderAdminRole.id, {
                        ViewChannel: true,
                    });
                }

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("reopen")
                        .setLabel("فتح التذكرة")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(emojis.reopen),
                    new ButtonBuilder()
                        .setCustomId("delete")
                        .setLabel("حذف التذكرة")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(emojis.delete),
                );

                const closedEmbed = new EmbedBuilder()
                    .setDescription(ED.orderInteractions_002())
                    .setColor(_ec.color(guildId));

                await interaction.reply({
                    embeds: [closedEmbed],
                    components: [actionRow],
                });
            }, 5000);
        } else if (interaction.customId === "reopen") {
            const orderAdminRoleId = await db.get(`orderad_${guildId}`);
            const orderAdminRole =
                interaction.guild.roles.cache.get(orderAdminRoleId);

            await channel.permissionOverwrites.set([
                {
                    id: guildId,
                    deny: ["ViewChannel"],
                },
                {
                    id: userId,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "EmbedLinks",
                        "AttachFiles",
                    ],
                },
                {
                    id: orderAdminRole.id,
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
                .setDescription(ED.orderInteractions_003())
                .setColor(_ec.color(guildId));

            const newActionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("orderclose")
                    .setLabel("إغلاق التذكرة")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.close),
            );

            await interaction.reply({
                embeds: [reopenedEmbed],
                components: [newActionRow],
            });

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("reopen")
                    .setLabel("فتح التذكرة")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
                    .setEmoji(emojis.reopen),
                new ButtonBuilder()
                    .setCustomId("delete")
                    .setLabel("حذف التذكرة")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
                    .setEmoji(emojis.delete),
            );

            await interaction.message.edit({ components: [disabledRow] });
        } else if (interaction.customId === "delete") {
            await interaction.channel.delete();
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = _ec.gid(interaction); // استخدام دالة gid من ملفك
        const userId = interaction.member.id;

        if (interaction.customId === "order-price") {
            // جلب البيانات من قاعدة البيانات
            const orderEveryPriceCredit = await db.get(
                `order-evrypri_${guildId}`,
            );
            const orderHerePriceCredit = await db.get(
                `order-herepri_${guildId}`,
            );
            const bank = await db.get(`bank_${guildId}`);

            // استخدام صورة أسعار الطلبات المخصصة أو الخط العام
            const imageUrl =
                (await db.get(`priceOrdersImage_${guildId}`)) ||
                (await db.get(`image_${guildId}`));

            // جلب اللون من الكاش الخاص بك
            const color = _ec.color(guildId);

            const { EmbedBuilder } = require("discord.js");

            const order_prices_embed = new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ** أسـعـار الطـلـبـات **`)
                .setDescription(
                    `# - اسعار الطلبات  ${interaction.guild.name} 

    ### أسـعـار الطـلـبـات 
    ${config.money}  .・ أسـعـار الطــلبـات ・. ${config.money} 
    مـنـشـن ( @everyone ) :
    ${config.probotemoji}・السـعـر  :  ${orderEveryPriceCredit || "غير محدد"}

    مـنـشـن ( @here ) :
    ${config.probotemoji}・السـعـر  : ${orderHerePriceCredit || "غير محدد"}

    التـحـويـل لـ <@!${bank || "غير محدد"}>`,
                )
                .setAuthor({
                    name: `${interaction.guild.name}`,
                    iconURL: interaction.guild.iconURL({ size: 1024 }),
                })
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({
                    text: interaction.guild?.name || "Server",
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setTimestamp()
                .setColor(color); // استخدام اللون من ملفك

            // التحقق من وجود الصورة قبل وضعها
            if (imageUrl) {
                order_prices_embed.setImage(imageUrl);
            }

            await interaction.reply({
                embeds: [order_prices_embed],
                ephemeral: true,
            });
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        // جلب البيانات من قاعدة البيانات
        const bank = await db.get(`bank_${guildId}`);
        const ordersroomId = await db.get(`orderroom_${guildId}`);

        if (interaction.customId === "every-order") {
            const evrypri = await db.get(`order-evrypri_${guildId}`);

            if (!evrypri) {
                await interaction.reply({
                    content:
                        "يرجى تحديد سعر منشن الايفري عن طريق استخدام الامر الاتي: /setup-price",
                    ephemeral: true,
                });
                return;
            }

            if (!bank) {
                await interaction.reply({
                    content:
                        "يرجى تحديد البنك عن طريق استخدام الامر الاتي: /setup",
                    ephemeral: true,
                });
                return;
            }

            const data = await db.get(`order_credit_${userId}_${guildId}`);
            if (data) {
                return await interaction.reply({
                    content: `** يـوجد لـديـك عـمـلـيـة شــراء فـ الـوقـت الحـالـي بـ الفـعـل **`,
                    ephemeral: true,
                });
            }
            const orderdatauser = await db.get(
                `order_ticket_${interaction.member.id}_${guildId}.userId`,
            );
            if (orderdatauser !== interaction.user.id) {
                return await interaction.reply({
                    content: `**يمكن ل صاحب التكت فقط استعمال الازرار**`,
                    ephemeral: true,
                });
            }
            try {
                const totalPriceC = Math.floor(evrypri * (20 / 19) + 1);
                const totalPriceRe = Math.ceil(totalPriceC / 5);

                const currencyRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`pay_currency_every_${userId}`)
                        .setPlaceholder("اختر طريقة الدفع")
                        .addOptions([
                            { label: `Re - ${totalPriceRe.toLocaleString()}`, description: "الدفع بالروبوتس", value: "Re", emoji: "💎" },
                            { label: `c - ${totalPriceC.toLocaleString()}`, description: "الدفع بالكاش", value: "c", emoji: "💰" },
                        ]),
                );

                const currencyMsg = await interaction.channel.send({
                    content: `**اختر طريقة الدفع** <@!${userId}>`,
                    components: [currencyRow],
                });

                const currencyFilter = (i) => i.user.id === userId && i.customId === `pay_currency_every_${userId}`;
                const currencyCollector = interaction.channel.createMessageComponentCollector({
                    filter: currencyFilter, max: 1, time: 60000,
                });

                currencyCollector.on("collect", async (i) => {
                    await i.deferUpdate();
                    const chosen = i.values[0];
                    const totalPrice = chosen === "c" ? totalPriceC : totalPriceRe;
                    await currencyMsg.delete().catch(() => {});

                    await interaction.channel.send(`${chosen} <@!${bank}> ${totalPrice}`);
                    await interaction.channel.send(`\`\`\`${chosen} ${bank} ${totalPrice}\`\`\``);
                    await interaction.channel.send(` . \` يرجى التحويل في أسرع وقت ممكن هنا\` <@!${userId}>`);

                    await db.set(`order_credit_${userId}_${guildId}`, userId);

                    const paymentResult = await verifyPayment({
                        channel: interaction.channel, userId,
                        requiredAmount: totalPrice, bankId: bank, timeout: 120000,
                    });

                    if (!paymentResult.success) {
                        await db.delete(`order_credit_${userId}_${guildId}`);
                        await interaction.channel.send({ content: `**انتهى الوقت ولم يتم التحويل.** <@!${userId}>` });
                        return;
                    }

                    const ernsing = Number(totalPrice);
                    await db.add(`ernss_${guildId}.erns`, ernsing);
                    await db.add(`ernsg.ernsg`, ernsing);

                    await interaction.channel.send({ content: `**تم التحقق من التحويل بنجاح. يرجى ارسال طلبك.**` });

                    const orderCollectorFilter = (m) => m.author.id === interaction.user.id;
                    const collectedMessages = await interaction.channel.awaitMessages({
                        filter: orderCollectorFilter, max: 1, time: 300000, errors: ["time"],
                    });

                    if (collectedMessages.size > 0) {
                        const userMessage = collectedMessages.first().content;

                            const confirmRow =
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId("confirm_yes")
                                        .setLabel("نعم")
                                        .setStyle(ButtonStyle.Success)
                                        .setEmoji(emojis.yes),
                                    new ButtonBuilder()
                                        .setCustomId("confirm_no")
                                        .setLabel("لا")
                                        .setStyle(ButtonStyle.Danger)
                                        .setEmoji(emojis.no),
                                );

                            if (userMessage.length > 100) {
                                return await interaction.channel.send({
                                    content: `**طـلـبـك كـبـيـر قلـلـه شـوي**`,
                                    ephemeral: true,
                                });
                            }

                            const linkRegex =
                                /\b((https?:\/\/|www\.)[^\s]+(?:\.[a-z]{2,}|\/[^\s]*)?|https?:\/\/(?:discord\.gg|discord\.com\/invite|discord\.com\/channels\/[0-9]+\/[0-9]+\/[0-9]+))/gi;
                            const mentionRegex = /@(everyone|here)/g;

                            if (linkRegex.test(userMessage)) {
                                return interaction.channel.send({
                                    content: `**⚠️ لا يُسمح بإضافة روابط في الطلبات.**`,
                                });
                            }
                            if (mentionRegex.test(userMessage)) {
                                return interaction.channel.send({
                                    content: `**⚠️ لا يُسمح استخدام @ everyone و @ here في الطلبات.**`,
                                });
                            }
                            const confirmMessage =
                                await interaction.channel.send({
                                    content: `**يرجــى التأكيد, هل تريــد نشر هاذا الــطلب؟**\n${userMessage}`,
                                    components: [confirmRow],
                                });

                            const confirmFilter = (i) => i.user.id === userId;
                            const confirmCollector =
                                confirmMessage.createMessageComponentCollector({
                                    filter: confirmFilter,
                                    time: 60000,
                                });

                            confirmCollector.on("collect", async (i) => {
                                if (i.customId === "confirm_yes") {
                                    const orderdatauser = await db.get(
                                        `order_ticket_${interaction.member.id}_${guildId}.userId`,
                                    );
                                    if (orderdatauser !== interaction.user.id) {
                                        return await interaction.reply({
                                            content: `**يمكن ل صاحب التكت فقط استعمال الازرار**`,
                                            ephemeral: true,
                                        });
                                    }
                                    const embed = {
                                        description: `**- الطلـــب : ${userMessage}\n\n- صـاحـب الطلـــب : <@${userId}>**`,
                                        footer: {
                                            text: `By: ${interaction.user.username}`,
                                        },
                                    };

                                    const row =
                                        new ActionRowBuilder().addComponents(
                                            new ButtonBuilder()
                                                .setCustomId("")
                                                .setLabel("شــراء طــلب")
                                                .setEmoji(emojis.order)
                                                .setStyle(
                                                    ButtonStyle.Secondary,
                                                ),
                                            new ButtonBuilder()
                                                .setCustomId("order-price")
                                                .setLabel(
                                                    "اســـعار الـــطلــبات",
                                                )
                                                .setEmoji(emojis.order)
                                                .setStyle(
                                                    ButtonStyle.Secondary,
                                                ),
                                            new ButtonBuilder()
                                                .setLabel("صاحب الطــلب")
                                                .setStyle(ButtonStyle.Link)
                                                .setURL(
                                                    `https://discord.com/users/${userId}`,
                                                )
                                                .setEmoji(emojis.user),
                                        );

                                    const ordersroom =
                                        interaction.guild.channels.cache.get(
                                            ordersroomId,
                                        );
                                    await ordersroom.send({
                                        content: `**طـلـب جـديـد ${config.orderemoji} @everyone**`,
                                        embeds: [embed],
                                        components: [row],
                                    });

                                    await i.reply({
                                        content: `**تـم نـشـر طـلـبـك بـنـجاح**`,
                                        ephemeral: true,
                                    });

                                    const guildName = interaction.guild.name;
                                    const invoiceEmbed = new EmbedBuilder()
                                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                                        .setDescription(
                                            ED.orderInteractions_004({
                                                bank,
                                                config,
                                                evrypri,
                                                guildName,
                                                interaction,
                                                totalPrice,
                                                userMessage,
                                            }),
                                        )

                                        .setFooter(
                                            D.thanksFooter(interaction.guild),
                                        )
                                        .setThumbnail(
                                            D.thumb(interaction.guild),
                                        )
                                        .setTimestamp();
                                    await interaction.user.send({
                                        embeds: [invoiceEmbed],
                                    });

                                    await interaction.channel.delete();
                                    await db.delete(
                                        `order_credit_${userId}_${guildId}`,
                                    );
                                } else if (i.customId === "confirm_no") {
                                    const orderdatauser = await db.get(
                                        `order_ticket_${interaction.member.id}_${guildId}.userId`,
                                    );
                                    if (orderdatauser !== interaction.user.id) {
                                        return await interaction.reply({
                                            content: `**يمكن ل صاحب التكت فقط استعمال الازرار**`,
                                            ephemeral: true,
                                        });
                                    }
                                    const disabledButton =
                                        new ActionRowBuilder().addComponents(
                                            new ButtonBuilder()
                                                .setCustomId("confirm_yes")
                                                .setLabel("نعم")
                                                .setStyle(ButtonStyle.Success)
                                                .setDisabled(true)
                                                .setEmoji(emojis.yes),
                                            new ButtonBuilder()
                                                .setCustomId("confirm_no")
                                                .setLabel("لا")
                                                .setStyle(ButtonStyle.Danger)
                                                .setDisabled(true)
                                                .setEmoji(emojis.no),
                                        );
                                    // تحديث الرسالة لتعطيل الزر
                                    await i.message.edit({
                                        components: [disabledButton],
                                    });

                                    await i.reply({
                                        content: `**تم إلغاء النشر. يرجى إعادة إرسال الطلب.**`,
                                        ephemeral: true,
                                    });

                                    await interaction.channel.send({
                                        content: `**يرجى إعادة إرسال طلبك من خلال الضغط على الزر مجددًا. عندك دقــيقتين**`,
                                    });

                                    // هنا ننتظر إرسال الطلب الجديد
                                    const newCollector =
                                        interaction.channel.createMessageCollector(
                                            {
                                                filter: (m) =>
                                                    m.author.id === userId,
                                                time: 120000, // 2 دقائق
                                            },
                                        );

                                    newCollector.on("collect", async (msg) => {
                                        const newUserMessage = msg.content;
                                        const linkRegex =
                                            /\b((https?:\/\/|www\.)[^\s]+(?:\.[a-z]{2,}|\/[^\s]*)?|https?:\/\/(?:discord\.gg|discord\.com\/invite|discord\.com\/channels\/[0-9]+\/[0-9]+\/[0-9]+))/gi;
                                        const mentionRegex =
                                            /@(everyone|here)/g;

                                        if (msg.content.length > 100) {
                                            return await i.reply({
                                                content: `**طـلـبـك كـبـيـر قلـلـه شـوي**`,
                                                ephemeral: true,
                                            });
                                        }

                                        if (linkRegex.test(msg.content)) {
                                            return i.reply({
                                                content: `**⚠️ لا يُسمح بإضافة روابط في الطلبات.**`,
                                            });
                                        }
                                        if (mentionRegex.test(msg.content)) {
                                            return i.reply({
                                                content: `**⚠️ لا يُسمح استخدام @ everyone و @ here في الطلبات.**`,
                                            });
                                        }

                                        // نشر الطلب الجديد في روم الطلبات
                                        const ordersroom =
                                            interaction.guild.channels.cache.get(
                                                ordersroomId,
                                            );
                                        const embed = {
                                            description: `**- الطلـــب : ${newUserMessage}\n\n- صـاحـب الطلـــب : <@${userId}>**`,
                                            footer: {
                                                text: `By: ${interaction.user.username}`,
                                            },
                                        };

                                        const row =
                                            new ActionRowBuilder().addComponents(
                                                new ButtonBuilder()
                                                    .setCustomId("order")
                                                    .setLabel("شــراء طــلب")
                                                    .setEmoji(emojis.order)
                                                    .setStyle(
                                                        ButtonStyle.Secondary,
                                                    ),
                                                new ButtonBuilder()
                                                    .setCustomId("order-price")
                                                    .setLabel(
                                                        "اســـعار الـــطلــبات",
                                                    )
                                                    .setEmoji(emojis.order)
                                                    .setStyle(
                                                        ButtonStyle.Secondary,
                                                    ),
                                                new ButtonBuilder()
                                                    .setLabel("صاحب الطــلب")
                                                    .setStyle(ButtonStyle.Link)
                                                    .setURL(
                                                        `https://discord.com/users/${userId}`,
                                                    )
                                                    .setEmoji(emojis.user),
                                            );

                                        await ordersroom.send({
                                            content: `**طـلـب جـديـد ${config.orderemoji} @everyone**`,
                                            embeds: [embed],
                                            components: [row],
                                        });

                                        // إبلاغ المستخدم بنجاح النشر
                                        await interaction.channel.send({
                                            content: `**تم نشر طلبك بنجاح في روم الطلبات.**`,
                                            ephemeral: true,
                                        });
                                        await db.delete(
                                            `order_credit_${userId}_${guildId}`,
                                        );
                                        await interaction.channel.delete();
                                        // إغلاق الكولكليتور الجديد بعد نشر الطلب
                                        newCollector.stop();
                                    });
                                }
                            });
                        }
                    });
            } catch (error) {
                console.error(error);
            }
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        // جلب البيانات من قاعدة البيانات
        const bank = await db.get(`bank_${guildId}`);
        const ordersroomId = await db.get(`orderroom_${guildId}`);

        if (interaction.customId === "horder") {
            const herepris = await db.get(`order-herepri_${guildId}`);

            if (!herepris) {
                await interaction.reply({
                    content:
                        "يرجى تحديد سعر منشن الهير عن طريق استخدام الامر الاتي: /setup-price",
                    ephemeral: true,
                });
                return;
            }

            if (!bank) {
                await interaction.reply({
                    content:
                        "يرجى تحديد البنك عن طريق استخدام الامر الاتي: /setup",
                    ephemeral: true,
                });
                return;
            }

            const data = await db.get(`order_credit_${userId}_${guildId}`);
            if (data) {
                return await interaction.reply({
                    content: `** يـوجد لـديـك عـمـلـيـة شــراء فـ الـوقـت الحـالـي بـ الفـعـل **`,
                    ephemeral: true,
                });
            }
            const orderdatauser = await db.get(
                `order_ticket_${interaction.member.id}_${guildId}.userId`,
            );
            if (orderdatauser !== interaction.user.id) {
                return await interaction.reply({
                    content: `**يمكن ل صاحب التكت فقط استعمال الازرار**`,
                    ephemeral: true,
                });
            }
            try {
                const totalPriceC = Math.floor(herepris * (20 / 19) + 1);
                const totalPriceRe = Math.ceil(totalPriceC / 5);

                const currencyRow2 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`pay_currency_here_${userId}`)
                        .setPlaceholder("اختر طريقة الدفع")
                        .addOptions([
                            { label: `Re - ${totalPriceRe.toLocaleString()}`, description: "الدفع بالروبوتس", value: "Re", emoji: "💎" },
                            { label: `c - ${totalPriceC.toLocaleString()}`, description: "الدفع بالكاش", value: "c", emoji: "💰" },
                        ]),
                );

                const currencyMsg2 = await interaction.channel.send({
                    content: `**اختر طريقة الدفع** <@!${userId}>`,
                    components: [currencyRow2],
                });

                const currencyFilter2 = (i) => i.user.id === userId && i.customId === `pay_currency_here_${userId}`;
                const currencyCollector2 = interaction.channel.createMessageComponentCollector({
                    filter: currencyFilter2, max: 1, time: 60000,
                });

                currencyCollector2.on("collect", async (i) => {
                    await i.deferUpdate();
                    const chosen = i.values[0];
                    const totalPrice = chosen === "c" ? totalPriceC : totalPriceRe;
                    await currencyMsg2.delete().catch(() => {});

                    await interaction.channel.send(`${chosen} <@!${bank}> ${totalPrice}`);
                    await interaction.channel.send(`\`\`\`${chosen} ${bank} ${totalPrice}\`\`\``);
                    await interaction.channel.send(` . \` يرجى التحويل في أسرع وقت ممكن هنا\` <@!${userId}>`);

                    await db.set(`order_credit_${userId}_${guildId}`, userId);

                    const paymentResult2 = await verifyPayment({
                        channel: interaction.channel, userId,
                        requiredAmount: totalPrice, bankId: bank, timeout: 120000,
                    });

                    if (!paymentResult2.success) {
                        await db.delete(`order_credit_${userId}_${guildId}`);
                        await interaction.channel.send({ content: `**انتهى الوقت ولم يتم التحويل.** <@!${userId}>` });
                        return;
                    }

                    const ernsing = Number(totalPrice);
                    await db.add(`ernss_${guildId}.erns`, ernsing);
                    await db.add(`ernsg.ernsg`, ernsing);

                    await interaction.channel.send({ content: `**تم التحقق من التحويل بنجاح. يرجى ارسال طلبك.**` });

                    const orderCollectorFilter2 = (m) => m.author.id === interaction.user.id;
                    const collectedMessages = await interaction.channel.awaitMessages({
                        filter: orderCollectorFilter2, max: 1, time: 300000, errors: ["time"],
                    });

                    if (collectedMessages.size > 0) {
                        const userMessage = collectedMessages.first().content;

                            const confirmRow =
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId("confirm_yes")
                                        .setLabel("نعم")
                                        .setStyle(ButtonStyle.Success)
                                        .setEmoji(emojis.yes),
                                    new ButtonBuilder()
                                        .setCustomId("confirm_no")
                                        .setLabel("لا")
                                        .setStyle(ButtonStyle.Danger)
                                        .setEmoji(emojis.no),
                                );

                            if (userMessage.length > 100) {
                                return await interaction.channel.send({
                                    content: `**طـلـبـك كـبـيـر قلـلـه شـوي**`,
                                    ephemeral: true,
                                });
                            }

                            const linkRegex =
                                /\b((https?:\/\/|www\.)[^\s]+(?:\.[a-z]{2,}|\/[^\s]*)?|https?:\/\/(?:discord\.gg|discord\.com\/invite|discord\.com\/channels\/[0-9]+\/[0-9]+\/[0-9]+))/gi;
                            const mentionRegex = /@(everyone|here)/g;

                            if (linkRegex.test(userMessage)) {
                                return interaction.channel.send({
                                    content: `**⚠️ لا يُسمح بإضافة روابط في الطلبات.**`,
                                });
                            }
                            if (mentionRegex.test(userMessage)) {
                                return interaction.channel.send({
                                    content: `**⚠️ لا يُسمح استخدام @ everyone و @ here في الطلبات.**`,
                                });
                            }
                            const confirmMessage =
                                await interaction.channel.send({
                                    content: `**يرجــى التأكيد, هل تريــد نشر هاذا الــطلب؟**\n${userMessage}`,
                                    components: [confirmRow],
                                });

                            const confirmFilter = (i) => i.user.id === userId;
                            const confirmCollector =
                                confirmMessage.createMessageComponentCollector({
                                    filter: confirmFilter,
                                    time: 60000,
                                });

                            confirmCollector.on("collect", async (i) => {
                                if (i.customId === "confirm_yes") {
                                    const orderdatauser = await db.get(
                                        `order_ticket_${interaction.member.id}_${guildId}.userId`,
                                    );
                                    if (orderdatauser !== interaction.user.id) {
                                        return await interaction.reply({
                                            content: `**يمكن ل صاحب التكت فقط استعمال الازرار**`,
                                            ephemeral: true,
                                        });
                                    }
                                    const embed = {
                                        description: `**- الطلـــب : ${userMessage}\n\n- صـاحـب الطلـــب : <@${userId}>**`,
                                        footer: {
                                            text: `By: ${interaction.user.username}`,
                                        },
                                    };

                                    const row =
                                        new ActionRowBuilder().addComponents(
                                            new ButtonBuilder()
                                                .setCustomId("order")
                                                .setLabel("شــراء طــلب")
                                                .setEmoji(emojis.order)
                                                .setStyle(
                                                    ButtonStyle.Secondary,
                                                ),
                                            new ButtonBuilder()
                                                .setCustomId("order-price")
                                                .setLabel(
                                                    "اســـعار الـــطلــبات",
                                                )
                                                .setEmoji(emojis.order)
                                                .setStyle(
                                                    ButtonStyle.Secondary,
                                                ),
                                            new ButtonBuilder()
                                                .setLabel("صاحب الطــلب")
                                                .setStyle(ButtonStyle.Link)
                                                .setURL(
                                                    `https://discord.com/users/${userId}`,
                                                )
                                                .setEmoji(emojis.user),
                                        );

                                    const ordersroom =
                                        interaction.guild.channels.cache.get(
                                            ordersroomId,
                                        );
                                    await ordersroom.send({
                                        content: `**طـلـب جـديـد ${config.orderemoji} @here**`,
                                        embeds: [embed],
                                        components: [row],
                                    });

                                    await i.reply({
                                        content: `**تـم نـشـر طـلـبـك بـنـجاح**`,
                                        ephemeral: true,
                                    });

                                    await interaction.channel.delete();
                                    await db.delete(`order_credit_${userId}`);
                                } else if (i.customId === "confirm_no") {
                                    const orderdatauser = await db.get(
                                        `order_ticket_${interaction.member.id}_${guildId}.userId`,
                                    );
                                    if (orderdatauser !== interaction.user.id) {
                                        return await interaction.reply({
                                            content: `**يمكن ل صاحب التكت فقط استعمال الازرار**`,
                                            ephemeral: true,
                                        });
                                    }
                                    const disabledButton =
                                        new ActionRowBuilder().addComponents(
                                            new ButtonBuilder()
                                                .setCustomId("confirm_yes")
                                                .setLabel("نعم")
                                                .setStyle(ButtonStyle.Success)
                                                .setDisabled(true)
                                                .setEmoji(emojis.yes),
                                            new ButtonBuilder()
                                                .setCustomId("confirm_no")
                                                .setLabel("لا")
                                                .setStyle(ButtonStyle.Danger)
                                                .setDisabled(true)
                                                .setEmoji(emojis.no),
                                        );
                                    // تحديث الرسالة لتعطيل الزر
                                    await i.message.edit({
                                        components: [disabledButton],
                                    });

                                    await i.reply({
                                        content: `**تم إلغاء النشر. يرجى إعادة إرسال الطلب.**`,
                                        ephemeral: true,
                                    });

                                    await interaction.channel.send({
                                        content: `**يرجى إعادة إرسال طلبك من خلال الضغط على الزر مجددًا. عندك دقــيقتين**`,
                                    });

                                    // هنا ننتظر إرسال الطلب الجديد
                                    const newCollector =
                                        interaction.channel.createMessageCollector(
                                            {
                                                filter: (m) =>
                                                    m.author.id === userId,
                                                time: 120000, // 2 دقائق
                                            },
                                        );

                                    newCollector.on("collect", async (msg) => {
                                        const newUserMessage = msg.content;
                                        const linkRegex =
                                            /\b((https?:\/\/|www\.)[^\s]+(?:\.[a-z]{2,}|\/[^\s]*)?|https?:\/\/(?:discord\.gg|discord\.com\/invite|discord\.com\/channels\/[0-9]+\/[0-9]+\/[0-9]+))/gi;
                                        const mentionRegex =
                                            /@(everyone|here)/g;

                                        if (msg.content.length > 100) {
                                            return await i.reply({
                                                content: `**طـلـبـك كـبـيـر قلـلـه شـوي**`,
                                                ephemeral: true,
                                            });
                                        }

                                        if (linkRegex.test(msg.content)) {
                                            return i.reply({
                                                content: `**⚠️ لا يُسمح بإضافة روابط في الطلبات.**`,
                                            });
                                        }
                                        if (mentionRegex.test(msg.content)) {
                                            return i.reply({
                                                content: `**⚠️ لا يُسمح استخدام @ everyone و @ here في الطلبات.**`,
                                            });
                                        }

                                        // نشر الطلب الجديد في روم الطلبات
                                        const ordersroom =
                                            interaction.guild.channels.cache.get(
                                                ordersroomId,
                                            );
                                        const embed = {
                                            description: `**- الطلـــب : ${newUserMessage}\n\n- صـاحـب الطلـــب : <@${userId}>**`,
                                            footer: {
                                                text: `By: ${interaction.user.username}`,
                                            },
                                        };

                                        const row =
                                            new ActionRowBuilder().addComponents(
                                                new ButtonBuilder()
                                                    .setCustomId("order")
                                                    .setLabel("شــراء طــلب")
                                                    .setEmoji(emojis.order)
                                                    .setStyle(
                                                        ButtonStyle.Secondary,
                                                    ),
                                                new ButtonBuilder()
                                                    .setCustomId("order-price")
                                                    .setLabel(
                                                        "اســـعار الـــطلــبات",
                                                    )
                                                    .setEmoji(emojis.order)
                                                    .setStyle(
                                                        ButtonStyle.Secondary,
                                                    ),
                                                new ButtonBuilder()
                                                    .setLabel("صاحب الطــلب")
                                                    .setStyle(ButtonStyle.Link)
                                                    .setURL(
                                                        `https://discord.com/users/${userId}`,
                                                    )
                                                    .setEmoji(emojis.user),
                                            );

                                        await ordersroom.send({
                                            content: `**طـلـب جـديـد ${config.orderemoji} @here**`,
                                            embeds: [embed],
                                            components: [row],
                                        });

                                        // إبلاغ المستخدم بنجاح النشر
                                        await interaction.channel.send({
                                            content: `**تم نشر طلبك بنجاح في روم الطلبات.**`,
                                            ephemeral: true,
                                        });

                                        const guildName =
                                            interaction.guild.name;
                                        const invoiceEmbed = new EmbedBuilder()
                                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                                            .setDescription(
                                                ED.orderInteractions_005({
                                                    bank,
                                                    config,
                                                    guildName,
                                                    herepris,
                                                    interaction,
                                                    totalPrice,
                                                    userMessage,
                                                }),
                                            )

                                            .setFooter(
                                                D.thanksFooter(
                                                    interaction.guild,
                                                ),
                                            )
                                            .setThumbnail(
                                                D.thumb(interaction.guild),
                                            )
                                            .setTimestamp();
                                        await interaction.user.send({
                                            embeds: [invoiceEmbed],
                                        });

                                        await db.delete(
                                            `order_credit_${userId}`,
                                        );
                                        await interaction.channel.delete();
                                        // إغلاق الكولكليتور الجديد بعد نشر الطلب
                                        newCollector.stop();
                                    });
                                }
                            });
                        } else {
                            await db.delete(
                                `order_credit_${userId}_${guildId}`,
                            );
                            await interaction.channel.send({
                                content: `**انتهى الوقت ولم يتم التحويل.** <@!${userId}>`,
                            });
                            await interaction.channel.delete();
                        }
                    });
            } catch (error) {
                console.error(error);
            }
        }
    });

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return;

        // التحقق من البلاك لست
        const blacklist = (await db.get("blacklist")) || [];
        if (blacklist.includes(message.author.id)) {
            return message.reply(
                "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
            );
        }

        if (!message.guild) return;
        const guildId = message.guild.id;

        const { content } = message;
        const shortcut =
            (await db.get(`shortcut_createshop_${guildId}`)) || "+انشاء-متجر";
        const firstWord = content.trim().split(" ")[0];
        if (firstWord !== shortcut) return;

        const { member } = message;
        const admins = await db.get(`shopad_${guildId}`);
        if (!admins) {
            await message.reply({
                content:
                    "يرجى تحديد الادمن عن طريق استخدام الامر الاتي: /setup",
            });
            return;
        }

        if (!member.roles.cache.has(admins)) {
            await message.reply({
                content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر تـحـتـاج رتـبـه <@&${admins}>`,
                ephemeral: true,
            });
            return;
        }
        // استخراج المستخدم الذي تم منشنه
        const mentionedUser = message.mentions.users.first();
        if (!mentionedUser) {
            return message.reply("❌ **يرجى منشن صاحب المتجر.**");
        }

        // استخراج اسم المتجر بعد المنشن
        const args = message.content.split(" ").slice(2); // بعد "+اضافة-متجر-للداتا @منشن"
        const shopName = args.join(" ");

        if (!shopName) {
            return message.reply("❌ **يرجى إدخال اسم المتجر بعد المنشن.**");
        }

        const sellerId = mentionedUser.id;

        // جلب أنواع المتاجر من السيرفر
        const guild = message.guild;
        const categories = guild.channels.cache.filter(
            (channel) => channel.type === ChannelType.GuildCategory,
        );

        if (!categories.size) {
            return message.reply({
                content: `**لا يوجد كاتيجوري في هذا السيرفر**`,
                ephemeral: true,
            });
        }

        // إنشاء أزرار لأنواع المتاجر
        const buttons = [];
        for (const [categoryId, category] of categories) {
            const categoryDataKey = `categoryMentions_${categoryId}_${guildId}`;
            const categoryData = await db.get(categoryDataKey);

            if (!categoryData) continue;

            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`select_shop_create_${categoryId}`)
                    .setLabel(category.name)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis.selectMenu),
            );
        }

        // تقسيم الأزرار إلى صفحات إذا كان عددها أكثر من 5
        const pages = [];
        for (let i = 0; i < buttons.length; i += 5) {
            pages.push(buttons.slice(i, i + 5));
        }

        let currentPage = 0;

        // إنشاء الرسالة مع الأزرار
        const row = new ActionRowBuilder().addComponents(pages[currentPage]);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> اختر نوع المتجر")
            .setDescription(ED.orderInteractions_006())
            .setFooter({
                text: `الصفحة ${currentPage + 1} من ${pages.length}`,
            });

        const replyMessage = await message.reply({
            embeds: [embed],
            components: [row],
        });

        // إنشاء Collector لجمع التفاعلات
        const filter = (interaction) =>
            interaction.user.id === message.author.id;
        const collector = replyMessage.createMessageComponentCollector({
            filter,
            time: 60000,
        });

        collector.on("collect", async (interaction) => {
            if (interaction.customId.startsWith("select_shop_create_")) {
                if (!member.roles.cache.has(admins)) {
                    await message.reply({
                        content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر تـحـتـاج رتـبـه <@&${admins}>`,
                        ephemeral: true,
                    });
                    return;
                }
                const categoryId = interaction.customId.split("_")[3];

                const categoryData = await db.get(
                    `categoryMentions_${categoryId}_${guildId}`,
                );
                const pirefix = categoryData.pirefix;
                if (!categoryData) {
                    return interaction.reply({
                        content: "❌ **حدث خطأ أثناء جلب بيانات المتجر.**",
                        ephemeral: true,
                    });
                }

                const name = shopName.replaceAll(" ", "・");
                // إنشاء المتجر وإضافته إلى البيانات
                const channel = await guild.channels.create({
                    name: `${pirefix}${name}`,
                    type: ChannelType.GuildText,
                    parent: categoryId,
                    permissionOverwrites: [
                        {
                            id: guild.id,
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
                            id: sellerId,
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
                            id: admins,
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
                const ob = {
                    channelId: channel.id,
                    categoryId: categoryId,
                    sellerId: sellerId,
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
                };

                await db.set(`shop_${channel.id}_${guildId}`, ob);
                await db.set(`shop_${channel.id}_${guildId}.warns`, "0");
                await db.set(`shop_${channel.id}_${guildId}.status`, "1");
                const seller = await guild.members.fetch(sellerId);
                await seller.roles.add(categoryData.shoprole);

                // إرسال رسالة تأكيد
                const em5 = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> **تم انشاء متجر : **")
                    .setDescription(
                        ED.orderInteractions_007({
                            categoryData,
                            channel,
                            config,
                            sellerId,
                        }),
                    )
                    .setAuthor({
                        name: guild.name,
                        iconURL: guild.iconURL({ size: 1024 }),
                    })
                    .setFooter(D.footer(guild))
                    .setThumbnail(D.thumb(guild))
                    .setTimestamp()
                    .setThumbnail(guild.iconURL({ size: 1024 }));

                await channel.send({ embeds: [em5] });
                // تعطيل الأزرار
                const disabledButtons = pages[currentPage].map((button) =>
                    button.setDisabled(true),
                );
                const disabledRow = new ActionRowBuilder().addComponents(
                    disabledButtons,
                );

                // تعديل الرسالة الأصلية لتعطيل الأزرار
                await replyMessage.edit({ components: [disabledRow] });
                collector.stop();
                // إرسال رد التأكيد
                await interaction.reply({
                    content: `**تـم انشاء المـتـجـر بـ نـجـاح** ${channel}`,
                    ephemeral: true,
                });

                const logs = await db.get(`logs_${guildId}`);
                if (logs) {
                    const logg = guild.channels.cache.get(logs);
                    if (logg) {
                        await logg.send({ embeds: [em5] });
                    }
                }
            }
        });

        collector.on("end", async (_, reason) => {
            // تعطيل الأزرار عند انتهاء الوقت
            const disabledButtons = pages[currentPage].map((button) =>
                button.setDisabled(true),
            );
            const disabledRow = new ActionRowBuilder().addComponents(
                disabledButtons,
            );

            await replyMessage.edit({ components: [disabledRow] });

            if (reason === "time") {
                message.reply("❌ **انتهى الوقت لاختيار النوع.**");
            }
        });
    });

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return;

        // التحقق من البلاك لست
        const blacklist = (await db.get("blacklist")) || [];
        if (blacklist.includes(message.author.id)) {
            return message.reply(
                "**أنت في البلاك لست، لمعلومات اكثر تعال سيرفر السبورت!**",
            );
        }
        if (!message.guild) return;
        const guildId = message.guild.id;

        const { content } = message;
        const shortcut =
            (await db.get(`shortcut_addshopdata_${guildId}`)) ||
            "+اضافة-متجر-للداتا";
        const firstWord = content.trim().split(" ")[0];
        if (firstWord !== shortcut) return;

        const { member } = message;
        const admins = await db.get(`shopad_${guildId}`);
        if (!admins) {
            await message.reply({
                content:
                    "يرجى تحديد الادمن عن طريق استخدام الامر الاتي: /setup",
                ephemeral: true,
            });
            return;
        }

        if (!member.roles.cache.has(admins)) {
            await message.reply({
                content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر تـحـتـاج رتـبـه <@&${admins}>`,
                ephemeral: true,
            });
            return;
        }

        // استخراج المستخدم الذي تم منشنه
        const mentionedUser = message.mentions.users.first();
        if (!mentionedUser) {
            return message.reply("❌ **يرجى منشن صاحب المتجر.**");
        }

        const sellerId = mentionedUser.id;

        // جلب أنواع المتاجر من السيرفر
        const guild = message.guild;
        const categories = guild.channels.cache.filter(
            (channel) => channel.type === ChannelType.GuildCategory,
        );

        if (!categories.size) {
            return message.reply({
                content: `**لا يوجد كاتيجوري في هذا السيرفر**`,
                ephemeral: true,
            });
        }

        // إنشاء أزرار لأنواع المتاجر
        const buttons = [];
        for (const [categoryId, category] of categories) {
            const categoryDataKey = `categoryMentions_${categoryId}_${guildId}`;
            const categoryData = await db.get(categoryDataKey);

            if (!categoryData) continue;

            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`select_shoptypedata_${categoryId}`)
                    .setLabel(category.name)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis.selectMenu),
            );
        }

        // تقسيم الأزرار إلى صفحات إذا كان عددها أكثر من 5
        const pages = [];
        for (let i = 0; i < buttons.length; i += 5) {
            pages.push(buttons.slice(i, i + 5));
        }

        let currentPage = 0;

        // إنشاء الرسالة مع الأزرار
        const row = new ActionRowBuilder().addComponents(pages[currentPage]);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> اختر نوع المتجر")
            .setDescription(ED.orderInteractions_008())
            .setFooter({
                text: `الصفحة ${currentPage + 1} من ${pages.length}`,
            });

        const replyMessage = await message.reply({
            embeds: [embed],
            components: [row],
        });

        // إنشاء Collector لجمع التفاعلات
        const filter = (interaction) =>
            interaction.user.id === message.author.id;
        const collector = replyMessage.createMessageComponentCollector({
            filter,
            time: 60000,
        });

        collector.on("collect", async (interaction) => {
            if (interaction.customId.startsWith("select_shoptypedata_")) {
                if (!member.roles.cache.has(admins)) {
                    await message.reply({
                        content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر تـحـتـاج رتـبـه <@&${admins}>`,
                        ephemeral: true,
                    });
                    return;
                }
                const categoryId = interaction.customId.split("_")[2];
                const categoryData = await db.get(
                    `categoryMentions_${categoryId}_${guildId}`,
                );

                if (!categoryData) {
                    return interaction.reply({
                        content: "❌ **حدث خطأ أثناء جلب بيانات المتجر.**",
                        ephemeral: true,
                    });
                }

                const shop = await interaction.channel.edit({
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id, // أذونات للجميع
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
                            id: sellerId, // أذونات للبائع
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
                            id: admins, // أذونات للمشرفين
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
                const ob = {
                    channelId: interaction.channel.id,
                    categoryId: categoryId,
                    sellerId: sellerId,
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
                    pirefix: categoryData.pirefix,
                    shopname: interaction.channel.name,
                };

                await db.set(`shop_${interaction.channel.id}_${guildId}`, ob);
                await db.set(
                    `shop_${interaction.channel.id}_${guildId}.warns`,
                    "0",
                );
                await db.set(
                    `shop_${interaction.channel.id}_${guildId}.status`,
                    "1",
                );
                const seller = await guild.members.fetch(sellerId);
                await seller.roles.add(categoryData.shoprole);

                // إرسال رسالة تأكيد
                const em5 = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> **تم اضافة متجر : **")
                    .setDescription(
                        ED.orderInteractions_009({
                            categoryData,
                            config,
                            interaction,
                            sellerId,
                        }),
                    )
                    .setAuthor({
                        name: guild.name,
                        iconURL: guild.iconURL({ size: 1024 }),
                    })
                    .setFooter(D.footer(guild))
                    .setThumbnail(D.thumb(guild))
                    .setTimestamp()
                    .setThumbnail(guild.iconURL({ size: 1024 }));

                await interaction.channel.send({ embeds: [em5] });
                // تعطيل الأزرار
                const disabledButtons = pages[currentPage].map((button) =>
                    button.setDisabled(true),
                );
                const disabledRow = new ActionRowBuilder().addComponents(
                    disabledButtons,
                );

                // تعديل الرسالة الأصلية لتعطيل الأزرار
                await replyMessage.edit({ components: [disabledRow] });
                collector.stop();
                // إرسال رد التأكيد
                await interaction.reply({
                    content: `**تـم انشاء المـتـجـر بـ نـجـاح** ${interaction.channel}`,
                    ephemeral: true,
                });

                const logs = await db.get(`logs_${guildId}`);
                if (logs) {
                    const logg = guild.channels.cache.get(logs);
                    if (logg) {
                        await logg.send({ embeds: [em5] });
                    }
                }
            }
        });
        collector.on("end", async (_, reason) => {
            // تعطيل الأزرار عند انتهاء الوقت
            const disabledButtons = pages[currentPage].map((button) =>
                button.setDisabled(true),
            );
            const disabledRow = new ActionRowBuilder().addComponents(
                disabledButtons,
            );

            await replyMessage.edit({ components: [disabledRow] });

            if (reason === "time") {
                message.reply("❌ **انتهى الوقت لاختيار النوع.**");
            }
        });
    });

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return; // تجاهل الرسائل المرسلة من البوتات
        if (!message.guild) return;
        const guildId = message.guild.id; // الحصول على معرف السيرفر
        const { member, content, channel } = message; // الحصول على العضو والمحتوى والقناة
        const admins = await db.get(`shopad_${guildId}`); // جلب بيانات الأدمن
        const shortcut = await db.get(
            `shortcut_warning_${guildId}` || "+تحذير",
        );

        if (content.startsWith(shortcut)) {
            const reason = content.slice(shortcut.length).trim(); // استخراج النص بعد الاختصار

            if (!reason) {
                return message.reply(
                    `❌ **يرجى تحديد السبب بعد كلمة ${shortcut}.**`,
                );
            }

            // استخدام القناة الحالية كالمتجر
            const shop = channel;
            const data = await db.get(`shop_${shop.id}_${guildId}`); // جلب بيانات المتجر
            const currentWarns = Number(data?.warns) || 0;

            if (!admins) {
                return message.reply(
                    "يرجى تحديد الأدمن عن طريق استخدام الأمر: /setup",
                );
            }

            if (!member.roles.cache.has(admins)) {
                return message.reply(
                    `ليس لديك صلاحية لاستخدام هذا الأمر. تحتاج رتبة <@&${admins}>`,
                );
            }

            // تحقق من بيانات المتجر
            if (!data) {
                return message.reply("هذه الروم ليس مســجل كـ متجر");
            }

            // تحديث عدد التحذيرات
            const amount = 1;
            let updatedWarns;

            if (currentWarns === 0) {
                await db.set(`shop_${shop.id}_${guildId}.warns`, 1);
                updatedWarns = 1;
            } else {
                updatedWarns = currentWarns + 1;
                await db.set(`shop_${shop.id}_${guildId}.warns`, updatedWarns);

                // إنشاء الإيمبد لإرسال التحذير
                const warningEmbed = new EmbedBuilder()
                    .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> **تم تحذير المتجر ${shop} ${config.whaitshop}**`)
                    .setDescription(ED.orderInteractions_010({ config }))
                    .addFields(
                        {
                            name: `صـاحب الـمـتجــر ${config.whaitshop}`,
                            value: `<@${data.sellerId}>`,
                            inline: true,
                        },
                        {
                            name: `عـدد تـحذيـرات الـمتجـر ${config.whaitshop}`,
                            value: `${updatedWarns}`,
                            inline: true,
                        },
                        {
                            name: `سـبب تحـذير الــمتجر ${config.whaitshop}`,
                            value: `${reason}`,
                            inline: true,
                        },
                        {
                            name: `المــسؤول ${config.whaitshop}`,
                            value: `<@${member.id}>`,
                            inline: true,
                        },
                    )
                    .setTimestamp();

                // إرسال الإيمبد في القناة المتجر
                await shop.send({ embeds: [warningEmbed] });

                // إرسال الإيمبد في السجلات إذا كانت موجودة
                const logsChannelId = await db.get(`logs_${guildId}`);
                if (logsChannelId) {
                    const logsChannel = await message.guild.channels
                        .fetch(logsChannelId)
                        .catch(() => null);
                    if (logsChannel) {
                        await logsChannel.send({ embeds: [warningEmbed] });
                    }
                }

                // الرد على المستخدم
                await message.reply({
                    content: `✅ **تم إضافة ${amount} تحذير للمتجر ${shop}\nعدد التحذيرات الآن: ${updatedWarns}\nسبب التحذير: ${reason}**`,
                });
            }
        }
    });
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return; // تجاهل الرسائل المرسلة من البوتات

        if (!message.guild) return;
        const guildId = message.guild.id;
        const { member, content, channel, guild } = message;

        // جلب بيانات الأدمن واختصار الحذف
        const admins = await db.get(`shopad_${guildId}`);
        const shortcut = (await db.get(`shortcut_delete_${guildId}`)) || "+حذف";

        // تعديل الشرط للتحقق من الاختصار متبوعًا بمسافة
        if (content.startsWith(shortcut + " ") || content === shortcut) {
            let reason;
            if (content === shortcut) {
                reason = ""; // إذا كانت الرسالة فقط الاختصار بدون سبب
            } else {
                reason = content.slice(shortcut.length + 1).trim(); // استخراج السبب بعد المسافة
            }

            if (!reason) {
                return message.reply(
                    `❌ **يرجى تحديد السبب بعد كلمة ${shortcut}.**`,
                );
            }

            // تحقق من صلاحيات المستخدم
            if (!admins) {
                return message.reply(
                    "❌ يرجى تحديد الأدمن عن طريق استخدام الأمر: /setup",
                );
            }

            if (!member.roles.cache.has(admins)) {
                return message.reply(
                    `❌ ليس لديك صلاحية لاستخدام هذا الأمر. تحتاج رتبة <@&${admins}>.`,
                );
            }

            // جلب بيانات المتجر من القناة الحالية
            const shopData = await db.get(`shop_${channel.id}_${guildId}`);
            if (!shopData) {
                return message.reply("❌ هذه القناة ليست مسجلة كمتجر.");
            }

            const shopChannel = channel; // القناة الحالية
            const logChannelId = await db.get(`logs_${guildId}`);
            const logChannel = logChannelId
                ? guild.channels.cache.get(logChannelId)
                : null;
            const imageUrl = (await db.get(`image_${guildId}`)) || null;

            // إنشاء رسالة التنبيه
            const deletedShopEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف متجرك")
                .setDescription(ED.orderInteractions_011({ shopChannel }))
                .addFields(
                    {
                        name: `${config.whaitshop} **المتجر**`,
                        value: shopChannel.name,
                        inline: true,
                    },
                    {
                        name: `${config.whaitshop} **صاحب المتجر**`,
                        value: `<@${shopData.sellerId}>`,
                        inline: true,
                    },
                    {
                        name: `${config.whaitshop} **المسؤول**`,
                        value: `<@${member.id}>`,
                        inline: true,
                    },
                    { name: "السبب", value: reason, inline: true },
                )
                .setImage(imageUrl || config.line)
                .setFooter(D.footer(guild))
                .setThumbnail(D.thumb(guild))
                .setTimestamp();

            const deletedShopEmbedlogs = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف متجر")
                .setDescription(ED.orderInteractions_012({ shopChannel }))
                .addFields(
                    {
                        name: `${config.whaitshop} **المتجر**`,
                        value: shopChannel.name,
                        inline: true,
                    },
                    {
                        name: `${config.whaitshop}**صاحب المتجر**`,
                        value: `<@${shopData.sellerId}>`,
                        inline: true,
                    },
                    {
                        name: `${config.whaitshop} **المسؤول**`,
                        value: `<@${member.id}>`,
                        inline: true,
                    },
                    { name: "السبب", value: reason, inline: true },
                )
                .setImage(imageUrl || config.line)
                .setFooter(D.footer(guild))
                .setThumbnail(D.thumb(guild))
                .setTimestamp();

            // إرسال إشعار للبائع
            try {
                const seller = await client.users.fetch(shopData.sellerId);
                const dmChannel = await seller.createDM();
                await dmChannel.send({ embeds: [deletedShopEmbed] });
            } catch (error) {
                console.error(
                    `⚠️ Failed to notify the seller: ${error.message}`,
                );
            }

            // إرسال السجل إلى قناة السجلات
            if (logChannel) {
                await logChannel.send({ embeds: [deletedShopEmbedlogs] });
            }

            // حذف بيانات المتجر من قاعدة البيانات
            await db.delete(`shop_${channel.id}_${guildId}`);

            // حذف القناة
            try {
                await shopChannel.delete();
            } catch (error) {
                console.error(
                    `⚠️ Failed to delete the shop channel: ${error.message}`,
                );
            }

            // إزالة دور البائع إذا كان موجودًا
            if (shopData.shoprole) {
                try {
                    const sellerMember = await guild.members.fetch(
                        shopData.sellerId,
                    );
                    await sellerMember.roles.remove(shopData.shoprole);
                } catch (error) {
                    console.error(
                        `⚠️ Failed to remove the role from the seller: ${error.message}`,
                    );
                }
            }

            //    message.reply('✅ **تم حذف المتجر بنجاح!**');
        }
    });

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return; // تجاهل الرسائل المرسلة من البوتات

        if (!message.guild) return;
        const guildId = message.guild.id;
        const { content } = message;

        const shortcut =
            (await db.get(`shortcut_setshopowner_${guildId}`)) ||
            "+تحديد-صاحب-المتجر";

        // التحقق من أن الرسالة تبدأ بالاختصار متبوعًا بمسافة أو أنها الاختصار فقط
        if (!(content.startsWith(shortcut + " ") || content === shortcut))
            return;

        // استخراج الجزء المتبقي من الرسالة (بعد الاختصار والمسافة)
        const args = content.slice(shortcut.length).trim();

        // استخراج المستخدم الذي تم منشنه
        const mention = message.mentions.members.first();
        if (!mention) {
            await message.reply(
                "❌ يرجى منشن المستخدم لتحديده كصاحب جديد للمتجر.",
            );
            return;
        }

        const newOwner = mention;
        const shopId = message.channel.id; // افترض أن المتجر هو القناة الحالية

        try {
            // التأكد أن القناة هي متجر
            const shopData = await db.get(`shop_${shopId}_${guildId}`);
            if (!shopData) {
                await message.reply("❌ هـذة الـقـنـاة لـيـست مـتـجـرًا.");
                return;
            }

            // تحديث الأذونات للمالك الجديد
            await message.channel.permissionOverwrites.edit(newOwner.id, {
                ViewChannel: true,
                SendMessages: true,
                EmbedLinks: true,
                MentionEveryone: true,
                AttachFiles: true,
            });

            // تحديث قاعدة البيانات مباشرة
            await db.set(`shop_${shopId}_${guildId}.sellerId`, newOwner.id);

            // إرسال تأكيد للمستخدم
            await message.reply(
                `✅ تـم تـحـديـد صـاحـب الـمـتـجـر إلـى: <@${newOwner.id}>.`,
            );

            // إرسال رسالة إلى قناة السجلات
            const logsChannelId = await db.get(`logs_${guildId}`);
            const logsChannel = message.guild.channels.cache.get(logsChannelId);

            if (logsChannel) {
                const transferEmbed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تحديد صاحب المتجر")
                    .setDescription(ED.orderInteractions_013())
                    .addFields(
                        {
                            name: "صاحب المتجر الجديد",
                            value: `<@${newOwner.id}>`,
                            inline: true,
                        },
                        {
                            name: "المسؤول",
                            value: `<@${message.author.id}>`,
                            inline: true,
                        },
                        {
                            name: "تاريخ التحديد",
                            value: new Date().toLocaleString(),
                            inline: true,
                        },
                        {
                            name: "اسم المتجر",
                            value: message.channel.name,
                            inline: true,
                        },
                    );

                await logsChannel.send({ embeds: [transferEmbed] });
            }
        } catch (error) {
            console.error("Error setting shop owner:", error);
            await message.reply(
                "❌ حـدثـت مـشـكـلـة مـا أثـنـاء تـحـديـد صـاحـب الـمـتـجـر.",
            );
        }
    });

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return; // تجاهل الرسائل المرسلة من البوتات

        if (!message.guild) return;
        const guildId = message.guild.id;
        const channelId = message.channel.id;
        const { member, content } = message;

        const shortcut =
            (await db.get(`shortcut_addmentions_${guildId}`)) ||
            "+اضافة-منشنات";
        const shortcutRegex = new RegExp(`/^\s${shortcut}\s/`);
        if (!shortcutRegex.test(content)) return;

        // استخراج العدد من الرسالة حتى لو كان هناك مسافات كثيرة
        const countMatch = content.replace(shortcut, "").trim();
        const count = parseInt(countMatch, 10);

        if (isNaN(count) || count <= 0) {
            return message.reply("❌ **يرجى تحديد العدد بعد استخدام الأمر!**");
        }

        if (count > 999) {
            return message.reply(
                "❌ **لا يمكنك إضافة أكثر من 999 منشن دفعة واحدة!**",
            );
        }

        const admins = await db.get(`shopad_${guildId}`);

        if (!admins) {
            return message.reply(
                "❌ **يرجى تحديد الأدمن عن طريق استخدام الأمر: /setup**",
            );
        }

        if (!member.roles.cache.has(admins)) {
            return message.reply(
                `❌ **ليس لديك صلاحية لإستخدام هذا الأمر. تحتاج رتبة <@&${admins}>**`,
            );
        }

        const data = await db.get(`shop_${channelId}_${guildId}`);

        if (!data) {
            return message.reply("❌ **لا يمكنني العثور على هذا المتجر!**");
        }

        // إرسال الأزرار
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("add-everyone")
                .setLabel("Everyone")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.mention),

            new ButtonBuilder()
                .setCustomId("add-here")
                .setLabel("Here")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.mention),

            new ButtonBuilder()
                .setCustomId("add-shop")
                .setLabel("Shop Role")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.shop),
        );

        const msg = await message.reply({
            content: "❓ **اختر نوع المنشن الذي تريد إضافته:**",
            components: [row],
        });

        // انتظار تفاعل المستخدم
        const filter = (i) => i.user.id === message.author.id;
        const collector = msg.createMessageComponentCollector({
            filter,
            time: 30000,
        });

        collector.on("collect", async (interaction) => {
            const mentionStyle = interaction.customId;

            if (mentionStyle === "add-everyone") {
                await db.add(
                    `shop_${channelId}_${guildId}.everyoneMentions`,
                    count,
                );
            } else if (mentionStyle === "add-here") {
                await db.add(
                    `shop_${channelId}_${guildId}.hereMentions`,
                    count,
                );
            } else if (mentionStyle === "add-shop") {
                await db.add(
                    `shop_${channelId}_${guildId}.shopRoleMentions`,
                    count,
                );
            }

            // تعطيل الأزرار
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("add-everyone")
                    .setLabel("Everyone")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji(emojis.mention),

                new ButtonBuilder()
                    .setCustomId("add-here")
                    .setLabel("Here")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji(emojis.mention),

                new ButtonBuilder()
                    .setCustomId("add-shop")
                    .setLabel("Shop Role")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji(emojis.shop),
            );

            await interaction.update({
                content: `✅ **تمت إضافة ${count} منشنات بنجاح لنوع ${mentionStyle}.**`,
                components: [disabledRow],
            });

            collector.stop();
        });

        collector.on("end", (_, reason) => {
            if (reason === "time") {
                msg.edit({
                    content: "⏳ **انتهى وقت الاختيار.**",
                    components: [],
                });
            }
        });
    });

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return; // تجاهل الرسائل المرسلة من البوتات

        if (!message.guild) return;
        const guildId = message.guild.id;
        const channelId = message.channel.id;
        const { member, content } = message;

        const shortcut =
            (await db.get(`shortcut_setmentions_${guildId}`)) ||
            "+تحديد-المنشنات";
        const shortcutRegex = new RegExp(`/^\s${shortcut}\s/`);
        if (!shortcutRegex.test(content)) return;

        // استخراج العدد من الرسالة حتى لو كان هناك مسافات كثيرة
        const countMatch = content.replace(shortcut, "").trim();
        const count = parseInt(countMatch, 10);

        if (isNaN(count) || count <= 0) {
            return message.reply("❌ **يرجى تحديد العدد بعد استخدام الأمر!**");
        }

        if (count > 999) {
            return message.reply(
                "❌ **لا يمكنك تحديد أكثر من 999 منشن دفعة واحدة!**",
            );
        }

        const admins = await db.get(`shopad_${guildId}`);

        if (!admins) {
            return message.reply(
                "❌ **يرجى تحديد الأدمن عن طريق استخدام الأمر: /setup**",
            );
        }

        if (!member.roles.cache.has(admins)) {
            return message.reply(
                `❌ **ليس لديك صلاحية لإستخدام هذا الأمر. تحتاج رتبة <@&${admins}>**`,
            );
        }

        const data = await db.get(`shop_${channelId}_${guildId}`);

        if (!data) {
            return message.reply("❌ **لا يمكنني العثور على هذا المتجر!**");
        }

        // إرسال الأزرار
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("set-everyone")
                .setLabel("Everyone")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.mention),

            new ButtonBuilder()
                .setCustomId("set-here")
                .setLabel("Here")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.mention),

            new ButtonBuilder()
                .setCustomId("set-shop")
                .setLabel("Shop Role")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.shop),
        );

        const msg = await message.reply({
            content: "❓ **اختر نوع المنشن الذي تريد إضافته:**",
            components: [row],
        });

        // انتظار تفاعل المستخدم
        const filter = (i) => i.user.id === message.author.id;
        const collector = msg.createMessageComponentCollector({
            filter,
            time: 30000,
        });

        collector.on("collect", async (interaction) => {
            const mentionStyle = interaction.customId;

            if (mentionStyle === "set-everyone") {
                await db.set(
                    `shop_${channelId}_${guildId}.everyoneMentions`,
                    count,
                );
            } else if (mentionStyle === "set-here") {
                await db.set(
                    `shop_${channelId}_${guildId}.hereMentions`,
                    count,
                );
            } else if (mentionStyle === "set-shop") {
                await db.set(
                    `shop_${channelId}_${guildId}.shopRoleMentions`,
                    count,
                );
            }

            // تعطيل الأزرار
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("set-everyone")
                    .setLabel("Everyone")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji(emojis.mention),

                new ButtonBuilder()
                    .setCustomId("set-here")
                    .setLabel("Here")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji(emojis.mention),

                new ButtonBuilder()
                    .setCustomId("set-shop")
                    .setLabel("Shop Role")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji(emojis.shop),
            );

            await interaction.update({
                content: `✅ **بنجاح تم تحديد ${count} منشنات بنجاح لنوع ${mentionStyle}.**`,
                components: [disabledRow],
            });

            collector.stop();
        });

        collector.on("end", (_, reason) => {
            if (reason === "time") {
                msg.edit({
                    content: "⏳ **انتهى وقت الاختيار.**",
                    components: [],
                });
            }
        });
    });
    client.on("messageCreate", async (m) => {
        if (!m.guild || m.author.bot) return;

        const guildId = _ec.gid(m);
        const shortcut =
            (await db.get(`shortcut_mention_${guildId}`)) || "منشن";

        if (m.content === shortcut) {
            try {
                const data = await db.get(`shop_${m.channel.id}_${guildId}`);

                if (!data) {
                    const replyMessage = await m.reply({
                        content: `❌ **هذا الروم ليس مسجل كمتجر**`,
                    });
                    setTimeout(
                        () => replyMessage.delete().catch(() => {}),
                        5000,
                    );
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

                // جلب الخط لاستخدامه مرتين
                const line = await db.get(`image_${guildId}`);

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
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> المنشنات")
                    .setColor(_ec.color(guildId))
                    .setDescription(ED.orderInteractions_014({ data }))
                    .setTimestamp();

                // 1. وضع الخط داخل الإمبد (إذا وجد)
                if (line) {
                    evay.setImage(line);
                }

                // الرد بالإمبد
                await m.reply({ embeds: [evay], components: [row7] });

                // 2. إرسال الخط كرسالة منفصلة بعد الرد (إذا وجد)
                if (line) {
                    await m.channel.send({ content: line });
                }
            } catch (error) {
                console.error(error);
                m.reply({
                    content: "❌ **حدث خطأ أثناء تنفيذ الأمر.**",
                    ephemeral: true,
                });
            }
        }
    });

    client.on("messageCreate", async (message) => {
        // تجاهل البوتات والرسائل الخاصة
        if (!message.guild || message.author.bot) return;

        // تصحيح: استخدام message بدلاً من interaction
        const guildId = _ec.gid(message);

        // جلب بيانات المتجر لهذا الروم
        const shopData = await db.get(`shop_${message.channel.id}_${guildId}`);

        // إذا كان الروم مسجل كمتجر
        if (shopData) {
            const hasEveryone = message.content.includes("@everyone");
            const hasHere = message.content.includes("@here");
            const shopRole = shopData.shoprole; // الأيدي الخاص برتبة المتجر

            // التحقق إذا كان المنشور يحتوي على منشن الرتبة
            const hasShopMention =
                shopRole && message.content.includes(shopRole);

            // إذا وجد أي نوع من المنشنات
            if (hasEveryone || hasHere || hasShopMention) {
                try {
                    // جلب رابط الخط
                    const line = await db.get(`image_${guildId}`);

                    if (line) {
                        // إرسال الخط
                        await message.channel.send({ content: line });
                    }
                } catch (error) {
                    console.error("Error sending auto-line:", error);
                }
            }
        }
    });

    client.on("messageCreate", async (message) => {
        if (!message.guild) return;
        const guildId = message.guild.id;
        const shortcut = (await db.get(`shortcut_ping_${guildId}`)) || "!ping";
        if (message.content === shortcut) {
            // if (message.content === "!ping") {
            if (message.author.bot) return;
            if (!message.guild) return;

            // Calculate Uptime
            let days = Math.floor(client.uptime / 86400000);
            let hours = Math.floor(client.uptime / 3600000) % 24;
            let minutes = Math.floor(client.uptime / 60000) % 60;
            let seconds = Math.floor(client.uptime / 1000) % 60;
            const uptimeString = `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`;

            // Send initial message
            const sent = await message.channel.send(
                "⏳ **Measuring performance...**",
            );
            const ping = Date.now() - message.createdTimestamp;
            const apiPing = Math.round(message.client.ws.ping);

            // Determine color and emoji
            let color;
            let emoji;
            if (ping < 300) {
                color = 0x00ff00; // Green
                emoji = "🟢";
            } else if (ping < 400) {
                color = 0xffff00; // Yellow
                emoji = "🟡";
            } else {
                color = 0xff0000; // Red
                emoji = "🔴";
            }

            // Create embed
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
                    { name: "**Uptime**", value: `**${uptimeString}**` },
                )
                .setColor(_ec.color(guildId))
                .setTimestamp()
                .setFooter({
                    text: `Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL(),
                });

            // Create button
            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("انضم لـسيرفر السبورت")
                        .setStyle(ButtonStyle.Link)
                        .setURL("https://discord.gg/UwTqRcK73d")
                        .setEmoji(emojis.supportServer),
                )
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("ضيف البوت")
                        .setStyle(ButtonStyle.Link)
                        .setURL(
                            `https://discord.com/oauth2/authorize?client_id=${message.client.id}`,
                        )
                        .setEmoji(emojis.addBot),
                );

            // Edit initial message with embed and button
            sent.edit({ content: null, embeds: [embed], components: [button] });
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand()) return;

        const { commandName, options, guildId } = interaction;

        if (commandName === "اختصارت") {
            const { member } = interaction;
            const highstaff = await db.get(`highstaff_${guildId}`);
            if (!highstaff) {
                await interaction.reply({
                    content:
                        "يرجى تحديد رتبة العليا (highstaff) عن طريق استخدام الامر الاتي: /setup",
                    ephemeral: true,
                });
                return;
            }

            if (!member.roles.cache.has(highstaff)) {
                await interaction.reply({
                    content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
                    ephemeral: true, // إذا أردت أن تكون الرسالة مرئية فقط للعضو
                });
                return;
            }

            // استخراج الخيارات
            const mentionShortcut = options.getString("اختصار-المنشنات");
            const warningShortcut = options.getString("اختصار-تحذير");
            const deleteShortcut = options.getString("اختصار-حذف");
            const taxShortcut = options.getString("اختصار-ضريبه");
            const callShortcut = options.getString("اختصار-نداء");
            const pingShortcut = options.getString("اختصار-امر-بنق");
            const createShopShortcut = options.getString("اختصار-انشاء-متجر");
            const addShopToDataShortcut =
                options.getString("اختصار-اضافة-متجر");
            const setShopOwnerShortcut = options.getString(
                "اختصار-تحديد-صاحب-المتجر",
            );
            const setMentionsShortcut = options.getString(
                "اختصار-تحديد-المنشنات",
            );
            const addMentionsShortcut = options.getString(
                "اختصار-اضافة-منشنات",
            );

            if (
                mentionShortcut ||
                warningShortcut ||
                deleteShortcut ||
                taxShortcut ||
                callShortcut ||
                pingShortcut ||
                createShopShortcut ||
                addShopToDataShortcut ||
                setShopOwnerShortcut ||
                setMentionsShortcut ||
                addMentionsShortcut
            ) {
                // حفظ الاختصارات في قاعدة البيانات
                if (mentionShortcut)
                    await db.set(
                        `shortcut_mention_${guildId}`,
                        mentionShortcut,
                    );
                if (warningShortcut)
                    await db.set(
                        `shortcut_warning_${guildId}`,
                        warningShortcut,
                    );
                if (deleteShortcut)
                    await db.set(`shortcut_delete_${guildId}`, deleteShortcut);
                if (taxShortcut)
                    await db.set(`shortcut_tax_${guildId}`, taxShortcut);
                if (callShortcut)
                    await db.set(`shortcut_call_${guildId}`, callShortcut);
                if (pingShortcut)
                    await db.set(`shortcut_ping_${guildId}`, pingShortcut);
                if (createShopShortcut)
                    await db.set(
                        `shortcut_createshop_${guildId}`,
                        createShopShortcut,
                    );
                if (addShopToDataShortcut)
                    await db.set(
                        `shortcut_addshopdata_${guildId}`,
                        addShopToDataShortcut,
                    );
                if (setShopOwnerShortcut)
                    await db.set(
                        `shortcut_setshopowner_${guildId}`,
                        setShopOwnerShortcut,
                    );
                if (setMentionsShortcut)
                    await db.set(
                        `shortcut_setmentions_${guildId}`,
                        setMentionsShortcut,
                    );
                if (addMentionsShortcut)
                    await db.set(
                        `shortcut_addmentions_${guildId}`,
                        addMentionsShortcut,
                    );
                const savedMention = await db.get(
                    `shortcut_mention_${guildId}`,
                );
                const savedWarning = await db.get(
                    `shortcut_warning_${guildId}`,
                );
                const savedDelete = await db.get(`shortcut_delete_${guildId}`);
                const savedTax = await db.get(`shortcut_tax_${guildId}`);
                const savedCall = await db.get(`shortcut_call_${guildId}`);
                const savedPing = await db.get(`shortcut_ping_${guildId}`);
                const savedCreateShop = await db.get(
                    `shortcut_createshop_${guildId}`,
                );
                const savedAddShopToData = await db.get(
                    `shortcut_addshopdata_${guildId}`,
                );
                const savedSetShopOwner = await db.get(
                    `shortcut_setshopowner_${guildId}`,
                );
                const savedSetMentions = await db.get(
                    `shortcut_setmentions_${guildId}`,
                );
                const savedAddMentions = await db.get(
                    `shortcut_addmentions_${guildId}`,
                );

                // إنشاء Embed لتأكيد الحفظ
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حفظ الاختصارات بنجاح")
                    .setColor(_ec.color(interaction.guild?.id))
                    .addFields(
                        {
                            name: "اختصار المنشنات",
                            value: `\`${savedMention || "+منشنات"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار التحذير",
                            value: `\`${savedWarning || "+تحذير"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار الحذف",
                            value: `\`${savedDelete || "+حذف"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار الضريبة",
                            value: `\`${savedTax || "+tax"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار النداء",
                            value: `\`${savedCall || "+come"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار امر بنق",
                            value: `\`${savedPing || "!ping"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار انشاء متجر",
                            value: `\`${createShopShortcut || "+انشاء-متجر"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار اضافة متجر للداتا",
                            value: `\`${savedAddShopToData || "+اضافة-متجر-للداتا"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار تحديد صاحب المتجر",
                            value: `\`${savedSetShopOwner || "+تحديد-صاحب-المتجر"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار تحديد المنشنات",
                            value: `\`${savedSetMentions || "+تحديد-المنشنات"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار اضافة منشنات",
                            value: `\`${savedAddMentions || "+اضافة-منشنات"}\``,
                            inline: true,
                        },
                    );

                await interaction.reply({ embeds: [embed] });
            } else {
                // استرجاع الاختصارات المحفوظة
                const savedMention =
                    (await db.get(`shortcut_mention_${guildId}`)) || "+منشنات";
                const savedWarning = await db.get(
                    `shortcut_warning_${guildId}`,
                );
                const savedDelete = await db.get(`shortcut_delete_${guildId}`);
                const savedTax = await db.get(`shortcut_tax_${guildId}`);
                const savedCall = await db.get(`shortcut_call_${guildId}`);
                const savedPing = await db.get(`shortcut_ping_${guildId}`);
                const savedCreateShop = await db.get(
                    `shortcut_createshop_${guildId}`,
                );
                const savedAddShopToData = await db.get(
                    `shortcut_addshopdata_${guildId}`,
                );
                const savedSetShopOwner = await db.get(
                    `shortcut_setshopowner_${guildId}`,
                );
                const savedSetMentions = await db.get(
                    `shortcut_setmentions_${guildId}`,
                );
                const savedAddMentions = await db.get(
                    `shortcut_addmentions_${guildId}`,
                );

                // إنشاء Embed لعرض الاختصارات المحفوظة
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> الاختصارات المحفوظة")
                    .setColor(_ec.color(interaction.guild?.id))
                    .addFields(
                        {
                            name: "اختصار المنشنات",
                            value: `\`${savedMention}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار التحذير",
                            value: `\`${savedWarning || "+تحذير"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار الحذف",
                            value: `\`${savedDelete || "+حذف"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار الضريبة",
                            value: `\`${savedTax || "+tax"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار النداء",
                            value: `\`${savedCall || "+come"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار امر بنق",
                            value: `\`${savedPing || "!ping"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار انشاء متجر",
                            value: `\`${savedCreateShop || "+انشاء-متجر"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار اضافة متجر للداتا",
                            value: `\`${savedAddShopToData || "+اضافة-متجر-للداتا"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار تحديد صاحب المتجر",
                            value: `\`${savedSetShopOwner || "+تحديد-صاحب-المتجر"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار تحديد المنشنات",
                            value: `\`${savedSetMentions || "+تحديد-المنشنات"}\``,
                            inline: true,
                        },
                        {
                            name: "اختصار اضافة منشنات",
                            value: `\`${savedAddMentions || "+اضافة-منشنات"}\``,
                            inline: true,
                        },
                    )
                    .setFooter({
                        text: interaction.guild.name,
                        iconURL: interaction.guild.iconURL(),
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }
        }
    });

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;

        if (message.content === "+help") {
            try {
                // Embed Message
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> **قائمة المساعدة**")
                    .setDescription(ED.orderInteractions_015())
                    .setThumbnail(
                        client.user.displayAvatarURL({ dynamic: true }),
                    )
                    .setImage(
                        "https://ibb.co/twQS4tX4",
                    ); // ضع رابط الصورة الرئيسية هنا

                // Buttons Row
                const buttonsRow1 = new ActionRowBuilder().addComponents(
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
                    //   new ButtonBuilder()
                    //   .setLabel('اوامر العامه')
                    // .setStyle(ButtonStyle.Secondary)
                    //.setCustomId('generalCommands')
                );

                const buttonsRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("سيرفر السبورت")
                        .setStyle(ButtonStyle.Link)
                        .setURL("https://discord.gg/UwTqRcK73d")
                        .setEmoji(emojis.supportServer),
                );

                // Select Menu
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("helpMenu")
                    .setPlaceholder("اختر الامر اللذي تريد المساعده فيه.")
                    .addOptions(
                        { label: "كيف تضبط البوت بسيرفرك", value: "multiBot" },
                        { label: "كيف تسوي متاجر", value: "createStore" },
                        {
                            label: "كيف تسوي بيع تلقائي للطلبات",
                            value: "autoSellOrders",
                        },
                        {
                            label: "كيف تسوي بيع تلقائي للمزاد",
                            value: "autoAuction",
                        },
                        { label: "معلومات عن البوت", value: "botInfo" },
                        { label: "إعادة تشغيل القائمة", value: "resetMenu" },
                    );

                const selectMenuRow = new ActionRowBuilder().addComponents(
                    selectMenu,
                );

                // Reply with embed and components
                const sentMessage = await message.reply({
                    embeds: [embed],
                    components: [buttonsRow1, buttonsRow2, selectMenuRow],
                });

                // Disable components after a delay
                // setTimeout(async () => {
                const disabledButtonsRow1 =
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel("اوامر الاونر")
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId("ownerCommands")
                            .setDisabled(true)
                            .setEmoji(emojis.ownerCmds),
                        new ButtonBuilder()
                            .setLabel("اوامر الاداره")
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId("adminCommands")
                            .setDisabled(true)
                            .setEmoji(emojis.adminCmds),
                        //   new ButtonBuilder()
                        //   .setLabel('اوامر العامه')
                        // .setStyle(ButtonStyle.Secondary)
                        //.setCustomId('generalCommands')
                        //   .setDisabled(true)
                    );

                const disabledSelectMenuRow =
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("helpMenu")
                            .setPlaceholder("تم تعطيل القائمة.")
                            .setDisabled(true),
                    );

                //await sentMessage.edit({ components: [disabledButtonsRow1, buttonsRow2, disabledSelectMenuRow] });
                //}, 300000); // 5 دقائق
            } catch (error) {
                console.error(error);
                await message.reply({
                    content: "حدث خطأ أثناء عرض قائمة المساعدة.",
                    ephemeral: true,
                });
            }
        }
    });
};
