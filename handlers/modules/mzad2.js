const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
    StringSelectMenuBuilder,
} = require("discord.js");
const emojis = require("./emojis");
const D = require("./descriptions");
const { verifyPayment } = require("./paymentVerification");

const mzad2Timers = new Map();

const PAYMENT_BOT_ID = "1535048804078977164";

async function getColor(guildId, db, config) {
    const stored = guildId ? await db.get(`embed_color_${guildId}`) : null;
    const raw = stored || config?.color || "0x00AE86";
    return parseInt(String(raw).replace("#", "").replace("0x", ""), 16);
}

async function requireAuctionAdmin(interaction, db) {
    const adminRole = await db.get(`auctionad_${interaction.guild.id}`);
    if (!adminRole || !interaction.member.roles.cache.has(adminRole)) {
        await interaction.reply({
            content: "**🚫 يجب أن تملك رتبة مسؤول المزاد لاستخدام هذا الأمر.**",
            flags: MessageFlags.Ephemeral,
        });
        return false;
    }
    return true;
}

function fmtRemaining(sec) {
    if (sec <= 0) return "00س:00د:00ث";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}س:${String(m).padStart(2, "0")}د:${String(s).padStart(2, "0")}ث`;
}

function buildMzad2Msg(draft, rem) {
    return (
        `${draft.mentionType}\n**الـمـزاد الـخـاص**\n\n` +
        `> الـسـلـعـة: **${draft.itemName}**\n` +
        `> الـسـعـر الـمـبـدئـي: **${draft.startPrice}**\n` +
        `> الـضـريـبـة: **${draft.includesTax ? "نـعـم" : "لا"}**\n` +
        `> صـاحـب الـمـزاد: <@${draft.owner}>\n` +
        `> نـوع الـمـزاد: **${draft.typeName}**\n\n` +
        `**الـوقـت الـمـتـبـقـي:** \`${fmtRemaining(rem)}\``
    );
}

function buildControlRow(roomId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mzad2_refresh_${roomId}`)
            .setLabel("إنـعـاش")
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.revive || "🔔"),
        new ButtonBuilder()
            .setCustomId(`mzad2_cancel_${roomId}`)
            .setLabel("إلـغـاء")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis.cancelAuction || "❌"),
    );
}

function startMzad2Interval(td, roomId, db) {
    let dbTick = 0;
    td.interval = setInterval(async () => {
        td.remainingTime--;
        dbTick++;

        if (dbTick % 15 === 0) {
            try {
                const snap = await db.get(`active_mzad2_${roomId}`);
                if (snap)
                    await db.set(`active_mzad2_${roomId}`, {
                        ...snap,
                        remainingTime: td.remainingTime,
                        everyLeft: td.everyLeft,
                        hereLeft: td.hereLeft,
                    });
            } catch {}
        }

        try {
            await td.auctionMsg.edit({
                content: buildMzad2Msg(td.draft, td.remainingTime),
            });
        } catch {
            clearInterval(td.interval);
            mzad2Timers.delete(roomId);
            return;
        }

        if (td.remainingTime === 300 && !td.fiveMinNoticeSent) {
            td.fiveMinNoticeSent = true;
            try {
                await td.roomChannel.send(
                    "**⚠️ سـيـنـتـهـي الـمـزاد بـعـد 5 دقـائـق.**",
                );
            } catch {}
        }
        if (td.remainingTime === 60 && !td.oneMinNoticeSent) {
            td.oneMinNoticeSent = true;
            try {
                await td.roomChannel.send(
                    "**⚠️ سـيـنـتـهـي الـمـزاد بـعـد دقـيـقـة واحـدة.**",
                );
            } catch {}
        }

        if (td.remainingTime <= 0) {
            clearInterval(td.interval);
            mzad2Timers.delete(roomId);
            await db.delete(`active_mzad2_${roomId}`);
            try {
                await td.controlMsg.delete();
            } catch {}
            try {
                await td.roomChannel.send(
                    `**# انـتـهـى وقـت الـمـزاد**\nصـاحـب الـمـزاد: <@${td.draft.owner}>`,
                );
            } catch {}
            setTimeout(async () => {
                try {
                    await td.roomChannel.delete("انتهى المزاد الخاص");
                } catch {}
            }, 15000);
        }
    }, 1000);
}

async function startMzad2InRoom(guild, type, draft, db, config) {
    const pubCat = await db.get(`mzad2_pub_cat_${guild.id}`);
    const roomsList = await db.get(`mzad2_rooms_${guild.id}`);
    const validRooms = Array.isArray(roomsList) ? roomsList.filter(Boolean) : [];

    let roomChannel;
    let usedConfiguredRoom = false;
    if (validRooms.length > 0) {
        let idx = Number(await db.get(`mzad2_room_index_${guild.id}`)) || 0;
        if ((await db.get(`mzad2_room_index_${guild.id}`)) == null) idx = 0;
        const candidates = [];
        for (let i = 0; i < validRooms.length; i++) {
            const c = guild.channels.cache.get(validRooms[i]);
            if (c && c.type === ChannelType.GuildText) candidates.push(c);
        }
        if (candidates.length > 0) {
            const pick = candidates[idx % candidates.length];
            roomChannel = pick;
            usedConfiguredRoom = true;
            const nextIdx = (idx + 1) % Math.max(1, candidates.length);
            await db.set(`mzad2_room_index_${guild.id}`, nextIdx);
            try {
                await roomChannel.send(
                    `> 🔄 **يـتـم إنـشـاء الـمـزاد الـخـاص فـي هـذا الـروم.**`,
                );
            } catch {}
        }
    }

    if (!usedConfiguredRoom) {
        const safeName =
            String(draft.roomName)
                .replace(/[^a-zA-Z0-9\u0600-\u06FF\-_]/g, "-")
                .slice(0, 90) || "mzad2";
        try {
            roomChannel = await guild.channels.create({
                name: safeName,
                type: ChannelType.GuildText,
                parent: pubCat || null,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        allow: [
                            "ViewChannel",
                            "ReadMessageHistory",
                            "SendMessages",
                        ],
                    },
                ],
            });
        } catch (e) {
            console.error("mzad2 create channel error:", e);
            return null;
        }
    }

    let everyLeft = type.every;
    let hereLeft = type.here;
    const mentionType =
        everyLeft > 0 ? "@everyone" : hereLeft > 0 ? "@here" : "";
    if (mentionType === "@everyone") everyLeft = Math.max(0, everyLeft - 1);
    else if (mentionType === "@here") hereLeft = Math.max(0, hereLeft - 1);

    draft.mentionType = mentionType;
    draft.typeName = type.name;
    const initRem = type.hours * 3600;

    const auctionMsg = await roomChannel.send({
        content: buildMzad2Msg(draft, initRem),
    });

    if (draft.imageUrl) {
        try {
            await roomChannel.send({
                files: [{ attachment: draft.imageUrl, name: "mzad2.png" }],
            });
        } catch {
            try {
                await roomChannel.send(
                    `**صـورة الـسـلـعـة:**\n${draft.imageUrl}`,
                );
            } catch {}
        }
    }

    if (type.notice) {
        try {
            await roomChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> قـوانـيـن  الـمـزاد الـخـاص")
                        .setDescription(type.notice)
                        .setColor(await getColor(guild.id, db, config))
                        .setTimestamp(),
                ],
            });
        } catch {}
    }

    const controlMsg = await roomChannel.send({
        content: `**— لـوحـة تـحـكـم الـمـزاد الـخـاص —**\n@everyone مـتـبـقـي: \`${everyLeft}\` • @here مـتـبـقـي: \`${hereLeft}\``,
        components: [buildControlRow(roomChannel.id)],
    });

    await db.set(`active_mzad2_${roomChannel.id}`, {
        guildId: guild.id,
        ownerId: draft.owner,
        draft,
        type,
        remainingTime: initRem,
        everyLeft,
        hereLeft,
        auctionMsgId: auctionMsg.id,
        controlMsgId: controlMsg.id,
        startedAt: Date.now(),
    });

    const td = {
        remainingTime: initRem,
        guild,
        roomChannel,
        draft,
        guildId: guild.id,
        auctionMsg,
        controlMsg,
        everyLeft,
        hereLeft,
        type,
        oneMinNoticeSent: false,
        fiveMinNoticeSent: false,
        interval: null,
    };
    mzad2Timers.set(roomChannel.id, td);
    startMzad2Interval(td, roomChannel.id, db);
    return roomChannel;
}

async function runMzad2QuestionFlow(
    channel,
    type,
    db,
    config,
    guildId,
    userId,
    paidPrice,
) {
    const timeoutMsg = `** انتهى الوقت.** <@!${userId}>`;
    const closeAndDelete = async () => {
        await channel.send(timeoutMsg);
        await channel.send("** سيتم إغلاق التكت تلقائياً خلال 5 ثواني...**");
        setTimeout(() => channel.delete().catch(() => {}), 5000);
    };

    // 1. اسم الروم
    await channel.send(
        `<@${userId}> ** اكـتـب اسـم الـروم الـخـاص بـمـزادك:** *(لديك 3 دقائق)*`,
    );
    let roomName;
    try {
        const c = await channel.awaitMessages({
            filter: (m) => m.author.id === userId,
            max: 1,
            time: 180000,
            errors: ["time"],
        });
        roomName = c.first().content;
    } catch {
        return closeAndDelete();
    }

    // 2. اسم السلعة
    await channel.send(
        `<@${userId}> ** مـا هـي الـسـلـعـة؟** *(لديك 3 دقائق)*`,
    );
    let itemName;
    try {
        const c = await channel.awaitMessages({
            filter: (m) => m.author.id === userId,
            max: 1,
            time: 180000,
            errors: ["time"],
        });
        itemName = c.first().content;
    } catch {
        return closeAndDelete();
    }

    // 3. الضريبة
    const taxRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`m2tax_yes_${userId}`)
            .setLabel("نعم - بضريبة")
            .setStyle(ButtonStyle.Success)
            .setEmoji(emojis.tax || "✅"),
        new ButtonBuilder()
            .setCustomId(`m2tax_no_${userId}`)
            .setLabel("لا - بدون ضريبة")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis.cancel || "❌"),
    );
    const taxMsg = await channel.send({
        content: `<@${userId}> ** هـل الـسـلـعـة بـضـريـبـة؟**`,
        components: [taxRow],
    });
    let includesTax;
    try {
        const btnI = await taxMsg.awaitMessageComponent({
            filter: (i) => i.user.id === userId,
            time: 180000,
        });
        includesTax = btnI.customId === `m2tax_yes_${userId}`;
        await btnI.reply({
            content: `**✅ تـم الاخـتـيـار: ${includesTax ? "بـضـريـبـة" : "بـدون ضـريـبـة"}**`,
            flags: MessageFlags.Ephemeral,
        });
        await taxMsg.edit({ components: [] });
    } catch {
        return closeAndDelete();
    }

    // 4. السعر المبدئي
    await channel.send(
        `<@${userId}> ** أرسـل الـسـعـر الـمـبـدئـي لـلـسـلـعـة:**`,
    );
    let startPrice;
    try {
        const c = await channel.awaitMessages({
            filter: (m) => m.author.id === userId,
            max: 1,
            time: 180000,
            errors: ["time"],
        });
        startPrice = c.first().content;
    } catch {
        return closeAndDelete();
    }

    // 5. الصور
    const imgRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`m2img_yes_${userId}`)
            .setLabel("نعم")
            .setStyle(ButtonStyle.Success)
            .setEmoji(emojis.confirm || "✅"),
        new ButtonBuilder()
            .setCustomId(`m2img_no_${userId}`)
            .setLabel("لا")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis.cancel || "❌"),
    );
    const imgPromptMsg = await channel.send({
        content: `<@${userId}> ** هـل تـريـد إضـافـة صـورة؟**`,
        components: [imgRow],
    });
    let imageUrl = null;
    try {
        const btnI = await imgPromptMsg.awaitMessageComponent({
            filter: (i) => i.user.id === userId,
            time: 180000,
        });
        const wantsImages = btnI.customId === `m2img_yes_${userId}`;
        await btnI.deferUpdate();
        await imgPromptMsg.edit({ components: [] });
        if (wantsImages) {
            await channel.send(
                `<@${userId}> ** أرسـل الـصـورة (مـرفـق أو رابـط):** *(لديك 3 دقائق)*`,
            );
            try {
                const imgC = await channel.awaitMessages({
                    filter: (m) => m.author.id === userId,
                    max: 1,
                    time: 180000,
                    errors: ["time"],
                });
                const imgMsg = imgC.first();
                if (imgMsg.attachments.size > 0)
                    imageUrl = imgMsg.attachments.first().url;
                else if (imgMsg.content && imgMsg.content.startsWith("http"))
                    imageUrl = imgMsg.content.trim();
            } catch {}
        }
    } catch {
        return closeAndDelete();
    }

    const draft = {
        roomName,
        itemName,
        includesTax,
        startPrice,
        imageUrl,
        owner: userId,
        paidPrice,
    };

    // ملخص + زر النشر
    const summary = new EmbedBuilder()
        .setTitle("<a:ggeg1_944745994256438:1541881273658773504> ** مـلـخـص تـفـاصـيـل الـمـزاد**")
        .setDescription(
            `> اسـم الـروم: **${roomName}**\n` +
                `> الـسـلـعـة: **${itemName}**\n` +
                `> الـسـعـر الـمـبـدئـي: **${startPrice}**\n` +
                `> الـضـريـبـة: **${includesTax ? "نـعـم" : "لا"}**\n` +
                `> الـنـوع: **${type.name}** (${type.hours}س)\n` +
                `> @everyone: \`${type.every}\` • @here: \`${type.here}\`\n` +
                `> صـاحـب الـمـزاد: <@${userId}>`,
        )
        .setColor(await getColor(guildId, db, config))
        .setTimestamp();
    if (imageUrl) summary.setImage(imageUrl);

    const publishRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mzad2_publish_${userId}`)
            .setLabel("نشر المزاد")
            .setStyle(ButtonStyle.Success)
            .setEmoji(emojis.auction || "<a:emoji_83:1467168691937612077>"),
        new ButtonBuilder()
            .setCustomId(`mzad2_pub_cancel_${userId}`)
            .setLabel("إلغاء المزاد")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(
                emojis.cancelAuction || "<a:emoji_82:1467168694244212829>",
            ),
    );

    await db.set(`mzad2_draft_${userId}_${guildId}`, { draft, type });
    const auctionadmin = await db.get(`auctionad_${guildId}`);
    await channel.send({
        content: auctionadmin ? `<@&${auctionadmin}>` : null,
        embeds: [summary],
        components: [publishRow],
    });
}

async function startPaymentFlow(interaction, type, db, config) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const bank = await db.get(`bank_${guildId}`);
    if (!bank)
        return interaction.reply({
            content: "**❌ يـرجـى تـحـديـد الـبـنـك بـاسـتـخـدام `/setup`.**",
            flags: MessageFlags.Ephemeral,
        });

    const active = await db.get(`mzad2_credit_${userId}_${guildId}`);
    if (active)
        return interaction.reply({
            content: "**❌ لـديـك عـمـلـيـة شـراء قـيـد الـتـنـفـيـذ.**",
            flags: MessageFlags.Ephemeral,
        });

    const totalPriceC = Math.floor(type.price * (20 / 19) + 1);
    const totalPriceRe = Math.ceil(totalPriceC / 5);

    const currencyRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pay_currency_mzad_${userId}`)
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

    const currencyFilter = (i) => i.user.id === userId && i.customId === `pay_currency_mzad_${userId}`;
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
        await interaction.channel.send(`. \`يـرجـى الـتـحـويـل فـي أسـرع وقـت مـمـكـن هـنـا\` <@!${userId}>`);

        await db.set(`mzad2_credit_${userId}_${guildId}`, userId);

        const paymentResult = await verifyPayment({
            channel: interaction.channel, userId,
            requiredAmount: totalPrice, bankId: bank, timeout: 120000,
        });

        await db.delete(`mzad2_credit_${userId}_${guildId}`);

        if (!paymentResult.success) {
            await interaction.channel.send({
                content: `**انـتـهـى الـوقـت ولـم يـتـم الـتـحـويـل.** <@!${userId}>`,
            });
            return;
        }

        try { await db.add(`ernss_${guildId}.erns`, Number(totalPrice)); } catch {}
        try { await db.add(`ernsg.ernsg`, Number(totalPrice)); } catch {}

        try {
            const invoice = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> - فـاتـورة الـشـراء -")
                .setDescription(
                    `**تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**\n` +
                        `- نـوع الـمـزاد الـخـاص: **${type.name}** (${type.hours}س)\n` +
                        `- الـتـحـويـل لـ: <@!${bank}>\n` +
                        `- الـسـعـر الأصـلـي: \`${type.price}\` ${config.money || ""}\n` +
                        `- الـضـريـبـة: \`${totalPrice - type.price}\` ${config.money || ""}\n` +
                        `- **الـمـجـمـوع:** \`${totalPrice}\` ${config.money || ""}`,
                )
                .setFooter(D.thanksFooter(interaction.guild))
                .setThumbnail(D.thumb(interaction.guild))
                .setTimestamp();
            await interaction.user.send({ embeds: [invoice] });
        } catch {}

        await runMzad2QuestionFlow(
            interaction.channel, type, db, config, guildId, userId, type.price,
        );
    });

    currencyCollector.on("end", async (_collected, reason) => {
        if (reason !== "user") {
            await currencyMsg.delete().catch(() => {});
            await interaction.channel.send({
                content: `**⏰ انتهى الوقت ولم يتم اختيار طريقة الدفع.** <@!${userId}>`,
            });
        }
    });
}

module.exports = function registerMzad2(client, { db, config }) {
    //========= /add-mzad2-type =========
    client.on("interactionCreate", async (i) => {
        if (
            !i.isChatInputCommand() ||
            i.commandName !== "add-mzad2-type" ||
            !i.guild
        )
            return;
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({
                content: "❌ يجب أن تكون لديك صلاحية **Administrator**!",
                flags: MessageFlags.Ephemeral,
            });
        }
        const name = i.options.getString("name");
        const hours = i.options.getInteger("hours");
        const every = i.options.getInteger("every") ?? 0;
        const here = i.options.getInteger("here") ?? 0;
        const price = i.options.getInteger("price");
        const notice = i.options.getString("notice");

        const types = (await db.get(`mzad2_types_${i.guild.id}`)) || [];
        if (types.find((t) => t.name === name)) {
            return i.reply({
                content: `**❌ يـوجـد نـوع بـنـفـس الاسـم \`${name}\`.**`,
                flags: MessageFlags.Ephemeral,
            });
        }
        types.push({ name, hours, every, here, price, notice });
        await db.set(`mzad2_types_${i.guild.id}`, types);

        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تـمـت إضـافـة نـوع مـزاد خـاص")
            .setColor(await getColor(i.guild.id, db, config))
            .addFields(
                { name: "الاسـم", value: name, inline: true },
                { name: "الـسـاعـات", value: `${hours}`, inline: true },
                { name: "الـسـعـر", value: `${price}`, inline: true },
                { name: "@everyone", value: `${every}`, inline: true },
                { name: "@here", value: `${here}`, inline: true },
                { name: "الـتـنـويـه", value: notice.slice(0, 1000) },
            )
            .setTimestamp();
        await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    });

    //========= /remove-mzad2-type =========
    client.on("interactionCreate", async (i) => {
        if (
            i.isAutocomplete() &&
            i.commandName === "remove-mzad2-type" &&
            i.guild
        ) {
            const types = (await db.get(`mzad2_types_${i.guild.id}`)) || [];
            const focused = String(i.options.getFocused() || "").toLowerCase();
            const opts = types
                .filter((t) => t.name.toLowerCase().includes(focused))
                .slice(0, 25)
                .map((t) => ({ name: t.name, value: t.name }));
            return i.respond(opts);
        }
        if (
            !i.isChatInputCommand() ||
            i.commandName !== "remove-mzad2-type" ||
            !i.guild
        )
            return;
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({
                content: "❌ يجب أن تكون لديك صلاحية **Administrator**!",
                flags: MessageFlags.Ephemeral,
            });
        }
        const name = i.options.getString("name");
        const types = (await db.get(`mzad2_types_${i.guild.id}`)) || [];
        const idx = types.findIndex((t) => t.name === name);
        if (idx === -1)
            return i.reply({
                content: `**❌ لا يـوجـد نـوع بـاسـم \`${name}\`.**`,
                flags: MessageFlags.Ephemeral,
            });
        types.splice(idx, 1);
        await db.set(`mzad2_types_${i.guild.id}`, types);
        await i.reply({
            content: `**✅ تـم حـذف الـنـوع \`${name}\` بـنـجـاح.**`,
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= /set-mzad2-cat =========
    client.on("interactionCreate", async (i) => {
        if (
            !i.isChatInputCommand() ||
            i.commandName !== "set-mzad2-cat" ||
            !i.guild
        )
            return;
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({
                content: "❌ يجب أن تكون لديك صلاحية **Administrator**!",
                flags: MessageFlags.Ephemeral,
            });
        }
        const ticketCat = i.options.getChannel("ticket-category");
        const pubCat = i.options.getChannel("room-category");
        if (ticketCat)
            await db.set(`mzad2_ticket_cat_${i.guild.id}`, ticketCat.id);
        if (pubCat) await db.set(`mzad2_pub_cat_${i.guild.id}`, pubCat.id);
        await i.reply({
            content:
                `**✅ تـم الـحـفـظ.**\n` +
                (ticketCat ? `كـتـاغـوري الـتـكـتـات: ${ticketCat}\n` : "") +
                (pubCat ? `كـتـاغـوري رومـات الـمـزاد: ${pubCat}` : ""),
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= /add-mzad2-room =========
    client.on("interactionCreate", async (i) => {
        if (
            !i.isChatInputCommand() ||
            i.commandName !== "add-mzad2-room" ||
            !i.guild
        )
            return;
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({
                content: "❌ يجب أن تكون لديك صلاحية **Administrator**!",
                flags: MessageFlags.Ephemeral,
            });
        }
        const room = i.options.getChannel("channel");
        if (!room || room.type !== ChannelType.GuildText) {
            return i.reply({
                content: "**❌ الرجاء اختيار قناة نصية صالحة.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        const key = `mzad2_rooms_${i.guild.id}`;
        const list = (await db.get(key)) || [];
        const arr = Array.isArray(list) ? [...list] : [];
        if (!arr.includes(room.id)) arr.push(room.id);
        await db.set(key, arr);
        await i.reply({
            content:
                `**✅ تـم إضـافـة الـروم:** ${room}\n` +
                `**عـدد الـرومـات الحـالـي:** ${arr.length}`,
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= /remove-mzad2-room =========
    client.on("interactionCreate", async (i) => {
        if (
            !i.isChatInputCommand() ||
            i.commandName !== "remove-mzad2-room" ||
            !i.guild
        )
            return;
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({
                content: "❌ يجب أن تكون لديك صلاحية **Administrator**!",
                flags: MessageFlags.Ephemeral,
            });
        }
        const room = i.options.getChannel("channel");
        const key = `mzad2_rooms_${i.guild.id}`;
        const list = (await db.get(key)) || [];
        const arr = Array.isArray(list) ? [...list] : [];
        const before = arr.length;
        const filtered = arr.filter((id) => id !== room.id);
        await db.set(key, filtered);
        await i.reply({
            content: `**${
                filtered.length < before ? "✅" : "❌"
            } تـم الـتـعـديـل.**

**عـدد الـرومـات الحـالـي:** ${filtered.length}`,
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= /list-mzad2-rooms =========
    client.on("interactionCreate", async (i) => {
        if (
            !i.isChatInputCommand() ||
            i.commandName !== "list-mzad2-rooms" ||
            !i.guild
        )
            return;
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({
                content: "❌ يجب أن تكون لديك صلاحية **Administrator**!",
                flags: MessageFlags.Ephemeral,
            });
        }
        const key = `mzad2_rooms_${i.guild.id}`;
        const list = (await db.get(key)) || [];
        const arr = Array.isArray(list) ? [...list] : [];
        if (arr.length === 0) {
            return i.reply({
                content:
                    "**ℹ️ لا تـوجـد رومـات مـحـددة.**\nاستخدم `/add-mzad2-room` لإضافة رومات المزاد.",
                flags: MessageFlags.Ephemeral,
            });
        }
        const names = arr.map((id) => {
            const c = i.guild.channels.cache.get(id);
            return c ? `${c}` : `<#${id}> (محذوف)`;
        });
        await i.reply({
            content: `**رومـات الـمـزاد الـخـاص:**\n${names.join("\n")}`,
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= /mzad2-panel =========
    client.on("interactionCreate", async (i) => {
        if (
            !i.isChatInputCommand() ||
            i.commandName !== "mzad2-panel" ||
            !i.guild
        )
            return;

        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({
                content: "❌ يجب أن تكون لديك صلاحية **Administrator**!",
                flags: MessageFlags.Ephemeral,
            });
        }

        const guildId = i.guild.id;
        const text = i.options.getString("embed-text");
        const embedColor = await getColor(guildId, db, config);
        const auctionImage = await db.get(`buyauctionimage_${guildId}`);

        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  شـراء مـزاد خـاص")
            .setDescription(
                text ||
                    `**أهـلاً بـك فـي قـسـم شـراء الـمـزادات الـخـاصـة بـسـيـرفـر ${i.guild.name}**\n\n` +
                        `- اضـغـط الـزر أدنـاه لـفـتـح تـكـت شـراء.\n` +
                        `- اخـتـر نـوع الـمـزاد ثـم الـتـحويـل للـبـنـك.\n` +
                        `- يـتـم إنـشـاء روم خـاص لـمـزادك تـلـقـائـيـاً.`,
            )
            .setAuthor({
                name: i.guild.name,
                iconURL: i.guild.iconURL({ size: 1024 }),
            })
            .setFooter({ text: i.guild.name })
            .setTimestamp()
            .setColor(embedColor);

        // إضافة الـ if اللي طلبتها للصورة
        if (auctionImage) {
            embed.setImage(auctionImage);
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket-mzad2")
                .setLabel("شـراء تـكـت مـزاد خـاص")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(
                    emojis.ticketAuction || "<a:005:1458810220728946863>",
                ),
            new ButtonBuilder()
                .setCustomId(`mzad2_prices`) // زر عرض الأسعار الخاص بالمزاد اللي برمجته أنت
                .setLabel("أسـعـار الـمـزاد الـخـاص")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojis.auction),
        );

        await i.reply({
            content: "✅ **Done! Panel has been sent.**",
            flags: MessageFlags.Ephemeral,
        });
        await i.channel.send({ embeds: [embed], components: [row] });
    });

    //========= mzad2_prices button: show prices =========
    client.on("interactionCreate", async (interaction) => {
        if (
            !interaction.isButton() ||
            (!interaction.customId.startsWith("mzad2_prices") ) ||
            !interaction.guild
        )
            return;

        const guildId = interaction.guild.id;
        const types = (await db.get(`mzad2_types_${guildId}`)) || [];
        const color = _ec.color(guildId);

        if (types.length === 0) {
            return interaction.reply({
                content: "❌ **لا توجد أنواع مزاد خاص محددة بعد.**",
                flags: MessageFlags.Ephemeral,
            });
        }

        const priceFields = types.map((t, idx) => ({
            name: `${idx + 1}. ${t.name || "نوع " + (idx + 1)}`,
            value: t.price ? `\`${t.price}\`` : "غير محدد",
            inline: true,
        }));

        const priceImage = await db.get(`priceImage_${guildId}`);
        const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> أسـعـار الـمـزاد الـخـاص")
            .setColor(color)
            .addFields(priceFields)
            .setTimestamp();

        if (priceImage) embed.setImage(priceImage);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    });

    //========= ticket-mzad2 button: open ticket =========
    client.on("interactionCreate", async (interaction) => {
        if (
            !interaction.isButton() ||
            interaction.customId !== "ticket-mzad2" ||
            !interaction.guild
        )
            return;

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const ticketCat = await db.get(`mzad2_ticket_cat_${guildId}`);
        if (!ticketCat)
            return interaction.reply({
                content:
                    "**❌ يـرجـى تـحـديـد كـتـاغـوري الـتـكـتـات بـاسـتـخـدام `/set-mzad2-cat`.**",
                flags: MessageFlags.Ephemeral,
            });
        const adminRole = await db.get(`auctionad_${guildId}`);
        if (!adminRole)
            return interaction.reply({
                content:
                    "**❌ يـرجـى تـحـديـد رتـبـة مـسـؤول الـمـزاد بـاسـتـخـدام `/setup`.**",
                flags: MessageFlags.Ephemeral,
            });
        const types = (await db.get(`mzad2_types_${guildId}`)) || [];
        if (types.length === 0)
            return interaction.reply({
                content:
                    "**❌ لا تـوجـد أنـواع مـضـافـة. اسـتـخـدم `/add-mzad2-type`.**",
                flags: MessageFlags.Ephemeral,
            });

        const existing = await db.get(`mzad2_ticket_${userId}_${guildId}`);
        if (existing) {
            const ch = interaction.guild.channels.cache.get(existing.channelId);
            if (ch)
                return interaction.reply({
                    content: `**❌ لـديـك تـكـت مـفـتـوح بـالـفـعـل: <#${ch.id}>**`,
                    flags: MessageFlags.Ephemeral,
                });
            await db.delete(`mzad2_ticket_${userId}_${guildId}`);
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const safeName =
            interaction.user.username
                .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")
                .slice(0, 24) || "user";
        let ticketChannel;
        try {
            ticketChannel = await interaction.guild.channels.create({
                name: `mzad2-${safeName}`,
                type: ChannelType.GuildText,
                parent: ticketCat,
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
                        id: adminRole,
                        allow: [
                            "SendMessages",
                            "EmbedLinks",
                            "AttachFiles",
                            "ViewChannel",
                            "MentionEveryone",
                            "ReadMessageHistory",
                        ],
                    },
                ],
            });
        } catch (e) {
            console.error("mzad2 ticket create error:", e);
            return interaction.editReply(
                "**❌ فـشـل إنـشـاء الـتـكـت. تـأكـد مـن صـلاحـيـات الـبـوت.**",
            );
        }

        await db.set(`mzad2_ticket_${userId}_${guildId}`, {
            userId,
            channelId: ticketChannel.id,
        });
        await db.set(`mzad2_ticket_channel_${ticketChannel.id}`, {
            ownerId: userId,
            guildId,
        });

        const bank = await db.get(`bank_${guildId}`);
        const typeLines = types
            .map(
                (t) =>
                    `**${t.name}** — \`${t.hours}س\` — السـعـر: \`${t.price}\``,
            )
            .join("\n");
        const select = new StringSelectMenuBuilder()

            .setCustomId(`mzad2_pick_type_${userId}`)
            .setPlaceholder("اخـتـر نـوع الـمـزاد")
            .addOptions(
                types.slice(0, 25).map((t) => ({
                    label: t.name.slice(0, 100),
                    description: `${t.hours}س • السعر ${t.price}`.slice(0, 100),
                    value: t.name,
                })),
            );
        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("closemzad2")
                .setLabel("إغلاق التكت")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.close || "🔒"),
        );

        // ... تكملة تعريف الـ select و closeBtn

        await ticketChannel.send({
            content: `<@${userId}> <@&${adminRole}>`,
            embeds: [
                new EmbedBuilder()
                    .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  تـكـت الـمـزاد الـخـاص")
                    .setDescription(
                        `**أهـلاً بـك فـي تـكـت الـمـزاد الـخـاص فـي ${interaction.guild.name}**\n\n` +
                            `### الأنـواع الـمـتـاحـة:\n${typeLines}\n\n` +
                            `الـتـحـويـل لـ: <@!${bank || "غير محدد"}>`,
                    )
                    .setColor(await getColor(guildId, db, config)) // إضافة اللون
                    .setImage(await db.get(`buyauctionimage_${guildId}`)) // إضافة الصورة من القاعدة مباشرة
                    .setTimestamp(),
            ],
            components: [
                new ActionRowBuilder().addComponents(select),
                closeBtn,
            ],
        });

        await interaction.reply(
            `**__ تـم إنـشـاء تـكـتـك بـنـجـاح: <#${ticketChannel.id}> __**`,
        );
    });

    //========= mzad2_pick_type select menu =========
    client.on("interactionCreate", async (interaction) => {
        if (
            !interaction.isStringSelectMenu() ||
            !interaction.customId.startsWith("mzad2_pick_type_")
        )
            return;
        if (!interaction.guild) return;
        const ownerId = interaction.customId.replace("mzad2_pick_type_", "");
        if (interaction.user.id !== ownerId) {
            return interaction.reply({
                content:
                    "**❌ يـمـكـن لـصـاحـب الـتـكـت فـقـط اسـتـعـمـال هـذا الـزر.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        const typeName = interaction.values[0];
        const types =
            (await db.get(`mzad2_types_${interaction.guild.id}`)) || [];
        const type = types.find((t) => t.name === typeName);
        if (!type)
            return interaction.reply({
                content: "**❌ النـوع غـيـر مـوجـود.**",
                flags: MessageFlags.Ephemeral,
            });
        await startPaymentFlow(interaction, type, db, config);
    });

    //========= mzad2_publish button =========
    client.on("interactionCreate", async (interaction) => {
        if (
            !interaction.isButton() ||
            !interaction.customId.startsWith("mzad2_publish_")
        )
            return;
        if (!interaction.guild) return;
        if (!(await requireAuctionAdmin(interaction, db))) return;

        const ownerId = interaction.customId.replace("mzad2_publish_", "");
        const guildId = interaction.guild.id;
        const stored = await db.get(`mzad2_draft_${ownerId}_${guildId}`);
        if (!stored)
            return interaction.reply({
                content:
                    "**❌ انـتـهـت صـلاحـيـة الـبـيـانـات. أعـد الـعـمـلـيـة.**",
                flags: MessageFlags.Ephemeral,
            });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const room = await startMzad2InRoom(
            interaction.guild,
            stored.type,
            stored.draft,
            db,
            config,
        );
        if (!room) return interaction.editReply("**❌ فـشـل إنـشـاء الـروم.**");

        await db.delete(`mzad2_draft_${ownerId}_${guildId}`);
        await db.delete(`mzad2_ticket_${ownerId}_${guildId}`);
        await db.delete(`mzad2_ticket_channel_${interaction.channel.id}`);
        await interaction.reply(`**✅ تـم نـشـر الـمـزاد فـي ${room}**`);
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch {}
        }, 4000);
    });

    //========= mzad2_pub_cancel button =========
    client.on("interactionCreate", async (interaction) => {
        if (
            !interaction.isButton() ||
            !interaction.customId.startsWith("mzad2_pub_cancel_")
        )
            return;
        if (!interaction.guild) return;
        const ownerId = interaction.customId.replace("mzad2_pub_cancel_", "");
        const guildId = interaction.guild.id;
        const adminRole = await db.get(`auctionad_${guildId}`);
        if (
            interaction.user.id !== ownerId &&
            (!adminRole || !interaction.member.roles.cache.has(adminRole))
        ) {
            return interaction.reply({
                content: "**🚫 لـيـس لـديـك صـلاحـيـة الإلـغـاء.**",
                flags: MessageFlags.Ephemeral,
            });
        }
        await db.delete(`mzad2_draft_${ownerId}_${guildId}`);
        await interaction.reply({
            content: "** تـم إلـغـاء الـمـزاد.**",
            flags: MessageFlags.Ephemeral,
        });
    });

    //========= closemzad2 / reopenmzad2 / deletemzad2 =========
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton() || !interaction.guild) return;
        const channel = interaction.channel;
        const guildId = interaction.guild.id;

        if (interaction.customId === "closemzad2") {
            const meta = await db.get(`mzad2_ticket_channel_${channel.id}`);
            const ownerId = meta?.ownerId || interaction.user.id;
            await db.delete(`mzad2_credit_${ownerId}_${guildId}`);
            await db.delete(`mzad2_ticket_${ownerId}_${guildId}`);

            const closingEmbed = new EmbedBuilder()
                .setDescription("**جارٍ إغلاق التكت...**")
                .setColor(await getColor(guildId, db, config));
            await interaction.reply({ embeds: [closingEmbed] });

            setTimeout(async () => {
                try {
                    await channel.permissionOverwrites.edit(guildId, {
                        ViewChannel: false,
                    });
                    await channel.permissionOverwrites.edit(ownerId, {
                        ViewChannel: false,
                    });
                    const adminRole = await db.get(`auctionad_${guildId}`);
                    if (adminRole)
                        await channel.permissionOverwrites.edit(adminRole, {
                            ViewChannel: true,
                        });
                } catch {}

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("reopenmzad2")
                        .setLabel("فتح التكت")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(emojis.reopen || "🔓"),
                    new ButtonBuilder()
                        .setCustomId("deletemzad2")
                        .setLabel("حذف التكت")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(emojis.delete || "🗑️"),
                );
                const closedEmbed = new EmbedBuilder()
                    .setDescription(
                        "**✅ تـم إغـلاق الـتـكـت. اخـتـر إجـراءً أدنـاه.**",
                    )
                    .setColor(await getColor(guildId, db, config));
                try {
                    await interaction.reply({
                        embeds: [closedEmbed],
                        components: [row],
                    });
                } catch {}
            }, 2000);
        }

        if (interaction.customId === "reopenmzad2") {
            const meta = await db.get(`mzad2_ticket_channel_${channel.id}`);
            const ownerId = meta?.ownerId;
            if (!ownerId)
                return interaction.reply({
                    content: "**❌ بـيـانـات الـتـكـت غـيـر مـوجـودة.**",
                    flags: MessageFlags.Ephemeral,
                });
            try {
                await channel.permissionOverwrites.edit(ownerId, {
                    ViewChannel: true,
                    SendMessages: true,
                });
                await db.set(`mzad2_ticket_${ownerId}_${guildId}`, {
                    userId: ownerId,
                    channelId: channel.id,
                });
                await interaction.reply({
                    content: "**✅ تـم إعـادة فـتـح الـتـكـت.**",
                });
            } catch {
                await interaction.reply({
                    content: "**❌ فـشـل إعـادة الـفـتـح.**",
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        if (interaction.customId === "deletemzad2") {
            const meta = await db.get(`mzad2_ticket_channel_${channel.id}`);
            await db.delete(`mzad2_ticket_channel_${channel.id}`);
            if (meta?.ownerId)
                await db.delete(`mzad2_ticket_${meta.ownerId}_${guildId}`);
            await interaction.reply({
                content: "**🗑️ سـيـتـم حـذف الـتـكـت خـلال 3 ثـوانٍ...**",
            });
            setTimeout(() => channel.delete().catch(() => {}), 3000);
        }
    });

    //========= refresh button =========
    client.on("interactionCreate", async (interaction) => {
        if (
            !interaction.isButton() ||
            !interaction.customId.startsWith("mzad2_refresh_")
        )
            return;
        if (!interaction.guild) return;
        if (!(await requireAuctionAdmin(interaction, db))) return;

        const roomId = interaction.customId.replace("mzad2_refresh_", "");
        const td = mzad2Timers.get(roomId);
        if (!td)
            return interaction.reply({
                content: "**❌ لا يـوجـد مـزاد نـشـط فـي هـذا الـروم.**",
                flags: MessageFlags.Ephemeral,
            });

        let mention = "";
        if (td.everyLeft > 0) {
            mention = "@everyone";
            td.everyLeft--;
        } else if (td.hereLeft > 0) {
            mention = "@here";
            td.hereLeft--;
        } else
            return interaction.reply({
                content:
                    "**❌ تـم اسـتـخـدام كـل الـمـنـشـنـات الـمـسـمـوحـة لـهـذا الـنـوع.**",
                flags: MessageFlags.Ephemeral,
            });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await td.roomChannel.send({
                content: `${mention}\n** تـنـويـه الـمـزاد**\n${td.type.notice || ""}`,
            });
        } catch {
            return interaction.editReply("**❌ فـشـل إرسـال الـتـنـويـه.**");
        }

        try {
            await td.controlMsg.edit({
                content: `**— لـوحـة تـحـكـم الـمـزاد الـخـاص —**\n@everyone مـتـبـقـي: \`${td.everyLeft}\` • @here مـتـبـقـي: \`${td.hereLeft}\``,
                components: [buildControlRow(roomId)],
            });
        } catch {}

        try {
            const snap = await db.get(`active_mzad2_${roomId}`);
            if (snap)
                await db.set(`active_mzad2_${roomId}`, {
                    ...snap,
                    everyLeft: td.everyLeft,
                    hereLeft: td.hereLeft,
                });
        } catch {}

        await interaction.reply(
            `**✅ تـم إرسـال الـتـنـويـه (${mention}).**`,
        );
    });

    //========= cancel button (active auction) =========
    client.on("interactionCreate", async (interaction) => {
        if (
            !interaction.isButton() ||
            !interaction.customId.startsWith("mzad2_cancel_")
        )
            return;
        if (!interaction.guild) return;
        if (!(await requireAuctionAdmin(interaction, db))) return;

        const roomId = interaction.customId.replace("mzad2_cancel_", "");
        const td = mzad2Timers.get(roomId);
        if (!td)
            return interaction.reply({
                content: "**❌ لا يـوجـد مـزاد نـشـط.**",
                flags: MessageFlags.Ephemeral,
            });

        await interaction.reply({
            content:
                "**✅ تـم إلـغـاء الـمـزاد. سـيـتـم حـذف الـروم خـلال 10 ثـوانٍ.**",
            flags: MessageFlags.Ephemeral,
        });

        clearInterval(td.interval);
        mzad2Timers.delete(roomId);
        await db.delete(`active_mzad2_${roomId}`);
        try {
            await td.controlMsg.delete();
        } catch {}
        try {
            await td.roomChannel.send(
                `**# تـم إلـغـاء الـمـزاد بـواسـطـة <@${interaction.user.id}>**`,
            );
        } catch {}
        setTimeout(async () => {
            try {
                await td.roomChannel.delete("ألغي المزاد الخاص");
            } catch {}
        }, 10000);
    });

    //========= restore on restart =========
    async function restoreMzad2Timers() {
        try {
            await new Promise((r) => setTimeout(r, 3000));
            const all = await db.all();
            const keys = all.filter(
                (e) => e.id && e.id.startsWith("active_mzad2_"),
            );
            for (const entry of keys) {
                const roomId = entry.id.replace("active_mzad2_", "");
                const data = entry.value;
                if (!data || !data.draft || !data.guildId) continue;
                const guild = client.guilds.cache.get(data.guildId);
                if (!guild) continue;
                const roomChannel = guild.channels.cache.get(roomId);
                if (!roomChannel) {
                    await db.delete(entry.id);
                    continue;
                }

                let rem;
                if (data.startedAt && data.type && data.type.hours) {
                    const totalSec = data.type.hours * 3600;
                    const elapsedSec = Math.floor(
                        (Date.now() - data.startedAt) / 1000,
                    );
                    rem = totalSec - elapsedSec;
                } else {
                    rem =
                        typeof data.remainingTime === "number"
                            ? data.remainingTime
                            : 60;
                }
                if (rem <= 0) {
                    await db.delete(entry.id);
                    try {
                        await roomChannel.send(
                            `**# انـتـهـى وقـت الـمـزاد**\nصـاحـب الـمـزاد: <@${data.draft.owner}>`,
                        );
                    } catch {}
                    setTimeout(async () => {
                        try {
                            await roomChannel.delete(
                                "انتهى المزاد قبل الاستعادة",
                            );
                        } catch {}
                    }, 5000);
                    continue;
                }

                let auctionMsg, controlMsg;
                try {
                    auctionMsg = await roomChannel.messages.fetch(
                        data.auctionMsgId,
                    );
                } catch {}
                try {
                    controlMsg = await roomChannel.messages.fetch(
                        data.controlMsgId,
                    );
                } catch {}

                if (!auctionMsg)
                    auctionMsg = await roomChannel.send({
                        content: buildMzad2Msg(data.draft, rem),
                    });
                if (!controlMsg)
                    controlMsg = await roomChannel.send({
                        content: `**— لـوحـة تـحـكـم الـمـزاد الـخـاص —**\n@everyone مـتـبـقـي: \`${data.everyLeft}\` • @here مـتـبـقـي: \`${data.hereLeft}\``,
                        components: [buildControlRow(roomId)],
                    });

                const td = {
                    remainingTime: rem,
                    guild,
                    roomChannel,
                    draft: data.draft,
                    guildId: data.guildId,
                    auctionMsg,
                    controlMsg,
                    everyLeft: data.everyLeft || 0,
                    hereLeft: data.hereLeft || 0,
                    type: data.type,
                    oneMinNoticeSent: rem <= 60,
                    fiveMinNoticeSent: rem <= 300,
                    interval: null,
                };
                mzad2Timers.set(roomId, td);
                startMzad2Interval(td, roomId, db);
                console.log(
                    `[Mzad2] Restored timer for room ${roomId} (${rem}s remaining)`,
                );
            }
        } catch (e) {
            console.error("restoreMzad2Timers error:", e);
        }
    }

    if (client.isReady()) restoreMzad2Timers();
    else client.once("ready", () => restoreMzad2Timers());

    //========= cleanup on manual channel delete =========
    client.on("channelDelete", async (channel) => {
        try {
            const td = mzad2Timers.get(channel.id);
            if (td) {
                clearInterval(td.interval);
                mzad2Timers.delete(channel.id);
            }
            const key = `active_mzad2_${channel.id}`;
            const exists = await db.get(key);
            if (exists) await db.delete(key);

            const tmeta = await db.get(`mzad2_ticket_channel_${channel.id}`);
            if (tmeta) {
                await db.delete(`mzad2_ticket_channel_${channel.id}`);
                if (tmeta.ownerId)
                    await db.delete(
                        `mzad2_ticket_${tmeta.ownerId}_${channel.guild?.id || ""}`,
                    );
            }
        } catch (e) {
            console.error("mzad2 channelDelete cleanup error:", e);
        }
    });
};
