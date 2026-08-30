const _ec = require("./embedColor");
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");

async function getColor(guildId, db, config) {
    const stored = guildId ? await db.get(`embed_color_${guildId}`) : null;
    const raw = stored || config?.color || "0x00AE86";
    return parseInt(String(raw).replace("#", "").replace("0x", ""), 16);
}

async function buildSetupEmbed(guild, db, config) {
    const gid = guild.id;
    const room = await db.get(`apply_room_${gid}`);
    const type = (await db.get(`apply_type_${gid}`)) || "dm";
    const roles = (await db.get(`apply_roles_${gid}`)) || [];
    const admin = await db.get(`apply_admin_${gid}`);
    const ticketCat = await db.get(`apply_ticketcat_${gid}`);
    const qs = (await db.get(`apply_qs_${gid}`)) || {};
    const qsCount = Object.values(qs).filter(Boolean).length;

    return new EmbedBuilder()
        .setTitle(" لـوحـة إعـدادات نـظـام الـتـقـديـم")
        .setDescription(
            "**اضـغـط الأزرار أدنـاه لـتـعـديـل الإعـدادات. عـنـد الانـتـهـاء اضـغـط (نـشـر الـتـقـديـم).**",
        )
        .addFields(
            {
                name: " روم الـقـبـول",
                value: room ? `<#${room}>` : "`غير محدد`",
                inline: true,
            },
            {
                name: " نـوع الـقـبـول",
                value: type === "dm" ? "`خـاص (DM)`" : "`فـي الـروم`",
                inline: true,
            },
            {
                name: " الـرتـب الـتـلـقـائـيـة",
                value: roles.length
                    ? roles.map((r) => `<@&${r}>`).join(" ")
                    : "`غير محدد`",
                inline: false,
            },
            {
                name: " روم الـتـقـديـمـات (لـلإدارة)",
                value: admin ? `<#${admin}>` : "`غير محدد`",
                inline: true,
            },
            {
                name: " كـتـاغـوري تـكـت الـتـقـديـم",
                value: ticketCat ? `<#${ticketCat}>` : "`غير محدد`",
                inline: true,
            },
            {
                name: " الأسـئـلـة",
                value: `\`${qsCount}/5 مـعـدّة\``,
                inline: true,
            },
        )
        .setColor(await getColor(gid, db, config))
        .setFooter({ text: guild.name })
        .setTimestamp();
}

function buildSetupRows() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("applycfg_room")
                .setLabel("روم القبول")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
            new ButtonBuilder()
                .setCustomId("applycfg_type")
                .setLabel("نوع القبول")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
            new ButtonBuilder()
                .setCustomId("applycfg_roles")
                .setLabel("الرتب")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("applycfg_admin")
                .setLabel("روم التقديمات")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
            new ButtonBuilder()
                .setCustomId("applycfg_ticketcat")
                .setLabel("كاتيغوري التكت")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
            new ButtonBuilder()
                .setCustomId("applycfg_questions")
                .setLabel("الأسئلة")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("<a:011_1367454588252454943:1542937524274470974>"),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("applycfg_publish")
                .setLabel(" نشر التقديم")
                .setStyle(ButtonStyle.Success),
        ),
    ];
}

function buildQuestionsRows(qs) {
    qs = qs || {};
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();
    for (let n = 1; n <= 5; n++) {
        const has = !!qs[n];
        const btn = new ButtonBuilder()
            .setCustomId(`applycfg_q${n}`)
            .setLabel(`سؤال ${n}${has ? " ✓" : ""}`)
            .setStyle(has ? ButtonStyle.Success : ButtonStyle.Secondary);
        if (n <= 3) row1.addComponents(btn);
        else row2.addComponents(btn);
    }
    return [row1, row2];
}

const ticketLocks = new Set();

async function safeReplyError(interaction, msg) {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: msg,
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: msg,
                flags: MessageFlags.Ephemeral,
            });
        }
    } catch {}
}

module.exports = function registerApply(client, { db, config }) {
    const isGeneral = () => {
        const tok = client._botToken || "";
        return (
            tok &&
            tok === (config.generalToken || process.env.BOT_TOKEN_GENERAL || "")
        );
    };

    //========= prefix command: +تسطيب-تقديم =========
    client.on("messageCreate", async (message) => {
        if (!isGeneral()) return;
        if (!message.guild || message.author.bot) return;
        const content = message.content.trim();
        if (content !== "+تسطيب-تقديم" && content !== "+تسطيب التقديم") return;
        if (
            !message.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
            return message.reply(
                "**❌ يـجـب أن تـكـون لـديـك صـلاحـيـة Administrator.**",
            );
        }
        const embed = await buildSetupEmbed(message.guild, db, config);
        await message.channel.send({
            embeds: [embed],
            components: buildSetupRows(),
        });
    });

    //========= setup panel buttons =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton() || !interaction.guild) return;
        if (!interaction.customId.startsWith("applycfg_")) return;
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            return interaction.reply({
                content:
                    "**❌ يـجـب أن تـكـون لـديـك صـلاحـيـة Administrator.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const id = interaction.customId;
        const gid = interaction.guild.id;

        // اختيار روم القبول
        if (id === "applycfg_room") {
            const sel = new ChannelSelectMenuBuilder()
                .setCustomId("applycfg_pickroom")
                .setPlaceholder("اختر روم القبول")
                .addChannelTypes(ChannelType.GuildText);
            return interaction.reply({
                content: "**اخـتـر الـروم الـذي يـرسـل فـيـه (تـم قـبـولـك):**",
                components: [new ActionRowBuilder().addComponents(sel)],
                flags: MessageFlags.Ephemeral,
            });
        }

        // تبديل نوع القبول
        if (id === "applycfg_type") {
            const cur = (await db.get(`apply_type_${gid}`)) || "dm";
            const next = cur === "dm" ? "channel" : "dm";
            await db.set(`apply_type_${gid}`, next);
            try {
                const embed = await buildSetupEmbed(
                    interaction.guild,
                    db,
                    config,
                );
                await interaction.update({
                    embeds: [embed],
                    components: buildSetupRows(),
                });
            } catch {
                await interaction.reply({
                    content: `**✅ تـم: \`${next === "dm" ? "خاص" : "في الروم"}\`**`,
                    flags: MessageFlags.Ephemeral,
                });
            }
            return;
        }

        // اختيار الرتب
        if (id === "applycfg_roles") {
            const sel = new RoleSelectMenuBuilder()
                .setCustomId("applycfg_pickroles")
                .setPlaceholder("اختر الرتب التي تُعطى للمقبول")
                .setMinValues(0)
                .setMaxValues(10);
            return interaction.reply({
                content:
                    "**اخـتـر الـرتـب الـتـي تُـعـطـى تـلـقـائـيـاً لـلـمـقـبـول (يـمـكـن الـمـتـعـدد):**",
                components: [new ActionRowBuilder().addComponents(sel)],
                flags: MessageFlags.Ephemeral,
            });
        }

        // اختيار روم التقديمات (للإدارة)
        if (id === "applycfg_admin") {
            const sel = new ChannelSelectMenuBuilder()
                .setCustomId("applycfg_pickadmin")
                .setPlaceholder("اختر روم استقبال التقديمات")
                .addChannelTypes(ChannelType.GuildText);
            return interaction.reply({
                content:
                    "**اخـتـر روم اسـتـقـبـال الـتـقـديـمـات (لـلإدارة):**",
                components: [new ActionRowBuilder().addComponents(sel)],
                flags: MessageFlags.Ephemeral,
            });
        }

        // اختيار كاتيغوري التكت
        if (id === "applycfg_ticketcat") {
            const sel = new ChannelSelectMenuBuilder()
                .setCustomId("applycfg_pickticketcat")
                .setPlaceholder("اختر كاتيغوري التكت")
                .addChannelTypes(ChannelType.GuildCategory);
            return interaction.reply({
                content:
                    "**اخـتـر الـكـتـاغـوري الـذي تُـنـشـأ فـيـه تـكـتـات الـتـقـديـم:**",
                components: [new ActionRowBuilder().addComponents(sel)],
                flags: MessageFlags.Ephemeral,
            });
        }

        // قائمة الأسئلة
        if (id === "applycfg_questions") {
            const qs = (await db.get(`apply_qs_${gid}`)) || {};
            return interaction.reply({
                content:
                    "**اضـغـط عـلـى رقـم الـسـؤال لـتـعـديـلـه (الـعـلامـة ✓ تـعـنـي مـعـدّ).**",
                components: buildQuestionsRows(qs),
                flags: MessageFlags.Ephemeral,
            });
        }

        // أزرار الأسئلة 1..5 (تفتح Modal)
        const qm = id.match(/^applycfg_q([1-5])$/);
        if (qm) {
            const n = qm[1];
            const qs = (await db.get(`apply_qs_${gid}`)) || {};
            const cur = qs[n] || "";
            const modal = new ModalBuilder()
                .setCustomId(`applymodal_q${n}`)
                .setTitle(`السؤال رقم ${n}`)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("qtext")
                            .setLabel("نص السؤال")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                            .setMaxLength(200)
                            .setValue(cur ? cur.slice(0, 200) : ""),
                    ),
                );
            return interaction.showModal(modal);
        }

        // نشر التقديم → Modal
        if (id === "applycfg_publish") {
            const room = await db.get(`apply_admin_${gid}`);
            if (!room)
                return interaction.reply({
                    content: "**❌ حـدد روم الـتـقـديـمـات أولاً.**",
                    flags: MessageFlags.Ephemeral,
                });
            const modal = new ModalBuilder()
                .setCustomId("applypub_modal")
                .setTitle("نشر بانل التقديم")
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("title")
                            .setLabel("عنوان الإمبد")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(100)
                            .setValue("التقديم"),
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("desc")
                            .setLabel("وصف الإمبد")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                            .setMaxLength(2000)
                            .setValue("اضغط الزر أدناه للتقديم."),
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("btnlabel")
                            .setLabel("نص الزر")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(50)
                            .setValue("تقديم"),
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("emoji")
                            .setLabel(
                                "الإيموجي (اختياري — مثل 📝 أو <:name:id>)",
                            )
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(80),
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("type")
                            .setLabel("النوع: اكتب questions أو ticket")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(20)
                            .setValue("questions"),
                    ),
                );
            return interaction.showModal(modal);
        }
    });

    //========= channel/role select menus =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.guild) return;
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        )
            return;
        const gid = interaction.guild.id;

        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === "applycfg_pickroom") {
                await db.set(`apply_room_${gid}`, interaction.values[0]);
                return interaction.update({
                    content: `**✅ تـم تـحـديـد روم الـقـبـول: <#${interaction.values[0]}>**`,
                    components: [],
                });
            }
            if (interaction.customId === "applycfg_pickadmin") {
                await db.set(`apply_admin_${gid}`, interaction.values[0]);
                return interaction.update({
                    content: `**✅ تـم تـحـديـد روم الـتـقـديـمـات: <#${interaction.values[0]}>**`,
                    components: [],
                });
            }
            if (interaction.customId === "applycfg_pickticketcat") {
                await db.set(`apply_ticketcat_${gid}`, interaction.values[0]);
                return interaction.update({
                    content: `**✅ تـم تـحـديـد كـتـاغـوري الـتـكـت: <#${interaction.values[0]}>**`,
                    components: [],
                });
            }
        }

        if (
            interaction.isRoleSelectMenu() &&
            interaction.customId === "applycfg_pickroles"
        ) {
            await db.set(`apply_roles_${gid}`, interaction.values);
            return interaction.update({
                content: interaction.values.length
                    ? `**✅ تـم حـفـظ الـرتـب:** ${interaction.values.map((r) => `<@&${r}>`).join(" ")}`
                    : "**✅ تـم مـسـح كـل الـرتـب.**",
                components: [],
            });
        }
    });

    //========= modal: question text =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isModalSubmit() || !interaction.guild) return;
        const m = interaction.customId.match(/^applymodal_q([1-5])$/);
        if (!m) return;
        const n = m[1];
        const gid = interaction.guild.id;
        const txt = interaction.fields.getTextInputValue("qtext").trim();
        const qs = (await db.get(`apply_qs_${gid}`)) || {};
        qs[n] = txt;
        await db.set(`apply_qs_${gid}`, qs);
        await interaction.reply({
            content: `**✅ تـم حـفـظ الـسـؤال رقـم ${n}.**`,
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= modal: publish panel =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isModalSubmit() || !interaction.guild) return;
        if (interaction.customId !== "applypub_modal") return;
        const gid = interaction.guild.id;
        const title =
            interaction.fields.getTextInputValue("title").trim() || "التقديم";
        const desc = interaction.fields.getTextInputValue("desc").trim();
        const btnlabel =
            interaction.fields.getTextInputValue("btnlabel").trim() || "تقديم";
        const emoji =
            interaction.fields.getTextInputValue("emoji").trim() || "";
        const typeRaw = interaction.fields
            .getTextInputValue("type")
            .trim()
            .toLowerCase();
        const type =
            typeRaw.startsWith("t") || typeRaw.includes("تكت")
                ? "ticket"
                : "questions";

        if (type === "questions") {
            const qs = (await db.get(`apply_qs_${gid}`)) || {};
            if (Object.values(qs).filter(Boolean).length === 0) {
                return interaction.reply({
                    content:
                        "**❌ لا تـوجـد أسـئـلـة مـعـدّة. اضـبـط الأسـئـلـة أولاً.**",
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
        if (type === "ticket" && !(await db.get(`apply_ticketcat_${gid}`))) {
            return interaction.reply({
                content: "**❌ حـدد كـتـاغـوري الـتـكـت أولاً.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .setColor(await getColor(gid, db, config))
            .setFooter({ text: interaction.guild.name })
            .setTimestamp();

        const btn = new ButtonBuilder()
            .setCustomId(
                type === "ticket"
                    ? "apply_open_ticket"
                    : "apply_open_questions",
            )
            .setLabel(btnlabel)
            .setStyle(ButtonStyle.Primary);
        if (emoji) {
            try {
                btn.setEmoji(emoji);
            } catch {}
        }

        await interaction.channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(btn)],
        });
        await interaction.reply({
            content: "**✅ تـم نـشـر بـانـل الـتـقـديـم بـنـجـاح.**",
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= apply button: questions =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton() || !interaction.guild) return;
        if (interaction.customId !== "apply_open_questions") return;
        const gid = interaction.guild.id;
        const qs = (await db.get(`apply_qs_${gid}`)) || {};
        const list = [];
        for (let n = 1; n <= 5; n++) if (qs[n]) list.push({ n, q: qs[n] });
        if (list.length === 0)
            return interaction.reply({
                content: "**❌ لا تـوجـد أسـئـلـة مـعـدّة.**",
                flags: MessageFlags.Ephemeral,
            });

        const modal = new ModalBuilder()
            .setCustomId("apply_qmodal")
            .setTitle("استمارة التقديم");
        for (const item of list) {
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`a${item.n}`)
                        .setLabel(item.q.slice(0, 45))
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1000),
                ),
            );
        }
        await interaction.showModal(modal);
    });

    //========= apply questions modal submit =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isModalSubmit() || !interaction.guild) return;
        if (interaction.customId !== "apply_qmodal") return;
        const gid = interaction.guild.id;
        const adminRoom = await db.get(`apply_admin_${gid}`);
        if (!adminRoom)
            return interaction.reply({
                content: "**❌ روم الـتـقـديـمـات غـيـر مـحـدد.**",
                flags: MessageFlags.Ephemeral,
            });
        const adminCh = interaction.guild.channels.cache.get(adminRoom);
        if (!adminCh)
            return interaction.reply({
                content: "**❌ روم الـتـقـديـمـات غـيـر مـوجـود.**",
                flags: MessageFlags.Ephemeral,
            });

        const qs = (await db.get(`apply_qs_${gid}`)) || {};
        const fields = [];
        for (let n = 1; n <= 5; n++) {
            if (!qs[n]) continue;
            let ans;
            try {
                ans = interaction.fields.getTextInputValue(`a${n}`);
            } catch {
                continue;
            }
            fields.push({
                name: `❓ ${qs[n]}`.slice(0, 256),
                value: `${ans}`.slice(0, 1024),
            });
        }

        const userId = interaction.user.id;
        const embed = new EmbedBuilder()
            .setTitle(" تـقـديـم جـديـد")
            .setAuthor({
                name: interaction.user.tag,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setDescription(`**الـمـقـدم:** <@${userId}> \`(${userId})\``)
            .addFields(fields)
            .setColor(await getColor(gid, db, config))
            .setFooter({ text: "بـانـتـظـار الـقـرار" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`apply_accept_${userId}`)
                .setLabel("قبول")
                .setStyle(ButtonStyle.Success)
                .setEmoji("✅"),
            new ButtonBuilder()
                .setCustomId(`apply_reject_${userId}`)
                .setLabel("رفض")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("❌"),
            new ButtonBuilder()
                .setCustomId(`apply_reasonbtn_${userId}`)
                .setLabel("رفض مع سبب")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("📝"),
        );

        await adminCh.send({ embeds: [embed], components: [row] });
        await interaction.reply({
            content: "**✅ تـم إرسـال تـقـديـمـك. بـانـتـظـار الـرد.**",
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= apply button: ticket =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton() || !interaction.guild) return;
        if (interaction.customId !== "apply_open_ticket") return;
        const gid = interaction.guild.id;
        const userId = interaction.user.id;
        const lockKey = `${userId}_${gid}`;

        try {
            const cat = await db.get(`apply_ticketcat_${gid}`);
            const adminRoom = await db.get(`apply_admin_${gid}`);
            if (!cat)
                return interaction.reply({
                    content: "**❌ كـتـاغـوري الـتـكـت غـيـر مـحـدد.**",
                    flags: MessageFlags.Ephemeral,
                });

            if (ticketLocks.has(lockKey)) {
                return interaction.reply({
                    content:
                        "**❌ جـاري إنـشـاء تـكـتـك بـالـفـعـل. انـتـظـر لـحـظـة...**",
                    flags: MessageFlags.Ephemeral,
                });
            }
            ticketLocks.add(lockKey);

            try {
                const exist = await db.get(`apply_ticket_${userId}_${gid}`);
                if (exist) {
                    const ch = interaction.guild.channels.cache.get(
                        exist.channelId,
                    );
                    if (ch)
                        return interaction.reply({
                            content: `**❌ لـديـك تـكـت تـقـديـم مـفـتـوح: <#${ch.id}>**`,
                            flags: MessageFlags.Ephemeral,
                        });
                    await db.delete(`apply_ticket_${userId}_${gid}`);
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const safe =
                    interaction.user.username
                        .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")
                        .slice(0, 24) || "user";
                let ch;
                try {
                    ch = await interaction.guild.channels.create({
                        name: `apply-${safe}`,
                        type: ChannelType.GuildText,
                        parent: cat,
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
                        ],
                    });
                } catch (e) {
                    console.error("apply ticket create error:", e);
                    return interaction.editReply(
                        "**❌ فـشـل إنـشـاء الـتـكـت. تـأكـد مـن صـلاحـيـات الـبـوت.**",
                    );
                }

                await db.set(`apply_ticket_${userId}_${gid}`, {
                    channelId: ch.id,
                });
                await db.set(`apply_ticket_channel_${ch.id}`, {
                    ownerId: userId,
                    guildId: gid,
                });

                const embed = new EmbedBuilder()
                    .setTitle(" تـكـت الـتـقـديـم")
                    .setDescription(
                        `**أهـلاً <@${userId}>**\n\nالإدارة سـتـتـواصـل مـعـك هـنـا. اكـتـب أي تـفـاصـيـل تـريـد إضـافـتـهـا.`,
                    )
                    .setColor(await getColor(gid, db, config))
                    .setTimestamp();
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`apply_accept_${userId}`)
                        .setLabel("قبول")
                        .setStyle(ButtonStyle.Success)
                        .setEmoji("✅"),
                    new ButtonBuilder()
                        .setCustomId(`apply_reject_${userId}`)
                        .setLabel("رفض")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji("<a:emoji_82:1542937626569482260>"),
                    new ButtonBuilder()
                        .setCustomId(`apply_reasonbtn_${userId}`)
                        .setLabel("رفض مع سبب")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji("<a:emoji_82:1542937626569482260>"),
                );
                await ch.send({
                    content: `<@${userId}>`,
                    embeds: [embed],
                    components: [row],
                });
                if (adminRoom) {
                    const ach = interaction.guild.channels.cache.get(adminRoom);
                    if (ach)
                        await ach
                            .send({
                                content: ` تـكـت تـقـديـم جـديـد مـن <@${userId}>: <#${ch.id}>`,
                            })
                            .catch(() => {});
                }
                await interaction.editReply(
                    `** تـم فـتـح تـكـت الـتـقـديـم: <#${ch.id}>**`,
                );
            } finally {
                ticketLocks.delete(lockKey);
            }
        } catch (e) {
            console.error("apply_open_ticket error:", e);
            ticketLocks.delete(lockKey);
            await safeReplyError(
                interaction,
                "**❌ حـدث خـطـأ غـيـر مـتـوقـع.**",
            );
        }
    });

    //========= helper: send accept/reject finalization =========
    async function sendAccept(interaction, applicantId) {
        const gid = interaction.guild.id;
        const member = await interaction.guild.members
            .fetch(applicantId)
            .catch(() => null);
        if (!member) {
            return interaction.reply({
                content: "**❌ الـعـضـو لـم يـعـد فـي الـسـيـرفـر.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const roles = (await db.get(`apply_roles_${gid}`)) || [];
        const givenRoles = [];
        for (const r of roles) {
            try {
                await member.roles.add(r);
                givenRoles.push(r);
            } catch {}
        }

        const acceptType = (await db.get(`apply_type_${gid}`)) || "dm";
        const acceptRoom = await db.get(`apply_room_${gid}`);
        const successText =
            `** مـبـروك <@${applicantId}>! تـم قـبـولـك فـي ${interaction.guild.name}.**` +
            (givenRoles.length
                ? `\nالـرتـب الـمُـعـطـاة: ${givenRoles.map((r) => `<@&${r}>`).join(" ")}`
                : "");

        let delivered = "";
        if (acceptType === "dm") {
            try {
                await member.send(successText);
                delivered = " تـم الإرسـال خـاص.";
            } catch {
                delivered = " لـم أتـمـكـن مـن الإرسـال خـاص.";
            }
        }
        if (acceptType === "channel" || delivered.includes("⚠️")) {
            if (acceptRoom) {
                const ch = interaction.guild.channels.cache.get(acceptRoom);
                if (ch) {
                    try {
                        await ch.send(successText);
                        delivered += " ✅ نُـشـر فـي الـروم.";
                    } catch {
                        delivered += " ❌ فـشـل الـنـشـر.";
                    }
                }
            }
        }

        // update embed
        try {
            const msg = interaction.message;
            const oldEmbed = msg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .setColor(_ec.color(gid))
                .setFooter({
                    text: `✅ تـم الـقـبـول بـواسـطـة ${interaction.user.tag}`,
                })
                .setTimestamp();
            await msg.edit({ embeds: [newEmbed], components: [] });
        } catch {}

        await interaction.editReply(
            `**✅ تـم قـبـول <@${applicantId}>.** ${delivered}`,
        );

        // close ticket if this was a ticket channel
        const tmeta = await db.get(
            `apply_ticket_channel_${interaction.channel.id}`,
        );
        if (tmeta) {
            try {
                await interaction.channel.send(
                    "**🔒 سـيُـحـذف الـتـكـت خـلال 10 ثـوانٍ...**",
                );
            } catch {}
            setTimeout(
                () => interaction.channel.delete().catch(() => {}),
                10000,
            );
        }
    }

    async function sendReject(interaction, applicantId, reason) {
        const gid = interaction.guild.id;
        await interaction
            .deferReply({ flags: MessageFlags.Ephemeral })
            .catch(() => {});

        const member = await interaction.guild.members
            .fetch(applicantId)
            .catch(() => null);
        const text = reason
            ? `**❌ تـم رفـض تـقـديـمـك فـي ${interaction.guild.name}.**\n**الـسـبـب:** ${reason}`
            : `**❌ تـم رفـض تـقـديـمـك فـي ${interaction.guild.name}.**`;

        let delivered = "";
        if (member) {
            try {
                await member.send(text);
                delivered = "📨 تـم إعـلام الـعـضـو خـاص.";
            } catch {
                delivered = "⚠️ لـم أتـمـكـن مـن إعـلام الـعـضـو خـاص.";
            }
        }

        try {
            const msg = interaction.message;
            const oldEmbed = msg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .setColor(_ec.color(gid))
                .setFooter({
                    text: `❌ تـم الـرفـض بـواسـطـة ${interaction.user.tag}${reason ? ` — السبب: ${reason.slice(0, 80)}` : ""}`,
                })
                .setTimestamp();
            await msg.edit({ embeds: [newEmbed], components: [] });
        } catch {}

        await interaction.editReply(
            `**❌ تـم رفـض تـقـديـم <@${applicantId}>.** ${delivered}`,
        );

        const tmeta = await db.get(
            `apply_ticket_channel_${interaction.channel.id}`,
        );
        if (tmeta) {
            try {
                await interaction.channel.send(
                    "**🔒 سـيُـحـذف الـتـكـت خـلال 10 ثـوانٍ...**",
                );
            } catch {}
            setTimeout(
                () => interaction.channel.delete().catch(() => {}),
                10000,
            );
        }
    }

    //========= admin buttons: accept / reject / reason =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton() || !interaction.guild) return;
        const m = interaction.customId.match(
            /^apply_(accept|reject|reasonbtn)_(\d+)$/,
        );
        if (!m) return;
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            return interaction.reply({
                content:
                    "**❌ يـجـب أن تـكـون لـديـك صـلاحـيـة Administrator.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        const action = m[1];
        const applicantId = m[2];

        if (action === "accept") return sendAccept(interaction, applicantId);
        if (action === "reject")
            return sendReject(interaction, applicantId, null);
        if (action === "reasonbtn") {
            const modal = new ModalBuilder()
                .setCustomId(`apply_reasonmodal_${applicantId}`)
                .setTitle("سبب الرفض")
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("reason")
                            .setLabel("اكتب سبب الرفض")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                            .setMaxLength(800),
                    ),
                );
            return interaction.showModal(modal);
        }
    });

    //========= reason modal submit =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isModalSubmit() || !interaction.guild) return;
        const m = interaction.customId.match(/^apply_reasonmodal_(\d+)$/);
        if (!m) return;
        const applicantId = m[1];
        const reason = interaction.fields.getTextInputValue("reason").trim();
        return sendReject(interaction, applicantId, reason);
    });

    //========= cleanup ticket on channelDelete =========
    client.on("channelDelete", async (channel) => {
        try {
            const tmeta = await db.get(`apply_ticket_channel_${channel.id}`);
            if (tmeta) {
                await db.delete(`apply_ticket_channel_${channel.id}`);
                if (tmeta.ownerId)
                    await db.delete(
                        `apply_ticket_${tmeta.ownerId}_${channel.guild?.id || ""}`,
                    );
            }
        } catch {}
    });
};
