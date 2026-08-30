const express = require("express");
const app = express();
const port = 30303;

app.get("/", (req, res) => {
  res.send("Hello World!");
});
const fs = require("fs");
const path = require("path");
const emojis = require("./handlers/modules/emojis");
const ED = require("./handlers/modules/embedDescriptions");

const { Events } = require("discord.js");

const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ActivityType,
  Partials,
  WebhookClient,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} = require("discord.js");
const { ModalBuilder } = require("discord.js");
const { TextInputBuilder } = require("discord.js");
const { MessageEmbed } = require("discord.js");
const { ComponentType } = require("discord.js");
const { TextInputStyle } = require("discord.js");
const { MessageButton } = require("discord.js");
const { MessageActionRow } = require("discord.js");
const { getAudioUrl } = require("google-tts-api");
const googleTTS = require("google-tts-api");
const sharp = require("sharp");
const { MessageSelectMenu } = require("discord.js");
const { SelectMenuBuilder } = require("discord.js");
const chalk = require("chalk");
const ms = require("ms");
let CronJob = require("cron").CronJob;
//
const { QuickDB, SqliteDriver } = require("quick.db");
const sqliteDriver = new SqliteDriver("./database.sqlite");
const db = QuickDB.createSingleton({ driver: sqliteDriver });

require("dotenv").config();
const config = require("./config.json");
const crypto = require("crypto");

const PLAN_DURATIONS = {
  "1m": { ms: 30 * 24 * 60 * 60 * 1000, label: "شهر واحد" },
  "3m": { ms: 90 * 24 * 60 * 60 * 1000, label: "3 شهور" },
  "1y": { ms: 365 * 24 * 60 * 60 * 1000, label: "سنة كاملة" },
};
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const tokenHash = (t) =>
  crypto
    .createHash("sha256")
    .update(t || "")
    .digest("hex")
    .slice(0, 24);
const tokenKey = (t) => `bot_sub_${tokenHash(t)}`;

async function createSubscription(token, ownerId, plan) {
  const dur = PLAN_DURATIONS[plan];
  if (!dur) throw new Error("خطة غير صالحة");
  const now = Date.now();
  const expiresAt = now + dur.ms;
  const data = {
    token,
    ownerId,
    plan,
    startedAt: now,
    expiresAt,
    graceEndsAt: expiresAt + GRACE_PERIOD_MS,
    status: "active",
    notifiedExpired: false,
    notifiedDeleted: false,
    botId: null,
    guildId: null,
  };
  await db.set(tokenKey(token), data);
  return data;
}

async function renewSubscription(token, plan) {
  const dur = PLAN_DURATIONS[plan];
  if (!dur) throw new Error("خطة غير صالحة");
  const sub = await db.get(tokenKey(token));
  if (!sub) throw new Error("لا يوجد اشتراك لهذا البوت");
  const now = Date.now();
  const base =
    sub.status === "active" && sub.expiresAt > now ? sub.expiresAt : now;
  sub.expiresAt = base + dur.ms;
  sub.graceEndsAt = sub.expiresAt + GRACE_PERIOD_MS;
  sub.plan = plan;
  sub.status = "active";
  sub.notifiedExpired = false;
  sub.notifiedDeleted = false;
  await db.set(tokenKey(token), sub);
  return sub;
}

async function getAllSubscriptions() {
  const all = await db.all();
  return all.filter((e) => e.id.startsWith("bot_sub_")).map((e) => e.value);
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `<t:${Math.floor(ts / 1000)}:f>`;
}

const makerToken = config.makerToken || process.env.BOT_TOKEN_MAKER || "";
const generalToken = process.env.BOT_TOKEN || process.env.BOT_TOKEN_GENERAL || config.generalToken || "";

if (makerToken && !config.tokens.includes(makerToken)) {
  config.tokens.push(makerToken);
}
if (generalToken && !config.tokens.includes(generalToken)) {
  config.tokens.push(generalToken);
}

const botTokens = config.tokens.filter((t) => t && t.trim() !== "");

const bots = botTokens.map((token, index) => {
  const client = new Client({
    //intents: 3276799,
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.GuildIntegrations,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMessageTyping,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.DirectMessageTyping,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.GuildMember,
      Partials.Reaction,
      Partials.GuildScheduledEvent,
      Partials.User,
      Partials.ThreadMember,
    ],
  });
  client.setMaxListeners(0);
  const types = require("./types.js");
  const typesPath = path.join(__dirname, "types.js");

  client.types = types;

  function choices() {
    const ch = [];
    for (const t of types) {
      ch.push({
        name: t.nametype,
        value: t.categoryId,
      });
    }
    return ch;
  }

  const chsd = choices();
  client.commands1 = new Collection();

  const botOwner = "959174041422397471";
  const allowedUserId = `${botOwner}`;
  const owner = `${botOwner}`;
  const TARGET_ROLE_ID = "1384831324015296614";
  const TARGET_CHANNEL_ID = "1492886293800288527";
  const logJoinChannel = "1492886293800288527";
  const allowedBotId = "1386364859784101969";
  const prefix = "+";
  const TARGET_GUILD_ID = "1500197339329986690";
  const reportsChannelId = "1492886293800288527"; // ضع هنا معرف قناة البلاغات
  const reportsGuildId = " 1500197339329986690 "; // ضع هنا معرف السيرفر المحدد

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const guildId = message.guild.id;
    const keywords = await db.all();
    const guildKeywords = keywords.filter((entry) =>
      entry.id.startsWith(`autoreply_${guildId}_`),
    );

    guildKeywords.forEach((entry) => {
      const keyword = entry.id.split(`autoreply_${guildId}_`)[1];
      const data = entry.value;

      if (message.content === keyword) {
        const { reply, role, channel, embed, title, image, color } = data;

        // تحقق من الرتبة (إذا كانت موجودة)
        if (role && !message.member.roles.cache.has(role)) return;

        // تحقق من الروم (إذا كانت موجودة)
        if (channel && message.channel.id !== channel) return;

        // إرسال الرد
        if (embed) {
          const embedMessage = {
            title: title || null,
            description: reply,
            color: color ? parseInt(color.replace("#", ""), 16) : null,
            image: image ? { url: image } : null,
          };
          message.channel.send({ embeds: [embedMessage] });
        } else if (image) {
          // إذا لم يتم تحديد إيمبد ولكن تم تحديد صورة
          message.channel.send({ content: reply, files: [image] });
        } else {
          message.channel.send(reply);
        }
      }
    });
  });

  // استجابة زر عرض تفاصيل الرد
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, index] = interaction.customId.split("_");
    if (action !== "view-autoreply") return;

    const guildId = interaction.guild.id;
    const keywords = await db.all();
    const guildKeywords = keywords.filter((entry) =>
      entry.id.startsWith(`autoreply_${guildId}_`),
    );
    const selectedEntry = guildKeywords[parseInt(index)];
    if (!selectedEntry)
      return interaction.reply("الرد غير موجود.", { ephemeral: true });

    const keyword = selectedEntry.id.split(`autoreply_${guildId}_`)[1];
    const { reply, role, channel, embed, title, image, color } =
      selectedEntry.value;

    const detailsEmbed = new EmbedBuilder()
      .setTitle(`تفاصيل الرد التلقائي - ${keyword}`)
      .addFields(
        { name: "الرد", value: reply },
        {
          name: "رتبة محددة",
          value: role ? `<@&${role}>` : "لا يوجد",
          inline: true,
        },
        {
          name: "روم محدد",
          value: channel ? `<#${channel}>` : "لا يوجد",
          inline: true,
        },
        { name: "نوع الرد", value: embed ? "إيمبد" : "نص عادي", inline: true },
      );

    if (embed && title) detailsEmbed.setTitle(title);
    if (embed && image) detailsEmbed.setImage(image);
    if (embed && color) detailsEmbed.setColor(color);

    interaction.reply({ embeds: [detailsEmbed], ephemeral: true });
  });

  /*
client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    function formatNumber(number) {
        return number >= 1000 ? `${(number / 1000).toFixed(1)}k` : number.toString();
    }

    async function updatePresence() {
        // جلب عدد السيرفرات والأعضاء
        const totalServers = client.guilds.cache.size;
        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

        // جلب عدد المتاجر من قاعدة البيانات
        const allEntries = await db.all(); // جلب جميع البيانات
        const totalShops = allEntries.filter(entry => entry.id.startsWith('shop_')).length;

        // إنشاء رسائل الحالة
        const presenceMessages = [
            { name: `+help`, type: 0 },
            { name: `${formatNumber(totalServers)} servers | ${formatNumber(totalMembers)} members`, type: 0 },
            { name: `${formatNumber(totalShops)} shops`, type: 0 }
        ];

        // اختيار رسالة عشوائية
        const randomPresence = presenceMessages[Math.floor(Math.random() * presenceMessages.length)];

        // تحديث حالة البوت
        client.user.setPresence({
            activities: [randomPresence],
            status: 'idle'
        });
    }

    // تحديث الحالة في البداية
    updatePresence();

    // تحديث الحالة كل 15 ثانية
    setInterval(updatePresence, 15000);
});
    */
  client.on("clientReady", async () => {
    console.log(
      chalk.bold.underline.blue(
        `✅ Bot ${index + 1} logged in as ${client.user.tag}`,
      ),
    );

    const isMakerBotEarly = token === makerToken;
    const isGeneralBotEarly = token === generalToken;
    if (!isMakerBotEarly && !isGeneralBotEarly) {
      const sub = await db.get(tokenKey(token));
      if (sub) {
        const now = Date.now();
        if (!sub.botId || !sub.guildId) {
          sub.botId = client.user.id;
          sub.guildId = client.guilds.cache.first()?.id || sub.guildId;
          await db.set(tokenKey(token), sub);
        }
        if (sub.status === "deleted" || now >= sub.graceEndsAt) {
          console.warn(
            chalk.red(
              `⛔ ${client.user.tag}: انتهت فترة السماح — جاري إيقاف البوت`,
            ),
          );
          try {
            await client.destroy();
          } catch {}
          return;
        }
        if (sub.status === "expired" || now >= sub.expiresAt) {
          console.warn(
            chalk.yellow(
              `⏸️ ${client.user.tag}: الاشتراك منتهي — البوت متوقف (فترة سماح)`,
            ),
          );
          if (sub.status !== "expired") {
            sub.status = "expired";
            await db.set(tokenKey(token), sub);
          }
          try {
            await client.destroy();
          } catch {}
          return;
        }
      }
    }

    const restrictedCommands = [
      {
        name: "add-token",
        description: "لإضافة توكن بوت",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "token",
            description: "التوكن الذي تريد إضافته",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "type",
            description: "نوع التوكن",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
              { name: "🛒 بوت الميكر (الرئيسي)", value: "maker" },
              { name: "🤖 البوت العام (العمليات)", value: "general" },
              { name: "➕ بوت إضافي", value: "extra" },
            ],
          },
          {
            name: "owner",
            description: "راعي البوت (للتنبيهات والتجديد)",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
          {
            name: "plan",
            description: "مدة الاشتراك",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
              { name: "📅 شهر واحد", value: "1m" },
              { name: "📅 3 شهور", value: "3m" },
              { name: "📅 سنة كاملة", value: "1y" },
            ],
          },
        ],
      },
      {
        name: "renew",
        description: "تجديد اشتراك بوت",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "plan",
            description: "مدة التجديد",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "📅 شهر واحد", value: "1m" },
              { name: "📅 3 شهور", value: "3m" },
              { name: "📅 سنة كاملة", value: "1y" },
            ],
          },
        ],
      },
      {
        name: "subs",
        description: "عرض اشتراكات جميع البوتات",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "remove-token",
        description: "لحذف توكن",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "token",
            description: "التوكن الذي تريد حذفه",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "panel",
        description: "لـ ارسال البانل",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "status",
        description: "لـ ارسال البانل الحــالة",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "set-activity",
        dm_permission: false,
        default_member_permissions: 8,
        description: "تغيير حالة البوت",
        options: [
          {
            name: "activity",
            description: "النص الذي تريد عرضه",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "type",
            description:
              "نوع الحالة (0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching)",
            type: ApplicationCommandOptionType.Number,
            required: false,
          },
          {
            name: "presence",
            description: "حالة الاتصال (online, idle, dnd, invisible)",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
              { name: "🟢 Online", value: "online" },
              { name: "🟡 Idle", value: "idle" },
              { name: "🔴 Do Not Disturb", value: "dnd" },
            ],
          },
        ],
      },

      {
        name: "set-username",
        dm_permission: false,
        default_member_permissions: 8,
        description: "تغيير اسم البوت",
        options: [
          {
            name: "username",
            description: "الاسم الجديد للبوت",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },

      {
        name: "bot-avatar",
        description: "تغيير صورة البوت والبنر",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "imge",
            description: "صورة البوت الجديدة",
            type: ApplicationCommandOptionType.Attachment,
            required: true,
          },
          {
            name: "banner",
            description: "بنر البوت الجديد (اختياري)",
            type: ApplicationCommandOptionType.Attachment,
            required: false, // ليس إلزاميًا
          },
        ],
      },
    ];

    //    const rest = new REST({ version: 10 }).setToken(token);
    async function updateTypesAndCommands(typesData) {
      client.types = typesData;
      const updatedChoices = client.types.map((t) => ({
        name: t.name,
        value: t.id,
      }));

      // يجب تحديث chsd إذا كانت تستخدم في الأوامر
      chsd = updatedChoices;
    }

    const globalCommands = [
      {
        name: "exchange-setup",
        description: "إعدادات نظام التبادل (للأدمنستريتور فقط)",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "report",
        description: "لـــ ارســال بلاغ لـ صاحب البــوت",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "details",
            description: `تفــاصيل البلاغ`,
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "fake-tweet",
        description: "لـ انشاء تغريــدة مزيــفة",
        dm_permission: true,
        default_member_permissions: 1,
        options: [
          {
            name: "tweet",
            description: "التغريدة",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "user",
            description: "الشخص",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },
      {
        name: "fake-comment",
        description: "لـ انشاء تعــليق يوتيوب مزيــف",
        dm_permission: true,
        default_member_permissions: 1,
        options: [
          {
            name: "comment",
            description: "التعليق",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "user",
            description: "الشخص",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },

      {
        name: "tax",
        description: "لـمـعـرفـه الـضـريـبـه لـعـدد مـا",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "number",
            description: "الـعـدد",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "add-tax-channel",
        description: " اضـافـة روم لـ رومـات الضـرائـب ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `channel`,
            description: ` الـروم `,
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "server-info",
        description: "عرض معلومات السيرفر",
        dm_permission: false,
        default_member_permissions: 1,
      },

      {
        name: "reset-mentions",
        description: "ترسيت جميع المنشنات",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "setup-images",
        description: "تعديل انفوهات وصور السيرفر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          // --- شراء الخدمات ---
          {
            name: "buy-shop-image",
            description: "صورة شراء متجر (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "buy-shop-image-attachment",
            description: "صورة شراء متجر (مرفق)",
            type: 11,
            required: false,
          },
          {
            name: "buy-order-image",
            description: "صورة شراء طلب (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "buy-order-image-attachment",
            description: "صورة شراء طلب (مرفق)",
            type: 11,
            required: false,
          },
          {
            name: "buy-auction-image",
            description: "صورة شراء مزاد (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "buy-auction-image-attachment",
            description: "صورة شراء مزاد (مرفق)",
            type: 11,
            required: false,
          },
          {
            name: "buy-roles-image",
            description: "صورة شراء رتبة (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "buy-roles-image-attachment",
            description: "صورة شراء رتبة (مرفق)",
            type: 11,
            required: false,
          },

          // --- قوانين السيرفر فقط ---
          {
            name: "rules-server",
            description: "قوانين السيرفر العامة (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "rules-server-attachment",
            description: "قوانين السيرفر العامة (مرفق)",
            type: 11,
            required: false,
          },

          // --- الأسعار ---
          {
            name: "price-roles",
            description: "أسعار الرتب (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "price-roles-attachment",
            description: "أسعار الرتب (مرفق)",
            type: 11,
            required: false,
          },
          {
            name: "price-shop",
            description: "أسعار المتاجر (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "price-shop-attachment",
            description: "أسعار المتاجر (مرفق)",
            type: 11,
            required: false,
          },
          {
            name: "price-orders",
            description: "أسعار الطلبات (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "price-orders-attachment",
            description: "أسعار الطلبات (مرفق)",
            type: 11,
            required: false,
          },
          {
            name: "price-auction",
            description: "أسعار المزاد (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "price-auction-attachment",
            description: "أسعار المزاد (مرفق)",
            type: 11,
            required: false,
          },

          // --- الخط العام ---
          {
            name: "line",
            description: "صورة خط السيرفر (رابط)",
            type: 3,
            required: false,
          },
          {
            name: "line-attachment",
            description: "صورة خط السيرفر (مرفق)",
            type: 11,
            required: false,
          },
        ],
      },
      {
        name: "setup",
        description: "اعداد البوت بسيرفرك",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "line",
            description: "خط السيرفر",
            type: ApplicationCommandOptionType.Attachment,
            required: false,
          },
          {
            name: "logs",
            description: "روم لوق المتاجر",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "scam-logs",
            description: "روم لوق التشهير والبلاغات",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "order-room",
            description: "روم الطلبات",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "action-room",
            description: "روم المزادات",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "buy-shop-tickets",
            description: "كتاغوري شراء متجر",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildCategory],
          },
          {
            name: "buy-auction-tickets",
            description: "كتاغوري شراء مزاد",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildCategory],
          },
          {
            name: "buy-order-tickets",
            description: "كتاغوري شراء طلبات",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildCategory],
          },
          {
            name: "high-staff",
            description: "رتبة العليا",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "shop-admin",
            description: "مسؤول المتاجر",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "order-admin",
            description: "مسؤول طلبات",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "auction-admin",
            description: "مسؤول المزاد",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "auction-mzad-role",
            description: "رول منشن المزاد (يُذكر في النوع الثالث)",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "order-mention-role",
            description: "رول منشن الطلبات (يُذكر في زر منشن طلبات)",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "embed-color",
            description: "لون الامبدات بالهيكس مثال: 0x00AE86 او #00AE86",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "bank",
            description: "المستخدم الذي ستحدده كبنك السيرفر",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
          {
            name: "buy-roles-tickets",
            description: "كتاغوري تكتات شراء رتب",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildCategory],
          },
          {
            name: "roles-admin",
            description: "مسؤول شراء الرتب",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "support-category",
            description: "كتاغوري تكتات الدعم الفني والتشهير",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildCategory],
          },
          {
            name: "support-admin",
            description: "رتبة مسؤول الدعم الفني",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "scam-admin",
            description:
              "رتبة مسؤول التشهير (تُستخدم لو تركتها فارغة تأخذ مسؤول الدعم)",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "scam-room",
            description: "روم نشر تقارير التشهير تلقائياً بعد إقرار الإدارة",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "commands-room",
            description: "روم الأوامر — يُرسل فيه طلب دفع بيع المتجر",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "rating-channel",
            description:
              "روم استلام تقييمات الخدمة من التكتات (دعم، مزاد، طلبات، رتب)",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "setup-prices",
        description: "تعديل الأسعار في السيرفر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "everyone-price",
            description: "سعر منشن ايفري للمتاجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "here-price",
            description: "سعر منشن هير للمتاجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "shop-mention-price",
            description: "سعر منشن متجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "order-every-price-credit",
            description: "سعر منشن ايفري با الكردت للطلبات",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "order-here-price-credit",
            description: "سعر منشن هير با الكردت",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "order-order-price-credit",
            description: "سعر منشن الطلبات (رول) بالكردت",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "auction-every-price-credit",
            description: "سعر منشن ايفري للمزاد باالكردت",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "auction-here-price-credit",
            description: "سعر منشن هير با الكردت للمزادات",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "auction-mzad-price-credit",
            description: "سعر منشن مزاد (رول) باالكردت",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "change-partners-credit",
            description: "سعر اضافة شريك او حذف",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "change-name",
            description: "سعر تغيير اسم المتجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "change-owner",
            description: "سعر تغيير صاحب المتجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "remove-warn-credit",
            description: "سعر ازالة تحذير",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "auto-message",
            description: "سعر نشر تلقائي للمتاجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "change-shape",
            description: "سعر تغيير شكل المتجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "change-type-price",
            description: "سعر تغيير نوع المتجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "shop-vacation",
            description: "سعر طلب إجازة للمتجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "disable-auto-price",
            description: "سعر تعطيل الإرسال التلقائي لجميع المتاجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "activate-shop-price",
            description: "سعر تفعيل المتجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "sell-shop-price",
            description: "سعر بيع المتجر",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "shop-category-price",
            description: "تعديل سعر نوع المتجر (اكتب: categoryId السعر)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "اختصارت",
        description: "اعداد الاختصارات",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "اختصار-المنشنات",
            description:
              "اختصار المنشنات وش تبي العضو يكتب عشان يظهر له المنشنات",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-تحذير",
            description:
              "اختصار التحذيرات وش تبي المسؤول يكتب عشان يحذر المتجر",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-حذف",
            description: "وش تبي المسؤول يكتب عشان يحذف المتجر",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-ضريبه",
            description: "وش تبي العضو يكتب عشان يظهر الضريبه",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-نداء",
            description: "وش تبي المسؤول يكتب عشان ينادي العضو",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-امر-بنق",
            description: "وش تبي العضو يكتب عشان يظهر بنق البوت",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-تحديد-صاحب-المتجر",
            description: "اختصار الأمر لتحديد صاحب المتجر",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-تحديد-المنشنات",
            description: "اختصار الأمر لتحديد المنشنات الخاصة بالمتجر",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-اضافة-منشنات",
            description: "اختصار الأمر لإضافة منشنات جديدة",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-اضافة-متجر",
            description: "اختصار امر يضيف المتجر لبينات البوت",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "اختصار-انشاء-متجر",
            description: "اختصار امر يسوي المتجر",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: `price-panel`,
        description: `ارسال بانل الاسعار`,
        dm_permissions: false,
        default_member_permissions: 1,
        options: [
          {
            name: "embed-text",
            description: "الكلام الي بيكون محطوط با ايمبد الاسعار",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: `buy-panel`,
        description: `ارسال قسم الشراء`,
        dm_permissions: false,
        default_member_permissions: 1,
        options: [
          {
            name: "embed-text",
            description: "الكلام الي بيكون محطوط با ايمبد التكتات",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: `order-panel`,
        description: `ارسال قسم شراء طلبات`,
        dm_permissions: false,
        default_member_permissions: 1,
        options: [
          {
            name: "embed-text",
            description: "الكلام الي بيكون محطوط با ايمبد التكتات",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: `shop-panel`,
        description: `ارسال قسم شراء متاجر`,
        dm_permissions: false,
        default_member_permissions: 1,
        options: [
          {
            name: "embed-text",
            description: "الكلام الي بيكون محطوط با ايمبد التكتات",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: `auction-panel`,
        description: `ارسال قسم شراء مزاد`,
        dm_permissions: false,
        default_member_permissions: 1,
        options: [
          {
            name: "embed-text",
            description: "الكلام الي بيكون محطوط با ايمبد التكتات",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "r-mzad",
        description: "تعيين قوانين المزاد التي تُرسل تلقائياً عند النشر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "rules",
            description: "نص قوانين المزاد",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "add-mzad-room",
        description: "إضافة روم مزاد للقائمة",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "room",
            description: "روم المزاد",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "remove-mzad-room",
        description: "حذف روم مزاد من القائمة",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "room",
            description: "روم المزاد",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "start-mzad",
        description: "إطلاق مزاد مباشرة بدون تكت (للمسؤولين فقط)",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "room",
            description: "روم المزاد",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "item",
            description: "اسم السلعة",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "start-price",
            description: "السعر المبدئي",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "duration",
            description: "مدة المزاد بالدقائق",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
            max_value: 360,
          },
          {
            name: "mention-type",
            description: "نوع المنشن",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "@everyone", value: "everyone" },
              { name: "@here", value: "here" },
              { name: "رول المزاد", value: "mzad" },
            ],
          },
          {
            name: "tax",
            description: "هل السلعة بضريبة؟",
            type: ApplicationCommandOptionType.Boolean,
            required: true,
          },
          {
            name: "owner",
            description: "صاحب المزاد (افتراضي: أنت)",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
          {
            name: "image-url",
            description: "رابط صورة السلعة (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "mzad-stats",
        description: "إحصائيات المزادات في هذا السيرفر",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "mzad-list",
        description: "عرض قائمة المزادات النشطة في السيرفر",
        dm_permission: false,
      },
      {
        name: "add-mzad2-type",
        description:
          "إضافة نوع مزاد خاص (الاسم، الساعات، السعر، إيفري، هير، تنويه)",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "name",
            description: "اسم النوع",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "hours",
            description: "مدة المزاد بالساعات",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
            max_value: 168,
          },
          {
            name: "price",
            description: "سعر تكت هذا النوع",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
          },
          {
            name: "every",
            description: "عدد منشن @everyone المسموح",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 0,
            max_value: 50,
          },
          {
            name: "here",
            description: "عدد منشن @here المسموح",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 0,
            max_value: 50,
          },
          {
            name: "notice",
            description: "نص التنويه الذي يرسل عند الإنعاش",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "set-mzad2-cat",
        description: "تحديد كتاغوري التكتات وكتاغوري رومات المزاد الخاص",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "ticket-category",
            description: "كتاغوري تكتات المزاد الخاص",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildCategory],
          },
          {
            name: "room-category",
            description: "كتاغوري إنشاء رومات المزاد الخاص",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildCategory],
          },
        ],
      },
      {
        name: "mzad2-panel",
        description: "إرسال بانل شراء تكت مزاد خاص",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "embed-text",
            description: "نص الايمبد (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "remove-mzad2-type",
        description: "حذف نوع مزاد ثاني",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "name",
            description: "اسم النوع",
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: "remove-tax-channel",
        description: " ازـالـة روم لـ رومـات الضـرائـب ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `channel`,
            description: ` الـروم `,
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "show-tax-channels",
        description: " لـ اظهار رومات الضرائب المسجلة ",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "add-emoji-channel",
        description: " اضـافـة روم لـ رومـات ايموجي ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `channel`,
            description: ` الـروم `,
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "remove-emoji-channel",
        description: " ازـالـة روم لـ رومـات ايموجي ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `channel`,
            description: ` الـروم `,
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "show-emoji-channels",
        description: "اظهار رومات الايموجي",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "add-sticker-channel",
        description: " اضـافـة روم لـ رومـات ستيكر ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `channel`,
            description: ` الـروم `,
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "remove-sticker-channel",
        description: " حذف روم ستيكر ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `channel`,
            description: ` الـروم `,
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "show-sticker-channels",
        description: " اظهار رومات الاستيكر ",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "add-autoreply",
        description: "اضافة رد تلقائي",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "keyword",
            description: "الكلمة",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "reply",
            description: "الرد",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "role",
            description: "حدد الرتبة المسموح بها للرد (اختياري)",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "channel",
            description: "حدد الروم المسموح بها للرد (اختياري)",
            type: ApplicationCommandOptionType.Channel,
            required: false,
          },
          {
            name: "embed",
            description: "هل تريد الرد كإيمبد؟",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
          {
            name: "title",
            description: "عنوان الإيمبد (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "image",
            description: "رابط الصورة للإيمبد (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "color",
            description: "لون الايمبد",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
              { name: "اخضر فاتح", value: "#90EE90" },
              { name: "اخضر غامق", value: "#006400" },
              { name: "احمر فاتح", value: "#FF6347" },
              { name: "احمر غامق", value: "#8B0000" },
              { name: "ازرق", value: "#0056D7" },
              { name: "ازرق فاتح", value: "#ADD8E6" },
              { name: "ازرق سماوي", value: "#00BFFF" },
              { name: "اصفر", value: "#FFFF00" },
              { name: "اصفر ذهبي", value: "#FFD700" },
              { name: "برتقالي فاتح", value: "#FFA07A" },
              { name: "برتقاني غامق", value: "#FF8C00" },
              { name: "وردي", value: "#FFC0CB" },
              { name: "وردي داكن", value: "#FF1493" },
              { name: "بنفسجي", value: "#800080" },
              { name: "بنفسجي فاتح", value: "#DDA0DD" },
              { name: "بني", value: "#A52A2A" },
              { name: "رمادي فاتح", value: "#D3D3D3" },
              { name: "رمادي غامق", value: "#696969" },
              { name: "فيروزي", value: "#40E0D0" },
              { name: "نيلي", value: "#4B0082" },
              { name: "ابيض", value: "#FFFFFF" },
              { name: "اسود", value: "#000000" },
              { name: "ذهبي", value: "#FFD700" },
              { name: "ليموني", value: "#32CD32" },
              { name: "مرجاني", value: "#FF7F50" },
            ],
          },
        ],
      },
      {
        name: "remove-autoreply",
        description: "حذف رد تلقائي",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "keyword",
            description: "الكلمه المراد حذفها",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "list-autoreplies",
        description: "اظهار الردود التلقائيه",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "say-emabed",
        description: "ارسال رساله با ايمبد",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `msg`,
            description: "الرساله",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: `room`,
            description: `روم الرساله.`,
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: `image`,
            description: `صورة الأميبد`,
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: `title`,
            description: "العنوان",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "come",
        description: " اسـتـدعـاء عـضـو ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `user`,
            description: `الشخص المرجو استدعائه `,
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: `reason`,
            description: ` سبب استدعاء الشخص `,
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "مزاد",
        description: "بدء مزاد",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "الشخص",
            description: "الشخص صاحب المزاد",
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: "السلعة",
            description: "شرح السلعة",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "السعر",
            description: "سعر السلعة",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "وقت",
            description: "وقت انتهاء المزاد",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            choices: [
              { name: "5 دقائق", value: 5 },
              { name: "6 دقائق", value: 6 },
              { name: "7 دقائق", value: 7 },
              { name: "8 دقائق", value: 8 },
              { name: "9 دقائق", value: 9 },
              { name: "10 دقا.���ق", value: 10 },
              { name: "11 دقائق", value: 11 },
              { name: "12 دقائق", value: 12 },
            ],
          },
          {
            name: "المنشن",
            description: "نوع منشن المزاد",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            choices: [
              { name: "Everyone", value: 0 },
              { name: "Here", value: 1 },
            ],
          },
          {
            name: "channel",
            description: "الروم التي تريد ارسال فيها المزاد",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "صوره",
            description: "صورة للسلعة او للمزاد",
            type: ApplicationCommandOptionType.Attachment,
            required: false,
          },
          {
            name: "صوره2",
            description: "صورة ثانيه",
            type: ApplicationCommandOptionType.Attachment,
            required: false,
          },
          {
            name: "صوره3",
            description: "صورة ثالثه",
            type: ApplicationCommandOptionType.Attachment,
            required: false,
          },
          {
            name: "صوره4",
            description: "صورة رابعة",
            type: ApplicationCommandOptionType.Attachment,
            required: false,
          },
          {
            name: "صوره5",
            description: "صورة خامسة",
            type: ApplicationCommandOptionType.Attachment,
            required: false,
          },
        ],
      },
      {
        name: "say-all-shops",
        description: "ارســال رســـالة لـ كل المــتاجــر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `message`,
            description: ` الكلمه `,
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
   
    {
        name: "shop",
        description: "لانشاء متجر في كاتيجوري محدد من الانواع المسجلة.",
        dm_permission: false,
        default_member_permissions: "8",
        options: [
            {
                name: "category",
                description: "اختر نوع المتجر (الكاتيجوري) المسجل مسبقا.",
                type: 3, // String لكي يعمل الـ Autocomplete
                required: true,
                autocomplete: true
            },
            {
                name: "name",
                description: "اسم المتجر الجديد.",
                type: 3,
                max_length: 35,
                required: true
            },
            {
                name: "seller",
                description: "التاجر المسؤول عن هذا المتجر.",
                type: 6,
                required: true
            }
        ]
    },
    {
        name: "add-shop-data",
        description: "اضافة متجر موجود مسبقا الى الداتا بيز مع امكانية نقله وتعديل اسمه.",
        dm_permission: false,
        default_member_permissions: "8",
        options: [
            {
                name: "shop",
                description: "اختر روم المتجر المراد اضافته وتنظيمه.",
                type: 7, // Channel
                required: true
            },
            {
                name: "category",
                description: "اختر نوع المتجر (الكاتاجوري المسجل مسبقا).",
                type: 3, // String لكي يعمل الـ Autocomplete
                required: true,
                autocomplete: true
            },
            {
                name: "seller",
                description: "صاحب المتجر (التاجر المسؤول).",
                type: 6,
                required: true
            }
        ]
    }

,   {
        name: "remove-shop-data",
        description: "حذف المتجر من الداتا",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "shop",
            description: "الـمـتـجـر",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
            //choices: choices()
          },
        ],
      },
      {
        name: "shop-data",
        description: "اظهار معلومات المتجر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "shop",
            description: "الـمـتـجـر",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
            //choices: choices()
          },
        ],
      },
      {
        name: "order",
        description: "لـ طلب بروم انت تحدده",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `الشخص`,
            description: "صاحب الطلب",
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: `الطلب`,
            description: "السلعة المطلوبة",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: `المنشن`,
            description: "نوع منشن الطلب",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            choices: [
              { name: "Everyone", value: 0 },
              { name: "Here", value: 1 },
            ],
          },
        ],
      },
      {
        name: "check-types",
        description: "فحص جميع الأنواع وحذف الأنواع ذات الكاتيجوري المحذوف",
        dm_permission: false,
        default_member_permissions: 1,
        options: [],
      },
      {
        name: "edit-type",
        description: "تعديل نوع متجر موجود بدون إعادة كتابته من الصفر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "category",
            description: "الكاتيجوري الخاص بالنوع الذي تريد تعديله",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildCategory],
            required: true,
          },
          {
            name: "name",
            description: "الاسم الجديد (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "everyone_mention_count",
            description: "عدد منشنات everyone (اختياري)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "here_mention_count",
            description: "عدد منشنات here (اختياري)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "shop_mention_count",
            description: "عدد منشنات رتبة المتجر (اختياري)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "shop_mention",
            description: "رتبة منشن المتجر الجديدة (اختياري)",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "shop_role",
            description: "رتبة صاحب المتجر (اختياري)",
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: "pirefix",
            description: "الزخ �فه.� الجديدة (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "maxwarns",
            description: "أقصى عدد تحذيرات (اختياري)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "shop_price",
            description: "السعر الجديد (اختياري)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "has_tax",
            description: "هل يوجد ضريبة؟ (اختياري)",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
          {
            name: "tax_price",
            description: "سعر الضريبة (اختياري)",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "shop-emoji",
            description: "الإيموجي الافتراضي للنوع مثال: 🛒 (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "remove-type",
        description: "حذف نوع كتاغوري متاجر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "category",
            description: "الكاتيجوري الذي تريد حذفه من الداتا",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildCategory],
            required: true,
          },
        ],
      },
      {
        name: "remove-all-types",
        description: "حذف جميع انواع المتاجر",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "reset",
        description: "حذف جميع البينات المتعلقه با السيرفر",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "say-voice",
        description: "ارسال كلام صوتي باستخدام البوت",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "message",
            description: "الكلام",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "language",
            description: "اللغة",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "العربية | العربية", value: "ar" },
              { name: "الإنجليزية | English", value: "en" },
              { name: "الإسبانية | Español", value: "es" },
              { name: "الفرنسية | Français", value: "fr" },
              { name: "الألمانية | Deutsch", value: "de" },
              { name: "الإيطالية | Italiano", value: "it" },
              { name: "الروسية | Русский", value: "ru" },
              { name: "الصينية | 中文", value: "zh" },
              { name: "اليابانية | 日本語", value: "ja" },
              { name: "الكورية | 한국어", value: "ko" },
              { name: "الهندية | हिन्दी", value: "hi" },
              { name: "البرتغالية | Português", value: "pt" },
              { name: "التركية | Türkçe", value: "tr" },
              { name: "الهولندية | Nederlands", value: "nl" },
              { name: "البولندية | Polski", value: "pl" },
            ],
          },
        ],
      },
      {
        name: "add-type",
        description: "تحديد نوع كتاغوري متاجر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "name",
            description: "اسم هاذا النوع",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "category",
            description: "الكاتيجوري الذي تريد تحديد منشناته",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildCategory],
            required: true,
          },
          {
            name: "everyone_mention_count",
            description: "عدد منشنات ايفري ون المسموح بها.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "here_mention_count",
            description: "عدد منشنات هير المسموح بها.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "shop_mention_count",
            description: "عدد منشنات رتبة المسموح بها.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "shop_mention",
            description: "رتبت منشن متجر.",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
          {
            name: "shop_role",
            description: "رتبت صاحب المتجر من هاذا النوع.",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
          {
            name: "pirefix",
            description:
              "زخرفة المتجر — اكتب هنا مكان الإيموجي مثال: ネ〢「هنا」︲",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "maxwarns",
            description: "اقصى عدد تحذيرات لهاذا النوع.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "shop_price",
            description: "سعر المتجر من هاذا النوع.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "has_tax",
            description: "هل يحتوي النوع على ضريبة؟",
            type: ApplicationCommandOptionType.Boolean,
            required: true,
          },
          {
            name: "tax_price",
            description: "سعر الضريبة لهذا النوع (في حالة وجودها).",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "shop-emoji",
            description: "الإيموجي الافتراضي لهذا النوع مثال: 🛒",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "add-type2",
        description: "يحدد نوع كتاغوري و يضيف كل المتاجر الي فيه للداتا",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "name",
            description: "اسم هاذا النوع",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "category",
            description: "الكاتيجوري الذي تريد تحديد منشناته",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildCategory],
            required: true,
          },
          {
            name: "everyone_mention_count",
            description: "عدد منشنات ايفري ون المسموح بها.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "here_mention_count",
            description: "عدد منشنات هير المسموح بها.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "shop_mention_count",
            description: "عدد منشنات رتبة المسموح بها.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "shop_mention",
            description: "رتبت منشن متجر.",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
          {
            name: "shop_role",
            description: "رتبت صاحب المتجر من هاذا النوع.",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
          {
            name: "shop-pirefix",
            description: "زخرفة المتجر من هاذا النوع",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "maxwarns",
            description: "اقصى عدد تحذيرات لهاذا النوع.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "shop_price",
            description: "سعر المتجر من هاذا النوع.",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "has_tax",
            description: "هل يحتوي النوع على ضريبة؟",
            type: ApplicationCommandOptionType.Boolean,
            required: true,
          },
          {
            name: "tax_price",
            description: "سعر الضريبة لهذا النوع (في حالة وجودها).",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
        ],
      },
      {
        name: "active",
        description: "لـتـفـعـيـل مـتـجـر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "shop",
            description: "الـمـتـجـر",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
            //choices: choices()
          },
        ],
      },
      {
        name: "active-all",
        description: "لـتـفـعـيـل المتاجر",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "disable",
        description: "لـتـعـطـيـل مـتـجـر مـعـيـن",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "shop",
            description: "االـروم",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "reason",
            description: "الـسـبـب",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "disable-all",
        description: "تعطيل جميع المتاجر",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "tax-time",
        description: "تفعيل وضع الضريبه للمتاجر",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "afk",
        description: "لتفعيل وضع الخمول",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "reason",
            description: "الـسـبـب",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "ping",
        description: " لرؤية سرعة استجابت البوت ",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "send-tashfeer",
        description: " رسـالـة التـشـفـيـر ",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "types",
        description: "لــ اظــهار معلومأت انواع المتاجر",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "set-mention",
        description: "تحديد عدد منشنات متجر محدد",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `shop`,
            description: `حدد المتجر الذي تريد التعديل عليه.`,
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: `mention`,
            description: `نوع المنشن.`,
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: `@everyone`, value: `everyone` },
              { name: `@here`, value: `here` },
              { name: `@shop_role`, value: `shop_role` },
            ],
          },
          {
            name: `count`,
            description: `عدد المنشنات الذي سيتم تحديده.`,
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
        ],
      },
      {
        name: "add-mention",
        description: "اضافة عدد منشنات لـ متجر محدد",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `shop`,
            description: `حدد المتجر الذي تريد التعديل عليه.`,
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: `mention`,
            description: `نوع المنشن.`,
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: `@everyone`, value: `everyone` },
              { name: `@here`, value: `here` },
              { name: `@shop_role`, value: `shop_role` },
            ],
          },
          {
            name: `count`,
            description: `عدد المنشنات الذي سيتم تحديده.`,
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
        ],
      },
      {
        name: "add-helper",
        description: " اضـافـة مساعد للمـتـجـر ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `helper`,
            description: `المـساعد.`,
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: `shop`,
            description: ` المـتـجـر.`,
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "remove-helper",
        description: " ازالة مساعد مـن مـتـجـر مـعـيـن ",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `helper`,
            description: `المساعد.`,
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: `shop`,
            description: ` المـتـجـر.`,
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "show-helpers",
        description: "رؤية مساعدين المتجر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: `shop`,
            description: ` المـتـجـر.`,
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "owner",
        description: "change owner of a shop",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "new-owner",
            description: "صـاحـب المـتـجـر الجـديـد",
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: "shop",
            description: "المـتـجـر",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },

      {
        name: "delete-shop",
        description: "delete a shop",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "shop",
            description: "the shop you want to delete",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "reason",
            description: "the reason",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "warns",
        description: "عـرض تـحـذيـرات مـتـجـر مـعـيـن",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "warn",
        description: "warn a shop",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "thewarn",
            description: "سبب التحذير",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "shop",
            description: "المـتـجـر",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "amount",
            description: "عـدد التـحـذيـرات",
            type: ApplicationCommandOptionType.Number,
            required: false,
          },
          {
            name: "pic",
            description: "صوره",
            type: ApplicationCommandOptionType.Attachment,
            required: false,
          },
        ],
      },
      {
        name: "unwarn",
        description: "حذف تحذير من متجر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "shop",
            description: "المـتـجـر المراد حذف تحذيراته",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "amount",
            description: "عـدد التـحـذيـرات",
            type: ApplicationCommandOptionType.Number,
            required: false,
          },
        ],
      },
      {
        name: "unwarn-all",
        description: "حذف كل التحذيرات من المتاجر او متجر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "shop",
            description: "المـتـجـر المراد حذف تحذيراته",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "mentions",
        description: "اظهار عدد منشنات المتجر",
        dm_permission: false,
        default_member_permissions: 1,
      },

      // أمر إضافة قانون
      {
        name: "add-rule",
        description: "إضـافـة قـانـون جـديـد مـع صـورة (الـحـد الأقـصـى 5)",
        options: [
          { name: "label", description: "اسـم الـزر", type: 3, required: true },
          {
            name: "content",
            description: "الـنـص الـذي يـظـهـر عـنـد الـضـغـط",
            type: 3,
            required: true,
          },
          {
            name: "emoji",
            description: "إيـمـوجـي الـزر (اخـتـيـاري)",
            type: 3,
            required: false,
          },
          {
            name: "image_url",
            description: "رابـط صـورة لـلإمـبـيـد (اخـتـيـاري)",
            type: 3,
            required: false,
          },
          {
            name: "image_file",
            description: "رفـع مـلـف صـورة (اخـتـيـاري)",
            type: 11,
            required: false,
          },
        ],
      },
      // أمر إرسال قانون كإمبيد
      {
        name: "send-rule",
        description: "إر سـال قـانـون مـحـفـوظ كـإمـبـيـد لـروم مـعـيـنـة",
        options: [
          {
            name: "rule_name",
            description: "اخـتـر اسـم الـقـانـون",
            type: 3,
            required: true,
            autocomplete: true,
          },
          {
            name: "channel",
            description: "الـروم الـمـراد الإر سـال إلـيـهـا",
            type: 7,
            required: true,
          },
        ],
      },

      {
        name: "remove-rule",
        description: "حذف قانون من قائمة البانل",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "panel-rules",
        description: "إرسال بانل القوانين",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "embed-text",
            description: "نص مخصص للإمبد",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "panel-tickets",
        description: "إرسال بانل التكتات (شراء متجر، مزاد، طلبات، رتب)",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "embed-text",
            description: "نص مخصص للإمبد",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "all-for-panel",
        description:
          "إرسال بانل واحد يحتوي على الأسعار والقوانين والتكتات والرتب",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "text",
            description: "نص مخصص للإمبد (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "panel-support",
        description: "إرسال بانل الدعم الفني والتشهير",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "embed-text",
            description: "نص مخصص للإمبد",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "نقاطي",
        description: "اعرض نقاط التكتات الخاصة بك",
        dm_permission: false,
      },
      {
        name: "توب-نقاط",
        description: "أعلى المسؤولين نقاطاً في التكتات",
        dm_permission: false,
      },
      {
        name: "add-roles",
        description: "إضافة رتبة للبيع (الحد الأقصى 5)",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "role",
            description: "الرتبة",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
          {
            name: "price",
            description: "السعر بالكردت",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "benefits",
            description: "مميزات الرتبة",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "remove-roles",
        description: "حذف رتبة من قائمة البيع",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "list-roles",
        description: "عرض قائمة الرتب المتاحة للشراء مع مميزاتها وأسعارها",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "shop-check",
        description:
          "فحص المتاجر المسجلة وعرض الغير متفاعلة (لم ترسل أي رسالة)",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "delete-inactive",
        description: "حذف المتاجر الغير متفاعلة خلال مدة محددة",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "days",
            description: "المدة مثال: 1d أو 4d أو 7d",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "setup-auto-reset",
        description: "إعداد ريست المنشن التلقائي للمتاجر",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "days",
            description: "عدد الأيام بين كل ريست",
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: "room",
            description: "الروم الذي ترسل فيه رسالة الريست",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "message",
            description: "الرسالة التي ترسل في الروم عند الريست",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "edit-auto-reset",
        description: "تعديل إعدادات ريست المنشن التلقائي",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "days",
            description: "عدد الأيام بين كل ريست",
            type: ApplicationCommandOptionType.Integer,
            required: false,
          },
          {
            name: "room",
            description: "الروم الذي ترسل فيه رسالة الريست",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
          {
            name: "message",
            description: "الرسالة التي ترسل في الروم عند الريست",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "type",
            description: "نوع المتجر للفلترة (فارغ = الكل)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "add-word",
        description: "إضافة أو إزالة كلمة من قائمة الكلمات الممنوعة مع المنشن",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "word",
            description: "الكلمة المراد إضافتها أو إزالتها",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: "remove",
            description: "إزالة الكلمة بدلاً من إضافتها؟",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
          },
        ],
      },
      {
        name: "list-words",
        description: "عرض قائمة الكلمات الممنوعة (داخل المتجر فقط)",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "setup-words",
        description: "إعداد نظام الكلمات الممنوعة (الوضع والروم)",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "mode",
            description: "الوضع",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: "تلقائي — يحذر تلقائياً ويمسح الرسالة", value: "auto" },
              { name: "روم — يرسل للروم وينتظر الإداري", value: "room" },
            ],
          },
           {
            name: "room",
            description: "روم المخالفات (مطلوب في وضع room)",
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
    ];

    const rest = new REST({ version: 10 }).setToken(token);
    const isMakerBot = token === makerToken;
    const isGeneralBot = token === generalToken;

    const makerOnlyCommands = [
      {
        name: "all-bots",
        description: "عرض جميع البوتات وحالتها",
        dm_permission: false,
        default_member_permissions: 8,
      },
    ];

    const addTokenCmd = restrictedCommands.find((c) => c.name === "add-token");
    const removeTokenCmd = restrictedCommands.find(
      (c) => c.name === "remove-token",
    );
    const renewCmd = restrictedCommands.find((c) => c.name === "renew");
    const subsCmd = restrictedCommands.find((c) => c.name === "subs");
    const makerCommands = [
      addTokenCmd,
      removeTokenCmd,
      renewCmd,
      subsCmd,
      ...makerOnlyCommands,
    ].filter(Boolean);

    const generalBotCommands = [
      ...globalCommands,
      ...restrictedCommands.filter(
        (c) => !["add-token", "remove-token", "renew", "subs"].includes(c.name),
      ),
    ];

    try {
      console.log("📋 generalBotCommands.length =", generalBotCommands.length);
      if (isMakerBot) {
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: makerCommands,
        });
        console.log(
          `✅ Maker bot commands registered: add-token, remove-token, renew, subs, all-bots`,
        );
      } else if (isGeneralBot) {
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: generalBotCommands,
        });
        const names = generalBotCommands.map((c) => c.name).join(", ");
        console.log(
          `✅ General bot commands registered for ${client.user.tag} (${generalBotCommands.length} commands):\n   ${names}`,
        );
      } else {
        console.log(
          `⚠️ Bot ${client.user.tag} is not maker or general — skipping command registration.`,
        );
      }
    } catch (error) {
      console.error("❌ An error occurred while registering commands:", error);
    }

    const guildCommands = [
      {
        name: "add-mzad2-room",
        description: "إضافة قناة لقائمة رومات المزاد الخاص (يتوزع المزاد بينها دورياً)",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "channel",
            description: "القناة التي سيُنشأ فيها المزاد (تُضاف للقائمة)",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "remove-mzad2-room",
        description: "حذف قناة من قائمة رومات المزاد الخاص",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "channel",
            description: "القناة التي ستُحذف من القائمة",
            type: ApplicationCommandOptionType.Channel,
            required: true,
            channel_types: [ChannelType.GuildText],
          },
        ],
      },
      {
        name: "list-mzad2-rooms",
        description: "عرض قائمة رومات المزاد الخاص المحددة",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "add-extra-cat",
        description: "إضافة كتاغوري إضافي لنوع المتجر (يتوزع إنشاء المتاجر بينها دورياً)",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "category",
            description: "النوع / الكتاغوري الرئيسي الذي تريد إضافة كتاغوري إضافي له",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildCategory],
            required: true,
          },
          {
            name: "extra-category",
            description: "الكتاغوري الإضافي الجديد للنوع",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildCategory],
            required: true,
          },
        ],
      },
      {
        name: "remove-extra-cat",
        description: "إزالة كتاغوري إضافي من نوع المتجر",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "category",
            description: "النوع / الكتاغوري الرئيسي",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildCategory],
            required: true,
          },
          {
            name: "extra-category",
            description: "الكتاغوري الإضافي الذي تريد إزالته",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildCategory],
            required: true,
          },
        ],
      },
      {
        name: "set-auction-msg",
        description: "تعيين نص رسالة المزاد",
        dm_permission: false,
        default_member_permissions: 1,
        options: [
          {
            name: "template",
            description: "القالب - استخدم: {mention} {item} {price} {tax} {owner} {time}",
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: "add-select-role",
        description: "إضافة رتبة لقائمة الاختيار المجاني",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "role",
            description: "الرتبة",
            type: ApplicationCommandOptionType.Role,
            required: true,
          },
          {
            name: "emoji",
            description: "إيموجي الرتبة (اختياري)",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "remove-select-role",
        description: "حذف رتبة من قائمة الاختيار المجاني",
        dm_permission: false,
        default_member_permissions: 8,
      },
      {
        name: "list-select-roles",
        description: "عرض قائمة الرتب المتاحة للاختيار",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "send-role-panel",
        description: "إرسال لوحة اختيار الرتب المجانية",
        dm_permission: false,
        default_member_permissions: 8,
        options: [
          {
            name: "channel",
            description: "القناة",
            type: ApplicationCommandOptionType.Channel,
            required: true,
          },
          {
            name: "title",
            description: "عنوان اللوحة",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: "description",
            description: "وصف اللوحة",
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        name: "reset-auction-msg",
        description: "إعادة تعيين نص رسالة المزاد للقالب الافتراضي",
        dm_permission: false,
        default_member_permissions: 1,
      },
      {
        name: "refresh-embeds",
        description: "تحديث جميع الإيمبدات القديمة مع الإيموجي الجديد تلقائياً",
        dm_permission: false,
        default_member_permissions: 8,
      },
    ];

    const targetGuildIds = ["1485410755716321312", "1542290726535037049"];
    for (const guildId of targetGuildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
          body: guildCommands,
        });
        console.log(`✅ Guild commands registered for guild ${guildId}`);
      } catch (err) {
        console.error(`❌ Failed to register guild commands for ${guildId}:`, err.message);
      }
    }
  });

  const IGNORED_GUILDS = ["1322845612919619604", "1384831324015296614"];
  const replacements = {
    متجر: "مــ.ـتـجر",
    متجري: "مــ.ــتجري",
    متجرها: "مــ.ـتـجرها",
    متجره: "مــ.ـتـجره",
    متجرك: "مــ.ــتجرك",
    متجركم: "مــ.ــتجركم",
    متجرهم: "مــ.ـتجرهم",
    متجرنا: "مــ.ـنتجرنا",
    عرض: "عــ.ـرض",
    عرضي: "عـ �.ــرضي",
    عرضك: "عــ.ــرضك",
    عرضكم: "عــ.ــرضكم",
    عرضهم: "عــ.ــرضهم",
    عرضنا: "عــ.ــرض=� �",
    عروض: "عــ.ــروض",
    عروضي: "عــ.ــروضي",
    عروضك: "عــ.ــروضك",
    عروضكم: "عــ.ــروضكم",
    عروضهم: "عــ.ــروضهم",
    عروضنا: "عــ.ــروضنا",
    حساب: "حــ.ــساب",
    حسابي: "حــ.ــسابي",
    حسابك: "حــ.ــسابك",
    حسابكم: "حــ.ــسابكم",
    حسابهم: "حــ.ــسابهم",
    حسابنا: "حــ.ــسابنا",
    حسابات: "حــ.ــسابات",
    حساباتي: "حــ.ــساباتي",
    حساباتك: "حــ.ــساباتك",
    حساباتكم: "حــ.ــساباتكم",
    حساباتهم: "حــ.ــساباتهم",
    حساباتنا: ")�ـ �.ــساباتنا",
    متوفر: "مــ.ــتوفر",
    متوفري: "مــ.ــتوفري",
    متوفرها: "مــ.ــتوفرها",
    متوفره: "مــ.ــتوفره",
    متوفرك: "مــ.ــتوفرك",
    متوفركم: "مــ.ــتوفركم",
    متوفرهم: "مــ.ــتوفرهم",
    متوفرنا: "مــ.ــتوفرنا",
    شوب: "شــ.ــوب",
    شوبك: "شــ.ــوبك",
    شوبكم: "شــ.ــوبكم",
    شوبهم: "شــ.ــوبهم",
    شوبنا: "شــ.ــوبنا",
    اوفر: "أــ.ــوفر",
    اوفرها: "أــ.ــوفرها",
    اوفره: "أــ.ــوفره",
    اوفرك: "أــ.ــفرك",
    اوفركم: "أــ.ــفركم",
    اوفرهم: "أــ.ــوفرهم",
    اوفرنا: "أــ.ــوفرنا",
    بيع: "بــ.ــيع",
    بيعي: "بــ.ــيعي",
    بيعك: "بــ.ــيعك",
    بيعكم: "بــ.ــيعكم",
    بيعهم: "بــ.ــيعهم",
    بيعنا: "بــ.ــيعنا",
    للبيع: "للــ.ــبيع",
    للبيعي: "للــ.ــبيعي",
    للبيعك: "للــ.ــبيعك",
    للبيعكم: "للــ.ــبيعكم",
    للبيعهم: "للــ.ــبيعهم",
    للبيعنا: "للــ.ــبيعنا",
    ابيع: "أبــ.ــيع",
    ابيعك: "أبــ.ــيعك",
    ابيعكم: "أبــ.ــيعكم",
    ابيعهم: "أبــ.ــيعهم",
    ابيعنا: "أبــ.ــيعنا",
    بوست: "بــ.ــوست",
    بوستك: "بــ.ــوستك",
    بوستكم: "بــ.ــوستكم",
    بوستهم: "بــ.ــوستهم",
    بوستنا: "بــ.ــوستنا",
    نيترو: "نيــ.ــترو",
    نيتروك: "نيــ.ــتروك",
    نيتروكم: "نيــ.ــتروكم",
    نيتروهم: "نيــ.ــتروهم",
    نيترونا: "نيــ.ــترونا",
    روبكس: "روبكــ.ــس",
    روبكسك: "روبكســ.ــك",
    روبكسكم: "روبكســ.ــكم",
    روبكسهم: "روبكســ.ــهم",
    روبكسنا: "روبكســ.ــنا",
    سعر: "ســ.ــعر",
    سعري: "ســ.ــعري",
    سعرها: "ســ.ــعرها",
    سعره: "ســ.ــعره",
    سعرك: "ســ.ــعرك",
    سعركم: "ســ.ــعركم",
    سعرهم: "ســ.ــعرهم",
    سعرنا: "ســ.ــعرنا",
    خاص: "خــ.ـاص",
    خاصك: "خــ.ـاصك",
    خاصكم: "خاصــ.ـكم",
    خاصهم: "خاصــ.ـهم",
    خاصنا: "خاصـ.ـنا",
    مطلوب: "مــ.ــطلوب",
    مطلوبة: "مــ.ــطلوبة",
    مطلوبك: "مــ.ــطلوبك",
    مطلوبكم: "مــ.ــطلوبكم",
    مطلوبهم: "مــ.ــطلوبهم",
    مطلوبنا: "مــ.ــطلوبنا",
    اطلب: "أطــ.ــلب",
    اطلبك: "أطــ.ــلبك",
    اطلبكم: "أطــ.ــلبكم",
    اطلبهم: "أطــ.ــلبهم",
    اطلبنا: "أطــ.ــلبنا",
    مقابل: "مــ.ــقابل",
    مقابلي: "مــ.ــقابلي",
    مقابلك: "مــ.ــقابلك",
    مقابلكم: "مــ.ــقابلكم",
    مقابلهم: "مــ.ــقابلهم",
    مقابلنا: "مــ.ــقابلنا",
    مقابله: "مــ.ــقابله",
    مقابلها: "مــ.ــقابلها",
    سيرفر: "ســ.ــيرفر",
    سيرفري: "ســ.ــيرفري",
    سيرفرك: "ســ.ــيرفرك",
    سيرفركم: "ســ.ــيرفركم",
    سيرفرهم: "ســ.ــيرفرهم",
    سيرفرنا: "ســ.ــيرفرنا",
    سيرفره: "ســ.ــيرفره",
    كردت: "كــ.ــردت",
    كريدت: "كريــ.ــدت",
    اسعار: "اس3ـار",
    سيرفرها: "ســ.ــيرفرها",
    كريديت: "كـريـ.ـدت",
    تبادل: " تبـ.ـادل",
    شراء: "شــ.ــراء",
    شرائي: "شــ.ــرائي",
    شرائك: "شــ.ــرائك",
    شرائكم: "شــ.ــرائكم",
    شرائهم: "شــ.ــرائهم",
    شرائنا: "شــ.ــرائنا",
    هاك: "هــ.ــاك",
    هاكر: "هــ.ــاكر",
    هاكات: "هــ.ــاكات",
    فيزا: "فيــ.ــزا",
    فيزه: "فيــ.ــزه",
    فيزات: "فيــ.ــزات",
    تاجر: "تــ.ــاجر",
    تاجرك: "تــ.ــاجرك",
    تاجركم: "تــ.ــاجركم",
    تاجرهم: "تــ.ــاجرهم",
    تاجرنا: "تــ.ــاجرنا",
    تجار: "تــ.ــجار",
    نيتروهات: "نيــ.ــتروهات",
  };

  client.once("clientReady", async () => {
    // تحميل الحالة المحفوظة من قاعدة البيانات
    const savedActivity = db.get(`activity_${client.user.id}`);
    const savedPresence = db.get(`presence_${client.user.id}`);

    if (savedActivity) {
      client.user.setActivity(savedActivity.name, { type: savedActivity.type });
    }

    if (savedPresence) {
      client.user.setPresence({ status: savedPresence });
    }
  });

  // حدث عند تفعيل أمر
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === "set-activity") {
      const activity = options.getString("activity");
      const type = options.getNumber("type") || 0;
      const presence = options.getString("presence") || "online";

      // حفظ الحالة في قاعدة البيانات
      db.set(`activity_${client.user.id}`, { name: activity, type });
      db.set(`presence_${client.user.id}`, presence);

      // تعيين الحالة للبوت
      client.user.setActivity(activity, { type });
      client.user.setPresence({ status: presence });

      await interaction.reply({
        content: "تم تعيين الحالة بنجاح!",
        ephemeral: true,
      });
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === "set-username") {
      // التحقق من صلاحيات المستخدم
      if (!interaction.member.permissions.has("ADMINISTRATOR")) {
        return interaction.reply({
          content: "You do not have permission to use this command.",
          ephemeral: true,
        });
      }

      const newUsername = options.getString("username"); // الحصول على الاسم الجديد

      if (!newUsername || newUsername.length < 2 || newUsername.length > 32) {
        return interaction.reply({
          content: "Please provide a valid username (2-32 characters).",
          ephemeral: true,
        });
      }

      try {
        // تغيير اسم البوت
        await client.user.setUsername(newUsername);
        interaction.reply({
          content: `Bot username has been updated to **${newUsername}**!`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error changing bot username:", error);
        interaction.reply({
          content: "There was an error changing the bot username.",
          ephemeral: true,
        });
      }
    }

    if (commandName === "bot-avatar") {
      // التحقق من صلاحيات المستخدم
      if (!interaction.member.permissions.has("ADMINISTRATOR")) {
        return interaction.reply({
          content: "You do not have permission to use this command.",
          ephemeral: true,
        });
      }

      const avatarAttachment = options.getAttachment("imge"); // صورة البوت
      const bannerAttachment = options.getAttachment("banner"); // بنر البوت (اختياري)

      if (!avatarAttachment || !avatarAttachment.url) {
        return interaction.reply({
          content: "Please provide a valid image for the avatar.",
          ephemeral: true,
        });
      }

      try {
        // تغيير صورة البوت (Avatar)
        await client.user.setAvatar(avatarAttachment.url);
        let replyMessage = "Bot avatar has been updated successfully!";

        // تغيير بنر البوت (Banner) إذا تم توفيره
        if (bannerAttachment && bannerAttachment.url) {
          await client.user.setBanner(bannerAttachment.url);
          replyMessage += "\nBot banner has been updated successfully!";
        }

        interaction.reply({ content: replyMessage, ephemeral: true });
      } catch (error) {
        console.error("Error updating bot profile:", error);
        interaction.reply({
          content: "There was an error updating the bot profile.",
          ephemeral: true,
        });
      }
    }
  });

  client.on("guildCreate", async (guild) => {
    let invUrl = "Guild does not have channels to create an invitation link";
    try {
      let invChannel =
        guild.channels.cache.find(
          (channel) => channel.type === ChannelType.GuildText,
        ) ||
        guild.channels.cache.find(
          (channel) => channel.type === ChannelType.GuildVoice,
        );

      if (invChannel) {
        const inv = await invChannel.createInvite({ maxAge: 0, maxUses: 0 });
        invUrl = inv.url;
      }
    } catch (error) {
      console.error("Error creating invite:", error);
    }

    let owner = await guild.fetchOwner(); // جلب بيانات صاحب السيرفر

    const embed = new EmbedBuilder()
      .setTitle("New Guild Joined")
      .setColor(0x00ff00)
      .addFields(
        { name: "📌 Guild Name:", value: guild.name, inline: true },
        { name: "🆔 Guild ID:", value: guild.id, inline: true },
        {
          name: "👑 Owner:",
          value: `${owner.user.tag} (${owner.id})`,
          inline: false,
        },
        { name: "👥 Members:", value: `${guild.memberCount}`, inline: true },
        {
          name: "📅 Created At:",
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
        { name: "🔗 Invite URL:", value: invUrl },
      )
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`leaveGuild--${guild.id}`)
      .setLabel("Leave This Guild")
      .setStyle("Danger")
      .setEmoji(emojis.leaveGuild);

    const row = new ActionRowBuilder().addComponents(button);

    const logChannel = client.channels.cache.get(logJoinChannel);
    if (logChannel) {
      logChannel.send({ embeds: [embed], components: [row] });
    } else {
      console.error("Log channel not found.");
    }
  });

  // التعامل مع الضغط على زر "Leave This Guild"
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, guildId] = interaction.customId.split("--");

    if (action === "leaveGuild") {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return interaction.reply({
          content: "❌ لا يمكن العثور على هذا السيرفر.",
          ephemeral: true,
        });
      }

      try {
        await guild.leave();
        await interaction.reply({
          content: `✅ تم مغادرة السيرفر: **${guild.name}**`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error leaving guild:", error);
        await interaction.reply({
          content: "❌ فشل في مغادرة السيرفر.",
          ephemeral: true,
        });
      }
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.channel.type === ChannelType.DM && !message.author.bot) {
      const targetUser = await client.users.fetch(botOwner);

      const embed = new EmbedBuilder()
        .setTitle("رسـالـه أرسـلـت لـلـبـوت")
        .setDescription(ED.index_001({ message }));

      targetUser
        .send({ embeds: [embed] })
        .catch((error) => console.error("Error sending message:", error));
    }
  });

  client.on("interactionCreate", async (i) => {
    if (!i.isChatInputCommand()) return;

    const { commandName } = i;

    switch (commandName) {
      case "add-token":
        {
          if (i.user.id !== allowedUserId) {
            return i.reply({
              content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
              ephemeral: true,
            });
          }
          const token = i.options.getString("token");
          const tokenType = i.options.getString("type") || "extra";
          const subOwner = i.options.getUser("owner");
          const subPlan = i.options.getString("plan");
          if (!token)
            return i.reply({
              content: "**❌ لـم يـتـم ادخـال تـوكـن.**",
              ephemeral: true,
            });

          const alreadyExists =
            config.tokens.includes(token) ||
            config.makerToken === token ||
            config.generalToken === token;
          if (alreadyExists)
            return i.reply({
              content: "**❌ هـذا التـوكـن مـسـجـل بـالـفـعـل!**",
              ephemeral: true,
            });

          const typeLabels = {
            maker: "🛒 بوت الميكر",
            general: "🤖 البوت العام",
            extra: "➕ بوت إضافي",
          };

          if (tokenType !== "maker" && (!subOwner || !subPlan)) {
            return i.reply({
              content:
                "**❌ يجب تحديد `owner` و `plan` لإضافة الاشتراك (إلا لبوت الميكر).**",
              ephemeral: true,
            });
          }

          if (tokenType === "maker") {
            config.makerToken = token;
          } else if (tokenType === "general") {
            config.generalToken = token;
          } else {
            config.tokens.push(token);
          }

          try {
            if (tokenType !== "maker" && subOwner && subPlan) {
              await createSubscription(token, subOwner.id, subPlan);
            }
          } catch (err) {
            console.error("فشل حفظ الاشتراك:", err);
          }

          fs.writeFile(
            "./config.json",
            JSON.stringify(config, null, 2),
            (err) => {
              if (err) {
                console.error("Error writing to config file:", err);
                return i.reply({
                  content: "**❌ حـدث خـطـأ أثـنـاء حـفـظ الـتـوكـن.**",
                  ephemeral: true,
                });
              }
              const subInfo =
                tokenType !== "maker" && subPlan
                  ? `\n📅 الخطة: **${PLAN_DURATIONS[subPlan].label}**\n👤 الراعي: <@${subOwner.id}>`
                  : "";
              i.reply({
                content: `**✅ تـم حـفـظ الـتـوكـن كـ ${typeLabels[tokenType]}!**${subInfo}\n\n♻️ جارٍ إعادة تشغيل البوت...`,
                ephemeral: true,
              });
              setTimeout(() => {
                process.exit(1);
              }, 3000);
            },
          );
        }
        break;

      case "renew":
        {
          if (i.user.id !== allowedUserId) {
            return i.reply({
              content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
              ephemeral: true,
            });
          }
          const subs = await getAllSubscriptions();
          if (!subs.length)
            return i.reply({
              content: "**❌ لا يوجد بوتات مشتركة.**",
              ephemeral: true,
            });
          const plan = i.options.getString("plan");
          const options = subs.slice(0, 25).map((s) => {
            const bot = bots.find((b) => b._botToken === s.token);
            const label = bot?.user?.tag || `بوت (${s.token.slice(-6)})`;
            return {
              label: label.slice(0, 80),
              value: tokenHash(s.token),
              description:
                `ينتهي: ${new Date(s.expiresAt).toLocaleDateString("ar")}`.slice(
                  0,
                  100,
                ),
            };
          });
          const select = new StringSelectMenuBuilder()
            .setCustomId(`renew_select_${plan}`)
            .setPlaceholder("اختر البوت لتجديد اشتراكه")
            .addOptions(options);
          const row = new ActionRowBuilder().addComponents(select);
          await i.reply({
            content: `اختر البوت لتجديده بخطة **${PLAN_DURATIONS[plan].label}**:`,
            components: [row],
            flags: MessageFlags.Ephemeral,
          });
        }
        break;

      case "subs":
        {
          if (i.user.id !== allowedUserId) {
            return i.reply({
              content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
              ephemeral: true,
            });
          }
          const subs = await getAllSubscriptions();
          if (!subs.length)
            return i.reply({
              content: "**📭 لا يوجد اشتراكات مسجلة.**",
              ephemeral: true,
            });
          const embed = new EmbedBuilder()
            .setTitle("📋 اشتراكات البوتات")
            .setColor(0x5865f2)
            .setTimestamp();
          for (const s of subs.slice(0, 25)) {
            const bot = bots.find((b) => b._botToken === s.token);
            const name = bot?.user?.tag || `بوت (${s.token.slice(-6)})`;
            const statusIcon =
              s.status === "active"
                ? "🟢 نشط"
                : s.status === "expired"
                  ? "🟡 منتهي (فترة سماح)"
                  : "🔴 محذوف";
            embed.addFields({
              name,
              value: `الحالة: ${statusIcon}\nالخطة: ${PLAN_DURATIONS[s.plan]?.label || s.plan}\nالراعي: <@${s.ownerId}>\nينتهي: ${fmtDate(s.expiresAt)}\nنهاية فترة السماح: ${fmtDate(s.graceEndsAt)}`,
              inline: false,
            });
          }
          await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        break;

      case "remove-token":
        {
          if (i.user.id !== allowedUserId) {
            return i.reply({
              content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
              ephemeral: true,
            });
          }
          const token = i.options.getString("token");
          if (!token)
            return i.reply({
              content: "**❌ لـم يـتـم ادخـال تـوكـن.**",
              ephemeral: true,
            });

          const tokenIndex = config.tokens.indexOf(token);
          if (tokenIndex === -1) {
            return i.reply({
              content: "**❌ هـذا التـوكـن غـيـر مـسـجـل.**",
              ephemeral: true,
            });
          }

          config.tokens.splice(tokenIndex, 1);
          fs.writeFile(
            "./config.json",
            JSON.stringify(config, null, 2),
            (err) => {
              if (err) {
                console.error("Error writing to config file:", err);
                return i.reply({
                  content: "**❌ حـدث خـطـأ أثـنـاء حـذف الـتـوكـن.**",
                  ephemeral: true,
                });
              }
              i.reply({
                content:
                  "**✅ تـم حـذف الـتـوكـن بـنـجـاح! جارٍ إعادة تشغيل البوت...**",
                ephemeral: true,
              });

              setTimeout(() => {
                process.exit(1); // إعادة تشغيل البوت
              }, 3000);
            },
          );
        }
        break;
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "say-voice") {
      const text = interaction.options.getString("message");
      const lang = interaction.options.getString("language") || "ar";

      await interaction.deferReply();

      try {
        // التحقق من طول النص (حد Google TTS هو 200 حرف)
        if (text.length > 200) {
          return await interaction.editReply(
            "❌ النص طويل جدًا. الحد الأقصى هو 200 حرف.",
          );
        }

        // توليد رابط الصوت
        const url = googleTTS.getAudioUrl(text, {
          lang: lang,
          slow: false,
          host: "https://translate.google.com",
        });

        // إنشاء رابط للتحميل المباشر
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`فشل في تحميل الصوت: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const voiceFile = new AttachmentBuilder(buffer, { name: "voice.mp3" });

        await interaction.editReply({
          content: `${interaction.user}`,
          files: [voiceFile],
        });
      } catch (error) {
        console.error("خطأ في توليد الصوت:", error);
        await interaction.editReply(
          "❌ حدث خطأ أثناء إنشاء الصوت. يرجى المحاولة مرة أخرى.",
        );
      }
    }
  });

  // ========= Main Commands Handler =========
  require("./handlers/commands")(client, {
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
  });

  // ========= Embed Color Cache Init =========
  require("./handlers/modules/embedColor")
    .init(db, config)
    .catch(() => {});

  // ========= Interactions & Messages Handler =========
  require("./handlers/interactions")(client, {
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
  });


  client._botToken = token;

  client.on("interactionCreate", async (i) => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName !== "all-bots") return;
    if (i.user.id !== allowedUserId)
      return i.reply({
        content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
        flags: MessageFlags.Ephemeral,
      });

    await i.deferReply();

    const embed = new EmbedBuilder()
      .setTitle("🤖 قائمة البوتات")
      .setColor(0x5865f2)
      .setTimestamp();

    for (const bot of bots) {
      const isOnline = bot.ws && bot.ws.status === 0;
      const status = isOnline ? "🟢 أونلاين" : "🔴 أوف لاين";
      const botName = bot.user ? bot.user.tag : "غير معروف";

      const guild = bot.guilds?.cache?.first();
      let ownerInfo = "غير معروف";
      let serverLink = "لا يوجد سيرفر";

      if (guild) {
        try {
          const gOwner = await guild.fetchOwner();
          ownerInfo = `<@${gOwner.id}>`;
          const textCh = guild.channels.cache.find(
            (c) =>
              c.type === ChannelType.GuildText &&
              c
                .permissionsFor(bot.user)
                ?.has(PermissionFlagsBits.CreateInstantInvite),
          );
          if (textCh) {
            const inv = await textCh.createInvite({ maxAge: 0, maxUses: 0 });
            serverLink = `[${guild.name}](${inv.url})`;
          } else {
            serverLink = guild.name;
          }
        } catch {}
      }

      embed.addFields({
        name: botName,
        value: `الحالة: ${status}\nراعي البوت: ${ownerInfo}\nالسيرفر: ${serverLink}`,
        inline: false,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("allbots_delete")
        .setLabel("حذف بوت")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.delete),
      new ButtonBuilder()
        .setCustomId("allbots_fix")
        .setLabel("اصلاح مشكلة بوت")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.fixBot),
    );

    await i.editReply({ embeds: [embed], components: [row] });
  });

  client.on("interactionCreate", async (i) => {
    if (!i.isButton()) return;
    if (i.customId !== "allbots_delete") return;
    if (i.user.id !== allowedUserId)
      return i.reply({
        content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
        flags: MessageFlags.Ephemeral,
      });

    const options = bots
      .filter((b) => b.user)
      .map((b) => ({ label: b.user.tag, value: b.user.id }));

    if (!options.length)
      return i.reply({
        content: "**❌ لا يوجد بوتات.**",
        flags: MessageFlags.Ephemeral,
      });

    const select = new StringSelectMenuBuilder()
      .setCustomId("allbots_delete_select")
      .setPlaceholder("اختر البوت الذي تريد حذفه")
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    await i.reply({
      content: "اختر البوت الذي تريد حذف توكنه:",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  });

  client.on("interactionCreate", async (i) => {
    if (!i.isStringSelectMenu()) return;
    if (i.customId !== "allbots_delete_select") return;
    if (i.user.id !== allowedUserId)
      return i.reply({
        content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
        flags: MessageFlags.Ephemeral,
      });

    const selectedBotId = i.values[0];
    const selectedBot = bots.find((b) => b.user && b.user.id === selectedBotId);
    if (!selectedBot)
      return i.reply({
        content: "**❌ لم يتم العثور على البوت.**",
        flags: MessageFlags.Ephemeral,
      });

    const botToken = selectedBot._botToken;
    const tokenIndex = config.tokens.indexOf(botToken);
    if (tokenIndex === -1)
      return i.reply({
        content: "**❌ لم يتم العثور على توكن البوت.**",
        flags: MessageFlags.Ephemeral,
      });

    await i.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const restDel = new REST({ version: 10 }).setToken(botToken);
      await restDel.put(Routes.applicationCommands(selectedBotId), {
        body: [],
      });
    } catch (e) {
      console.error(
        `⚠️ Failed to clear commands for ${selectedBot.user.tag}:`,
        e.message,
      );
    }

    config.tokens.splice(tokenIndex, 1);
    if (config.makerToken === botToken) config.makerToken = "";
    if (config.generalToken === botToken) config.generalToken = "";

    fs.writeFile(
      "./config.json",
      JSON.stringify(config, null, 2),
      async (err) => {
        if (err) return i.editReply("**❌ حدث خطأ أثناء حذف التوكن.**");
        await i.editReply(
          `**✅ تم حذف بوت ${selectedBot.user.tag} وأوامره بنجاح! جارٍ إعادة التشغيل...**`,
        );
        setTimeout(() => process.exit(1), 3000);
      },
    );
  });

  client.on("interactionCreate", async (i) => {
    if (!i.isButton()) return;
    if (i.customId !== "allbots_fix") return;
    if (i.user.id !== allowedUserId)
      return i.reply({
        content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
        flags: MessageFlags.Ephemeral,
      });

    await i.deferReply({ flags: MessageFlags.Ephemeral });

    const offlineBots = bots.filter((b) => !b.ws || b.ws.status !== 0);
    if (!offlineBots.length)
      return i.editReply("**✅ كل البوتات تعمل بشكل طبيعي.**");

    let fixed = 0;
    for (const bot of offlineBots) {
      const tok = bot._botToken;
      if (!tok) continue;
      try {
        await bot.destroy();
        await bot.login(tok);
        fixed++;
      } catch (err) {
        console.error(`Failed to fix bot ${bot.user?.tag}:`, err);
      }
    }
    await i.editReply(
      `**✅ تم محاولة إصلاح ${fixed} من ${offlineBots.length} بوت.**`,
    );
  });

  client.on("interactionCreate", async (i) => {
    if (!i.isStringSelectMenu()) return;
    if (!i.customId.startsWith("renew_select_")) return;
    if (i.user.id !== allowedUserId)
      return i.reply({
        content: "**🚫 لا يمكنك استخدام هذا الأمر.**",
        flags: MessageFlags.Ephemeral,
      });

    const plan = i.customId.replace("renew_select_", "");
    const selectedHash = i.values[0];
    const subs = await getAllSubscriptions();
    const sub = subs.find((s) => tokenHash(s.token) === selectedHash);
    if (!sub)
      return i.reply({
        content: "**❌ لم يتم العثور على الاشتراك.**",
        flags: MessageFlags.Ephemeral,
      });

    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const updated = await renewSubscription(sub.token, plan);
      const bot = bots.find((b) => b._botToken === sub.token);
      const botName = bot?.user?.tag || `بوت (${sub.token.slice(-6)})`;

      const wasOffline = !bot || !bot.ws || bot.ws.status !== 0;
      if (bot && wasOffline) {
        try {
          await bot.destroy();
        } catch {}
        try {
          await bot.login(sub.token);
        } catch (e) {
          console.error("فشل إعادة تشغيل البوت بعد التجديد:", e);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ تم تجديد الاشتراك")
        .setDescription(
          ED.index_002({ PLAN_DURATIONS, botName, fmtDate, plan, updated }),
        )
        .setColor(0x00ff00)
        .setTimestamp();
      await i.editReply({ embeds: [embed] });

      try {
        const ownerUser = await client.users.fetch(updated.ownerId);
        await ownerUser.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ تم تجديد اشتراك بوتك")
              .setDescription(
                ED.index_003({
                  PLAN_DURATIONS,
                  botName,
                  fmtDate,
                  plan,
                  updated,
                }),
              )
              .setColor(0x00ff00)
              .setTimestamp(),
          ],
        });
      } catch {}

      const alertCh = client.channels.cache.get(logJoinChannel);
      if (alertCh) {
        await alertCh
          .send({
            embeds: [
              new EmbedBuilder()
                .setTitle("🔔 تجديد اشتراك")
                .setDescription(
                  ED.index_004({
                    PLAN_DURATIONS,
                    botName,
                    fmtDate,
                    plan,
                    updated,
                  }),
                )
                .setColor(0x00bfff)
                .setTimestamp(),
            ],
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("فشل التجديد:", err);
      await i.editReply(`**❌ فشل التجديد:** ${err.message}`);
    }
  });

  if (token === makerToken) {
    const runSubscriptionCheck = async () => {
      try {
        const subs = await getAllSubscriptions();
        const now = Date.now();
        for (const sub of subs) {
          if (sub.status === "deleted") continue;
          const targetBot = bots.find((b) => b._botToken === sub.token);
          const botName =
            targetBot?.user?.tag || `بوت (${sub.token.slice(-6)})`;

          if (sub.status === "active" && now >= sub.expiresAt) {
            sub.status = "expired";
            await db.set(tokenKey(sub.token), sub);
            if (targetBot) {
              try {
                await targetBot.destroy();
              } catch {}
            }

            if (!sub.notifiedExpired) {
              sub.notifiedExpired = true;
              await db.set(tokenKey(sub.token), sub);

              const expiredEmbed = new EmbedBuilder()
                .setTitle("⏰ انتهى اشتراك البوت")
                .setDescription(ED.index_005({ botName, fmtDate, sub }))
                .setColor(0xffaa00)
                .setTimestamp();

              const alertCh = client.channels.cache.get(logJoinChannel);
              if (alertCh)
                await alertCh
                  .send({
                    content: `<@${sub.ownerId}>`,
                    embeds: [expiredEmbed],
                  })
                  .catch(() => {});
              try {
                const ownerUser = await client.users.fetch(sub.ownerId);
                await ownerUser.send({ embeds: [expiredEmbed] });
              } catch {}
              console.log(
                chalk.yellow(`⏸️ تم إيقاف ${botName} — انتهى الاشتراك`),
              );
            }
          } else if (sub.status === "expired" && now >= sub.graceEndsAt) {
            sub.status = "deleted";
            sub.notifiedDeleted = true;
            await db.set(tokenKey(sub.token), sub);

            const tokIdx = config.tokens.indexOf(sub.token);
            if (tokIdx !== -1) config.tokens.splice(tokIdx, 1);
            if (config.generalToken === sub.token) config.generalToken = "";
            try {
              fs.writeFileSync(
                "./config.json",
                JSON.stringify(config, null, 2),
              );
            } catch (e) {
              console.error("فشل تحديث config:", e);
            }

            try {
              if (sub.botId) {
                const restDel = new REST({ version: 10 }).setToken(sub.token);
                await restDel.put(Routes.applicationCommands(sub.botId), {
                  body: [],
                });
              }
            } catch (e) {
              console.error("فشل حذف الأوامر:", e.message);
            }

            if (sub.guildId) {
              try {
                const allEntries = await db.all();
                const suffix = `_${sub.guildId}`;
                let removed = 0;
                for (const entry of allEntries) {
                  if (
                    entry.id.endsWith(suffix) &&
                    !entry.id.startsWith("bot_sub_")
                  ) {
                    await db.delete(entry.id);
                    removed++;
                  }
                }
                console.log(
                  chalk.red(
                    `🗑️ تم حذف ${removed} مفتاح من قاعدة البيانات للبوت ${botName}`,
                  ),
                );
              } catch (e) {
                console.error("فشل حذف بيانات البوت:", e);
              }
            }

            await db.delete(tokenKey(sub.token));

            const deletedEmbed = new EmbedBuilder()
              .setTitle("🗑️ تم حذف بيانات البوت")
              .setDescription(ED.index_006({ botName, sub }))
              .setColor(0xff0000)
              .setTimestamp();

            const alertCh = client.channels.cache.get(logJoinChannel);
            if (alertCh)
              await alertCh
                .send({ content: `<@${sub.ownerId}>`, embeds: [deletedEmbed] })
                .catch(() => {});
            try {
              const ownerUser = await client.users.fetch(sub.ownerId);
              await ownerUser.send({ embeds: [deletedEmbed] });
            } catch {}
            console.log(
              chalk.red(`🗑️ تم حذف بيانات ${botName} — انتهت فترة السماح`),
            );
          }
        }
      } catch (err) {
        console.error("خطأ في فاحص الاشتراكات:", err);
      }
    };

    setTimeout(runSubscriptionCheck, 30 * 1000);
    setInterval(runSubscriptionCheck, 60 * 60 * 1000);
    console.log(chalk.cyan("🔄 فاحص اشتراكات البوتات يعمل (كل ساعة)"));
  }

  client.on("error", (error) => {
    console.error(`🔴 Bot ${index + 1} encountered an error:`, error);
  });

  client.login(token).catch((error) => {
    if (error.code === "TokenInvalid") {
      console.warn(`⚠️ Bot ${index + 1}: توكن غير صالح — تم التخطي.`);
    } else {
      console.error(`❌ Bot ${index + 1} failed to log in:`, error);
    }
  });

  return client;
});

// تشغيل السيرفر لإبقاء العملية حية
app.listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
});
