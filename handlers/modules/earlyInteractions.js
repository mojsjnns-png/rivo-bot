const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder, // تـمـت الإضـافـة لـحـل الإيـرور
    RoleSelectMenuBuilder, // تـمـت الإضـافـة لـحـل الإيـرور
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

module.exports = function registerEarlyInteractions(
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
    client.on("messageCreate", async (m) => {
        if (!m.guild) return;
        const guildId = m.guild.id;
        const { member, guild } = m;
        if (!m.content) return;
        const data = await db.get(`shop_${m.channel.id}_${guildId}`);
        const warns = await db.get(`shop_${m.channel.id}_${guildId}.warns`);
        if (!data) return;

        // Handle @everyone mention
        if (m.content.includes("@everyone")) {
            if (data.everyoneMentions > 0) {
                if (data.everyoneMentions === 2) {
                    await m.reply(`**متبقي منشن واحد افري استخدمه بحكمة**`);
                }
                data.everyoneMentions = data.everyoneMentions - 1;
                await db.set(`shop_${m.channel.id}_${guildId}`, data);
            } else {
                await m.reply(
                    `**تم تحذير متجرك بسبب انه لا يوجد لديك منشنات افري كافية**`,
                );
                await m.delete().catch(() => {});
                await db.add(`shop_${m.channel.id}_${guildId}.warns`, 1);
                await db.set(`shop_${m.channel.id}_${guildId}`, data);
            }
        }

        // Handle @here mention
        if (m.content.includes("@here")) {
            if (data.hereMentions > 0) {
                if (data.hereMentions === 2) {
                    await m.reply(`**متبقي منشن واحد هير استخدمه بحكمة**`);
                }
                data.hereMentions = data.hereMentions - 1;
                await db.set(`shop_${m.channel.id}_${guildId}`, data);
            } else {
                await m.reply(
                    `**تم تحذير متجرك بسبب انه لا يوجد لديك منشنات هير كافية**`,
                );
                await m.delete().catch(() => {});
                data.warns = data.warns + 1;
                await db.set(`shop_${m.channel.id}_${guildId}`, data);
            }
        }

        // Handle custom shop role mentions
        if (data) {
            if (m.content.includes(`<@&${data.shopmen}>`)) {
                if (data.shopRoleMentions > 0) {
                    if (data.shopRoleMentions === 2) {
                        await m.reply(`**متبقي منشن واحد شوب استخدمه بحكمة**`);
                    }
                    data.shopRoleMentions = data.shopRoleMentions - 1;
                    await db.set(`shop_${m.channel.id}_${guildId}`, data);
                } else {
                    await m.reply(
                        `**تم تحذير متجرك بسبب انه لا يوجد لديك منشنات شوب كافية**`,
                    );
                    await m.delete().catch(() => {});
                    data.warns = data.warns + 1;
                    await db.set(`shop_${m.channel.id}_${guildId}`, data);
                }
            }
        }

        // ====== فحص التشفير ======
        const tashfeerWords = ["باونتي","لعبه","ماب","يوزر","خاص","العاب","سعركم","كريديت","يوزرات","تواصل","موجود","ضمان","طلبات","طلب","ميزانيه","سعرك","تصاميم","تصميم","روبوكس","نتفلكس","شاهد","بلوكس","ديسكورد","فيزا","نيترو","اسيا","عملات","دولار","رصيد","شوب","بيع","شراء","تبادل","تبديل","عروضكم","عروض","متوفر","مطلوب","دفع","تحويل","سوم","شارة","انستقرام","كمية","سريع","كردت","عرض","عرضك","فلوس","قارما","سعر","تبدخاص","اطلب","مقابل","تجار","اوفر","متجر","كريدت"];
        const contentLower = m.content.toLowerCase();
        const hasUnencrypted = tashfeerWords.some(w => contentLower.includes(w));
        const hasEncryptedPattern = m.content.includes("ـ,ـ");
        if (hasUnencrypted && !hasEncryptedPattern && !m.author.bot) {
            await m.delete().catch(() => {});
            await m.reply("**⚠️ يجب تشفير الرسالة قبل الإرسال! استخدم زر التشفير.**").catch(() => {});
            data.warns = (data.warns || 0) + 1;
            await db.set(`shop_${m.channel.id}_${guildId}`, data);
            const maxWarns = await db.get(`shop_${m.channel.id}_${guildId}.maxWarns`);
            if (data.warns > (maxWarns || 3)) {
                const sellerId = data.sellerId;
                const admins = await db.get(`shopad_${guildId}`);
                await m.channel.permissionOverwrites.set([
                    { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
                    ...(sellerId ? [{ id: sellerId, allow: ["ViewChannel"] }] : []),
                    ...(admins ? [{ id: admins, allow: ["ViewChannel"] }] : []),
                ]);
                await m.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم إغلاق المتجر")
                            .setDescription(`تم إغلاق المتجر بسبب تجاوز عدد التحذيرات (${data.warns}/${maxWarns || 3}) — الرسالة غير مشفرة.`)
                            .setColor(_ec.color(guildId))
                            .setTimestamp(),
                    ],
                });
                await db.set(`shop_${m.channel.id}_${guildId}.status`, "0");
                const logs = await db.get(`logs_${guildId}`);
                const logChannel = guild.channels.cache.get(logs);
                if (logChannel) {
                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("⚠️ تم إغلاق متجر")
                                .setDescription(`تم إغلاق <#${m.channel.id}> بسبب عدم التشفير (${data.warns} تحذيرات)`)
                                .setColor(0xFF0000)
                                .setTimestamp(),
                        ],
                    });
                }
            } else {
                await m.channel.send(`**⚠️ تحذير ${data.warns}/${maxWarns || 3}: يجب تشفير الرسالة!**`).catch(() => {});
            }
            return;
        }
    });
// ========== !قائمه - عرض سيرفرات البوت ==========
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith("!قائمه")) return;

    // صلاحية: صاحب البوت فقط
    const botOwnerId = "959174041422397471"; //ID حقك
    if (message.author.id !== botOwnerId) {
        return message.reply("**❌ هذا الأمر لصاحب البوت فقط.**");
    }

    const guilds = client.guilds.cache;
    
    if (guilds.size === 0) {
        return message.reply("**❌ البوت غير موجود في أي سيرفر.**");
    }

    const embeds = [];
    let description = "";
    let count = 0;
    let page = 1;

    for (const guild of guilds.values()) {
        count++;
        const owner = await guild.fetchOwner().catch(() => null);
        const ownerName = owner ? `${owner.user.username}` : "غير معروف";
        const ownerId = owner ? owner.user.id : "—";
        
        // محاولة إنشاء دعوة
        let inviteLink = "لا يوجد";
        try {
            const invites = await guild.invites.fetch().catch(() => null);
            if (invites && invites.size > 0) {
                inviteLink = invites.first().url;
            } else {
                const channels = guild.channels.cache.filter(c => 
                    c.type === ChannelType.GuildText && 
                    c.permissionsFor(guild.members.me).has("CreateInstantInvite")
                );
                if (channels.size > 0) {
                    const invite = await channels.first().createInvite({ maxAge: 0 }).catch(() => null);
                    if (invite) inviteLink = invite.url;
                }
            }
        } catch {}

        description += `**${count}.** ${guild.name}\n`;
        description += `🆔 \`${guild.id}\`\n`;
        description += `👤 <@${ownerId}> (\`${ownerId}\`)\n`;
        description += `🔗 ${inviteLink}\n`;
        description += `👥 ${guild.memberCount} عضو\n\n`;

        // كل 10 سيرفرات في إمبد
        if (count % 10 === 0 || count === guilds.size) {
            embeds.push(
                new EmbedBuilder()
                    .setTitle(`<a:ggeg1_944745994256438:1541881273658773504>  قائمة السيرفرات (${page})`)
                    .setDescription(description || "لا يوجد")
                    .setColor(0x3498DB)
                    .setFooter({ text: `المجموع: ${guilds.size} سيرفر | الصفحة ${page}/${Math.ceil(guilds.size / 10)}` })
                    .setTimestamp()
            );
            description = "";
            page++;
        }
    }

    // إرسال الإمبدات
    for (const embed of embeds) {
        await message.channel.send({ embeds: [embed] }).catch(() => {});
    }
});
    client.on("messageCreate", async (m) => {
        if (!m.guild) return;
        const guildId = m.guild.id;
        const { guild, channel } = m;
        if (!m.content) return;

        // التحقق من حالة التفعيل
        const featureStatus = await db.get(
            `shop_${channel.id}_${guildId}.status`,
        );
        if (featureStatus !== "1") return; // إذا كانت غير مفعلة، لا تفعل شيئًا

        const data = await db.get(`shop_${channel.id}_${guildId}`);
        const warns = await db.get(`shop_${channel.id}_${guildId}.warns`);
        const sellerId = await db.get(`shop_${channel.id}_${guildId}.sellerId`);
        const admins = await db.get(`shopad_${guildId}`);

        if (!data) return;
        const warningLimit = await db.get(
            `shop_${channel.id}_${guildId}.maxWarns`,
        );

        if (warns > warningLimit) {
            // إخفاء القناة عند تجاوز الحد
            await channel.permissionOverwrites.set([
                {
                    id: guild.roles.everyone.id,
                    deny: [
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AddReactions,
                        PermissionFlagsBits.CreatePublicThreads,
                        PermissionFlagsBits.CreatePrivateThreads,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ViewChannel,
                    ],
                },
                {
                    id: sellerId,
                    allow: [
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AddReactions,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.UseExternalEmojis,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
                {
                    id: admins,
                    allow: [
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AddReactions,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.MentionEveryone,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.UseExternalEmojis,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
            ]);

            // إرسال الرسالة وتحديث قاعدة البيانات
            const embed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم اخفاء المتجر")
                .setDescription(ED.earlyInteractions_001())
                .addFields(
                    {
                        name: "تاريخ الاخفاء",
                        value: new Date().toLocaleString(),
                        inline: true,
                    },
                    {
                        name: "صاحب المتجر",
                        value: `<@${sellerId}>`,
                        inline: true,
                    },
                    {
                        name: "سبب الاخفاء",
                        value: `تجاوز عدد التحذيرات المسموح: ${warns}/${warningLimit}`,
                        inline: true,
                    },
                    {
                        name: "عدد التحذيرات الحالية",
                        value: `${warns}`,
                        inline: true,
                    },
                    {
                        name: "أقصى عدد تحذيرات",
                        value: `${warningLimit}`,
                        inline: true,
                    },
                )
                .setColor(_ec.color(guildId)) // اللون الأd�مر للإشارة إلى الإخفاء
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            await db.set(`shop_${channel.id}_${guildId}.status`, "0"); // تعيين الحالة إلى "0" عند الإخفاء

            // إرسال رسالة إلى القناة اللوج الخاصة بالمتجر
            const logs = await db.get(`logs_${guildId}`);
            const logChannel = guild.channels.cache.get(logs);
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }
        } else if (warns <= warningLimit) {
            // إعادة فتح القناة عند انخفاض التحذيرات
            const currentStatus = await db.get(
                `shop_${channel.id}_${guildId}.status`,
            );
            if (currentStatus === "0") {
                // إعادة إعدادات الأذونات
                await channel.permissionOverwrites.set([
                    {
                        id: guild.roles.everyone.id,
                        allow: [
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.CreatePublicThreads,
                            PermissionFlagsBits.CreatePrivateThreads,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ViewChannel,
                        ],
                    },
                    {
                        id: sellerId,
                        allow: [
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.UseExternalEmojis,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                    {
                        id: admins,
                        allow: [
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.MentionEveryone,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.UseExternalEmojis,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                ]);

                // إرسال الرسالة وتحديث قاعدة البيانات
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم اعادة فتح المتجر")
                    .setDescription(ED.earlyInteractions_002())
                    .addFields(
                        {
                            name: "تاريخ إعادة الفتح",
                            value: new Date().toLocaleString(),
                            inline: true,
                        },
                        {
                            name: "صاحب المتجر",
                            value: `<@${sellerId}>`,
                            inline: true,
                        },
                        {
                            name: "عدد التحذيرات الحالية",
                            value: `${warns}`,
                            inline: true,
                        },
                        {
                            name: "أقصى عدد تحذيرات",
                            value: `${warningLimit}`,
                            inline: true,
                        },
                    )
                    .setColor(_ec.color(guildId)) // اللون الأخضر للإشارة إلى الفتح
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
                await db.set(`shop_${channel.id}_${guildId}.status`, "1"); // تعيين الحالة إلى "1" عند إعادة الفتح
            }
        }
    });

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;
        const args = message.content.trim().split(/ +/);
        const command = args.shift().toLowerCase();

        const shortcut = (await db.get(`shortcut_call_${guildId}`)) || "+come";

        if (command === shortcut) {
            if (
                !message.member.permissions.has(
                    PermissionsBitField.Flags.ManageChannels,
                )
            ) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(_ec.color(guildId))
                            .setDescription(ED.earlyInteractions_003()),
                    ],
                });
            }

            const user =
                message.mentions.users.first() ||
                (args[0]
                    ? await client.users.fetch(args[0]).catch(() => null)
                    : null);
            const msg = args.slice(1).join(" ");

            if (!user) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(_ec.color(guildId))
                            .setDescription(ED.earlyInteractions_004()),
                    ],
                });
            }

            if (user.bot) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(_ec.color(guildId))
                            .setDescription(ED.earlyInteractions_005()),
                    ],
                });
            }

            const embedMessage = new EmbedBuilder()
                .setColor(_ec.color(guildId))
                .setDescription(ED.earlyInteractions_006({ message, msg }));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("فتح الرسالة")
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`,
                    )
                    .setEmoji(emojis.link),
                new ButtonBuilder()
                    .setLabel("بروفايل المرسل")
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/users/${message.author.id}`)
                    .setEmoji(emojis.user),
            );

            try {
                await user.send({ embeds: [embedMessage], components: [row] });
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(_ec.color(guildId))
                            .setDescription(ED.earlyInteractions_007()),
                    ],
                });
            } catch (error) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(_ec.color(guildId))
                            .setDescription(ED.earlyInteractions_008()),
                    ],
                });
            }
        }
    });

    //tax
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return;

        const guildId = message.guild.id;
        const shortcutTax = (await db.get(`shortcut_tax_${guildId}`)) || "+tax"; // Removed 'await' to use the sync version

        if (message.content.startsWith(shortcutTax)) {
            let args = message.content.split(" ")[1];
            if (!args) return message.reply("Please provide a valid number!");

            if (args.endsWith("m")) args = args.replace(/m/gi, "") * 1000000;
            else if (args.endsWith("k") || args.endsWith("K"))
                args = args.replace(/[kK]/gi, "") * 1000;

            let args2 = parseInt(args);
            if (isNaN(args2))
                return message.reply("Please provide a valid number!");

            let tax = Math.floor(args2 * (20 / 19) + 1);

            message.reply(`> **Your tax is: ${tax}**`);
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "dashboardshop") return;

        await interaction.deferReply({ ephemeral: true });
        try {
            // Validate guild and member
            if (!interaction.inGuild()) {
                return await interaction.editReply({
                    content: "❌ هذا الأمر متاح فقط داخل السيرفرات",
                });
            }

            const { guild, member, channel } = interaction;
            const guildId = guild.id;
            const userId = member.id;

            // Fetch shop data
            const shopKey = `shop_${channel.id}_${guildId}`;
            const data = await db.get(shopKey);

            if (!data) {
                return await interaction.editReply({
                    content: "❌ عفواً لم أستطع العثور على هذا المتجر",
                });
            }

            // Check permissions
            const owner = await db.get(`${shopKey}.sellerId`);
            const partners = (await db.get(`${shopKey}.partners`)) || [];

            if (userId !== owner && !partners.includes(userId)) {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setTitle("صلاحية مرفوضة")
                    .setDescription(ED.earlyInteractions_009({ owner }));

                return await interaction.editReply({
                    embeds: [embed],
                });
            }

            // Prepare dashboard embed
            const imageUrl = await db.get(`image_${guildId}`);

            const shopdashbordembd = new EmbedBuilder()
                .setColor(_ec.color(guildId))
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> ** لوحة تحكم المتجر **")
                .setDescription(ED.earlyInteractions_010({ config }))
                .setAuthor({
                    name: guild.name,
                    iconURL: guild.iconURL({ size: 1024 }),
                })
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({
                    text: `${interaction.guild?.name || "Server"}`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

            if (imageUrl) shopdashbordembd.setImage(imageUrl);

            // Create buttons
            const firstButtonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("changeshape")
                    .setLabel("تغيير شكل المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.shape),
                new ButtonBuilder()
                    .setCustomId("changetypeprice_btn")
                    .setLabel("تغيير نوع المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.typeChange),
                new ButtonBuilder()
                    .setCustomId("changeName")
                    .setLabel("تغيير اسم المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.nameChange),
                new ButtonBuilder()
                    .setCustomId("ownerchange")
                    .setLabel("تغيير صاحب المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.ownerChange),
            );
            const secondButtonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("remove_warn")
                    .setLabel("إزالة تحذيرات")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.removeWarn),
                new ButtonBuilder()
                    .setCustomId("mention")
                    .setLabel("شراء منشنات")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.mention),
                new ButtonBuilder()
                    .setCustomId("partnerdashboard")
                    .setLabel("إدارة الشركاء")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.partners),
                new ButtonBuilder()
                    .setCustomId("shopvacation_btn")
                    .setLabel("طلب إجازة للمتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.vacation),
                new ButtonBuilder()
                    .setCustomId("autopublish_btn")
                    .setLabel("النشر التلقائي")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.autoPublish),
            );
            const thirdButtonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("disableauto_btn")
                    .setLabel("تعطيل الإرسال التلقائي")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.disableAuto),
                new ButtonBuilder()
                    .setCustomId("activateshop_paid")
                    .setLabel("تفعيل المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.activate),
                new ButtonBuilder()
                    .setCustomId("sellshop")
                    .setLabel("بيع المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.sell),
                new ButtonBuilder()
                    .setCustomId("sendmesageshop")
                    .setLabel("إرسال رسالة بالبوت")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.sendBotMsg),
                new ButtonBuilder()
                    .setCustomId("traders_community")
                    .setLabel("مجتمع تجار")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.community),
            );
            const fourthButtonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("showshopdata")
                    .setLabel("عرض معلومات المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.info),
                new ButtonBuilder()
                    .setCustomId("showwarns")
                    .setLabel("عرض تحذيرات المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.showWarnings),
                new ButtonBuilder()
                    .setCustomId("showhelprs")
                    .setLabel("عرض شركاء المتجر")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.showHelpers),
                new ButtonBuilder()
                    .setCustomId("shop_ratings_btn")
                    .setLabel("تقييمات")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.rate),
                new ButtonBuilder()
                    .setCustomId("deleteshop2")
                    .setLabel("حذف المتجر")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(emojis.delete),
            );

            await interaction.editReply({
                embeds: [shopdashbordembd],
                components: [
                    firstButtonRow,
                    secondButtonRow,
                    thirdButtonRow,
                    fourthButtonRow,
                ],
            });
        } catch (error) {
            console.error("Error in dashboard shop interaction:", error);
            await interaction.editReply({
                content: "❌ حدث خطأ أثناء معالجة طلبك، يرجى المحاولة لاحقاً",
            });
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.member.id;
        const owner = await db.get(
            `shop_${interaction.channel.id}_${guildId}.sellerId`,
        );
        const data = await db.get(`shop_${interaction.channel.id}_${guildId}`);

        const imageUrl = await db.get(`image_${guildId}`);
        if (interaction.customId === "deleteshop2") {
            if (!data) {
                return await interaction.reply({
                    content: `❌ **عفــوا لم اســتطع العثــور على هــاذا المــتجــر**`,
                    ephemeral: true,
                });
            }
            if (userId !== data.sellerId) {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setTitle("صلاحية مرفوضة")
                    .setDescription(ED.earlyInteractions_011({ data }));

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            const deletedconformShopEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تاكيــد")
                .setDescription(ED.earlyInteractions_012())
                .setTimestamp();

            // إرسال الرسالة مع الأزرار (إذا كانت هناك أزرار)
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("deletecomformed")
                    .setLabel("تاكيد الحذف")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.delete),
            );
            await interaction.reply({
                embeds: [deletedconformShopEmbed],
                components: [buttons],
                ephemeral: true, // الرسالة تظهر فقط للشخص الذي ضغط
            });
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.member.id;
        const owner = await db.get(
            `shop_${interaction.channel.id}_${guildId}.sellerId`,
        );
        const data = await db.get(`shop_${interaction.channel.id}_${guildId}`);

        if (interaction.customId === "deletecomformed") {
            if (!data) {
                return await interaction.reply({
                    content: `❌ **عفــوا لم اســتطع العثــور على هــاذا المــتجــر**`,
                    ephemeral: true,
                });
            }
            if (userId !== data.sellerId) {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setTitle("صلاحية مرفوضة")
                    .setDescription(ED.earlyInteractions_013({ data }));

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            const imageUrl = await db.get(`image_${guildId}`);
            // Prepare embed messages
            // Prepare embed messages
            const deletedShopEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف متجرك")
                .setDescription(ED.earlyInteractions_014({ interaction })) // استخدام قيمة افتراضية إذا كانت data.name غير متوفرة
                .addFields(
                    {
                        name: "اسم المتجر",
                        value: `${interaction.channel.name}`,
                        inline: true,
                    }, // استخدام قيمة افتراضية
                    {
                        name: "المسؤول",
                        value: `<@${interaction.user.id}>`,
                        inline: true,
                    }, // تأكد من أن interaction.user.id صحيح
                    { name: "السبب", value: "أنت طلبت حذفه", inline: true },
                )
                .setImage(imageUrl || config.line)
                .setFooter(D.footer(interaction.guild))
                .setThumbnail(D.thumb(interaction.guild))
                .setTimestamp();

            const logEmbed = EmbedBuilder.from(deletedShopEmbed)
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم حذف متجر")
                .setDescription(ED.earlyInteractions_015({ interaction }))
                .addFields(
                    {
                        name: "اسم المتجر",
                        value: `${interaction.channel.name}`,
                        inline: true,
                    }, // استخدام قيمة افتراضية
                    {
                        name: "المسؤول",
                        value: `<@${interaction.user.id}>`,
                        inline: true,
                    },
                    {
                        name: "السبب",
                        value: "صاحب المتجر طلب حذفه تلقائيًا من البوت",
                        inline: true,
                    },
                );

            // Notify the seller
            try {
                const seller = await client.users.fetch(data.sellerId);
                const dmChannel = await seller.createDM();
                await dmChannel.send({ embeds: [deletedShopEmbed] });
            } catch (error) {
                console.error(`Failed to notify the seller: ${error}`);
            }

            // Send log if logs channel exists
            const logsChannelId = await db.get(`logs_${guildId}`);
            if (logsChannelId) {
                try {
                    const logChannel =
                        interaction.guild.channels.cache.get(logsChannelId);
                    if (logChannel) {
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (error) {
                    console.error(`Failed to send log: ${error}`);
                }
            }

            // Clean up database and delete shop
            await db.delete(`shop_${data.id}_${guildId}`);
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error(`Failed to delete the shop channel: ${error}`);
            }

            // Remove role from seller if applicable
            if (data.shoprole) {
                try {
                    const sellerMember = await interaction.guild.members.fetch(
                        data.sellerId,
                    );
                    await sellerMember.roles.remove(data.shoprole);
                } catch (error) {
                    console.error(
                        `Failed to remove the role from the seller: ${error}`,
                    );
                }
            }

            // await interaction.reply({ content: 'تم حذف المتجر بنجاح!', ephemeral: true });
        }
    });

//==============================================================================
// 1. أمر التحكم (يوضع في messageCreate)
//==============================================================================
client.on("messageCreate", async (message) => {
    if (message.content === "قوقو") {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const guildId = message.guild.id;
        const userId = message.author.id;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cd_apply_all_${userId}`)
                .setLabel("كل المتاجر")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cd_apply_type_${userId}`)
                .setLabel("نوع معين")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`cd_cancel_${userId}`)
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
        );

        await message.reply({
            content: "نظام كول داون المتاجر\nاختر تطبيق الإعداد على الكل أو نوع محدد بشكل رسمي:",
            components: [row]
        });
    }
});

//==============================================================================
// 2. معالج التفاعلات (يوضع في interactionCreate)
//==============================================================================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (interaction.customId && interaction.customId.startsWith("cd_")) {
        if (!interaction.customId.endsWith(userId)) {
            return interaction.reply({ content: "هذا التحكم للمسؤول الذي طلب الأمر فقط.", ephemeral: true });
        }
    } else {
        return; 
    }

    if (interaction.customId === `cd_apply_all_${userId}`) {
        await interaction.update({
            content: "تطبيق على كل المتاجر\nاختر مدة الكول داون الرسمية:",
            components: [createCooldownMenu("ALL", userId)]
        });
    }

    if (interaction.customId === `cd_apply_type_${userId}`) {
        const allData = await db.all();
        const options = allData.filter(d => d.id.startsWith("categoryMentions_") && d.id.endsWith(`_${guildId}`))
            .map(cat => {
                const catId = cat.id.split("_")[1];
                return { label: cat.value.nametype || "نوع", value: catId };
            });

        if (options.length === 0) return interaction.update({ content: "لا توجد أنواع متاجر مسجلة بالداتا.", components: [] });

        const catRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`cd_select_cat_${userId}`)
                .setPlaceholder("اختر فئة المتجر")
                .addOptions(options.slice(0, 25))
        );

        await interaction.update({ content: "اختيار نوع محدد\nيرجى اختيار الفئة من القائمة:", components: [catRow] });
    }

    if (interaction.customId === `cd_select_cat_${userId}`) {
        const selectedCat = interaction.values[0];
        await interaction.update({
            content: `النوع المختار: <#${selectedCat}>\nالآن اختر مدة الكول داون:`,
            components: [createCooldownMenu(selectedCat, userId)]
        });
    }

    if (interaction.customId && interaction.customId.startsWith("cd_final_")) {
        const parts = interaction.customId.split("_");
        const targetId = parts[2]; 
        const seconds = interaction.values[0] === "OFF" ? 0 : parseInt(interaction.values[0]);

        await interaction.update({ content: `جاري معالجة الرومات وتعديل الكول داون إلى ${seconds} ثانية...`, components: [] });

        const allKeys = await db.all();
        const shops = allKeys.filter(d => d.id.startsWith("shop_") && d.id.endsWith(`_${guildId}`) && !d.id.includes("lastmsg") && !d.id.includes("ticket"));
        
        let count = 0;
        for (const shop of shops) {
            const channelId = shop.id.split("_")[1];
            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) continue;

            if (targetId === "ALL" || channel.parentId === targetId) {
                await channel.setRateLimitPerUser(seconds).catch(() => {});
                count++;
            }
        }
        await interaction.reply({ content: `تم تحديث الكول داون بنجاح\nالمدة: ${seconds} ثانية\nالرومات المتأثرة: ${count}` });
    }

    if (interaction.customId === `cd_cancel_${userId}`) {
        await interaction.update({ content: "تم إلغاء العملية بنجاح.", components: [] });
    }
});

function createCooldownMenu(targetId, userId) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`cd_final_${targetId}_${userId}`)
            .setPlaceholder("اختر الوقت")
            .addOptions([
                { label: "تعطيل", value: "OFF" },
                { label: "5 ثواني", value: "5" },
                { label: "10 ثواني", value: "10" },
                { label: "30 ثانية", value: "30" },
                { label: "دقيقة", value: "60" },
                { label: "5 دقائق", value: "300" },
                { label: "15 دقيقة", value: "900" },
                { label: "30 دقيقة", value: "1800" },
                { label: "ساعة", value: "3600" }
            ])
    );
}

 client.on("messageCreate", async (message) => {
        if (message.content === "قوقو") {
            const vipadmin = (await db.get("vipadmin")) || [];

            if (!vipadmin.includes(message.author.id)) {
                return;
            }
            const userId = message.author.id;
            const cooldownKey = `cooldown_${userId}_sendmessage`;

            try {
                // حذف الكول داون من قاعدة البيانات
                await db.delete(cooldownKey);

                message.reply("✅ **تم إزالة الكول داون بنجاح**");
            } catch (error) {
                console.error("Error removing cooldown:", error);
                message.reply("❌ **حدث خطأ أثناء محاولة إزالة الكول داون**");
            }
        }
    });
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.member.id;
        const channelId = interaction.channel.id;
        const user = interaction.user;

        // نظام التبريد (1 ساعة)
        const cooldownKey = `cooldown_${userId}_sendmessage`;
        const cooldown = await db.get(cooldownKey);

        // كلمات التشفير

        if (
            interaction.isButton() &&
            interaction.customId === "sendmesageshop"
        ) {
            const data = await db.get(`shop_${channelId}_${guildId}`);
            if (!data) {
                return await interaction.reply({
                    content: `❌ **عفواً لم أستطع العثور على هذا المتجر**`,
                    ephemeral: true,
                });
            }

            // التحقق من التبريد
            if (cooldown && Date.now() < cooldown) {
                const remainingTime = Math.ceil(
                    (cooldown - Date.now()) / (1000 * 60),
                );
                return interaction.reply({
                    content: `❌ **يجب الانتظار ${remainingTime} دقيقة قبل إرسال رسالة أخرى**`,
                    ephemeral: true,
                });
            }

            // إنشاء النموذج
            const modal = new ModalBuilder()
                .setCustomId("messageModal")
                .setTitle("إرسال رسالة إلى المتجر");

            const messageInput = new TextInputBuilder()
                .setCustomId("messageInput")
                .setLabel("محتوى الرسالة (2000 حرف كحد أقصى)")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(2000)
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(
                messageInput,
            );
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        }

        // معالجة إرسال النموذج
        if (
            interaction.isModalSubmit() &&
            interaction.customId === "messageModal"
        ) {
            await interaction.deferReply({ ephemeral: true });

            let messageContent =
                interaction.fields.getTextInputValue("messageInput");

            // تطبيق التشفير على الكلمات
            for (const [word, replacement] of Object.entries(replacements)) {
                const regex = new RegExp(word, "g");
                messageContent = messageContent.replace(regex, replacement);
            }

            // التحقق من وجود روابط
            const linkRegex =
                /(?:https?:\/\/|www\.|ftp:\/\/|mailto:|tel:)|(?:discord\.(?:gg|com\/invite|app\.com\/invite)|\.gg\/|(?:channels|me)\/)|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;
            if (linkRegex.test(messageContent)) {
                return await interaction.reply({
                    content: "❌ **لا يسمح بإدراج روابط في الرسالة**",
                    ephemeral: true,
                });
            }

            try {
                // البحث عن ويب هوك موجود أو إنشاء جديد
                let webhook = await findOrCreateWebhook(
                    interaction.channel,
                    user,
                );

                // زر رابط البروفايل
                const profileButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("صاحب الرساله")
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/users/${user.id}`)
                        .setEmoji(emojis.user),
                );

                // إرسال الرسالة عبر الويب هوك
                await webhook.send({
                    content: messageContent,
                    username: user.username,
                    avatarURL: user.displayAvatarURL(),
                    components: [profileButton],
                });

                // تعيين وقت التبريد (1 ساعة)
                await db.set(cooldownKey, Date.now() + 3600000);

                await interaction.reply({
                    content: "✅ **تم إرسال رسالتك بنجاح إلى المتجر**",
                    ephemeral: true,
                });
            } catch (error) {
                console.error("Error sending shop message:", error);
                await interaction.reply({
                    content: "❌ **حدث خطأ أثناء محاولة إرسال الرسالة**",
                    ephemeral: true,
                });
            }
        }
    });

    async function findOrCreateWebhook(channel, user) {
        try {
            // البحث عن ويب هوك موجود
            const webhooks = await channel.fetchWebhooks();
            const existingWebhook = webhooks.find(
                (wh) => wh.name === `${user.username}`,
            );

            if (existingWebhook) return existingWebhook;

            // إنشاء ويب هوك جديد إذا لم يوجد
            return await channel.createWebhook({
                name: `${user.username}`,
                avatar: user.displayAvatarURL(),
                reason: "لإرسال رسائل المتجر",
            });
        } catch (error) {
            console.error("Error handling webhook:", error);
            throw error;
        }
    }

    async function sendAutoPublishMessage(
        channel,
        activatorUser,
        text,
        mention,
        activatorId,
    ) {
        const mentionPrefix =
            mention === "here"
                ? "@here\n"
                : mention === "everyone"
                  ? "@everyone\n"
                  : "";
        const actionRow = new ActionRowBuilder();
        if (activatorId) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setLabel("صاحب النشر")
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/users/${activatorId}`)
                    .setEmoji(emojis.user),
            );
        }
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`stop_autopublish_${channel.id}`)
                .setLabel("إيقاف النشر")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.stopPublish),
        );
        const components = actionRow.components.length > 0 ? [actionRow] : [];
        const content = `${mentionPrefix}${text}`;
        const allowedMentions =
            mention === "here" || mention === "everyone"
                ? { parse: ["everyone"] }
                : { parse: [] };

        // جلب صورة الخط التلقائي
        const guildId = channel.guild?.id;
        const lineImage = guildId ? await db.get(`image_${guildId}`) : null;
        const embeds = [];
        if (lineImage && lineImage.startsWith("http")) {
            const lineEmbed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setImage(lineImage);
            embeds.push(lineEmbed);
        }

        if (activatorUser) {
            try {
                const webhook = await findOrCreateWebhook(
                    channel,
                    activatorUser,
                );
                await webhook.send({
                    content,
                    embeds,
                    username: activatorUser.username,
                    avatarURL: activatorUser.displayAvatarURL(),
                    allowedMentions,
                    components,
                });
                return;
            } catch (e) {
                console.log(
                    `[AutoPublish] Webhook send failed, falling back to channel.send: ${e.message}`,
                );
            }
        }
        await channel.send({ content, embeds, components, allowedMentions });
    }

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.member.id;
        const owner = await db.get(
            `shop_${interaction.channel.id}_${guildId}.sellerId`,
        );
        const data = await db.get(`shop_${interaction.channel.id}_${guildId}`);

        const imageUrl = await db.get(`image_${guildId}`);
        if (interaction.customId === "showwarns") {
            if (!data) {
                return await interaction.reply({
                    content: `❌ **عفــوا لم اســتطع العثــور على هــاذا المــتجــر**`,
                    ephemeral: true,
                });
            }
            const warns = data.warns || 0;

            const warnsembd = {
                title: `** التــحذيرات **`,
                description: ` 
**- عدد التحذيرات:**\n ${warns}`,
                author: {
                    name: `${interaction.guild.name}`,
                    icon_url: interaction.guild.iconURL({ size: 1024 }),
                },
                thumbnail: {
                    url: interaction.user.displayAvatarURL(),
                },
                ...(imageUrl ? { image: { url: imageUrl } } : {}),
                footer: {
                    text: `${interaction.guild?.name || "Server"}`,
                    icon_url: interaction.user.displayAvatarURL(),
                },
            };
            await interaction.reply({
                embeds: [warnsembd],
                ephemeral: true, // الرسالة تظهر فقط للشخص الذي ضغط
            });
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.member.id;

        if (interaction.customId === "showshopdata") {
            await interaction.deferReply({ ephemeral: true });
            const owner = await db.get(
                `shop_${interaction.channel.id}_${guildId}.sellerId`,
            );
            const data = await db.get(`shop_${interaction.channel.id}_${guildId}`);

            if (!data) {
                return await interaction.editReply({
                    content: `❌ **عفــوا لم اســتطع العثــور على هــاذا المــتجــر**`,
                });
            }

            const {
                everyoneMentions,
                hereMentions,
                shopRoleMentions,
                sellerId,
                date,
                warns,
                shoprole,
                shopmen,
                maxWarns,
                hasTax,
                taxPrice,
                nametype,
            } = data;

            // Retrieve the image URL
            const imageUrl = await db.get(`image_${guildId}`);

            // Create the embed
            const em5 = new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> **معلومات المتجر: ${interaction.channel.name}**`)
                .setDescription(
                    ED.earlyInteractions_016({
                        config,
                        everyoneMentions,
                        hasTax,
                        hereMentions,
                        maxWarns,
                        nametype,
                        sellerId,
                        shopRoleMentions,
                        shopmen,
                        shoprole,
                    }),
                )

                .setAuthor({
                    name: interaction.guild.name,
                    iconURL: interaction.guild.iconURL({ size: 1024 }),
                })
                .setFooter(D.footer(interaction.guild))
                .setThumbnail(D.thumb(interaction.guild))
                .setTimestamp()
                .setThumbnail(interaction.guild.iconURL({ size: 1024 }))
                .setImage(imageUrl || `${config.line}`); // Add image if available

            await interaction.editReply({
                content: `**معلومات المتجر: ${interaction.channel}**`,
                embeds: [em5],
            });
        }
    });
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const userId = interaction.member.id;
        const owner = await db.get(
            `shop_${interaction.channel.id}_${guildId}.sellerId`,
        );
        const data = await db.get(`shop_${interaction.channel.id}_${guildId}`);
        //   const partner = await db.get(`shop_${interaction.channel.id}_${guildId}.partners`);
        const imageUrl = await db.get(`image_${guildId}`);
        if (interaction.customId === "showhelprs") {
            if (!data) {
                return await interaction.reply({
                    content: `❌ **عفــوا لم اســتطع العثــور على هــاذا المــتجــر**`,
                    ephemeral: true,
                });
            }
            const partnerMentions =
                data.partners && data.partners.length > 0
                    ? data.partners
                          .map((partnerId) => `\`-\` <@${partnerId}>`)
                          .join("\n")
                    : null;

            const partners = {
                title: `** الشــركاء **`,
                description: ` 
**- شــركاء المتــجر:** ${partnerMentions || " لا يوجد شركاء مسجلين في المتجر"}`,
                author: {
                    name: `${interaction.guild.name}`,
                    icon_url: interaction.guild.iconURL({ size: 1024 }),
                },
                thumbnail: {
                    url: interaction.user.displayAvatarURL(),
                },
                ...(imageUrl ? { image: { url: imageUrl } } : {}),
                footer: {
                    text: `${interaction.guild?.name || "Server"}`,
                    icon_url: interaction.user.displayAvatarURL(),
                },
            };
            await interaction.reply({
                embeds: [partners],
                ephemeral: true, // الرسالة تظهر فقط للشخص الذي ضغط
            });
        }
    });
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton() && !interaction.isStringSelectMenu())
            return;

        const guildId = interaction.guild.id;
        const userId = interaction.member.id;
        const owner = await db.get(
            `shop_${interaction.channel.id}_${guildId}.sellerId`,
        );
        const data = await db.get(`shop_${interaction.channel.id}_${guildId}`);
        //   const partner = await db.get(`shop_${interaction.channel.id}_${guildId}.partners`);
        const imageUrl = await db.get(`image_${guildId}`);
        if (interaction.customId === "partnerdashboard") {
            if (!data) {
                return await interaction.reply({
                    content: `❌ **عفــوا لم اســتطع العثــور على هــاذا المــتجــر**`,
                    ephemeral: true,
                });
            }
            // التحقق مما إذا كان المستخدم هو صاحب المتجر أو شريك
            if (userId !== data.sellerId) {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setTitle("صلاحية مرفوضة")
                    .setDescription(ED.earlyInteractions_017({ data }));

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // إذا كان المستخدم صاحب المتجر أو شريكًا، نستمر في تنفيذ الأوامر
            const bank = await db.get(`bank_${guildId}`);
            const partnerMentions =
                data.partners && data.partners.length > 0
                    ? data.partners
                          .map((partnerId) => `\`-\` <@${partnerId}>`)
                          .join("\n")
                    : null;

            const order_prices_embed = {
                title: `** الــتحــكم بـ الشــركاء **`,
                description: `
\`#\` يــرجــى اخــتيــار الخــدمة عن طــريق الازرار الي تحــت 
**- شــركاء المتــجر:** ${partnerMentions || " لا يوجد شركاء مسجلين في المتجر"}`,
                author: {
                    name: `${interaction.guild.name}`,
                    icon_url: interaction.guild.iconURL({ size: 1024 }),
                },
                thumbnail: {
                    url: interaction.user.displayAvatarURL(),
                },
                ...(imageUrl ? { image: { url: imageUrl } } : {}),
                footer: {
                    text: `${interaction.guild?.name || "Server"}`,
                    icon_url: interaction.user.displayAvatarURL(),
                },
            };

            // إرسال الرسالة مع الأزرار (إذا كانت هناك أزرار)
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("addhelper")
                    .setLabel("اضــافة شــريك")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.customByRIVO1),
                new ButtonBuilder()
                    .setCustomId("removehelper")
                    .setLabel("ازالة شــريك")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.customByRIVO2),
            );

            await interaction.reply({
                embeds: [order_prices_embed],
                components: [buttons],
                ephemeral: true, // الرسالة تظهر فقط للشخص الذي ضغط
            });
        }

        if (interaction.customId === "removehelper") {
            // التحقق مما إذا كان المستخدم هو صاحب المتجر

            // جلب قائمة الشركاء
            const partners = data.partners || [];
            if (partners.length === 0) {
                return await interaction.reply({
                    content: "❌ **لا يوجد شركاء لإزالتهم.**",
                    ephemeral: true,
                });
            }

            // جلب معلومات الأعضاء (الشركاء) من السيرفر
            const partnerMembers = await Promise.all(
                partners.map(async (partnerId) => {
                    const member = await interaction.guild.members
                        .fetch(partnerId)
                        .catch(() => null);
                    return member
                        ? { id: partnerId, username: member.user.username }
                        : null;
                }),
            ).then((results) => results.filter(Boolean)); // إزالة القيم الفارغة

            // إنشاء قائمة الاختيار المتعدد
            const partnerOptions = partnerMembers.map((partner) => ({
                label: partner.username,
                value: partner.id,
            }));

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("remove_partners_select")
                    .setPlaceholder("اختر الشركاء لإزالتهم")
                    .setMinValues(1)
                    .setMaxValues(partners.length)
                    .addOptions(partnerOptions),
            );

            await interaction.reply({
                content: "**اختر الشركاء الذين ترغب في إزالتهم:**",
                components: [selectMenu],
                ephemeral: true,
            });
        }

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "remove_partners_select"
        ) {
            const selectedPartners = interaction.values;

            // إنشاء رسالة تأكيدية
            const confirmButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("confirm_remove_partners")
                    .setLabel("موافق")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(emojis.confirm),
                new ButtonBuilder()
                    .setCustomId("cancel_remove_partners")
                    .setLabel("إلغاء")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.cancel),
            );

            await interaction.update({
                content: `**هل أنت متأكد من إزالة الشركاء التاليين؟**\n${selectedPartners.map((id) => `<@${id}>`).join("\n")}`,
                components: [confirmButtons],
            });
        }

        if (interaction.customId === "confirm_remove_partners") {
            const selectedPartners = interaction.message.content
                .match(/<@(\d+)>/g)
                .map((m) => m.replace(/[<@!>]/g, ""));

            // تحديث قائمة الشركاء في قاعدة البيانات
            const updatedPartners = data.partners.filter(
                (partnerId) => !selectedPartners.includes(partnerId),
            );
            await db.set(
                `shop_${interaction.channel.id}_${guildId}.partners`,
                updatedPartners,
            );

            await interaction.update({
                content: "✅ **تم إزالة الشركاء بنجاح.**",
                components: [],
            });
            await interaction.channel.send({
                content: `تم ازالـة\n ${selectedPartners.map((id) => `<@${id}>`).join("\n")}\nمن المتجر بطلــب من صـاحب المتـجر`,
            });
        }

        if (interaction.customId === "cancel_remove_partners") {
            await interaction.update({
                content: "❌ **تم إلغاء عملية الإزالة.**",
                components: [],
            });
        }
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isButton()) return;
        const guildId = i.guild.id;
        const data = await db.get(`shop_${i.channel.id}_${guildId}`);
        const userId = i.member.id;
        const price = await db.get(`changepartnerscredit_${guildId}`);
        if (i.customId === "addhelper") {
            if (userId !== data.sellerId) {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setTitle("صلاحية مرفوضة")
                    .setDescription(ED.earlyInteractions_018({ data }));

                return i.reply({ embeds: [embed], ephemeral: true });
            }
            if (!price) {
                await i.reply({
                    content:
                        "يرجى تحديد سعر اضافة شريك عن طريق استخدام الامر الاتي: /setup-prices",
                    ephemeral: true,
                });
                return;
            }

            if (i.user.id === data.sellerId) {
                const modal = new ModalBuilder()
                    .setCustomId("partner_modal")
                    .setTitle("اضافة شريك");
                const partnerId = new TextInputBuilder()
                    .setCustomId("partnerId")
                    .setLabel("ايدي الشريك")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                const firstActionRow = new ActionRowBuilder().addComponents(
                    partnerId,
                );
                modal.addComponents(firstActionRow);
                await i.showModal(modal);
            } else {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> Not Shop Owner")
                    .setDescription(ED.earlyInteractions_019({ data }));
                await i.reply({ embeds: [embed], ephemeral: true });
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const userId = i.member.id;

        const data = await db.get(`shop_${i.channel.id}_${guildId}`);

        if (i.isModalSubmit()) {
            if (i.customId === "partner_modal") {
                if (i.user.id === data.sellerId) {
                    const partner = i.fields.getTextInputValue("partnerId");
                    let partne_r;

                    try {
                        partne_r = await i.guild.members.fetch(partner);
                    } catch {
                        return i.reply({
                            content: "**الشخص المدخل ليس موجود بالسيرفر**",
                            ephemeral: true,
                        });
                    }

                    const existingPartners = data.partners || [];

                    if (existingPartners.includes(partner)) {
                        return i.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setDescription(
                                        ED.earlyInteractions_020({ partner }),
                                    )
                                    .setColor(_ec.color(guildId))
                                    .setFooter({ text: "Dev by : zain" })
                                    .setTimestamp(),
                            ],
                            ephemeral: true,
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> اضافه شريك")
                        .setDescription(ED.earlyInteractions_021({ partner }))
                        .setFooter({ text: "Dev by : zain " })
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("confirmpartner" + partner)
                            .setLabel("اضافه")
                            .setStyle(ButtonStyle.Success)
                            .setEmoji(emojis.add),
                        new ButtonBuilder()
                            .setCustomId("cancel")
                            .setLabel("الغاء")
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji(emojis.cancel),
                    );

                    await i.reply({
                        embeds: [embed],
                        components: [row],
                        ephemeral: true,
                    });
                }
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const userId = i.member.id;

        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);

        if (i.isButton()) {
            if (i.user.id === owner) {
                if (i.customId.startsWith("confirmpartner")) {
                    const partner = i.customId.slice("confirmpartner".length);
                    const data = await db.get(
                        `shop_${i.channel.id}_${guildId}`,
                    );

                    const existingPartners = data.partners || [];

                    const transfer = await db.get(`bank_${guildId}`);
                    const price = await db.get(
                        `changepartnerscredit_${guildId}`,
                    );
                    const result = price;
                    const parttax = Math.floor(result * (20 / 19) + 1);

                    if (userId !== data.sellerId) {
                        const embed = new EmbedBuilder()
                            .setColor(_ec.color(guildId))
.setTitle("<a:ggeg1_944745994256438:1541881273658773504> صلاحية مرفوضة")
                            .setDescription(ED.earlyInteractions_022({ data }));

                        return i.reply({ embeds: [embed], ephemeral: true });
                    }
                    const embed = new EmbedBuilder()
                        .setDescription(
                            ED.earlyInteractions_023({
                                parttax,
                                price,
                                transfer,
                            }),
                        )
                        //.setImage(`${config.line}`)
                        .setFooter({ text: "Dev by : zain" })
                        .setTimestamp();

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("confirmpartner")
                                .setLabel("اضافه")
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(true)
                                .setEmoji(emojis.add),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("cancel")
                                .setLabel("الغاء")
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                                .setEmoji(emojis.cancel),
                        );

                    await i.update({ embeds: [embed], components: [row] });
                    await i.channel.send({
                        content: `Re <@!${transfer}> ${parttax}`,
                        ephemeral: true,
                    });
                    const partne_r = i.guild.members.cache.get(partner);
                    const filter = ({ content, author: { id } }) => {
                        const userName = i.user.username; // اسم المستخدم
                        const botId = "1535048804078977164"; // معرف البوت
                        const totalPrice = result; // السعر المطلوب
                        const bankId = transfer.id; // معرف حساب البنك

                        // التحقق من الرسائل الإنجليزية
                        const startsWithEnglish = content.startsWith(
                            `**:moneybag: | ${userName}, has transferred `,
                        );
                        const includesBankEnglish = content.includes(
                            `<@!${transfer}>`,
                        );
                        const amountCheckEnglish =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(price).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق من الرسائل العربية
                        const startsWithArabic = content.includes(
                            `**ـ ${userName}, قام بتحويل`,
                        );
                        const includesBankArabic = content.includes(
                            `<@!${transfer}>`,
                        );
                        const amountCheckArabic =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(price).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق النهائي
                        return (
                            id === botId &&
                            ((startsWithEnglish &&
                                includesBankEnglish &&
                                amountCheckEnglish) ||
                                (startsWithArabic &&
                                    includesBankArabic &&
                                    amountCheckArabic))
                        );
                    };
                    const collector = i.channel.createMessageCollector({
                        filter,
                        max: 1,
                        time: 60000, // الوقت المخصص لجمع الرسائل (60 ثانية)
                    });
                    let iscollected = false;
                    collector.on("collect", async (collected) => {
                        iscollected = true;
                        i.channel.permissionOverwrites.edit(partne_r, {
                            ViewChannel: true,
                            SendMessages: true,
                            MentionEveryone: true,
                            SendMessages: true,
                            AddReactions: true,
                            UseExternalEmojis: true,
                            ReadMessageHistory: true,
                            AttachFiles: true,
                        });
                        existingPartners.push(partner);
                        await db.set(
                            `shop_${i.channel.id}_${guildId}.partners`,
                            existingPartners,
                        );

                        const embeds = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء بنجاح")
                            .setDescription(
                                ED.earlyInteractions_024({ partner }),
                            )
                            .setFooter({ text: "Dev by : zain" })
                            //.setImage(`${config.line}`)
                            .setTimestamp();

                        const guildName = i.guild.name;
                        const invoiceEmbed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                            .setDescription(
                                ED.earlyInteractions_025({
                                    config,
                                    guildName,
                                    i,
                                    partner,
                                    parttax,
                                    result,
                                    transfer,
                                }),
                            )

                            .setFooter(D.thanksFooter(i.guild))
                            .setThumbnail(D.thumb(i.guild))
                            .setTimestamp();
                        await i.user.send({ embeds: [invoiceEmbed] });

                        await i.channel.send({ embeds: [embeds] });
                    });

                    collector.on("end", (collected) => {
                        if (iscollected) return;
                        const embed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")

                            .setDescription(ED.earlyInteractions_026())
                            .setFooter({ text: "Dev by : zain" })
                            .setTimestamp();

                        i.channel.send({ embeds: [embed] });
                        console.log(`yes.`);
                    });
                }
            }
        }
    });

    //ownerchange

    client.on("interactionCreate", async (i) => {
        if (!i.isButton()) return;
        const guildId = i.guild.id;
        const userId = i.member.id;
        const price = await db.get(`changeowner_${guildId}`);
        if (i.customId === "ownerchange") {
            if (!price) {
                await i.reply({
                    content:
                        "يرجى تحديد سعر تغيير الملكيـة عن طريق استخدام الامر الاتي: /setup-prices",
                    ephemeral: true,
                });
                return;
            }
            const data = await db.get(`shop_${i.channel.id}_${guildId}`);
            if (i.user.id === data.sellerId) {
                const modal = new ModalBuilder()
                    .setCustomId("owner_modal")
                    .setTitle("تغيير الملكية");
                const ownerId = new TextInputBuilder()
                    .setCustomId("NewownerId")
                    .setLabel("ايدي الاونر الجديد")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                const firstActionRow = new ActionRowBuilder().addComponents(
                    ownerId,
                );
                modal.addComponents(firstActionRow);
                await i.showModal(modal);
            } else {
                const embed = new EmbedBuilder()
                    .setColor(_ec.color(guildId))
                    .setTitle("صلاحية مرفوضة")
                    .setDescription(ED.earlyInteractions_027({ data }));

                await i.reply({ embeds: [embed], ephemeral: true });
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const userId = i.member.id;

        const data = await db.get(`shop_${i.channel.id}_${guildId}`);

        if (i.isModalSubmit()) {
            if (i.customId === "owner_modal") {
                if (i.user.id === data.sellerId) {
                    const owner = i.fields.getTextInputValue("NewownerId");
                    const owne_r = i.guild.members.cache.get(owner);
                    if (!owne_r) {
                        return i.reply({
                            content: "**الشخص المدخل ليس موجود بالسيرفر**",
                            ephemeral: true,
                        });
                    }

                    const existingowner = data.sellerId;

                    // التحقق مما إذا كان العضو شريكًا بالفعل
                    if (existingowner.includes(data.sellerId)) {
                        const alreadyPartnerEmbed = new EmbedBuilder()
                            .setDescription(ED.earlyInteractions_028({ data }))
                            .setColor(_ec.color(guildId))
                            .setFooter({ text: "Dev by : zain" })
                            .setTimestamp();

                        return i.reply({
                            embeds: [alreadyPartnerEmbed],
                            ephemeral: true,
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تغييــر الملــكية")
                        .setDescription(ED.earlyInteractions_029({ owner }))
                        .setFooter({ text: "Dev by :zain " })
                        //.setImage(`${config.line}`)
                        .setTimestamp();
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("confirmowner" + owner)
                                .setLabel("نعم")
                                .setStyle(ButtonStyle.Success)
                                .setEmoji(emojis.confirm),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("cancel")
                                .setLabel("الغاء")
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji(emojis.cancel),
                        );
                    await i.reply({
                        embeds: [embed],
                        components: [row],
                        ephemeral: true,
                    });
                }
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const userId = i.member.id;

        const ownerOld = await db.get(
            `shop_${i.channel.id}_${guildId}.sellerId`,
        );

        if (i.isButton()) {
            if (i.user.id === ownerOld) {
                if (i.customId.startsWith("confirmowner")) {
                    const newowner = i.customId.slice("confirmowner".length);
                    const data = await db.get(
                        `shop_${i.channel.id}_${guildId}`,
                    );
                    const oldOwnerId = data.sellerId;
                    const existingowner = data.sellerId;

                    const transfer = await db.get(`bank_${guildId}`);
                    const price = await db.get(`changeowner_${guildId}`);
                    const result = price;
                    const owntax = Math.floor(result * (20 / 19) + 1);

                    const embed = new EmbedBuilder()
                        .setDescription(
                            ED.earlyInteractions_030({
                                owntax,
                                price,
                                transfer,
                            }),
                        )
                        //.setImage(`${config.line}`)
                        .setFooter({ text: "Dev by : zain" })
                        .setTimestamp();

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("confirmowner")
                                .setLabel("نعم تم الاختيار")
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(true)
                                .setEmoji(emojis.confirm),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("cancel")
                                .setLabel("لا")
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                                .setEmoji(emojis.cancel),
                        );

                    await i.update({ embeds: [embed], components: [row] });
                    await i.channel.send({
                        content: `Re <@!${transfer}> ${owntax}`,
                        ephemeral: true,
                    });
                    const owne_r = i.guild.members.cache.get(ownerOld);
                    const Thebank = i.guild.members.cache.get(transfer);
                    const filter = ({ content, author: { id } }) => {
                        const userName = i.user.username; // اسم المستخدم
                        const botId = "1535048804078977164"; // معرف البوت
                        const totalPrice = result; // السعر المطلوب
                        const bankId = transfer.id; // معرف حساب البنك

                        // التحقق من الرسائل الإنجليزية
                        const startsWithEnglish = content.startsWith(
                            `**:moneybag: | ${userName}, has transferred `,
                        );
                        const includesBankEnglish = content.includes(
                            `<@!${transfer}>`,
                        );
                        const amountCheckEnglish =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(price).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق من الرسائل العربية
                        const startsWithArabic = content.includes(
                            `**ـ ${userName}, قام بتحويل`,
                        );
                        const includesBankArabic = content.includes(
                            `<@!${transfer}>`,
                        );
                        const amountCheckArabic =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(price).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق النهائي
                        return (
                            id === botId &&
                            ((startsWithEnglish &&
                                includesBankEnglish &&
                                amountCheckEnglish) ||
                                (startsWithArabic &&
                                    includesBankArabic &&
                                    amountCheckArabic))
                        );
                    };
                    const collector = i.channel.createMessageCollector({
                        filter,
                        max: 1,
                        time: 60000, // الوقت المخصص لجمع الرسائل (60 ثانية)
                    });
                    let iscollected = false;
                    collector.on("collect", async (collected) => {
                        iscollected = true;

                        await i.channel.permissionOverwrites.delete(oldOwnerId);
                        await i.channel.permissionOverwrites.edit(newowner, {
                            ViewChannel: true,
                            SendMessages: true,
                            EmbedLinks: true,
                            AddReactions: true,
                            UseExternalEmojis: true,
                            ReadMessageHistory: true,
                            MentionEveryone: true,
                            AttachFiles: true,
                        });

                        await db.set(
                            `shop_${i.channel.id}_${guildId}.sellerId`,
                            newowner,
                        );

                        const embeds = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء بنجاح")
                            .setDescription(
                                ED.earlyInteractions_031({ newowner }),
                            )
                            .setFooter({ text: "Dev by : zain" })
                            //.setImage(`${config.line}`)
                            .setTimestamp();

                        const guildName = i.guild.name;
                        const invoiceEmbed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                            .setDescription(
                                ED.earlyInteractions_032({
                                    Thebank,
                                    config,
                                    guildName,
                                    i,
                                    newowner,
                                    owntax,
                                    result,
                                    transfer,
                                }),
                            )

                            .setFooter(D.thanksFooter(i.guild))
                            .setThumbnail(D.thumb(i.guild))
                            .setTimestamp();
                        await i.user.send({ embeds: [invoiceEmbed] });

                        await i.channel.send({ embeds: [embeds] });
                    });

                    collector.on("end", (collected) => {
                        if (iscollected) return;
                        const embed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")

                            .setDescription(ED.earlyInteractions_033())
                            .setFooter({ text: "Dev by : zain" })
                            .setTimestamp();

                        i.channel.send({ embeds: [embed] });
                        console.log(`yes.`);
                    });
                }
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);

        if (i.isButton()) {
            if (i.customId === "changeName") {
                const bank = await db.get(`bank_${guildId}`);
                const changeName = await db.get(`changename_${guildId}`);

                if (!changeName) {
                    await i.reply({
                        content:
                            "يرجى تحديد سعر تغيير اسم المتجر عن طريق استخدام الأمر التالي: /setup-prices",
                        ephemeral: true,
                    });
                    return;
                }

                if (!bank) {
                    await i.reply({
                        content:
                            "يرجى تحديد البنك عن طريق استخدام الأمر التالي: /setup",
                        ephemeral: true,
                    });
                    return;
                }

                if (i.user.id === owner) {
                    const modal = new ModalBuilder()
                        .setCustomId("change_name_modal")
                        .setTitle("شراء تغيير اسم المتجر");

                    const thenewname = new TextInputBuilder()
                        .setCustomId("thenewname")
                        .setLabel("اسم المتجر الجديد")
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(100)
                        .setRequired(true);

                    const firstActionRow = new ActionRowBuilder().addComponents(
                        thenewname,
                    );
                    modal.addComponents(firstActionRow);
                    await i.showModal(modal);
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(_ec.color(guildId))
                        .setTitle("صلاحية مرفوضة")
                        .setDescription(ED.earlyInteractions_034({ owner }));

                    return i.reply({ embeds: [embed], ephemeral: true });
                }
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        if (i.isModalSubmit()) {
            if (i.customId === "change_name_modal") {
                const newname = i.fields.getTextInputValue("thenewname");

                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> شراء تغيير اسم المتجر")
                    .setDescription(ED.earlyInteractions_035({ newname }))
                    .setFooter({ text: "Dev by :zain" })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("confirm_change_name" + newname)
                        .setLabel("تأكيد الشراء")
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(emojis.confirm),
                );

                await i.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true,
                });
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        const guild = await client.guilds.fetch(guildId);
        const bankId = await db.get(`bank_${guildId}`);
        const transfer = await guild.members.fetch(bankId);
        const changeName = await db.get(`changename_${guildId}`);

        if (i.isButton() && i.customId.startsWith("confirm_change_name")) {
            if (i.user.id === owner) {
                const thename = i.customId.slice("confirm_change_name".length);
                const price = changeName;
                const tax = Math.floor(price * (20 / 19) + 1);
                const theoldname = i.channel.name;
                const embed = new EmbedBuilder()
                    .setDescription(
                        ED.earlyInteractions_036({
                            price,
                            tax,
                            thename,
                            transfer,
                        }),
                    )
                    .setFooter({ text: "Dev by :zain" })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("confirm_change_name")
                        .setLabel("تم الشراء")
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                        .setEmoji(emojis.confirm),
                );

                await i.update({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true,
                });
                await i.channel.send({
                    content: `Re ${transfer} ${tax}`,
                    ephemeral: true,
                });
                const result = price;
                const filter = ({ content, author: { id } }) => {
                    const userName = i.user.username; // اسم المستخدم
                    const botId = "1535048804078977164"; // معرف البوت
                    const totalPrice = result; // السعر المطلوب

                    // التحقق من الرسائل الإنجليزية
                    const startsWithEnglish = content.startsWith(
                        `**:moneybag: | ${userName}, has transferred `,
                    );
                    const includesBankEnglish = content.includes(
                        `<@!${bankId}>`,
                    );
                    const amountCheckEnglish =
                        Number(
                            content.slice(
                                content.lastIndexOf("`") - String(tax).length,
                                content.lastIndexOf("`"),
                            ),
                        ) >= totalPrice;

                    // التحقق من الرسائل العربية
                    const startsWithArabic = content.includes(
                        `**ـ ${userName}, قام بتحويل`,
                    );
                    const includesBankArabic = content.includes(
                        `<@!${bankId}>`,
                    );
                    const amountCheckArabic =
                        Number(
                            content.slice(
                                content.lastIndexOf("`") - String(tax).length,
                                content.lastIndexOf("`"),
                            ),
                        ) >= totalPrice;

                    // التحقق النهائي
                    return (
                        id === botId &&
                        ((startsWithEnglish &&
                            includesBankEnglish &&
                            amountCheckEnglish) ||
                            (startsWithArabic &&
                                includesBankArabic &&
                                amountCheckArabic))
                    );
                };

                const collector = i.channel.createMessageCollector({
                    filter,
                    max: 1,
                    time: 60000,
                });

                let iscollected = false;

                collector.on("collect", async (collected) => {
                    iscollected = true;
                    const data = await db.get(
                        `shop_${i.channel.id}_${guildId}`,
                    );

                    if (data) {
                        const datacatgory = await db.get(
                            `shop_${i.channel.id}_${guildId}.categoryId`,
                        );
                        const pirefix = await db.get(
                            `categoryMentions_${datacatgory}_${guildId}.pirefix`,
                        );
                        const catShopEmoji =
                            (await db.get(
                                `categoryMentions_${datacatgory}_${guildId}.shopEmoji`,
                            )) || "";
                        const shopOwnEmoji =
                            (await db.get(
                                `shop_${i.channel.id}_${guildId}.shopEmoji`,
                            )) || "";
                        const activeEmoji = shopOwnEmoji || catShopEmoji;
                        const builtPirefix = buildPrefix(pirefix, activeEmoji);

                        let shop = i.guild.channels.cache.get(i.channel.id);
                        const name2 = thename.replaceAll(" ", "・");
                        await shop.setName(`${builtPirefix}${name2}`);

                        const ernsing = Number(tax);
                        await db.add(`ernss_${guildId}.erns`, ernsing);
                        await db.add(`ernsg.ernsg`, ernsing);

                        const embed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء")
                            .setDescription(
                                ED.earlyInteractions_037({
                                    builtPirefix,
                                    i,
                                    name2,
                                    price,
                                    theoldname,
                                }),
                            )
                            .setFooter({ text: "Dev by :zain" })
                            .setTimestamp();

                        const guildName = guild.name;
                        const invoiceEmbed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                            .setDescription(
                                ED.earlyInteractions_038({
                                    bankId,
                                    builtPirefix,
                                    config,
                                    guildName,
                                    i,
                                    name2,
                                    result,
                                    tax,
                                    theoldname,
                                    transfer,
                                }),
                            )

                            .setFooter(D.thanksFooter(i.guild))
                            .setThumbnail(D.thumb(i.guild))
                            .setTimestamp();
                        await i.user.send({ embeds: [invoiceEmbed] });

                        await i.channel.send({ embeds: [embed] });

                        // إرسال إشعار إلى قناة السجلات
                    }
                });

                collector.on("end", (collected) => {
                    if (iscollected) return;
                    const embedf = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                        .setDescription(ED.earlyInteractions_039())
                        .setFooter(D.footer(i.guild))
                        .setThumbnail(D.thumb(i.guild))
                        .setTimestamp();

                    i.channel.send({ embeds: [embedf] });
                });
            }
        }
    });

    ///
    // remove warns
    ///////////////
    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);

        if (i.isButton()) {
            if (i.customId === "remove_warn") {
                const bank = await db.get(`bank_${guildId}`);
                const removeWarnCredit = await db.get(
                    `removewarncredit_${guildId}`,
                );

                if (!removeWarnCredit) {
                    await i.reply({
                        content:
                            "يرجى تحديد سعر حذف التحذير الواحد عن طريق استخدام الأمر التالي: /setup",
                        ephemeral: true,
                    });
                    return;
                }

                if (!bank) {
                    await i.reply({
                        content:
                            "يرجى تحديد البنك عن طريق استخدام الأمر التالي: /setup",
                        ephemeral: true,
                    });
                    return;
                }

                if (i.user.id === owner) {
                    const modal = new ModalBuilder()
                        .setCustomId("remove_warn_modal")
                        .setTitle("شراء حذف تحذيرات");

                    const warnAmount = new TextInputBuilder()
                        .setCustomId("warn_amount")
                        .setLabel("عدد التحذيرات التي تريد حذفها")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const firstActionRow = new ActionRowBuilder().addComponents(
                        warnAmount,
                    );
                    modal.addComponents(firstActionRow);
                    await i.showModal(modal);
                }
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        if (i.isModalSubmit()) {
            if (i.customId === "remove_warn_modal") {
                const amount = i.fields.getTextInputValue("warn_amount");

                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> شراء حذف تحذيرات")
                    .setDescription(ED.earlyInteractions_040({ amount }))
                    .setFooter({ text: "Dev by :zain" })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("confirm_remove_warn" + amount)
                        .setLabel("تأكيد الشراء")
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(emojis.confirm),
                );

                await i.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true,
                });
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        const guild = await client.guilds.fetch(guildId);
        const bankId = await db.get(`bank_${guildId}`);
        const transfer = await guild.members.fetch(bankId);
        const removeWarnCredit = await db.get(`removewarncredit_${guildId}`);

        if (i.isButton() && i.customId.startsWith("confirm_remove_warn")) {
            if (i.user.id === owner) {
                const amount = i.customId.slice("confirm_remove_warn".length);
                const price = amount * removeWarnCredit;
                const tax = Math.floor(price * (20 / 19) + 1);

                const embed = new EmbedBuilder()
                    .setDescription(
                        ED.earlyInteractions_041({
                            amount,
                            price,
                            tax,
                            transfer,
                        }),
                    )
                    .setFooter({ text: "Dev by :zain" })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("confirm_remove_warn")
                        .setLabel("تم الشراء")
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                        .setEmoji(emojis.confirm),
                );

                await i.update({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true,
                });
                await i.channel.send({
                    content: `Re ${transfer} ${tax}`,
                    ephemeral: true,
                });
                const result = price;
                const filter = ({ content, author: { id } }) => {
                    const userName = i.user.username; // اسم المستخدم
                    const botId = "1535048804078977164"; // معرف البوت
                    const totalPrice = result; // السعر المطلوب

                    // التحقق من الرسائل الإنجليزية
                    const startsWithEnglish = content.startsWith(
                        `**:moneybag: | ${userName}, has transferred `,
                    );
                    const includesBankEnglish = content.includes(
                        `<@!${bankId}>`,
                    );
                    const amountCheckEnglish =
                        Number(
                            content.slice(
                                content.lastIndexOf("`") - String(tax).length,
                                content.lastIndexOf("`"),
                            ),
                        ) >= totalPrice;

                    // التحقق من الرسائل العربية
                    const startsWithArabic = content.includes(
                        `**ـ ${userName}, قام بتحويل`,
                    );
                    const includesBankArabic = content.includes(
                        `<@!${bankId}>`,
                    );
                    const amountCheckArabic =
                        Number(
                            content.slice(
                                content.lastIndexOf("`") - String(tax).length,
                                content.lastIndexOf("`"),
                            ),
                        ) >= totalPrice;

                    // التحقق النهائي
                    return (
                        id === botId &&
                        ((startsWithEnglish &&
                            includesBankEnglish &&
                            amountCheckEnglish) ||
                            (startsWithArabic &&
                                includesBankArabic &&
                                amountCheckArabic))
                    );
                };

                const collector = i.channel.createMessageCollector({
                    filter,
                    max: 1,
                    time: 60000,
                });

                let iscollected = false;

                collector.on("collect", async (collected) => {
                    iscollected = true;
                    const data = await db.get(
                        `shop_${i.channel.id}_${guildId}`,
                    );

                    if (data) {
                        // التأكد أن عدد التحذيرات المتبقية لا يصبح سالبًا
                        const newWarns = Math.max(0, data.warns - amount);
                        await db.set(
                            `shop_${i.channel.id}_${guildId}.warns`,
                            newWarns,
                        );

                        const ernsing = Number(tax);
                        await db.add(`ernss_${guildId}.erns`, ernsing);
                        await db.add(`ernsg.ernsg`, ernsing);

                        const embedv = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء بنجاح")
                            .setDescription(
                                ED.earlyInteractions_042({ amount, newWarns }),
                            )
                            .setFooter({ text: "Dev by :zain" })
                            .setTimestamp();

                        const embed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية حذف التحذيرات")
                            .setDescription(
                                ED.earlyInteractions_043({
                                    amount,
                                    i,
                                    newWarns,
                                    price,
                                }),
                            )
                            .setFooter({ text: "Dev by :zain" })
                            .setTimestamp();

                        const guildName = guild.name;
                        const invoiceEmbed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                            .setDescription(
                                ED.earlyInteractions_044({
                                    amount,
                                    bankId,
                                    config,
                                    guildName,
                                    i,
                                    result,
                                    tax,
                                    transfer,
                                }),
                            )

                            .setFooter(D.thanksFooter(i.guild))
                            .setThumbnail(D.thumb(i.guild))
                            .setTimestamp();
                        await i.user.send({ embeds: [invoiceEmbed] });

                        await i.channel.send({ embeds: [embedv] });

                        // إرسال إشعار إلى قناة السجلات
                    }
                });

                collector.on("end", (collected) => {
                    if (iscollected) return;
                    const embedf = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                        .setDescription(ED.earlyInteractions_045())
                        .setFooter(D.footer(i.guild))
                        .setThumbnail(D.thumb(i.guild))
                        .setTimestamp();

                    i.channel.send({ embeds: [embedf] });
                });
            }
        }
    });
    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.isButton()) {
            if (i.customId === "mention") {
                const bank = await db.get(`bank_${guildId}`);
                const evrypri = await db.get(`evrypri_${guildId}`);
                const herepri = await db.get(`herepri_${guildId}`);
                const shoppri = await db.get(`shopprice_${guildId}`);
                if (!evrypri) {
                    await i.reply({
                        content:
                            "يرجى تحديد سعر منشن الايفري عن طريق استخدام الامر الاتي: /setup",
                        ephemeral: true,
                    });
                    return;
                }
                if (!herepri) {
                    await i.reply({
                        content:
                            "يرجى تحديد سعر منشن الهير عن طريق استخدام الامر الاتي: /setup",
                        ephemeral: true,
                    });
                    return;
                }
                if (!shoppri) {
                    await i.reply({
                        content:
                            "يرجى تحديد سعر منشن متاجر عن طريق استخدام الامر الاتي: /setup",
                        ephemeral: true,
                    });
                    return;
                }
                if (!bank) {
                    await i.reply({
                        content:
                            "يرجى تحديد البنك عن طريق استخدام الامر الاتي: /setup",
                        ephemeral: true,
                    });
                    return;
                }
                if (i.user.id === owner) {
                    const modal = new ModalBuilder()
                        .setCustomId("mention_modal")
                        .setTitle("شراء منشنات");
                    const mentionStyle = new TextInputBuilder()
                        .setCustomId("amount")
                        .setLabel("اكتب عدد المنشنات التي تريد شرائها")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const firstActionRow = new ActionRowBuilder().addComponents(
                        mentionStyle,
                    );
                    modal.addComponents(firstActionRow);
                    await i.showModal(modal);
                }
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        if (i.isModalSubmit()) {
            if (i.customId === "mention_modal") {
                const amount = i.fields.getTextInputValue("amount");
                if (isNaN(amount)) {
                    return i.reply({
                        content: " **العدد المدخل يجب ان يكون ارقام فقط**",
                        ephemeral: true,
                    });
                }
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> شراء منشنات")
                    .setDescription(ED.earlyInteractions_046({ amount }))
                    .setFooter({ text: "Dev by : zain" })
                    .setTimestamp();
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("shop" + amount)
                            .setLabel("منشن متاجر")
                            .setStyle(ButtonStyle.Primary),
                    )
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("here" + amount)
                            .setLabel("منشن هير")
                            .setStyle(ButtonStyle.Primary),
                    )
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("everyone" + amount)
                            .setLabel("منشن افري")
                            .setStyle(ButtonStyle.Primary),
                    )
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("cancel")
                            .setLabel("الغاء")
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji(emojis.mentionOrder),
                    );
                await i.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true,
                });
            }
        }
    });
    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);

        const guild = await client.guilds.fetch(guildId);
        const bankId = await db.get(`bank_${guildId}`);
        // const transfer = await client.users.fetch(bankId);
        const transfer = await guild.members.fetch(bankId);
        if (!transfer) {
            await i.reply({
                content: `
عفــوا لم اجد حساب البنك (العضو)
-# تاكد انه داخل السيرفر`,
                ephemeral: true,
            });
            return;
        }

        if (i.isButton()) {
            if (i.user.id === owner) {
                if (i.customId.startsWith("shop")) {
                    const amount = i.customId.slice("shop".length);
                    const price = await db.get(`shopprice_${guildId}`);
                    const result = amount * price;
                    const shoptax = Math.floor(result * (20 / 19) + 1);
                    const embed = new EmbedBuilder()
                        .setDescription(
                            ED.earlyInteractions_047({
                                amount,
                                result,
                                shoptax,
                                transfer,
                            }),
                        )
                        .setFooter({ text: "Dev by :zain " })
                        .setTimestamp();
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("shop")
                                .setLabel("منشن متاجر")
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("here")
                                .setLabel("منشن هير")
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("everyone")
                                .setLabel("منشن افري")
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("cancel")
                                .setLabel("الغاء")
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                                .setEmoji(emojis.mentionOrder),
                        );
                    await i.update({ embeds: [embed], components: [row] });
                    await i.channel.send({
                        content: `Re ${transfer} ${shoptax}`,
                        ephemeral: true,
                    });
                    const filter = ({ content, author: { id } }) => {
                        const userName = i.user.username; // اسم المستخدم
                        const botId = "1535048804078977164"; // معرف البوت
                        const totalPrice = result; // السعر المطلوب
                        const bankId = transfer.id; // معرف حساب البنك

                        // التحقق من الرسائل الإنجليزية
                        const startsWithEnglish = content.startsWith(
                            `**:moneybag: | ${userName}, has transferred `,
                        );
                        const includesBankEnglish = content.includes(
                            `<@!${bankId}>`,
                        );
                        const amountCheckEnglish =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(shoptax).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق من الرسائل العربية
                        const startsWithArabic = content.includes(
                            `**ـ ${userName}, قام بتحويل`,
                        );
                        const includesBankArabic = content.includes(
                            `<@!${bankId}>`,
                        );
                        const amountCheckArabic =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(shoptax).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق النهائي
                        return (
                            id === botId &&
                            ((startsWithEnglish &&
                                includesBankEnglish &&
                                amountCheckEnglish) ||
                                (startsWithArabic &&
                                    includesBankArabic &&
                                    amountCheckArabic))
                        );
                    };

                    // إنشاء جامع الرسائل (Collector)
                    const collector = i.channel.createMessageCollector({
                        filter,
                        max: 1,
                        time: 60000, // الوقت المخصص لجمع الرسائل (60 ثانية)
                    });
                    let iscollected = false;
                    collector.on("collect", async (collected) => {
                        iscollected = true;
                        const data = await db.get(
                            `shop_${i.channel.id}_${guildId}`,
                        );
                        if (data) {
                            await db.add(
                                `shop_${i.channel.id}_${guildId}.shopRoleMentions`,
                                amount,
                            );

                            const ernsing = Number(shoptax);
                            await db.add(`ernss_${guildId}.erns`, ernsing);

                            await db.add(`ernsg.ernsg`, ernsing);

                            const embedv = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء بنجاح")
                                .setDescription(
                                    ED.earlyInteractions_048({ amount, data }),
                                )
                                .setFooter({ text: "Dev by :zain " })
                                .setTimestamp();

                            const embed = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء منشنات")
                                .setDescription(
                                    ED.earlyInteractions_049({
                                        amount,
                                        i,
                                        result,
                                    }),
                                )
                                .setFooter({ text: "Dev by :zain " })
                                .setTimestamp();

                            const guildName = guild.name;
                            const invoiceEmbed = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                                .setDescription(
                                    ED.earlyInteractions_050({
                                        amount,
                                        bankId,
                                        config,
                                        guildName,
                                        i,
                                        result,
                                        shoptax,
                                        transfer,
                                    }),
                                )

                                .setFooter(D.thanksFooter(i.guild))
                                .setThumbnail(D.thumb(i.guild))
                                .setTimestamp();
                            await i.user.send({ embeds: [invoiceEmbed] });

                            await i.channel.send({ embeds: [embedv] });
                        }
                    });

                    collector.on("end", (collected) => {
                        if (iscollected) return;
                        const embedf = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_051())
                            .setFooter(D.footer(i.guild))
                            .setThumbnail(D.thumb(i.guild))
                            .setTimestamp();

                        i.channel.send({ embeds: [embedf] });
                        console.log(`non`);
                    });
                }
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);

        const guild = await client.guilds.fetch(guildId);
        const bankId = await db.get(`bank_${guildId}`);
        // const transfer = await client.users.fetch(bankId);
        const transfer = await guild.members.fetch(bankId);
        if (!transfer) {
            await i.reply({
                content: `
عفــوا لم اجد حساب البنك (العضو)
-# تاكد انه داخل السيرفر`,
                ephemeral: true,
            });
            return;
        }

        if (i.isButton()) {
            if (i.user.id === owner) {
                if (i.customId.startsWith("here")) {
                    const amount = i.customId.slice("here".length);
                    const price = await db.get(`herepri_${guildId}`);
                    const result = amount * price;
                    const heretax = Math.floor(result * (20 / 19) + 1);
                    const embed = new EmbedBuilder()
                        .setDescription(
                            ED.earlyInteractions_052({
                                amount,
                                heretax,
                                result,
                                transfer,
                            }),
                        )
                        .setFooter({ text: "Dev by :zain " })
                        .setTimestamp();
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("shop")
                                .setLabel("منشن متاجر")
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("here")
                                .setLabel("منشن هير")
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("everyone")
                                .setLabel("منشن افري")
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("cancel")
                                .setLabel("الغاء")
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                                .setEmoji(emojis.mentionOrder),
                        );
                    await i.update({ embeds: [embed], components: [row] });
                    await i.channel.send({
                        content: `Re ${transfer} ${heretax}`,
                        ephemeral: true,
                    });
                    const filter = ({ content, author: { id } }) => {
                        const userName = i.user.username; // اسم المستخدم
                        const botId = "1535048804078977164"; // معرف البوت
                        const totalPrice = result; // السعر المطلوب
                        const bankId = transfer.id; // معرف حساب البنك

                        // التحقق من الرسائل الإنجليزية
                        const startsWithEnglish = content.startsWith(
                            `**:moneybag: | ${userName}, has transferred `,
                        );
                        const includesBankEnglish = content.includes(
                            `<@!${bankId}>`,
                        );
                        const amountCheckEnglish =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(heretax).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق من الرسائل العربية
                        const startsWithArabic = content.includes(
                            `**ـ ${userName}, قام بتحويل`,
                        );
                        const includesBankArabic = content.includes(
                            `<@!${bankId}>`,
                        );
                        const amountCheckArabic =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(heretax).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق النهائي
                        return (
                            id === botId &&
                            ((startsWithEnglish &&
                                includesBankEnglish &&
                                amountCheckEnglish) ||
                                (startsWithArabic &&
                                    includesBankArabic &&
                                    amountCheckArabic))
                        );
                    };

                    // إنشاء جامع الرسائل (Collector)
                    const collector = i.channel.createMessageCollector({
                        filter,
                        max: 1,
                        time: 60000, // الوقت المخصص لجمع الرسائل (60 ثانية)
                    });
                    let iscollected = false;
                    collector.on("collect", async (collected) => {
                        iscollected = true;
                        const data = await db.get(
                            `shop_${i.channel.id}_${guildId}`,
                        );
                        if (data) {
                            await db.add(
                                `shop_${i.channel.id}_${guildId}.hereMentions`,
                                amount,
                            );

                            const ernsing = Number(heretax);
                            await db.add(`ernss_${guildId}.erns`, ernsing);

                            await db.add(`ernsg.ernsg`, ernsing);

                            const embedv = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء بنجاح")
                                .setDescription(
                                    ED.earlyInteractions_053({ amount, data }),
                                )
                                .setFooter({ text: "Dev by :zain " })
                                .setTimestamp();

                            const embed = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء منشنات")
                                .setDescription(
                                    ED.earlyInteractions_054({
                                        amount,
                                        i,
                                        result,
                                    }),
                                )
                                .setFooter({ text: "Dev by :zain " })
                                .setTimestamp();

                            const guildName = guild.name;
                            const invoiceEmbed = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                                .setDescription(
                                    ED.earlyInteractions_055({
                                        amount,
                                        bankId,
                                        config,
                                        guildName,
                                        heretax,
                                        i,
                                        result,
                                        transfer,
                                    }),
                                )

                                .setFooter(D.thanksFooter(i.guild))
                                .setThumbnail(D.thumb(i.guild))
                                .setTimestamp();
                            await i.user.send({ embeds: [invoiceEmbed] });

                            await i.channel.send({ embeds: [embedv] });
                        }
                    });

                    collector.on("end", (collected) => {
                        if (iscollected) return;
                        const embedf = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_056())
                            .setFooter(D.footer(i.guild))
                            .setThumbnail(D.thumb(i.guild))
                            .setTimestamp();

                        i.channel.send({ embeds: [embedf] });
                        console.log(`non`);
                    });
                }
            }
        }
    });

    client.on("interactionCreate", async (i) => {
        const guildId = i.guild.id;
        let shop = i.channel;
        const shopData = await db.get(`shop_${shop.id}_${guildId}`);
        const setings = shopData;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);

        const guild = await client.guilds.fetch(guildId);
        const bankId = await db.get(`bank_${guildId}`);

        const transfer = await guild.members.fetch(bankId);
        if (!transfer) {
            await i.reply({
                content: `
عفــوا لم اجد حساب البنك (العضو)
-# تاكد انه داخل السيرفر`,
                ephemeral: true,
            });
            return;
        }
        if (i.isButton()) {
            if (i.user.id === owner) {
                if (i.customId.startsWith("everyone")) {
                    const amount = i.customId.slice("everyone".length);

                    const price = await db.get(`evrypri_${guildId}`);

                    const result = amount * price;
                    const evrytax = Math.floor(result * (20 / 19) + 1);
                    const embed = new EmbedBuilder()
                        .setDescription(
                            ED.earlyInteractions_057({
                                amount,
                                evrytax,
                                result,
                                transfer,
                            }),
                        )
                        .setFooter({ text: "Dev by :zain " })
                        .setTimestamp();

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("shop")
                                .setLabel("منشن متاجر")
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("here")
                                .setLabel("منشن هير")
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("everyone")
                                .setLabel("منشن افري")
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true),
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("cancel")
                                .setLabel("الغاء")
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                                .setEmoji(emojis.mentionOrder),
                        );

                    await i.update({
                        embeds: [embed],
                        components: [row],
                        ephemeral: true,
                    });
                    await i.channel.send({
                        content: `Re ${transfer} ${evrytax}`,
                        ephemeral: true,
                    });
                    const filter = ({ content, author: { id } }) => {
                        const userName = i.user.username; // اسم المستخدم
                        const botId = "1535048804078977164"; // معرف البوت
                        const totalPrice = result; // السعر المطلوب
                        const bankId = transfer.id; // معرف حساب البنك

                        // التحقق من الرسائل الإنجليزية
                        const startsWithEnglish = content.startsWith(
                            `**:moneybag: | ${userName}, has transferred `,
                        );
                        const includesBankEnglish = content.includes(
                            `<@!${bankId}>`,
                        );
                        const amountCheckEnglish =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(evrytax).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق من الرسائل العربية
                        const startsWithArabic = content.includes(
                            `**ـ ${userName}, قام بتحويل`,
                        );
                        const includesBankArabic = content.includes(
                            `<@!${bankId}>`,
                        );
                        const amountCheckArabic =
                            Number(
                                content.slice(
                                    content.lastIndexOf("`") -
                                        String(evrytax).length,
                                    content.lastIndexOf("`"),
                                ),
                            ) >= totalPrice;

                        // التحقق النهائي
                        return (
                            id === botId &&
                            ((startsWithEnglish &&
                                includesBankEnglish &&
                                amountCheckEnglish) ||
                                (startsWithArabic &&
                                    includesBankArabic &&
                                    amountCheckArabic))
                        );
                    };

                    // إنشاء جامع الرسائل (Collector)
                    const collector = i.channel.createMessageCollector({
                        filter,
                        max: 1,
                        time: 60000, // الوقت المخصص لجمع الرسائل (60 ثانية)
                    });
                    let iscollected = false;
                    collector.on("collect", async (collected) => {
                        iscollected = true;
                        const data = await db.get(
                            `shop_${i.channel.id}_${guildId}`,
                        );
                        if (data) {
                            await db.add(
                                `shop_${i.channel.id}_${guildId}.everyoneMentions`,
                                amount,
                            );

                            const embedv = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء بنجاح")
                                .setDescription(
                                    ED.earlyInteractions_058({ amount, data }),
                                )
                                .setFooter({ text: "Dev by :zain " })
                                .setTimestamp();

                            const embedq = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت عملية الشراء منشنات")
                                .setDescription(
                                    ED.earlyInteractions_059({
                                        amount,
                                        i,
                                        result,
                                    }),
                                )
                                .setFooter({ text: "Dev by :zain " })
                                .setTimestamp();
                            const guildName = guild.name;
                            const invoiceEmbed = new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة الشراء -")
                                .setDescription(
                                    ED.earlyInteractions_060({
                                        amount,
                                        bankId,
                                        config,
                                        evrytax,
                                        guildName,
                                        i,
                                        result,
                                        transfer,
                                    }),
                                )

                                .setFooter(D.thanksFooter(i.guild))
                                .setThumbnail(D.thumb(i.guild))
                                .setTimestamp();
                            await i.user.send({ embeds: [invoiceEmbed] });
                            await i.channel.send({ embeds: [embedv] });
                        }
                    });
                    collector.on("end", (collected) => {
                        if (iscollected) return;
                        const embedc = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_061())
                            .setFooter(D.footer(i.guild))
                            .setThumbnail(D.thumb(i.guild))
                            .setTimestamp();
                        i.channel.send({ embeds: [embedc] });
                        console.log(`yes`);
                    });
                }
            }
        }
    });

    const keyword = [
        "متجر",
        "متجري",
        "متجرها",
        "متجره",
        "متجرك",
        "متجركم",
        "متجرهم",
        "متجرنا",
        "عرض",
        "عرضي",
        "عرضك",
        "عرضكم",
        "عرضهم",
        "عرضنا",
        "عروض",
        "عروضي",
        "عروضك",
        "عروضكم",
        "عروضهم",
        "عروضنا",
        "حساب",
        "حسابي",
        "حسابك",
        "حسابكم",
        "حسابهم",
        "حسابنا",
        "حسابات",
        "حساباتي",
        "حساباتك",
        "حساباتكم",
        "حساباتهم",
        "حساباتنا",
        "متوفر",
        "متوفري",
        "متوفرها",
        "متوفره",
        "متوفرك",
        "متوفركم",
        "متوفرهم",
        "متوفرنا",
        "شوب",
        "شوبك",
        "شوبكم",
        "شوبهم",
        "شوبنا",
        "اوفر",
        "اوفرها",
        "اوفره",
        "اوفرك",
        "اوف �كم",
        "اوفرهم",
        "اوفرنا",
        "بيع",
        "بيعي",
        "بيعك",
        "بيعكم",
        "بيعهم",
        "بيعنا",
        "للبيع",
        "للبيعي",
        "للبيعك",
        "للبيعكم",
        "للبيعهم",
        "للبيعنا",
        "ابيع",
        "ابيعك",
        "ابيعكم",
        "ابيعهم",
        "ابيعنا",
        "بوست",
        "بوستك",
        "بوستكم",
        "بوستهم",
        "بوستنا",
        "نيترو",
        "نيتروك",
        "نيتروكم",
        "نيتروهم",
        "نيترونا",
        "روبكس",
        "روبكسك",
        "روبكسكم",
        "روبكسهم",
        "روبكسنا",
        "سعر",
        "سعري",
        "سعرها",
        "سعره",
        "سعرك",
        "سعركم",
        "سعرهم",
        "سعرنا",
        "تبدخاص",
        "تبدخاصك",
        "تبدخاصكم",
        "تبدخاصهم",
        "تبدخاصنا",
        "مطلوب",
        "مطلوبة",
        "مطلوبك",
        "مطلوبكم",
        "مطلوبهم",
        "مطلوبنا",
        "اطلب",
        "اطلبك",
        "اطلبكم",
        "اطلبهم",
        "اطلبنا",
        "مقابل",
        "تبادل",
        "خاص",
        "كريدت",
        "كريدة",
        "كريديت",
        "كردت",
        "wwewewwewwyuyuhuhujhvuvcyucyww",
    ];
    //const { loadImage } = require('canvas'); // Make sure you import loadImage from 'canvas'
    client.on("messageCreate", async (message) => {
        if (!message.guild) return;
        const guildId = message.guild.id;
        if (!message.guild || message.author.bot) return;

        const shopAdmin = await db.get(`shopad_${guildId}`);
        if (shopAdmin && message.member.roles.cache.has(shopAdmin)) return; // تجاهل إذا كان لديه دور مسؤول المتاجر

        const sellerId = await db.get(
            `shop_${message.channel.id}_${guildId}.sellerId`,
        );
        const shoppp = await db.get(`shop_${message.channel.id}_${guildId}`);

        if (shoppp) {
            const foundKeywords = keywords.filter((word) =>
                message.content.includes(word),
            );
            if (foundKeywords.length > 0) {
                // عرض أول 5 كلمات فقط
                let keywordMessage = foundKeywords.slice(0, 5).join(", ");
                if (foundKeywords.length > 5) {
                    const remainingCount = foundKeywords.length - 5;
                    keywordMessage += ` +${remainingCount} more`;
                }

                const warningTime = new Date().toLocaleString();
                const warnsCount = Math.floor(shoppp.warns + 1);

                // إنشاء الإيمبد لتحذير المتجر
                const embed = new EmbedBuilder()
                    .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> **تم تحذير المتجر ${message.channel.url}**`)
                    .setDescription(ED.earlyInteractions_062({ config }))
                    .addFields(
                        {
                            name: "صاحب المتجر:",
                            value: `<@${sellerId}>`,
                            inline: true,
                        },
                        {
                            name: "عدد تحذيرات المتجر:",
                            value: `${warnsCount}`,
                            inline: true,
                        },
                        {
                            name: "سبب التحذير:",
                            value: `عدم تشفير الكلمات: ${keywordMessage}`,
                            inline: false,
                        },
                        { name: "وقت التحذير:", value: warningTime },
                    )
                    .setColor(_ec.color(guildId));

                // إرسال التحذير في القناة
                await message.channel.send({
                    content: `<@${sellerId}>`,
                    embeds: [embed],
                });

                // إرسال التحذير في قناة السجل (log channel)
                const logChannelId = await db.get(`logs_${guildId}`);
                if (logChannelId) {
                    const logChannel =
                        await message.guild.channels.fetch(logChannelId);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> **تحذير تم إرساله إلى المتجر**")
                            .addFields(
                                {
                                    name: "رابط المتجر:",
                                    value: `<#${message.channel.id}>`,
                                    inline: true,
                                },
                                {
                                    name: "صاحب المتجر:",
                                    value: `<@${sellerId}>`,
                                    inline: true,
                                },
                                {
                                    name: "عدد تحذيرات المتجر:",
                                    value: `${warnsCount}`,
                                    inline: true,
                                },
                                {
                                    name: "سبب التحذير:",
                                    value: `عدم تشفير الكلمات: ${keywordMessage}`,
                                    inline: false,
                                },
                                {
                                    name: "رابط الرسالة:",
                                    value: `[اضغط هنا](${message.url})`,
                                    inline: false,
                                },
                            )
                            .setColor(_ec.color(guildId));

                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }

                // تحديث عدد التحذيرات في قاعدة البيانات
                db.add(`shop_${message.channel.id}_${guildId}.warns`, 1);
            }
        }
    });

    client.on("messageCreate", async (message) => {
        if (message.content.startsWith("+معلومات")) {
            // تحديد معرف المستخدم
            const userId = message.author.id;
            if (!message.guild) return;
            const guildId = message.guild.id;

            // جلب جميع بيانات المتاجر
            const allEntries = await db.all();

            // تصفية المتاجر الخاصة بالمستخدم
            const userShops = allEntries.filter(
                (entry) =>
                    entry.id.startsWith("shop_") &&
                    entry.value.sellerId === userId,
            );
            const shopCount = userShops.length;

            // جلب التحذيرات الخاصة بالمستخدم
            const userWarnings =
                (await db.get(`warnings_${guildId}_${userId}`)) || 0;

            // حساب التحذيرات الخاصة بالمتاجر
            const userShopWarnings = userShops.reduce(
                (acc, entry) => acc + (entry.value.warns || 0),
                0,
            );

            // حساب التحذيرات الكلية بالسيرفر
            const totalWarnings = allEntries
                .filter((entry) => entry.id.startsWith("shop_"))
                .reduce((acc, entry) => acc + (entry.value.warns || 0), 0);

            // حساب المنشنات الخاصة بالمستخدم
            const userMentionsEvery = userShops.reduce(
                (acc, entry) => acc + (entry.value.everyoneMentions || 0),
                0,
            );
            const userMentionsHere = userShops.reduce(
                (acc, entry) => acc + (entry.value.hereMentions || 0),
                0,
            );
            const userMentionsShop = userShops.reduce(
                (acc, entry) => acc + (entry.value.shopRoleMentions || 0),
                0,
            );

            // حساب المنشنات الكلية بالسيرفر
            const totalMentionsEvery = allEntries
                .filter((entry) => entry.id.startsWith("shop_"))
                .reduce(
                    (acc, entry) => acc + (entry.value.everyoneMentions || 0),
                    0,
                );
            const totalMentionsHere = allEntries
                .filter((entry) => entry.id.startsWith("shop_"))
                .reduce(
                    (acc, entry) => acc + (entry.value.hereMentions || 0),
                    0,
                );
            const totalMentionsShop = allEntries
                .filter((entry) => entry.id.startsWith("shop_"))
                .reduce(
                    (acc, entry) => acc + (entry.value.shopRoleMentions || 0),
                    0,
                );

            // عدد المتاجر الإجمالية المسجلة
            const totalShops = allEntries.filter((entry) =>
                entry.id.startsWith("shop_"),
            ).length;

            // عدد الردود التلقائية
            const autorepliesCount = allEntries.filter((entry) =>
                entry.id.startsWith("autoreply_"),
            ).length;

            // عدد الكلمات الممنوعة
            const bannedWords = (await db.get("bannedWords")) || [];
            const bannedWordsCount = bannedWords.length;

            // إنشاء رسالة الإيمبد
            const embed = new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> معلومات المستخدم و السيرفر و البوت: `)
                .addFields(
                    {
                        name: "عدد المتاجر الخاصة فيك",
                        value: shopCount.toString(),
                        inline: true,
                    },
                    {
                        name: "تحذيرات متجر الخاصه فيك",
                        value: userShopWarnings.toString(),
                        inline: true,
                    },
                    {
                        name: " عدد التحذيرات لإجمالية المسجلة ",
                        value: totalWarnings.toString(),
                        inline: true,
                    },
                    {
                        name: "عدد المتاجر الإجمالية المسجلة",
                        value: totalShops.toString(),
                        inline: true,
                    },
                    {
                        name: "منشنات Everyone الخاصة فيك",
                        value: userMentionsEvery.toString(),
                        inline: true,
                    },
                    {
                        name: "منشنات Here الخاصة فيك",
                        value: userMentionsHere.toString(),
                        inline: true,
                    },
                    {
                        name: "منشنات المتجر الخاصة فيك",
                        value: userMentionsShop.toString(),
                        inline: true,
                    },
                    {
                        name: "منشنات Everyone الكلية المسجله",
                        value: totalMentionsEvery.toString(),
                        inline: true,
                    },
                    {
                        name: "منشنات Here الكلية المسجله",
                        value: totalMentionsHere.toString(),
                        inline: true,
                    },
                    {
                        name: "منشنات المتجر الكلية المسجله",
                        value: totalMentionsShop.toString(),
                        inline: true,
                    },
                    {
                        name: "عدد الردود التلقائية",
                        value: autorepliesCount.toString(),
                        inline: true,
                    },
                )
                .setColor(_ec.color(guildId))
                .setTimestamp();

            // إرسال رسالة الإيمبد
            message.channel.send({ embeds: [embed] });
        }
    });

    client.on("messageCreate", (message) => {
        // تحقق من أن الأمر يتم تنفيذه بواسطة مسؤول
        if (
            message.content === "!deleteTickets" &&
            message.member.permissions.has("ADMINISTRATOR")
        ) {
            // احصل على السيرفر
            const guild = message.guild;

            if (guild) {
                guild.channels.cache.forEach((channel) => {
                    if (channel.name.startsWith("ticket-")) {
                        channel
                            .delete()
                            .then(() =>
                                console.log(`Deleted channel: ${channel.name}`),
                            )
                            .catch(console.error);
                    }
                });
                message.reply('جميع الرومات التي تبدأ بـ "ticket-" تم حذفها.');
            } else {
                message.reply("لم أتمكن من العثور على السيرفر.");
            }
        } else if (message.content === "!deleteTickets") {
            message.reply("يجب أن تكون مسؤول السيرفر لتنفيذ هذا الأمر.");
        }
    });

    // ====================================================
    // HELPER: payment filter factory
    // ====================================================
    function makePayFilter(userName, bankId, totalPrice, tax) {
        return ({ content, author: { id } }) => {
            const botId = "1535048804078977164";
            if (id !== botId) return false;

            let paidAmount = 0;
            const backtickMatch = content.match(/`\$?([\d,]+(?:\.\d+)?)`/);
            const engMatch = content.match(/transferred\s+\$?([\d,]+)/i);
            const arMatch = content.match(/بتحويل\s+\$?([\d,]+)/);
            const found = backtickMatch || engMatch || arMatch;
            if (found) paidAmount = Number(found[1].replace(/,/g, ""));
            const amountOk = paidAmount >= totalPrice;

            const bankMentionOk =
                content.includes(`<@!${bankId}>`) ||
                content.includes(`<@${bankId}>`);

            const isTransfer =
                content.includes("has transferred") ||
                content.includes("قام بتحويل");

            const matched = isTransfer && bankMentionOk && amountOk;
            return matched;
        };
    }

    // ====================================================
    // HELPER: build channel prefix from prif template + emoji
    // ====================================================
    function buildPrefix(pirefix, shopEmoji) {
        if (!pirefix) return "";
        const e = shopEmoji || "";
        if (pirefix.includes("هنا")) return pirefix.replaceAll("هنا", e);
        if (pirefix.includes("{emoji}"))
            return pirefix.replaceAll("{emoji}", e);
        if (pirefix.includes("= ايموجي"))
            return pirefix.replaceAll("= ايموجd�", e);
        return pirefix;
    }

    // ====================================================
    // 1. تغيير شكل المتجر — يظهر زرين
    // ====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "changeshape") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ صاحب المتجر فقط يقدر يستخدم هذا الزر",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`changeshape_${guildId}`);
        if (!price)
            return i.reply({
                content:
                    "❌ سعر تغيير شكل المتجر غير محدد، استخدم /setup-prices",
                flags: MessageFlags.Ephemeral,
            });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("changeshape_emoji")
                .setLabel("تغيير إيموجي المتجر")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.emojiChange),
            new ButtonBuilder()
                .setCustomId("changeshape_prif")
                .setLabel("تغيير زخرفة المتجر")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.decoration),
        );
        await i.reply({
            content: "**اختر ماذا تريد تغيير:**",
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    // 1a. تغيير إيموجي المتجر
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "changeshape_emoji") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const modal = new ModalBuilder()
            .setCustomId("changeshape_emoji_modal")
            .setTitle("تغيير إيموجي المتجر");
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("new_emoji")
                    .setLabel("الإيموجي الجديد مثال: 🛒")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(20),
            ),
        );
        await i.showModal(modal);
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit() || i.customId !== "changeshape_emoji_modal")
            return;
        const guildId = i.guild.id;
        const newEmoji = i.fields.getTextInputValue("new_emoji").trim();
        await db.set(`pending_csemoji_${i.user.id}_${i.channel.id}`, newEmoji);
        const price = await db.get(`changeshape_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تغيير إيموجي المتجر")
            .setDescription(
                ED.earlyInteractions_063({ bank, newEmoji, price, tax }),
            )
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_cs_emoji")
                .setLabel("تأكيد الشراء")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.confirm),
        );
        await i.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "confirm_cs_emoji") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`changeshape_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const newEmoji = await db.get(
            `pending_csemoji_${i.user.id}_${i.channel.id}`,
        );
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_cs_emoji")
                .setLabel("تم الشراء")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
                .setEmoji(emojis.confirm),
        );
        await i.update({ components: [disabledRow] });
        await i.channel.send({ content: `Re ${bank} ${tax}` });
        const collector = i.channel.createMessageCollector({
            filter: makePayFilter(i.user.username, bankId, price, tax),
            max: 1,
            time: 60000,
        });
        let collected = false;
        collector.on("collect", async () => {
            collected = true;
            // قراءة البيانات القديمة أولاً قبل أي تعديل
            const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
            const catId = shopData?.categoryId;
            const catData = catId
                ? await db.get(`categoryMentions_${catId}_${guildId}`)
                : null;
            const oldName = i.channel.name;
            const prif = shopData.shopPrif || catData?.pirefix || "";
            const oldEmoji = shopData.shopEmoji || catData?.shopEmoji || "";
            // تحديث DB والاسم
            await db.delete(`pending_csemoji_${i.user.id}_${i.channel.id}`);
            await db.set(`shop_${i.channel.id}_${guildId}.shopEmoji`, newEmoji);
            // استبدال الإيموجي القديم مباشرةً في اسم القناة (بدل حساب البريفكس)
            let newChannelName;
            if (oldEmoji && oldName.includes(oldEmoji)) {
                newChannelName = oldName.replace(oldEmoji, newEmoji);
            } else if (oldName.includes("هنا")) {
                newChannelName = oldName.replace("هنا", newEmoji);
            } else {
                const bodyName = shopData.shopname
                    ? shopData.shopname.replaceAll(" ", "・")
                    : oldName;
                newChannelName = `${buildPrefix(prif, newEmoji)}${bodyName}`;
            }
            await i.channel.setName(newChannelName);
            await db.add(`ernss_${guildId}.erns`, tax);
            await db.add(`ernsg.ernsg`, tax);
            const doneEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تغيير إيموجي المتجر")
                .setDescription(
                    ED.earlyInteractions_064({ i, newEmoji, price }),
                )
                .setTimestamp();
            await i.channel.send({ embeds: [doneEmbed] });
        });
        collector.on("end", () => {
            if (!collected)
                i.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_065())
                            .setTimestamp(),
                    ],
                });
        });
    });

    // 1b. تغيير زخرفة اd�م �جر
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "changeshape_prif") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
        const catId = shopData?.categoryId;
        const catData = catId
            ? await db.get(`categoryMentions_${catId}_${guildId}`)
            : null;
        const currentPrif = shopData.shopPrif || catData?.pirefix || "غير محدد";
        const currentEmoji = shopData.shopEmoji || catData?.shopEmoji || "";
        const modal = new ModalBuilder()
            .setCustomId("changeshape_prif_modal")
            .setTitle("تغيير زخرفة المتجر");
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("new_prif")
                    .setLabel(`الزخرفة الجديدة (هنا = مكان الإيموجي)`)
                    .setPlaceholder(
                        `مثال: ネ〢「هنا」︲  |  الإيموجي الحالي: ${currentEmoji}`,
                    )
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100),
            ),
        );
        await i.showModal(modal);
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit() || i.customId !== "changeshape_prif_modal")
            return;
        const guildId = i.guild.id;
        const newPrif = i.fields.getTextInputValue("new_prif").trim();
        await db.set(`pending_csprif_${i.user.id}_${i.channel.id}`, newPrif);
        const price = await db.get(`changeshape_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
        const catId = shopData?.categoryId;
        const catData = catId
            ? await db.get(`categoryMentions_${catId}_${guildId}`)
            : null;
        const emoji = shopData.shopEmoji || catData?.shopEmoji || "";
        const preview = buildPrefix(newPrif, emoji);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تغيير زخرفة المتجر")
            .setDescription(
                ED.earlyInteractions_066({
                    bank,
                    newPrif,
                    preview,
                    price,
                    tax,
                }),
            )
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_cs_prif")
                .setLabel("تأكيد الشراء")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.confirm),
        );
        await i.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "confirm_cs_prif") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`changeshape_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const newPrif = await db.get(
            `pending_csprif_${i.user.id}_${i.channel.id}`,
        );
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_cs_prif")
                .setLabel("تم الشراء")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
                .setEmoji(emojis.confirm),
        );
        await i.update({ components: [disabledRow] });
        await i.channel.send({ content: `Re ${bank} ${tax}` });
        const collector = i.channel.createMessageCollector({
            filter: makePayFilter(i.user.username, bankId, price, tax),
            max: 1,
            time: 60000,
        });
        let collected = false;
        collector.on("collect", async () => {
            collected = true;
            // نقرأ البيانات القديمة قبل الكتابة
            const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
            const catId = shopData?.categoryId;
            const catData = catId
                ? await db.get(`categoryMentions_${catId}_${guildId}`)
                : null;
            const oldPrif = shopData?.shopPrif || catData?.pirefix || "";
            const oldEmoji = shopData?.shopEmoji || catData?.shopEmoji || "";
            const emoji = oldEmoji;
            // الآن نكتب الزخرفة الجديدة في DB
            await db.delete(`pending_csprif_${i.user.id}_${i.channel.id}`);
            await db.set(`shop_${i.channel.id}_${guildId}.shopPrif`, newPrif);
            const newPrefix = buildPrefix(newPrif, emoji);
            // استخدم الاسم المخزون مباشرةً بدل محاولة استخراجه من اسم القناة
            const bodyName = shopData.shopname
                ? shopData.shopname.replaceAll(" ", "・")
                : i.channel.name;
            const newChannelName = `${newPrefix}${bodyName}`;
            await i.channel.setName(newChannelName);
            await db.add(`ernss_${guildId}.erns`, tax);
            await db.add(`ernsg.ernsg`, tax);
            const doneEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تغيير زخرفة المتجر")
                .setDescription(
                    ED.earlyInteractions_067({
                        newChannelName,
                        newPrif,
                        price,
                    }),
                )
                .setTimestamp();
            await i.channel.send({ embeds: [doneEmbed] });
        });
        collector.on("end", () => {
            if (!collected)
                i.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_068())
                            .setTimestamp(),
                    ],
                });
        });
    });

    // ====================================================
    // 1c. تغيير اسم المتجر بالكامل (بدون تعديل البريفكس)
    // ====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "fullname_change") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ صاحب المتجر فقط يقدر يستخدم هذا الزر",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`changename_${guildId}`);
        if (!price)
            return i.reply({
                content:
                    "❌ سعر تغيير اسم المتجر غير محدد، استخدم /setup-prices",
                flags: MessageFlags.Ephemeral,
            });
        const bank = await db.get(`bank_${guildId}`);
        if (!bank)
            return i.reply({
                content: "❌ البنك غير محدد، استخدم /setup",
                flags: MessageFlags.Ephemeral,
            });
        const modal = new ModalBuilder()
            .setCustomId("fullname_modal")
            .setTitle("تغيير اسم المتجر بالكامل");
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("full_new_name")
                    .setLabel("الاسم الكامل للمتجر (يُطبّق مباشرة)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100),
            ),
        );
        await i.showModal(modal);
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit() || i.customId !== "fullname_modal") return;
        const guildId = i.guild.id;
        const fullName = i.fields.getTextInputValue("full_new_name").trim();
        await db.set(`pending_fullname_${i.user.id}_${i.channel.id}`, fullName);
        const price = await db.get(`changename_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تغيير اسم المتجر بالكامل")
            .setDescription(
                ED.earlyInteractions_069({ bank, fullName, price, tax }),
            )
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_fullname")
                .setLabel("تأكيد الشراء")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.confirm),
        );
        await i.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "confirm_fullname") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`changename_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const fullName = await db.get(
            `pending_fullname_${i.user.id}_${i.channel.id}`,
        );
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_fullname")
                .setLabel("تم الشراء")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
                .setEmoji(emojis.confirm),
        );
        await i.update({ components: [disabledRow] });
        await i.channel.send({ content: `Re ${bank} ${tax}` });
        const collector = i.channel.createMessageCollector({
            filter: makePayFilter(i.user.username, bankId, price, tax),
            max: 1,
            time: 60000,
        });
        let collected = false;
        collector.on("collect", async () => {
            collected = true;
            await db.delete(`pending_fullname_${i.user.id}_${i.channel.id}`);
            const oldName = i.channel.name;
            await i.channel.setName(fullName.replaceAll(" ", "-"));
            await db.add(`ernss_${guildId}.erns`, tax);
            await db.add(`ernsg.ernsg`, tax);
            const doneEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تغيير اسم المتجر بالكامل")
                .setDescription(
                    ED.earlyInteractions_070({ fullName, oldName, price }),
                )
                .setTimestamp();
            await i.channel.send({ embeds: [doneEmbed] });
        });
        collector.on("end", () => {
            if (!collected)
                i.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_071())
                            .setTimestamp(),
                    ],
                });
        });
    });

    // ====================================================
    // TRADERS COMMUNITY — مجتمع تجار
    // ====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "traders_community") return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("tc_create")
                .setLabel("إنشاء قروب تجار")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.createGroup),
            new ButtonBuilder()
                .setCustomId("tc_add")
                .setLabel("إضافة تاجر")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.addTrader),
            new ButtonBuilder()
                .setCustomId("tc_leave")
                .setLabel("خروج من قروب")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.leaveGroup),
            new ButtonBuilder()
                .setCustomId("tc_mygroups")
                .setLabel("قروباتي")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.myGroups),
        );
        await i.reply({
            content: "**مجتمع تجار — اختر العملية:**",
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    // TC: إنشاء قروب تجار
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "tc_create") return;
        const modal = new ModalBuilder()
            .setCustomId("tc_create_modal")
            .setTitle("إنشاء قروب تجار");
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("group_name")
                    .setLabel("اسم القروب")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(50),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("member1")
                    .setLabel("ايدي العضو الأول")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(25),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("member2")
                    .setLabel("ايدي العضو الثاني (اختياري)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(25),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("member3")
                    .setLabel("ايدي العضو الثالث (اختياري)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(25),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("member4")
                    .setLabel("ايدي العضو الرابع (اختياري)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(25),
            ),
        );
        await i.showModal(modal);
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit() || i.customId !== "tc_create_modal") return;
        const guildId = i.guild.id;
        const groupName = i.fields.getTextInputValue("group_name").trim();
        const m1 = i.fields.getTextInputValue("member1").trim();
        const m2 = i.fields.getTextInputValue("member2").trim();
        const m3 = i.fields.getTextInputValue("member3").trim();
        const m4 = i.fields.getTextInputValue("member4").trim();
        const members = [i.user.id, m1, m2, m3, m4].filter(
            (id) => id && /^\d+$/.test(id),
        );
        const uniqueMembers = [...new Set(members)];

        await i.deferReply({ flags: MessageFlags.Ephemeral });

        const catId = await db.get(`tradersGroupCat_${guildId}`);
        let groupChannel;
        try {
            groupChannel = await i.guild.channels.create({
                name: `${groupName}`,
                type: ChannelType.GuildText,
                parent: catId || null,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    ...uniqueMembers.map((uid) => ({
                        id: uid,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    })),
                ],
            });
        } catch (e) {
            return i.editReply({
                content: "❌ فشل إنشاء الروم، تأكد أن البوت عنده صلاحيات كافية",
            });
        }

        const groupId = groupChannel.id;
        const groups = (await db.get(`traderGroups_${guildId}`)) || [];
        groups.push({
            id: groupId,
            name: groupName,
            members: uniqueMembers,
            channelId: groupChannel.id,
            creatorId: i.user.id,
        });
        await db.set(`traderGroups_${guildId}`, groups);

        const mentions = uniqueMembers.map((uid) => `<@${uid}>`).join(" ");
        await groupChannel.send({
            content: `✅ **تم إنشاء قروب تجار: ${groupName}**\nالأعضاء: ${mentions}`,
        });
        await i.editReply({
            content: `✅ تم إنشاء القروب <#${groupChannel.id}> بنجاح!`,
        });
    });

    // TC: إضافة تاجر
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "tc_add") return;
        const modal = new ModalBuilder()
            .setCustomId("tc_add_modal")
            .setTitle("إضافة تاجر للقروب");
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("group_channel_id")
                    .setLabel("ايدي روم القروب")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(25),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("new_member_id")
                    .setLabel("ايدي التاجر الجديد")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(25),
            ),
        );
        await i.showModal(modal);
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit() || i.customId !== "tc_add_modal") return;
        const guildId = i.guild.id;
        const groupChannelId = i.fields
            .getTextInputValue("group_channel_id")
            .trim();
        const newMemberId = i.fields.getTextInputValue("new_member_id").trim();
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const groups = (await db.get(`traderGroups_${guildId}`)) || [];
        const group = groups.find((g) => g.channelId === groupChannelId);
        if (!group)
            return i.editReply({ content: "❌ القروب غير موجود في الداتا" });
        if (!group.members.includes(i.user.id))
            return i.editReply({ content: "❌ أنت لست عضواً في هذا القروب" });
        const groupChannel = i.guild.channels.cache.get(groupChannelId);
        if (!groupChannel)
            return i.editReply({ content: "❌ روم القروب غير موجود" });
        try {
            await groupChannel.permissionOverwrites.edit(newMemberId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            });
            if (!group.members.includes(newMemberId)) {
                group.members.push(newMemberId);
                await db.set(`traderGroups_${guildId}`, groups);
            }
            await groupChannel.send({
                content: `✅ تم إضافة <@${newMemberId}> للقروب!`,
            });
            await i.editReply({
                content: `✅ تم إضافة <@${newMemberId}> بنجاح`,
            });
        } catch (e) {
            await i.editReply({ content: "❌ فشل إضافة التاجر" });
        }
    });

    // TC: خروج من قروب
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "tc_leave") return;
        const modal = new ModalBuilder()
            .setCustomId("tc_leave_modal")
            .setTitle("خروج من قروب");
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("leave_group_id")
                    .setLabel("ايدي روم القروب اللي تبي تطلع منه")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(25),
            ),
        );
        await i.showModal(modal);
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit() || i.customId !== "tc_leave_modal") return;
        const guildId = i.guild.id;
        const groupChannelId = i.fields
            .getTextInputValue("leave_group_id")
            .trim();
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const groups = (await db.get(`traderGroups_${guildId}`)) || [];
        const group = groups.find((g) => g.channelId === groupChannelId);
        if (!group) return i.editReply({ content: "❌ القروب غير موجود" });
        if (!group.members.includes(i.user.id))
            return i.editReply({ content: "❌ أنت لست عضواً في هذا القروب" });
        const groupChannel = i.guild.channels.cache.get(groupChannelId);
        try {
            if (groupChannel) {
                await groupChannel.permissionOverwrites.delete(i.user.id);
                await groupChannel.send({
                    content: `👋 <@${i.user.id}> خرج من القروب`,
                });
            }
            group.members = group.members.filter((uid) => uid !== i.user.id);
            await db.set(`traderGroups_${guildId}`, groups);
            await i.editReply({
                content: `✅ تم خروجك من القروب ${group.name}`,
            });
        } catch (e) {
            await i.editReply({ content: "❌ حدث خطأ أثناء الخروج" });
        }
    });

    // TC: قروباتي
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "tc_mygroups") return;
        const guildId = i.guild.id;
        const groups = (await db.get(`traderGroups_${guildId}`)) || [];
        const myGroups = groups.filter((g) => g.members.includes(i.user.id));
        if (!myGroups.length)
            return i.reply({
                content: "❌ أنت لست في أي قروب",
                flags: MessageFlags.Ephemeral,
            });
        const desc = myGroups
            .map(
                (g) =>
                    `- **${g.name}** — <#${g.channelId}> — أعضاء: ${g.members.map((uid) => `<@${uid}>`).join(", ")}`,
            )
            .join("\n");
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> قروباتي")
            .setDescription(ED.earlyInteractions_072({ desc }))
            .setColor(_ec.color(guildId))
            .setTimestamp();
        await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    });

    // ====================================================
    // 2. تغيير نوع المتجر — Select Menu بأنواع أعلى سعراً
    // ====================================================
    //==============================================================================
    // 1. مـعـالـجـة زر تـغـيـيـر الـنـوع (الجزء الأول: فتح القائمة)
    //==============================================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "changetypeprice_btn") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);

        if (i.user.id !== owner)
            return i.reply({
                content:
                    "❌ صـاحـب الـمـتـجـر فـقـط يـقـد ر يـسـتـخـد م هـذا الـزر",
                flags: MessageFlags.Ephemeral,
            });

        const bank = await db.get(`bank_${guildId}`);
        if (!bank)
            return i.reply({
                content: "❌ الـبـنـك غـيـر مـحـد د، اسـتـخـد م /setup",
                flags: MessageFlags.Ephemeral,
            });

        const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
        const currentCatId = shopData?.categoryId;
        const currentTypeData = currentCatId
            ? await db.get(`categoryMentions_${currentCatId}_${guildId}`)
            : null;
        const currentPrice = currentTypeData?.shopPrice || 0;

        const allEntries = await db.all();
        const allTypes = allEntries
            .filter(
                (e) =>
                    e.id.startsWith("categoryMentions_") &&
                    e.id.endsWith(`_${guildId}`),
            )
            .map((e) => {
                const catId = e.id.slice(
                    "categoryMentions_".length,
                    e.id.lastIndexOf(`_${guildId}`),
                );
                return { catId, ...e.value };
            });

        const otherTypes = allTypes.filter((t) => t.catId !== currentCatId);
        if (otherTypes.length === 0)
            return i.reply({
                content: "❌ لا يـوجـد أنـواع أخـرى مـتـاحـة",
                flags: MessageFlags.Ephemeral,
            });

        const options = otherTypes.slice(0, 25).map((t) => {
            const tPrice = Number(t.shopPrice) || 0;
            const diff = tPrice - currentPrice;
            const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
            return {
                label: (t.nametype || `نـوع (${t.catId})`).slice(0, 80),
                description:
                    `الـسـعـر: ${tPrice} | الـفـرق: ${diffLabel} كـريـد ت`.slice(
                        0,
                        100,
                    ),
                value: t.catId,
            };
        });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("changetype_select")
                .setPlaceholder("اخـتـر الـنـوع الـجـد يـد لـلـمـتـجـر")
                .addOptions(options),
        );

        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـغـيـيـر نـوع الـمـتـجـر")
            .setDescription(
                ED.earlyInteractions_073({ currentPrice, currentTypeData }),
            )
            .setColor(_ec.color(guildId))
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();

        await i.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    //==============================================================================
    // 2. مـعـالـجـة اخـتـيـار الـنـوع (الجزء الثاني: التقدير والتأكيد)
    //==============================================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isStringSelectMenu() || i.customId !== "changetype_select")
            return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غـيـر مـصـر ح",
                flags: MessageFlags.Ephemeral,
            });

        const newCatId = i.values[0];
        const newTypeData = await db.get(
            `categoryMentions_${newCatId}_${guildId}`,
        );
        if (!newTypeData)
            return i.reply({
                content: "❌ الـنـوع غـيـر مـوجـود",
                flags: MessageFlags.Ephemeral,
            });

        const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
        const currentPrice = Number(shopData?.shopPrice) || 0;
        const newPrice = Number(newTypeData.shopPrice) || 0;
        const flatPrice =
            Number(await db.get(`changetypeprice_${guildId}`)) || 0;
        const diffPrice =
            newPrice - currentPrice > 0 ? newPrice - currentPrice : flatPrice;

        if (diffPrice <= 0)
            return i.reply({
                content: "❌ لـم يـتـم تـحـد يـد سـعـر الـتـحـويـل",
                flags: MessageFlags.Ephemeral,
            });

        const tax = Math.floor(diffPrice * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bankMember = i.guild.members.cache.get(bankId);

        await db.set(`pending_changetype_${i.user.id}_${i.channel.id}`, {
            newCatId,
            diffPrice,
            tax,
        });

        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـأكـيـد تـغـيـيـر نـوع الـمـتـجـر")
            .setDescription(
                ED.earlyInteractions_074({
                    bankMember,
                    currentPrice,
                    diffPrice,
                    newPrice,
                    newTypeData,
                    tax,
                }),
            )
            .setColor(_ec.color(guildId))
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_changetype")
                .setLabel("تـأكـيـد الـشـراء")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_changetype")
                .setLabel("إلـغـاء")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.cancel),
        );
        await i.update({ embeds: [embed], components: [row] });
    });

    //==============================================================================
    // 3. مـعـالـجـة تـأكـيـد الـشـراء (الجزء الثالث: التحويل والنقل)
    //==============================================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton()) return;
        if (i.customId === "cancel_changetype")
            return i.update({
                content: "❌ تـم إلـغـاء الـطـلـب",
                embeds: [],
                components: [],
            });
        if (i.customId !== "confirm_changetype") return;

        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غـيـر مـصـر ح",
                flags: MessageFlags.Ephemeral,
            });

        const pending = await db.get(
            `pending_changetype_${i.user.id}_${i.channel.id}`,
        );
        if (!pending)
            return i.reply({
                content: "❌ انـتـهى الـطـلـب",
                flags: MessageFlags.Ephemeral,
            });

        const { newCatId, diffPrice, tax } = pending;
        const bankId = await db.get(`bank_${guildId}`);
        const bankMember = i.guild.members.cache.get(bankId);

        // تـعـطـيـل الأزرار أثـنـاء الـمـعـالـجـة
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_changetype")
                .setLabel("تـم الـشـراء")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_changetype")
                .setLabel("إلـغـاء")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
                .setEmoji(emojis.cancel),
        );

        await i.update({ components: [disabledRow] });
        await i.channel.send({ content: `Re ${bankMember} ${tax}` });

        const collector = i.channel.createMessageCollector({
            filter: (m) =>
                m.author.id === "1535048804078977164" &&
                m.content.includes(i.user.username) &&
                m.content.includes(bankId) &&
                m.content.includes(String(diffPrice)),
            max: 1,
            time: 60000,
        });

        let collected = false;
        collector.on("collect", async () => {
            collected = true;
            await db.delete(`pending_changetype_${i.user.id}_${i.channel.id}`);

            const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
            const admins = await db.get(`shopad_${guildId}`);
            const partners = shopData?.partners || [];
            const newTypeData = await db.get(
                `categoryMentions_${newCatId}_${guildId}`,
            );

            // --- حـل مـشـكـلـة انـفـتـاح الـروم عـنـد الـنـقـل ---
            await i.channel.setParent(newCatId, { lockPermissions: false });

            let overwrites = [
                {
                    id: i.guild.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                    deny: [
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AddReactions,
                    ],
                },
                {
                    id: i.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.MentionEveryone,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
                {
                    id: admins,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ManageMessages,
                    ],
                },
            ];

            partners.forEach((pId) =>
                overwrites.push({
                    id: pId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AttachFiles,
                    ],
                }),
            );
            await i.channel.permissionOverwrites.set(overwrites);

            // تـحـديـث الـبـيـانـات والـرّتـب
            await db.set(
                `shop_${i.channel.id}_${guildId}.categoryId`,
                newCatId,
            );
            await db.set(
                `shop_${i.channel.id}_${guildId}.type`,
                newTypeData?.nametype,
            );

            const member = i.guild.members.cache.get(i.user.id);
            if (member) {
                if (shopData?.shoprole)
                    await member.roles
                        .remove(shopData.shoprole)
                        .catch(() => {});
                if (newTypeData?.shoprole)
                    await member.roles
                        .add(newTypeData.shoprole)
                        .catch(() => {});
            }

            await db.add(`ernss_${guildId}.erns`, tax);
            await db.add(`ernsg.ernsg`, tax);

            const doneEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تغيير نوع المتجر")
                .setDescription(
                    ED.earlyInteractions_075({ diffPrice, i, newTypeData }),
                )
                .setColor(_ec.color(guildId))
                .setTimestamp();

            await i.channel.send({
                content: `<@${i.user.id}>`,
                embeds: [doneEmbed],
            });
        });

        collector.on("end", () => {
            if (!collected)
                i.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انـتـهـاء الـوقـت")
                            .setDescription(ED.earlyInteractions_076())
                            .setColor("Red"),
                    ],
                });
        });
    });

    // ====================================================
    // 3. طلب إجازة للمتجر
    // ====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "shopvacation_btn") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ صاحب المتجر فقط يقدر يستخدم هذا الزر",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`shopvacation_${guildId}`);
        if (!price)
            return i.reply({
                content: "❌ سعر إجازة المتجر غير محدد، استخدم /setup-prices",
                flags: MessageFlags.Ephemeral,
            });
        const bank = await db.get(`bank_${guildId}`);
        if (!bank)
            return i.reply({
                content: "❌ البنك غير محدد، استخدم /setup",
                flags: MessageFlags.Ephemeral,
            });
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankMember = i.guild.members.cache.get(bank);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> طلب إجازة للمتجر")
            .setDescription(
                ED.earlyInteractions_077({ bankMember, price, tax }),
            )
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_shopvacation")
                .setLabel("تأكيد")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_shopvacation")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.cancel),
        );
        await i.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isButton()) return;
        if (i.customId === "cancel_shopvacation")
            return i.update({
                content: "❌ تم الإلغاء",
                embeds: [],
                components: [],
            });
        if (i.customId !== "confirm_shopvacation") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`shopvacation_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_shopvacation")
                .setLabel("تم التأكيد")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_shopvacation")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
                .setEmoji(emojis.cancel),
        );
        await i.update({ components: [disabledRow] });
        await i.channel.send({ content: `Re ${bank} ${tax}` });
        const collector = i.channel.createMessageCollector({
            filter: makePayFilter(i.user.username, bankId, price, tax),
            max: 1,
            time: 60000,
        });
        let collected = false;
        collector.on("collect", async () => {
            collected = true;
            await db.set(`shop_${i.channel.id}_${guildId}.onVacation`, true);
            await db.add(`ernss_${guildId}.erns`, tax);
            await db.add(`ernsg.ernsg`, tax);
            // إخفاء القناة عن الجميع
            await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, {
                ViewChannel: false,
            });
            const oldName = i.channel.name;
            if (!oldName.startsWith("🏖️"))
                await i.channel.setName(`🏖️${oldName}`);
            const activateRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("end_vacation_btn")
                    .setLabel("إنهاء الإجازة وتفعيل المتجر")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(emojis.endVacation),
            );
            const doneEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم وضع المتجر في وضع الإجازة")
                .setDescription(ED.earlyInteractions_078({ i, price }))
                .setTimestamp();
            await i.channel.send({
                embeds: [doneEmbed],
                components: [activateRow],
            });
        });
        collector.on("end", () => {
            if (!collected)
                i.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_079())
                            .setTimestamp(),
                    ],
                });
        });
    });

    // زر إنهاء الإجازة (مجاني)
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "end_vacation_btn") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ صاحب المتجر فقط يقدر يستخدم هذا الزر",
                flags: MessageFlags.Ephemeral,
            });
        await db.set(`shop_${i.channel.id}_${guildId}.onVacation`, false);
        // إعادة تفعيل القناة
        await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, {
            ViewChannel: true,
        });
        const oldName = i.channel.name;
        if (oldName.startsWith("🏖️")) await i.channel.setName(oldName.slice(2));
        const doneEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم إنهاء الإجازة وتفعيل المتجر")
            .setDescription(ED.earlyInteractions_080({ i }))
            .setTimestamp();
        await i.update({ embeds: [doneEmbed], components: [] });
    });

    // ====================================================
    // 4. النشر التلقائي — Modal + Select Menu + Scheduler
    // ====================================================

    // Step 1: فتح modal لإدخال النص ورابط البايو
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "autopublish_btn") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ صاحب المتجر فقط يقدر يستخدم هذا الزر",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`automessage_${guildId}`);
        if (!price)
            return i.reply({
                content: "❌ سعر النشر التلقائي غير محدد، استخدم /setup-prices",
                flags: MessageFlags.Ephemeral,
            });
        const bank = await db.get(`bank_${guildId}`);
        if (!bank)
            return i.reply({
                content: "❌ البنك غير محدد، استخدم /setup",
                flags: MessageFlags.Ephemeral,
            });
        const modal = new ModalBuilder()
            .setCustomId("autopublish_text_modal")
            .setTitle("النشر التلقائي");
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("ap_text")
                    .setLabel("النص المراد نشره تلقائياً")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(1000),
            ),
        );
        await i.showModal(modal);
    });

    // Step 2: Modal submit → احفظ النص وأظهر select menu للوقت
    client.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit() || i.customId !== "autopublish_text_modal")
            return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`automessage_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const text = i.fields.getTextInputValue("ap_text").trim();
        await db.set(`pending_autopublish_${i.user.id}_${i.channel.id}`, {
            text,
        });
        const bankId = await db.get(`bank_${guildId}`);
        const bankMember = i.guild.members.cache.get(bankId);
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("autopublish_interval")
            .setPlaceholder("اختر الفترة الزمنية للنشر التلقائي")
            .addOptions([
                { label: "⏱️ كل ٤٠ دقيقة", value: "40" },
                { label: "⏱️ كل ساعة", value: "60" },
                { label: "⏱️ كل ساعتين", value: "120" },
                { label: "⏱️ كل ٣ ساعات", value: "180" },
                { label: "⏱️ كل ٤ ساعات", value: "240" },
                { label: "⏱️ كل ٥ ساعات", value: "300" },
            ]);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> النشر التلقائي — اختر الفترة الزمنية")
            .setDescription(
                ED.earlyInteractions_081({
                    bankId,
                    bankMember,
                    price,
                    tax,
                    text,
                }),
            )
            .setFooter({ text: "اختر الفترة الزمنية ثم اضغط تأكيد" })
            .setTimestamp();
        await i.reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            flags: MessageFlags.Ephemeral,
        });
    });

    // Step 3: اختيار الفترة → احفظ في pending + أظهر منشن select + زر تأكيد
    client.on("interactionCreate", async (i) => {
        if (!i.isStringSelectMenu() || i.customId !== "autopublish_interval")
            return;
        const interval = i.values[0];
        const labels = {
            40: "٤٠ دقيقة",
            60: "ساعة",
            120: "ساعتين",
            180: "٣ ساعات",
            240: "٤ ساعات",
            300: "٥ ساعات",
        };
        const guildId = i.guild.id;
        const pending = await db.get(
            `pending_autopublish_${i.user.id}_${i.channel.id}`,
        );
        if (!pending)
            return i.update({
                content: "❌ انتهت الجلسة، ابدأ من جديد",
                embeds: [],
                components: [],
            });
        await db.set(`pending_autopublish_${i.user.id}_${i.channel.id}`, {
            ...pending,
            intervalMinutes: parseInt(interval),
        });
        const mentionMenu = new StringSelectMenuBuilder()
            .setCustomId("autopublish_mention")
            .setPlaceholder(" اختر نوع المنشن (اختياري)")
            .addOptions([
                { label: " بدون منشن", value: "none" },
                { label: " منشن @here", value: "here" },
                { label: " منشن @everyone", value: "everyone" },
            ]);
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_autopub_pay")
                .setLabel("تأكيد الدفع")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_autopublish")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.cancel),
        );
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم اختيار الفترة الزمنية")
            .setDescription(ED.earlyInteractions_082({ interval, labels }))
            .setFooter({ text: "يمكنك الضغط تأكيد مباشرة بدون منشن" })
            .setTimestamp();
        await i.update({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(mentionMenu),
                confirmRow,
            ],
        });
    });

    // Step 3b: اختيار المنشن → احفظ + حدّث الرسالة
    client.on("interactionCreate", async (i) => {
        if (!i.isStringSelectMenu() || i.customId !== "autopublish_mention")
            return;
        const mention = i.values[0];
        const mentionLabels = {
            none: "بدون منشن 🔕",
            here: "@here 🔔",
            everyone: "@everyone 📢",
        };
        const guildId = i.guild.id;
        const pending = await db.get(
            `pending_autopublish_${i.user.id}_${i.channel.id}`,
        );
        if (!pending)
            return i.update({
                content: "❌ انتهت الجلسة، ابدأ من جديد",
                embeds: [],
                components: [],
            });
        await db.set(`pending_autopublish_${i.user.id}_${i.channel.id}`, {
            ...pending,
            mention,
        });
        const timeLabels = {
            40: "٤٠ دقيقة",
            60: "ساعة",
            120: "ساعتين",
            180: "٣ ساعات",
            240: "٤ ساعات",
            300: "٥ ساعات",
        };
        const mentionMenu = new StringSelectMenuBuilder()
            .setCustomId("autopublish_mention")
            .setPlaceholder(`✅ ${mentionLabels[mention]}`)
            .addOptions([
                { label: " بدون منشن", value: "none" },
                { label: " منشن @here", value: "here" },
                { label: " منشن @everyone", value: "everyone" },
            ]);
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_autopub_pay")
                .setLabel("تأكيد الدفع")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_autopublish")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.cancel),
        );
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم ضبط الإعدادات")
            .setDescription(
                ED.earlyInteractions_083({
                    mention,
                    mentionLabels,
                    pending,
                    timeLabels,
                }),
            )
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();
        await i.update({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(mentionMenu),
                confirmRow,
            ],
        });
    });

    // Step 4: تأكيد الدفع → collector → تفعيل
    client.on("interactionCreate", async (i) => {
        if (!i.isButton()) return;
        if (i.customId === "cancel_autopublish")
            return i.update({
                content: "❌ تم الإلغاء",
                embeds: [],
                components: [],
            });
        if (i.customId !== "confirm_autopub_pay") return;
        console.log(`[AutoPublish] confirm_autopub_pay clicked by ${i.user.id} in ${i.channel.id}`);
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const pending = await db.get(
            `pending_autopublish_${i.user.id}_${i.channel.id}`,
        );
        if (!pending || !pending.intervalMinutes)
            return i.reply({
                content: "❌ انتهت الجلسة أو لم تختر الفترة، ابدأ من جديد",
                flags: MessageFlags.Ephemeral,
            });
        const intervalMinutes = pending.intervalMinutes;
        const mention = pending.mention || "none";
        const price = await db.get(`automessage_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_autopub_pay")
                .setLabel("تم التأكيد")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_autopublish")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
                .setEmoji(emojis.cancel),
        );
        await i.update({ components: [disabledRow] });
        await i.channel.send({ content: `Re ${bank || bankId} ${tax}` });
        console.log(`[AutoPublish] Payment requested: user=${i.user.username}, bankId=${bankId}, price=${price}, tax=${tax}`);

        const paymentResult = await verifyPayment({
            channel: i.channel,
            userId: i.user.id,
            requiredAmount: price,
            bankId: bankId,
            timeout: 60000,
        });

        if (!paymentResult.success) {
            console.log(`[AutoPublish] Payment timed out for ${i.user.username} in ${i.channel.id}`);
            i.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                        .setDescription(ED.earlyInteractions_085())
                        .setTimestamp(),
                ],
            });
            return;
        }

        console.log(`[AutoPublish] Payment collected for ${i.user.username} in ${i.channel.id}`);
        await db.delete(`pending_autopublish_${i.user.id}_${i.channel.id}`);
        const intervalMs = intervalMinutes * 60 * 1000;
        const now = Date.now();
        await db.set(`shop_${i.channel.id}_${guildId}.autoMessage`, true);
        await db.set(
            `shop_${i.channel.id}_${guildId}.autoMessageText`,
            pending.text,
        );
        await db.set(
            `shop_${i.channel.id}_${guildId}.autoMessageMention`,
            mention,
        );
        await db.set(
            `shop_${i.channel.id}_${guildId}.autoMessageIntervalMs`,
            intervalMs,
        );
        await db.set(
            `shop_${i.channel.id}_${guildId}.autoMessageNextSend`,
            now + intervalMs,
        );
        await db.set(
            `shop_${i.channel.id}_${guildId}.autoMessageActivatedBy`,
            i.user.id,
        );
        await db.delete(`shop_${i.channel.id}_${guildId}.autoMessageBio`);
        await db.add(`ernss_${guildId}.erns`, tax);
        await db.add(`ernsg.ernsg`, tax);
        const allData = await db.all();
        const categories = allData.filter(
            (d) =>
                d.id.startsWith("categoryMentions_") &&
                d.id.endsWith(`_${guildId}`),
        );
        if (categories.length === 0) {
            try {
                    await sendAutoPublishMessage(
                        i.channel,
                        i.user,
                        pending.text,
                        mention,
                        i.user.id,
                    );
                } catch (e) {
                    console.log(`[AutoPublish] Initial send error: ${e.message}`);
                }
                await i.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تفعيل النشر التلقائي")
                            .setDescription(
                                ED.earlyInteractions_084({
                                    i,
                                    intervalMinutes,
                                    mention,
                                    mentionLabels: { none: "بدون منشن", here: "@here", everyone: "@everyone" },
                                    price,
                                    timeLabels: { 40: "٤٠ دقيقة", 60: "ساعة", 120: "ساعتين", 180: "٣ ساعات", 240: "٤ ساعات", 300: "٥ ساعات" },
                                }),
                            )
                            .setTimestamp(),
                    ],
                });
                return;
            }
            const typeOptions = categories.slice(0, 25).map((cat) => {
                const catId = cat.id.replace("categoryMentions_", "").replace(`_${guildId}`, "");
                const catData = cat.value || {};
                return {
                    label: (catData.nametype || "نوع").slice(0, 100),
                    value: catId,
                    description: (catData.shopEmoji || "").slice(0, 100),
                };
            });
            const typeMenu = new StringSelectMenuBuilder()
                .setCustomId("autopublish_type_select")
                .setPlaceholder("اختر نوع المنشور")
                .addOptions(typeOptions);
            const typeRow = new ActionRowBuilder().addComponents(typeMenu);
            await i.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> اختر نوع المنشور")
                        .setDescription("**اختر نوع المتجر للنشر التلقائي:**")
                        .setTimestamp(),
                ],
                components: [typeRow],
            });
    });

    // Step 4b: اختيار نوع المنشور → نشر
    client.on("interactionCreate", async (i) => {
        if (!i.isStringSelectMenu() || i.customId !== "autopublish_type_select") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const catId = i.values[0];
        const catData = await db.get(`categoryMentions_${catId}_${guildId}`);
        const nametype = catData?.nametype || "متجر";
        const shopEmoji = catData?.shopEmoji || "";
        const prif = catData?.pirefix || "";
        const channelName = i.channel.name;
        const mention = await db.get(`shop_${i.channel.id}_${guildId}.autoMessageMention`);
        const text = await db.get(`shop_${i.channel.id}_${guildId}.autoMessageText`);
        const intervalMinutes = (await db.get(`shop_${i.channel.id}_${guildId}.autoMessageIntervalMs`)) / 60000;
        const activatorId = await db.get(`shop_${i.channel.id}_${guildId}.autoMessageActivatedBy`);
        let activatorUser = null;
        if (activatorId) {
            activatorUser = await client.users.fetch(activatorId).catch(() => null);
        }
        await i.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم اختيار النوع")
                    .setDescription(`**تم اختيار نوع المنشور: ${shopEmoji} ${nametype}**`)
                    .setTimestamp(),
            ],
            components: [],
        });
        try {
            await sendAutoPublishMessage(
                i.channel,
                activatorUser,
                text,
                mention,
                activatorId,
            );
        } catch (e) {
            console.log(`[AutoPublish] Initial send error: ${e.message}`);
        }
        const timeLabels = {
            40: "٤٠ دقيقة",
            60: "ساعة",
            120: "ساعتين",
            180: "٣ ساعات",
            240: "٤ ساعات",
            300: "٥ ساعات",
        };
        const mentionLabels = {
            none: "بدون منشن",
            here: "@here",
            everyone: "@everyone",
        };
        await i.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تفعيل النشر التلقائي")
                    .setDescription(
                        ED.earlyInteractions_084({
                            i,
                            intervalMinutes,
                            mention,
                            mentionLabels,
                            price: await db.get(`automessage_${guildId}`),
                            timeLabels,
                        }),
                    )
                    .setTimestamp(),
            ],
        });
    });

    // ====================================================
    // 5. تعطيل الإرسال التلقائي لجميع متاجرك
    // ====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "disableauto_btn") return;
        const guildId = i.guild.id;
        const price = await db.get(`disableauto_${guildId}`);
        if (!price)
            return i.reply({
                content:
                    "❌ سعر تعطيل الإرسال التلقائي غير محدد، استخدم /setup-prices",
                flags: MessageFlags.Ephemeral,
            });
        const bank = await db.get(`bank_${guildId}`);
        if (!bank)
            return i.reply({
                content: "❌ البنك غير محدد، استخدم /setup",
                flags: MessageFlags.Ephemeral,
            });
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankMember = i.guild.members.cache.get(bank);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تعطيل الإرسال التلقائي")
            .setDescription(
                ED.earlyInteractions_086({ bankMember, price, tax }),
            )
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_disableauto")
                .setLabel("تأكيد")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_disableauto")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.cancel),
        );
        await i.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isButton()) return;
        if (i.customId === "cancel_disableauto")
            return i.update({
                content: "❌ تم الإلغاء",
                embeds: [],
                components: [],
            });
        if (i.customId !== "confirm_disableauto") return;
        const guildId = i.guild.id;
        const price = await db.get(`disableauto_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_disableauto")
                .setLabel("تم التأكيد")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_disableauto")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji(emojis.cancel),
        );
        await i.update({ components: [disabledRow] });
        await i.channel.send({ content: `Re ${bank} ${tax}` });
        const collector = i.channel.createMessageCollector({
            filter: makePayFilter(i.user.username, bankId, price, tax),
            max: 1,
            time: 60000,
        });
        let collected = false;
        collector.on("collect", async () => {
            collected = true;
            const allKeys = await db.all();
            const shopKeys = allKeys.filter(
                (k) =>
                    k.id.startsWith(`shop_`) &&
                    k.id.endsWith(`_${guildId}`) &&
                    k.value?.sellerId === i.user.id,
            );
            for (const sk of shopKeys) {
                await db.set(`${sk.id}.autoMessage`, false);
            }
            await db.add(`ernss_${guildId}.erns`, tax);
            await db.add(`ernsg.ernsg`, tax);
            const doneEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تعطيل النشر التلقائي")
                .setDescription(ED.earlyInteractions_087({ price }))
                .setTimestamp();
            await i.channel.send({ embeds: [doneEmbed] });
        });
        collector.on("end", () => {
            if (!collected)
                i.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_088())
                            .setTimestamp(),
                    ],
                });
        });
    });

    // ====================================================
    // 6. تفعيل المتجر (مدفوع)
    // ====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "activateshop_paid") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ صاحب المتجر فقط يقدر يستخدم هذا الزر",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`activateshopprice_${guildId}`);
        if (!price)
            return i.reply({
                content: "❌ سعر تفعيل المتجر غير محدد، استخدم /setup-prices",
                flags: MessageFlags.Ephemeral,
            });
        const bank = await db.get(`bank_${guildId}`);
        if (!bank)
            return i.reply({
                content: "❌ البنك غير محدد، استخدم /setup",
                flags: MessageFlags.Ephemeral,
            });
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankMember = i.guild.members.cache.get(bank);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تفعيل المتجر")
            .setDescription(
                ED.earlyInteractions_089({ bankMember, price, tax }),
            )
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_activateshop")
                .setLabel("تأكيد")
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_activateshop")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.cancel),
        );
        await i.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isButton()) return;
        if (i.customId === "cancel_activateshop")
            return i.update({
                content: "❌ تم الإلغاء",
                embeds: [],
                components: [],
            });
        if (i.customId !== "confirm_activateshop") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });
        const price = await db.get(`activateshopprice_${guildId}`);
        const tax = Math.floor(price * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bank = i.guild.members.cache.get(bankId);
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_activateshop")
                .setLabel("تم التأكيد")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
                .setEmoji(emojis.confirm),
            new ButtonBuilder()
                .setCustomId("cancel_activateshop")
                .setLabel("إلغاء")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
                .setEmoji(emojis.cancel),
        );
        await i.update({ components: [disabledRow] });
        await i.channel.send({ content: `Re ${bank} ${tax}` });
        const collector = i.channel.createMessageCollector({
            filter: makePayFilter(i.user.username, bankId, price, tax),
            max: 1,
            time: 60000,
        });
        let collected = false;
        collector.on("collect", async () => {
            collected = true;
            await i.channel.permissionOverwrites.edit(owner, {
                ViewChannel: true,
                SendMessages: true,
                EmbedLinks: true,
                AddReactions: true,
                UseExternalEmojis: true,
                ReadMessageHistory: true,
                MentionEveryone: true,
                AttachFiles: true,
            });
            await db.set(`shop_${i.channel.id}_${guildId}.onVacation`, false);
            const oldName = i.channel.name;
            if (oldName.startsWith("🏖️"))
                await i.channel.setName(oldName.slice(2));
            await db.add(`ernss_${guildId}.erns`, tax);
            await db.add(`ernsg.ernsg`, tax);
            const doneEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تفعيل المتجر")
                .setDescription(ED.earlyInteractions_090({ i, price }))
                .setTimestamp();
            await i.channel.send({ embeds: [doneEmbed] });
        });
        collector.on("end", () => {
            if (!collected)
                i.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهاء الوقت")
                            .setDescription(ED.earlyInteractions_091())
                            .setTimestamp(),
                    ],
                });
        });
    });

    // ====================================================
    // 7. بيع المتجر لشخص محدد — المشتري يدفع في روم الأوامر
    // ====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.isButton() || i.customId !== "sellshop") return;
        const guildId = i.guild.id;
        const owner = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
        if (i.user.id !== owner)
            return i.reply({
                content: "❌ صاحب المتجر فقط يقدر يستخدم هذا الزر",
                flags: MessageFlags.Ephemeral,
            });
        const bank = await db.get(`bank_${guildId}`);
        if (!bank)
            return i.reply({
                content: "❌ البنك غير محدد، استخدم /setup",
                flags: MessageFlags.Ephemeral,
            });
        const cmdRoom = await db.get(`commandsRoom_${guildId}`);
        if (!cmdRoom)
            return i.reply({
                content:
                    "❌ روم الأوامر غير محدد، استخدم /setup واضف commands-room",
                flags: MessageFlags.Ephemeral,
            });
        const modal = new ModalBuilder()
            .setCustomId("sellshop_modal")
            .setTitle("بيع المتجر");
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("newowner_sell")
                    .setLabel("ايدي المشتري (بدون @)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(30),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("sale_price")
                    .setLabel("السعر (كريدت)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(20),
            ),
        );
        await i.showModal(modal);
    });

    client.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit() || i.customId !== "sellshop_modal") return;
        const guildId = i.guild.id;
        const oldOwnerId = await db.get(
            `shop_${i.channel.id}_${guildId}.sellerId`,
        );
        if (i.user.id !== oldOwnerId)
            return i.reply({
                content: "❌ غير مصرح",
                flags: MessageFlags.Ephemeral,
            });

        const newOwnerId = i.fields
            .getTextInputValue("newowner_sell")
            .trim()
            .replace(/\D/g, "");
        const salePrice = parseInt(
            i.fields.getTextInputValue("sale_price").trim(),
        );

        if (!newOwnerId || isNaN(salePrice) || salePrice <= 0)
            return i.reply({
                content: "❌ بيانات غير صحيحة",
                flags: MessageFlags.Ephemeral,
            });

        await i.deferReply({ flags: MessageFlags.Ephemeral });

        const newOwnerMember =
            i.guild.members.cache.get(newOwnerId) ||
            (await i.guild.members.fetch(newOwnerId).catch(() => null));
        if (!newOwnerMember)
            return i.editReply({
                content: "❌ الشخص المدخل ليس موجوداً في السيرفر",
            });

        const tax = Math.floor(salePrice * (20 / 19) + 1);
        const bankId = await db.get(`bank_${guildId}`);
        const bankMember = i.guild.members.cache.get(bankId);
        const cmdRoomId = await db.get(`commandsRoom_${guildId}`);
        const cmdChannel = i.guild.channels.cache.get(cmdRoomId);

        await db.set(`pending_sellshop_${i.channel.id}`, {
            newOwnerId,
            oldOwnerId,
            salePrice,
            tax,
            shopChannelId: i.channel.id,
        });

        // DM للمشتري
        const dmEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  عرض شراء متجر")
            .setDescription(
                ED.earlyInteractions_092({
                    bankId,
                    cmdChannel,
                    i,
                    salePrice,
                    tax,
                }),
            )
            .setColor(_ec.color(guildId))
            .setTimestamp();
        await newOwnerMember.send({ embeds: [dmEmbed] }).catch(() => {});

        await i.editReply({
            content: `✅ تم إرسال عرض الشراء لـ ${newOwnerMember} — بانتظار الدفع في ${cmdChannel || "روم الأوامر"}`,
        });

        if (!cmdChannel) return;

        const notifyEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  طلب شراء متجر")
            .setDescription(
                ED.earlyInteractions_093({
                    bankId,
                    i,
                    newOwnerMember,
                    salePrice,
                    tax,
                }),
            )
            .setColor(_ec.color(guildId))
            .setTimestamp();
        await cmdChannel.send({ embeds: [notifyEmbed] });

        const collector = cmdChannel.createMessageCollector({
            filter: makePayFilter(
                newOwnerMember.user.username,
                bankId,
                salePrice,
                tax,
            ),
            max: 1,
            time: 300000,
        });
        let collected = false;
        collector.on("collect", async () => {
            collected = true;
            const pending = await db.get(`pending_sellshop_${i.channel.id}`);
            if (!pending) return;
            await db.delete(`pending_sellshop_${i.channel.id}`);
            const shopChannel = i.guild.channels.cache.get(i.channel.id);
            if (shopChannel) {
                await shopChannel.permissionOverwrites
                    .delete(oldOwnerId)
                    .catch(() => {});
                await shopChannel.permissionOverwrites
                    .edit(newOwnerId, {
                        ViewChannel: true,
                        SendMessages: true,
                        EmbedLinks: true,
                        AddReactions: true,
                        UseExternalEmojis: true,
                        ReadMessageHistory: true,
                        MentionEveryone: true,
                        AttachFiles: true,
                    })
                    .catch(() => {});
            }
            await db.set(
                `shop_${i.channel.id}_${guildId}.sellerId`,
                newOwnerId,
            );
            await db.add(`ernss_${guildId}.erns`, tax);
            await db.add(`ernsg.ernsg`, tax);
            const invoiceEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فاتورة بيع المتجر -")
                .setDescription(
                    ED.earlyInteractions_094({
                        i,
                        newOwnerId,
                        oldOwnerId,
                        salePrice,
                        tax,
                    }),
                )
                .setFooter({ text: "شكراً لتعاملك معنا!" })
                .setTimestamp();
            await cmdChannel.send({ embeds: [invoiceEmbed] });
            const doneEmbed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم بيع المتجر")
                .setDescription(
                    ED.earlyInteractions_095({ i, newOwnerId, salePrice }),
                )
                .setTimestamp();
            if (shopChannel) await shopChannel.send({ embeds: [doneEmbed] });
        });
        collector.on("end", async () => {
            if (!collected) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> انتهى الوقت")
                    .setDescription(ED.earlyInteractions_096({ i }))
                    .setTimestamp();
                await cmdChannel.send({ embeds: [timeoutEmbed] });
                await db.delete(`pending_sellshop_${i.channel.id}`);
            }
        });
    });

    // ====================================================
    // AUTO-PUBLISH SCHEDULER — يعمل كل دقيقة
    // ====================================================
    setInterval(async () => {
        try {
            const now = Date.now();
            const allKeys = await db.all();
            const shops = allKeys.filter(
                (k) =>
                    k.id.startsWith("shop_") &&
                    k.value?.autoMessage === true &&
                    k.value?.autoMessageNextSend &&
                    k.value.autoMessageNextSend <= now,
            );
            for (const entry of shops) {
                const keyParts = entry.id.split("_");
                if (keyParts.length < 3) continue;
                const guildId = keyParts[keyParts.length - 1];
                const channelId = keyParts[keyParts.length - 2];
                const cfg = entry.value;
                if (!cfg.autoMessageText || !cfg.autoMessageIntervalMs)
                    continue;
                try {
                    const guild = await client.guilds
                        .fetch(guildId)
                        .catch(() => null);
                    if (!guild) continue;
                    const channel = await guild.channels
                        .fetch(channelId)
                        .catch(() => null);
                    if (!channel) continue;
                    const stillEnabled = await db.get(
                        `shop_${channelId}_${guildId}.autoMessage`,
                    );
                    if (!stillEnabled) continue;
                    const currentNext = await db.get(
                        `shop_${channelId}_${guildId}.autoMessageNextSend`,
                    );
                    if (!currentNext || currentNext > now) continue;
                    await db.set(
                        `shop_${channelId}_${guildId}.autoMessageNextSend`,
                        now + cfg.autoMessageIntervalMs,
                    );
                    const activatorId = cfg.autoMessageActivatedBy;
                    let activatorUser = null;
                    if (activatorId) {
                        activatorUser = await client.users
                            .fetch(activatorId)
                            .catch(() => null);
                    }
                    await sendAutoPublishMessage(
                        channel,
                        activatorUser,
                        cfg.autoMessageText,
                        cfg.autoMessageMention,
                        activatorId,
                    );
                } catch (e) {
                    console.log(
                        `[AutoPublish] Error channel ${channelId}: ${e.message}`,
                    );
                }
            }
        } catch (e) {
            console.log(`[AutoPublish] Scheduler error: ${e.message}`);
        }
    }, 60000);

    // ====================================================
    // زر إيقاف النشر التلقائي من تحت المنشور
    // ====================================================
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("stop_autopublish_")) return;
        if (!interaction.guild) return;

        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guild.id;
        const channelId = interaction.customId.replace("stop_autopublish_", "");
        const shopKey = `shop_${channelId}_${guildId}`;
        const shopData = await db.get(shopKey);

        if (!shopData) {
            return interaction.editReply({
                content: "❌ **لم يتم العثور على بيانات المتجر**",
            });
        }

        if (!shopData.autoMessage) {
            return interaction.editReply({
                content: "❌ **النشر التلقائي متوقف بالفعل**",
            });
        }

        const userId = interaction.user.id;
        const sellerId = shopData.sellerId;
        const activatorId = shopData.autoMessageActivatedBy;
        const highstaff = await db.get(`highstaff_${guildId}`);
        const member = interaction.member;

        const isOwner = userId === sellerId;
        const isActivator = activatorId && userId === activatorId;
        const isAdmin =
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            (highstaff && member.roles.cache.has(highstaff));

        if (!isOwner && !isActivator && !isAdmin) {
            return interaction.editReply({
                content:
                    "❌ **لا تملك صلاحية إيقاف النشر التلقائي. هذا الزر متاح فقط لمالك المتجر، أو من فعّل النشر، أو الإداريين.**",
            });
        }

        await db.set(`${shopKey}.autoMessage`, false);
        await db.delete(`${shopKey}.autoMessageNextSend`);

        const stoppedByLabel = isOwner
            ? "مالك المتجر"
            : isActivator
              ? "مفعّل النشر"
              : "إداري";
        const stopEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تم إيقاف النشر التلقائي")
            .setDescription(
                ED.earlyInteractions_097({ stoppedByLabel, userId }),
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [stopEmbed] });
    });

    //====== نظام تقييمات المتاجر ======

    // shop_ratings_btn: قائمة الخيارات الرئيسية
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "shop_ratings_btn") return;
        if (!interaction.guild) return;

        const ratingsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("do_rate_shop")
                .setLabel("تقييم المتجر")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("edit_my_rate_shop")
                .setLabel("تعديل تقييمي")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.editRate),
            new ButtonBuilder()
                .setCustomId("view_shop_rates")
                .setLabel("عرض التقييمات")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.viewRates),
        );
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تقييمات المتجر")
                    .setDescription(ED.earlyInteractions_098())
                    .setTimestamp(),
            ],
            components: [ratingsRow],
            flags: MessageFlags.Ephemeral,
        });
    });

    // do_rate_shop: عرض أزرار النجوم
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "do_rate_shop") return;
        if (!interaction.guild) return;

        const starsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("rate_shop_star_1")
                .setLabel("")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("rate_shop_star_2")
                .setLabel("")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("rate_shop_star_3")
                .setLabel("")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("rate_shop_star_4")
                .setLabel("")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("rate_shop_star_5")
                .setLabel("")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.rate),
        );
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تقييم المتجر")
                    .setDescription(ED.earlyInteractions_099())
                    .setTimestamp(),
            ],
            components: [starsRow],
        });
    });

    // rate_shop_star_N: فتح modal السبب
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("rate_shop_star_")) return;
        if (!interaction.guild) return;

        const stars = interaction.customId.replace("rate_shop_star_", "");
        const starsN = parseInt(stars);
        if (isNaN(starsN) || starsN < 1 || starsN > 5) return;

        const modal = new ModalBuilder()
            .setCustomId(`rate_shop_modal_${stars}`)
            .setTitle(`تقييم المتجر — ${"".repeat(starsN)}`);
        const reasonInput = new TextInputBuilder()
            .setCustomId("rate_reason")
            .setLabel("سبب التقييم (اختياري)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(300)
            .setPlaceholder("اكتب تجربتك مع هذا المتجر...");
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    });

    // rate_shop_modal: حفظ التقييم الجديد
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith("rate_shop_modal_")) return;
        if (!interaction.guild) return;

        const stars = parseInt(
            interaction.customId.replace("rate_shop_modal_", ""),
        );
        if (isNaN(stars) || stars < 1 || stars > 5) return;
        const reason =
            interaction.fields.getTextInputValue("rate_reason").trim() || null;
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        const ratingsKey = `shop_ratings_${channelId}_${guildId}`;
        let ratings = (await db.get(ratingsKey)) || [];
        const existing = ratings.findIndex((r) => r.userId === userId);
        const entry = { userId, rating: stars, reason, timestamp: Date.now() };
        if (existing >= 0) ratings[existing] = entry;
        else ratings.push(entry);
        await db.set(ratingsKey, ratings);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تسجيل تقييمك!")
                    .setDescription(ED.earlyInteractions_100({ reason, stars }))
                    .setTimestamp(),
            ],
            flags: MessageFlags.Ephemeral,
        });
    });

    // edit_my_rate_shop: عرض تقييمات المستخدم في select menu
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "edit_my_rate_shop") return;
        if (!interaction.guild) return;

        const channelId = interaction.channel.id;
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const ratings =
            (await db.get(`shop_ratings_${channelId}_${guildId}`)) || [];
        const myRatings = ratings.filter((r) => r.userId === userId);

        if (!myRatings.length) {
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تعديل التقييم")
                        .setDescription(ED.earlyInteractions_101())
                        .setTimestamp(),
                ],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("do_rate_shop")
                            .setLabel("تقييم المتجر")
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji(emojis.rate),
                    ),
                ],
            });
        }

        const options = myRatings.map((r, i) => ({
            label: `${"".repeat(r.rating)} (${r.rating}/5)`,
            description: r.reason ? r.reason.slice(0, 100) : "بدون سبب",
            value: `${i}`,
        }));
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("edit_rate_pick")
            .setPlaceholder("اختر تقييمك الحالي لتعديله")
            .addOptions(options);

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تعديل التقييم")
                    .setDescription(ED.earlyInteractions_102({ myRatings }))
                    .setTimestamp(),
            ],
            components: [new ActionRowBuilder().addComponents(selectMenu)],
        });
    });

    // edit_rate_pick: عرض أزرار النجوم للتعديل
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== "edit_rate_pick") return;
        if (!interaction.guild) return;

        const starsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("edit_rate_star_1")
                .setLabel("")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("edit_rate_star_2")
                .setLabel("")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("edit_rate_star_3")
                .setLabel("")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("edit_rate_star_4")
                .setLabel("")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.rate),
            new ButtonBuilder()
                .setCustomId("edit_rate_star_5")
                .setLabel("")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.rate),
        );
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تعديل التقييم")
                    .setDescription(ED.earlyInteractions_103())
                    .setTimestamp(),
            ],
            components: [starsRow],
        });
    });

    // edit_rate_star_N: فتح modal التعديل مع السبب القديم كـ placeholder
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("edit_rate_star_")) return;
        if (!interaction.guild) return;

        const stars = interaction.customId.replace("edit_rate_star_", "");
        const starsN = parseInt(stars);
        if (isNaN(starsN) || starsN < 1 || starsN > 5) return;

        const channelId = interaction.channel.id;
        const guildId = interaction.guild.id;
        const ratings =
            (await db.get(`shop_ratings_${channelId}_${guildId}`)) || [];
        const myRating = ratings.find((r) => r.userId === interaction.user.id);
        const oldReason = myRating?.reason || "";

        const modal = new ModalBuilder()
            .setCustomId(`edit_shop_modal_${stars}`)
            .setTitle(`تعديل التقييم — ${"".repeat(starsN)}`);
        const reasonInput = new TextInputBuilder()
            .setCustomId("rate_reason")
            .setLabel("سبب التعديل (اختياري)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(300)
            .setPlaceholder(oldReason || "اكتب سبب تعديل تقييمك...");
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    });

    // edit_shop_modal: تحديث التقييم الموجود
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith("edit_shop_modal_")) return;
        if (!interaction.guild) return;

        const stars = parseInt(
            interaction.customId.replace("edit_shop_modal_", ""),
        );
        if (isNaN(stars) || stars < 1 || stars > 5) return;
        const reason =
            interaction.fields.getTextInputValue("rate_reason").trim() || null;
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        const ratingsKey = `shop_ratings_${channelId}_${guildId}`;
        let ratings = (await db.get(ratingsKey)) || [];
        const existing = ratings.findIndex((r) => r.userId === userId);
        const entry = { userId, rating: stars, reason, timestamp: Date.now() };
        if (existing >= 0) ratings[existing] = entry;
        else ratings.push(entry);
        await db.set(ratingsKey, ratings);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم تعديل تقييمك!")
                    .setDescription(ED.earlyInteractions_104({ reason, stars }))
                    .setTimestamp(),
            ],
            flags: MessageFlags.Ephemeral,
        });
    });

    // view_shop_rates: عرض كل تقييمات المتجر
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== "view_shop_rates") return;
        if (!interaction.guild) return;

        const channelId = interaction.channel.id;
        const guildId = interaction.guild.id;
        const ratings =
            (await db.get(`shop_ratings_${channelId}_${guildId}`)) || [];

        if (!ratings.length) {
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تقييمات المتجر")
                        .setDescription(ED.earlyInteractions_105())
                        .setTimestamp(),
                ],
                components: [],
            });
        }

        const avg = (
            ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
        ).toFixed(1);
        const lines = ratings
            .slice(-10)
            .map(
                (r) =>
                    `👤 <@${r.userId}> — ${"".repeat(r.rating)} (${r.rating}/5)${r.reason ? `\n> ${r.reason}` : ""}\n<t:${Math.floor(r.timestamp / 1000)}:R>`,
            )
            .join("\n\n");

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تقييمات المتجر")
                    .setDescription(
                        ED.earlyInteractions_106({ avg, lines, ratings }),
                    )
                    .setTimestamp(),
            ],
            components: [],
        });
    });

    //====== تأكيد/إلغاء حذف المتاجر الغير متفاعلة ======
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.guild) return;

        if (interaction.customId === "cancel_del_inactive") {
            await db.delete(`pending_delete_inactive_${interaction.guild.id}`);
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تم إلغاء العملية")
                        .setTimestamp(),
                ],
                components: [],
            });
        }

        if (interaction.customId.startsWith("confirm_del_inactive_")) {
            const gId = interaction.guild.id;
            const pending =
                (await db.get(`pending_delete_inactive_${gId}`)) || [];
            await db.delete(`pending_delete_inactive_${gId}`);
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> جارٍ الحذف...")
                        .setDescription(ED.earlyInteractions_107({ pending }))
                        .setColor(_ec.color(gId))
                        .setTimestamp(),
                ],
                components: [],
            });
            let deleted = 0;
            for (const channelId of pending) {
                try {
                    const ch = interaction.guild.channels.cache.get(channelId);
                    if (ch)
                        await ch
                            .delete(
                                `حذف متجر غير متفاعل بواسطة ${interaction.user.tag}`,
                            )
                            .catch(() => {});
                    await db.delete(`shop_${channelId}_${gId}`);
                    await db.delete(`shop_lastmsg_${channelId}_${gId}`);
                    deleted++;
                } catch {}
            }
            const logsId = await db.get(`logs_${gId}`);
            const logsCh = logsId
                ? interaction.guild.channels.cache.get(logsId)
                : null;
            if (logsCh)
                await logsCh
                    .send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  حذف متاجر غير متفاعلة")
                                .setDescription(
                                    ED.earlyInteractions_108({
                                        deleted,
                                        interaction,
                                    }),
                                )
                                .setColor(_ec.color(gId))
                                .setTimestamp(),
                        ],
                    })
                    .catch(() => {});
            await interaction.followUp({
                content: `**✅ تم حذف ${deleted} متجر غير متفاعل.**`,
                ephemeral: true,
            });
        }
    });

    //====== claim_warn: استلام مخالفة كلمة ممنوعة ======
    //==============================================================================
    // الـقـائـمـة الـكـامـلـة لـلـكـلـمـات الـمـمـنـوعـة
    //==============================================================================
    const all_forbidden_words = [
        "متجر",
        "متجري",
        "متجرها",
        "متجره",
        "متجرك",
        "متجركم",
        "متجرهم",
        "متجرنا",
        "عرض",
        "عرضي",
        "عرضك",
        "عرضكم",
        "عرضهم",
        "عرضنا",
        "عروض",
        "عروضي",
        "عروضك",
        "عروضكم",
        "عروضهم",
        "عروضنا",
        "حساب",
        "حسابي",
        "حسابك",
        "حسابكم",
        "حسابهم",
        "حسابنا",
        "حسابات",
        "حساباتي",
        "حساباتك",
        "حساباتكم",
        "حساباتهم",
        "حساباتنا",
        "متوفر",
        "متوفري",
        "متوفرها",
        "متوفره",
        "متوفرك",
        "متوفركم",
        "متوفرهم",
        "متوفرنا",
        "شوب",
        "شوبك",
        "شوبكم",
        "شوبهم",
        "شوبنا",
        "اوفر",
        "اوفرها",
        "اوفره",
        "اوفرك",
        "اوفركم",
        "اوفرهم",
        "اوفرنا",
        "بيع",
        "بيعي",
        "بيعك",
        "بيعكم",
        "بيعهم",
        "بيعنا",
        "للبيع",
        "للبيعي",
        "للبيعك",
        "للبيعكم",
        "للبيعهم",
        "للبيعنا",
        "ابيع",
        "ابيعك",
        "ابيعكم",
        "ابيعهم",
        "ابيعنا",
        "بوست",
        "بوستك",
        "بوستكم",
        "بوستهم",
        "بوستنا",
        "نيترو",
        "نيتروك",
        "نيتروكم",
        "نيتروهم",
        "نيترونا",
        "روبكس",
        "روبكسك",
        "روبكسكم",
        "روبكسهم",
        "روبكسنا",
        "سعر",
        "سعري",
        "سعرها",
        "سعره",
        "سعرك",
        "سعركم",
        "سعرهم",
        "سعرنا",
        "تبدخاص",
        "تبدخاصك",
        "تبدخاصكم",
        "تبدخاصهم",
        "تبدخاصنا",
        "مطلوب",
        "مطلوبة",
        "مطلوبك",
        "مطلوبكم",
        "مطلوبهم",
        "مطلوبنا",
        "اطلب",
        "اطلبك",
        "اطلبكم",
        "اطلبهم",
        "اطلبنا",
        "مقابل",
        "تبادل",
        "خاص",
        "كريدت",
        "كريدة",
        "كريديت",
        "كردت",
        "wwewewwewwyuyuhuhujhvuvcyucyww",
    ];

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;
        const guildId = message.guild.id;

        if (message.content === "+تحذيرات") {
            if (!message.member.permissions.has("Administrator")) return;
            const line = await db.get(`image_${guildId}`);
            const embed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> إعـدادات نـظـام الـتـحـذيـرات")
                .setDescription(
                    "اضـغـط عـلـى الأزرار لـتـهـيـئـة نـظـام الـتـشـفـيـر والـتـعـطـيـل",
                )
                .setColor(_ec.color(guildId));
            if (line) embed.setImage(line);

            const r1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_mode_toggle")
                    .setLabel("تـغـيـيـر الـوضـع (آتـو / يـدوي)")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("setup_set_channel")
                    .setLabel("تـحـديـد روم الإدارة")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setup_set_role")
                    .setLabel("تـحـديـد رتـبـة الاسـتـلام")
                    .setStyle(ButtonStyle.Danger),
            );
            const r2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_auto_disable_toggle")
                    .setLabel("تـفـعـيـل/تـعـطـيـل الـتـعـطـيـل")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("setup_set_limit")
                    .setLabel("حـد الـتـحـذيـرات")
                    .setStyle(ButtonStyle.Secondary),
            );
            await message.reply({ embeds: [embed], components: [r1, r2] });
        }

        const shopAdmin = await db.get(`shopad_${guildId}`);
        if (shopAdmin && message.member.roles.cache.has(shopAdmin)) return;

        const hasMention =
            message.mentions.users.size > 0 ||
            message.mentions.roles.size > 0 ||
            message.content.includes("@here") ||
            message.content.includes("@everyone");
        if (!hasMention) return;

        const shoppp = await db.get(`shop_${message.channel.id}_${guildId}`);
        if (!shoppp || shoppp.disabled) return;

        const db_words = (await db.get(`forbidden_words_${guildId}`)) || [];
        const final_keywords = [
            ...new Set([...all_forbidden_words, ...db_words]),
        ];

        const foundWords = final_keywords.filter((w) =>
            message.content.toLowerCase().includes(w.toLowerCase()),
        );
        if (foundWords.length === 0) return;
        const mode =
            (await db.get(`forbidden_words_mode_${guildId}`)) || "room";
        const line = await db.get(`image_${guildId}`);
        const keywordMsg = foundWords.slice(0, 5).join(", ");

        if (mode === "auto") {
            await message.delete().catch(() => {});
            await db.add(`shop_${message.channel.id}_${guildId}.warns`, 1);
            const embed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـحـذيـر تـلـقـائـي")
                .setDescription(
                    `صـاحـب الـمـتـجـر: <@${shoppp.sellerId}>\nالـسـبـب: عـدم تـشـفـيـر: ${keywordMsg}`,
                )
                .setColor(_ec.color(guildId));
            if (line) embed.setImage(line);
            await message.channel.send({
                content: `<@${shoppp.sellerId}>`,
                embeds: [embed],
            });
            await handleDisable(message.channel.id, guildId);
        } else {
            const violRoomId = await db.get(`forbidden_words_room_${guildId}`);
            const staffRole = await db.get(`warning_staff_role_${guildId}`);
            const violRoom = await message.guild.channels
                .fetch(violRoomId)
                .catch(() => null);
            if (violRoom) {
                await db.set(`violation_${message.channel.id}_${message.id}`, {
                    userId: message.author.id,
                    word: keywordMsg,
                    sellerId: shoppp.sellerId,
                });
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `claim_warn_${message.channel.id}_${message.id}`,
                        )
                        .setLabel("اسـتـلام الـتـحـذيـر")
                        .setStyle(ButtonStyle.Danger),
                );
                const embed = new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504> مـخـالـفـة مـتـجـر")
                    .setDescription(
                        `الـمـتـجـر: <#${message.channel.id}>\nالـعـضـو: <@${message.author.id}>\nالـكـلـمـات: ${keywordMsg}`,
                    )
                    .setColor(_ec.color(guildId));
                if (line) embed.setImage(line);
                await violRoom.send({
                    content: staffRole ? `<@&${staffRole}>` : "@here",
                    embeds: [embed],
                    components: [row],
                });
            }
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.guild) return;
        const guildId = interaction.guild.id;
        const line = await db.get(`image_${guildId}`);

        if (interaction.isButton()) {
            if (interaction.customId === "setup_mode_toggle") {
                const current =
                    (await db.get(`forbidden_words_mode_${guildId}`)) || "room";
                const newMode = current === "room" ? "auto" : "room";
                await db.set(`forbidden_words_mode_${guildId}`, newMode);
                return interaction.reply({
                    content: `تـم تـحـويـل الـوضـع إلـى: **${newMode}**`,
                    ephemeral: true,
                });
            }

            if (interaction.customId === "setup_set_channel") {
                const row = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId("select_warning_ch")
                        .setPlaceholder("اخـتـر روم الإدارة")
                        .addChannelTypes(ChannelType.GuildText),
                );
                return interaction.reply({
                    content: "اخـتـر الـقـنـاة:",
                    components: [row],
                    ephemeral: true,
                });
            }

            if (interaction.customId === "setup_set_role") {
                const row = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId("select_warning_role")
                        .setPlaceholder("اخـتـر رتـبـة الاسـتـلام"),
                );
                return interaction.reply({
                    content: "اخـتـر الـرّتـبـة:",
                    components: [row],
                    ephemeral: true,
                });
            }

            if (interaction.customId === "setup_auto_disable_toggle") {
                const current =
                    (await db.get(`auto_disable_${guildId}`)) || false;
                await db.set(`auto_disable_${guildId}`, !current);
                return interaction.reply({
                    content: `✅ الـتـعـطـيـل الـتـلـقـائـي الآن: **${!current ? "مـفـعـل" : "مـعـطـل"}**`,
                    ephemeral: true,
                });
            }

            if (interaction.customId === "setup_set_limit") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_set_limit")
                    .setTitle("حـد الـتـحـذيـرات");
                const input = new TextInputBuilder()
                    .setCustomId("limit_input")
                    .setLabel("أد خـل الـعـدد")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(input),
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId.startsWith("claim_warn_")) {
                const staffRole = await db.get(`warning_staff_role_${guildId}`);
                if (staffRole && !interaction.member.roles.cache.has(staffRole))
                    return interaction.reply({
                        content:
                            "لـيـس لـد يـك الـرّتـبـة الـمـسـؤولة لـلاسـتـلام.",
                        ephemeral: true,
                    });

                const [chId, msgId] = interaction.customId
                    .replace("claim_warn_", "")
                    .split("_");
                const viol = await db.get(`violation_${chId}_${msgId}`);
                if (!viol)
                    return interaction.update({
                        content: "الـمـخـالـفـة غـيـر مـوجـود ة.",
                        components: [],
                    });

                const violCh = interaction.guild.channels.cache.get(chId);
                if (violCh) {
                    await violCh.messages
                        .fetch(msgId)
                        .then((m) => m.delete())
                        .catch(() => {});
                    await db.add(`shop_${chId}_${guildId}.warns`, 1);
                    const warnEmbed = new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـم تـحـذيـر الـمـتـجـر يـدويـاً")
                        .setDescription(
                            `الـسـبـب: عـدم تـشـفـيـر: ${viol.word}`,
                        )
                        .setColor(_ec.color(guildId));
                    if (line) warnEmbed.setImage(line);
                    await violCh.send({
                        content: `<@${viol.sellerId}>`,
                        embeds: [warnEmbed],
                    });
                    await handleDisable(chId, guildId);
                    const removeBtn = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`remove_warn_${chId}_${viol.sellerId}`)
                            .setLabel("إزالـة الـتـحـذيـر")
                            .setStyle(ButtonStyle.Success),
                    );
                    await interaction.update({
                        content: "تـم إرسـال الـتـحـذيـر بـنـجـاح.",
                        embeds: [],
                        components: [removeBtn],
                    });
                }
            }

            if (interaction.customId.startsWith("remove_warn_")) {
                const staffRole = await db.get(`warning_staff_role_${guildId}`);
                if (staffRole && !interaction.member.roles.cache.has(staffRole))
                    return interaction.reply({
                        content:
                            "لـيـس لـد يـك الـرّتـبـة الـمـسـؤولة لـلاسـتـلام.",
                        ephemeral: true,
                    });
                const [chId, sId] = interaction.customId
                    .replace("remove_warn_", "")
                    .split("_");
                const current =
                    (await db.get(`shop_${chId}_${guildId}.warns`)) || 0;
                if (current > 0)
                    await db.sub(`shop_${chId}_${guildId}.warns`, 1);
                await interaction.update({
                    content: "تـم إزالـة تـحـذيـر مـن الـمـتـجـر.",
                    components: [],
                });
            }

            if (interaction.customId.startsWith("enable_shop_")) {
                const staffRole = await db.get(`warning_staff_role_${guildId}`);
                if (staffRole && !interaction.member.roles.cache.has(staffRole))
                    return interaction.reply({
                        content:
                            "لـيـس لـد يـك الـرّتـبـة الـمـسـؤولة لـلاسـتـلام.",
                        ephemeral: true,
                    });
                const chId = interaction.customId.replace("enable_shop_", "");
                await db.set(`shop_${chId}_${guildId}.warns`, 0);
                await db.set(`shop_${chId}_${guildId}.disabled`, false);
                const channel = interaction.guild.channels.cache.get(chId);
                if (channel)
                    await channel.permissionOverwrites.edit(guildId, {
                        ViewChannel: true,
                    });
                await interaction.update({
                    content: "تـم إعـادة تـفـعـيـل الـمـتـجـر.",
                    components: [],
                });
            }
        }

        if (
            interaction.isChannelSelectMenu() &&
            interaction.customId === "select_warning_ch"
        ) {
            await db.set(
                `forbidden_words_room_${guildId}`,
                interaction.values[0],
            );
            return interaction.update({
                content: "تـم تـحـديـد روم الإدارة بـنـجـاح.",
                components: [],
            });
        }
        if (
            interaction.isRoleSelectMenu() &&
            interaction.customId === "select_warning_role"
        ) {
            await db.set(
                `warning_staff_role_${guildId}`,
                interaction.values[0],
            );
            return interaction.update({
                content: "تـم تـحـديـد رتـبـة الاسـتـلام بـنـجـاح.",
                components: [],
            });
        }
        if (
            interaction.isModalSubmit() &&
            interaction.customId === "modal_set_limit"
        ) {
            const limit = interaction.fields.getTextInputValue("limit_input");
            await db.set(`warn_limit_${guildId}`, parseInt(limit));
            return interaction.reply({
                content: `تـم تـحـديـد الـحـد عـنـد: **${limit}**`,
                ephemeral: true,
            });
        }
    });

    async function handleDisable(chId, guildId) {
        const isAuto = await db.get(`auto_disable_${guildId}`);
        if (!isAuto) return;
        const limit = (await db.get(`warn_limit_${guildId}`)) || 5;
        const shop = await db.get(`shop_${chId}_${guildId}`);
        if (shop && shop.warns >= limit) {
            await db.set(`shop_${chId}_${guildId}.disabled`, true);
            const channel = client.channels.cache.get(chId);
            if (channel)
                await channel.permissionOverwrites.edit(guildId, {
                    ViewChannel: false,
                });
            const embed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـم إخـفـاء الـمـتـجـر")
                .setDescription("تـجـاوز حـد الـتـحـذيـرات.")
                .setColor(_ec.color(guildId));
            const line = await db.get(`image_${guildId}`);
            if (line) embed.setImage(line);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`enable_shop_${chId}`)
                    .setLabel("تـفـعـيـل الـمـتـجـر")
                    .setStyle(ButtonStyle.Success),
            );
            if (channel)
                await channel.send({
                    content: `<@${shop.sellerId}>`,
                    embeds: [embed],
                    components: [row],
                });
        }
    }

    //====== Scheduler: ريست المنشن التلقائي — يعمل كل ساعة ======
    setInterval(
        async () => {
            try {
                const now = Date.now();
                const allKeys = await db.all();
                const resetKeys = allKeys.filter((k) =>
                    k.id.startsWith("auto_mention_reset_"),
                );
                for (const entry of resetKeys) {
                    const cfg = entry.value;
                    if (!cfg?.days || !cfg?.roomId || !cfg?.lastReset) continue;
                    const guildId = entry.id.replace("auto_mention_reset_", "");
                    const interval = cfg.days * 24 * 60 * 60 * 1000;
                    if (now - cfg.lastReset < interval) continue;

                    try {
                        const guild = await client.guilds
                            .fetch(guildId)
                            .catch(() => null);
                        if (!guild) continue;
                        await guild.channels.fetch().catch(() => {});
                        const categories = guild.channels.cache.filter(
                            (ch) => ch.type === ChannelType.GuildCategory,
                        );

                        for (const [, category] of categories) {
                            const categoryData = await db.get(
                                `categoryMentions_${category.id}_${guildId}`,
                            );
                            if (!categoryData) continue;
                            for (const [, channel] of category.children.cache) {
                                const shopKey = `shop_${channel.id}_${guildId}`;
                                let shopCfg = await db.get(shopKey);
                                if (!shopCfg) continue;
                                if (cfg.type && shopCfg.type !== cfg.type)
                                    continue;
                                shopCfg.everyoneMentions =
                                    categoryData.everyoneMentions || 0;
                                shopCfg.hereMentions =
                                    categoryData.hereMentions || 0;
                                shopCfg.shopRoleMentions =
                                    categoryData.shopRoleMentions || 0;
                                await db.set(shopKey, shopCfg);
                                await channel
                                    .send({
                                        content:
                                            "✅ **تم ترست متجرك تلقائياً.**",
                                    })
                                    .catch(() => {});
                            }
                        }

                        const resetRoom = guild.channels.cache.get(cfg.roomId);
                        if (resetRoom)
                            await resetRoom
                                .send({ content: cfg.message })
                                .catch(() => {});
                        cfg.lastReset = now;
                        await db.set(`auto_mention_reset_${guildId}`, cfg);
                    } catch (e) {
                        console.log(
                            `[AutoReset] Guild ${guildId}: ${e.message}`,
                        );
                    }
                }
            } catch (e) {
                console.log(`[AutoReset] Scheduler error: ${e.message}`);
            }
        },
        60 * 60 * 1000,
    );
};
