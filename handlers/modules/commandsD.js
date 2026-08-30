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
// ========== في أول الملف (تحت الاستيرادات) ==========
const https = require("https");
// دالة رفع صورة لـ Catbox وترجع الرابط المباشر
async function uploadImageToHost(fileUrl) {
    return new Promise((resolve, reject) => {
        const tempDir = path.join(__dirname, "..", "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const ext = fileUrl.match(/\.(png|jpe?g|webp|gif)/i)?.[0] || ".png";
        const tempFile = path.join(tempDir, `upload_${Date.now()}${ext}`);
        const fileStream = fs.createWriteStream(tempFile);

        // تحميل الملف من الرابط
        https.get(fileUrl, (response) => {
            // إذا كان تحويل (redirect)، نتبع الرابط الجديد
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return uploadImageToHost(response.headers.location).then(resolve).catch(reject);
            }
            response.pipe(fileStream);
            fileStream.on("finish", () => {
                fileStream.close();
                
                // رفع الملف لـ Catbox
                const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
                const fileContent = fs.readFileSync(tempFile);
                
                const postData = Buffer.concat([
                    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`),
                    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${path.basename(tempFile)}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
                    fileContent,
                    Buffer.from(`\r\n--${boundary}--\r\n`),
                ]);

                const options = {
                    hostname: "catbox.moe",
                    path: "/user/api.php",
                    method: "POST",
                    headers: {
                        "Content-Type": `multipart/form-data; boundary=${boundary}`,
                        "Content-Length": postData.length,
                    },
                };

                const req = https.request(options, (res) => {
                    let data = "";
                    res.on("data", (chunk) => data += chunk);
                    res.on("end", () => {
                        // حذف الملف المؤقت
                        fs.unlink(tempFile, () => {});
                        resolve(data.trim());
                    });
                });

                req.on("error", (err) => {
                    fs.unlink(tempFile, () => {});
                    reject(err);
                });
                req.write(postData);
                req.end();
            });
        }).on("error", (err) => {
            fs.unlink(tempFile, () => {});
            reject(err);
        });
    });
}

// ========== ثم عدّل كود setup-images ==========

module.exports = function registerCommandsD(
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
    if (!i.guild) return;
    const commandsInSecondBlock = ["r-mzad","add-mzad-room","remove-mzad-room","add-rule","send-rule","remove-rule","panel-rules","panel-tickets","all-for-panel","نقاطي","توب-نقاط","panel-support","refresh-embeds"];
    if (commandsInSecondBlock.includes(i.commandName)) return;
    const guildId = i.guild.id;
    const shopData = await db.get(`shop_${i.channel.id}_${guildId}`);
    const sellerId = await db.get(`shop_${i.channel.id}_${guildId}.sellerId`);
    switch (i.commandName) {
      case "add-type":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال إلـى سـيـرفـر الـدعـم!**",
            );
          }

          const categoryId = i.options.get("category").value;
          const nametype = i.options.getString("name");
          const evcount = i.options.get("everyone_mention_count").value;
          const hecount = i.options.get("here_mention_count").value;
          const shcount = i.options.get("shop_mention_count").value;
          const pirefix = i.options.getString("pirefix");
          const shopEmoji = i.options.getString("shop-emoji") || "";
          const shoprole = i.options.getRole("shop_role").id;
          const shopmen = i.options.getRole("shop_mention").id;
          const maxWarns = i.options.get("maxwarns").value;
          const hasTax = i.options.getBoolean("has_tax");
          let taxPrice = i.options.get("tax_price")?.value || 0;
          const shopPrice = i.options.get("shop_price")?.value || 0;

          await i.deferReply({ flags: MessageFlags.Ephemeral });

          const category = await i.guild.channels
            .fetch(categoryId)
            .catch(() => null);
          if (!category)
            return i.editReply({
              content:
                "❌ **لا يـمـكـنـنـي الـوصـول إلـى هـذا الـكـاتـيـجـوري!**",
            });

          const guildId = i.guild.id;
          const key = `categoryMentions_${categoryId}_${guildId}`;

          // تحقق من شروط الضريبة
          if (hasTax && taxPrice === 0) {
            return i.editReply({
              content:
                "❌ يـجـب تـحـديـد سـعـر الـضـريـبـة إذا كـانـت مـفـعـلـة وتـكـون أكـبـر مـن 0.",
            });
          }

          // ضبط الضريبة إلى 0 إذا كانت غير مفعّلة
          if (!hasTax) {
            taxPrice = 0;
          }

          const op = {
            categoryId: categoryId,
            everyoneMentions: evcount,
            hereMentions: hecount,
            shopRoleMentions: shcount,
            pirefix: pirefix,
            shopEmoji: shopEmoji,
            shoprole: shoprole,
            shopmen: shopmen,
            maxWarns: maxWarns,
            hasTax: hasTax,
            taxPrice: taxPrice,
            shopPrice: shopPrice,
            nametype: nametype,
            guildId: guildId,
          };

          const existingData = await db.get(key);

          const imageUrl = await db.get(`image_${guildId}`);

          // الاحتفاظ بقائمة الكتاغوريات الحالية أو البدء بالرئيسي
          op.categories = Array.isArray(existingData?.categories) &&
            existingData.categories.filter(Boolean).length > 0
            ? existingData.categories.filter(Boolean)
            : [categoryId];

          await db.set(key, op);

          const isUpdate = !!existingData;
          const typeEmbed = new EmbedBuilder()
            .setTitle(
              `**${isUpdate ? "تـم تـحـديـث" : "تـم إضـافـة"} الـنـوع: ${nametype || "غـيـر مـحـدد"}**`,
            )
            .setDescription(
              ED.commandsD_001({
                config,
                evcount,
                hasTax,
                hecount,
                maxWarns,
                pirefix,
                shcount,
                shopEmoji,
                shopPrice,
                shopmen,
                shoprole,
                taxPrice,
              }),
            )
            .addFields({
              name: "الـكـاتـيـجـوري",
              value: `<#${categoryId}>`,
              inline: true,
            })
            .setImage(imageUrl || config.line || null);

          await i.editReply({
            content: `✅ تـم ${isUpdate ? "تـحـديـث" : "إضـافـة"} الـنـوع بـنـجـاح`,
          });
          await i.channel.send({ embeds: [typeEmbed] });
        }
        break;
      case "add-extra-cat":
        {
          const categoryId = i.options.get("category").value;
          const extraCatId = i.options.get("extra-category").value;
          const guildId = i.guild.id;
          const key = `categoryMentions_${categoryId}_${guildId}`;
          const data = await db.get(key);
          if (!data)
            return i.reply({
              content: "❌ النوع الرئيسي غير موجود.",
              flags: MessageFlags.Ephemeral,
            });
          const cats = Array.isArray(data.categories)
            ? data.categories.filter(Boolean)
            : [categoryId];
          if (extraCatId === categoryId)
            return i.reply({
              content: "❌ لا يمكن إضافة الكتاغوري الرئيسي نفسه.",
              flags: MessageFlags.Ephemeral,
            });
          if (cats.includes(extraCatId))
            return i.reply({
              content: "❌ هذا الكتاغوري الإضافي موجود مسبقاً.",
              flags: MessageFlags.Ephemeral,
            });
          cats.push(extraCatId);
          await db.set(key, { ...data, categories: cats });
          await i.reply({
            content:
              `✅ تم إضافة الكتاغوري الإضافي: <#${extraCatId}>\n` +
              `**كتاغوريات النوع الحالية:**\n${cats
                .map((c) => `<#${c}>`)
                .join("\n")}`,
            flags: MessageFlags.Ephemeral,
          });
        }
        break;
      case "remove-extra-cat":
        {
          const categoryId = i.options.get("category").value;
          const extraCatId = i.options.get("extra-category").value;
          const guildId = i.guild.id;
          const key = `categoryMentions_${categoryId}_${guildId}`;
          const data = await db.get(key);
          if (!data)
            return i.reply({
              content: "❌ النوع الرئيسي غير موجود.",
              flags: MessageFlags.Ephemeral,
            });
          const cats = Array.isArray(data.categories)
            ? data.categories.filter(Boolean)
            : [categoryId];
          const filtered = cats.filter((c) => c !== extraCatId);
          if (filtered.length === cats.length)
            return i.reply({
              content: "❌ هذا الكتاغوري الإضافي غير موجود.",
              flags: MessageFlags.Ephemeral,
            });
          if (filtered.length === 0) filtered.push(categoryId);
          await db.set(key, { ...data, categories: filtered });
          await i.reply({
            content:
              `✅ تم إزالة الكتاغوري الإضافي: <#${extraCatId}>\n` +
              `**كتاغوريات النوع الحالية:**\n${filtered
                .map((c) => `<#${c}>`)
                .join("\n")}`,
            flags: MessageFlags.Ephemeral,
          });
        }
        break;
      case "add-type2":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال إلـى سـيـرفـر الـدعـم!**",
            );
          }
          const guildId = i.guild.id;
          const categoryId = i.options.get("category").value;
          const nametype = i.options.getString("name");
          const evcount = i.options.get("everyone_mention_count").value;
          const hecount = i.options.get("here_mention_count").value;
          const shcount = i.options.get("shop_mention_count").value;
          const pirefix = i.options.getString("shop-pirefix");
          const shoprole = i.options.getRole("shop_role").id;
          const shopmen = i.options.getRole("shop_mention").id;
          const maxWarns = i.options.get("maxwarns").value;
          const hasTax = i.options.getBoolean("has_tax");
          let taxPrice = i.options.get("tax_price")?.value || 0;
          const shopPrice = i.options.get("shop_price")?.value || 0;
          const imageUrl = await db.get(`image_${guildId}`);

          const category = await i.guild.channels
            .fetch(categoryId)
            .catch(async () => {
              return i.reply({
                content: `❌ **لا يـمـكـنـنـي الـوصـول عـلـى هـذا الـكـاتـيـجـوري !**`,
                ephemeral: true,
              });
            });

          const allCategories = await db.all();
          const categoryCount = allCategories.filter(
            (entry) =>
              entry.id.startsWith(`categoryMentions_`) &&
              entry.id.endsWith(`_${guildId}`),
          ).length;

          if (categoryCount > 15) {
            return i.reply({
              content: `❌ **لا يـمـكـنـك تـحـديـد أكـثـر مـن 15 كـاتـيـجـوريـات فـي هـذا الـسـيـرفـر.**`,
              ephemeral: true,
            });
          }

          if (evcount > 9999) {
            return i.reply({
              content: `❌ **لا يـمـكـنـك تـحـديـد أكـثـر مـن 9999 مـنـشـنـات ايـفـري ._.**`,
              ephemeral: true,
            });
          }
          if (hecount > 9999) {
            return i.reply({
              content: `❌ **لا يـمـكـنـك تـحـديـد أكـثـر مـن 9999 مـنـشـنـات هـيـر ._.**`,
              ephemeral: true,
            });
          }
          if (shcount > 9999) {
            return i.reply({
              content: `❌ **لا يـمـكـنـك تـحـديـد أكـثـر مـن 9999 مـنـشـنـات شـوب ._.**`,
              ephemeral: true,
            });
          }
          if (maxWarns > 999) {
            return i.reply({
              content: `❌ **لا يـمـكـنـك تـحـديـد أكـثـر مـن 999 أقـصـى عـدد لـتـحـذيـرات ._.**`,
              ephemeral: true,
            });
          }

          // تحقق من شروط الضريبة
          if (hasTax && taxPrice === 0) {
            return i.reply({
              content:
                "يـجـب تـحـديـد سـعـر الـضـريـبـة إذا كـانـت الـضـريـبـة مـفـعـلـة ويـكـون أكـبـر مـن 0.",
              ephemeral: true,
            });
          }
          if (!hasTax && taxPrice > 0) {
            return i.reply({
              content:
                "لا يـمـكـنـك تـحـديـد سـعـر ضـريـبـة إذا كـانـت الـضـريـبـة غـيـر مـفـعـلـة.",
              ephemeral: true,
            });
          }

          const { member } = i;
          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            await i.reply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
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

          // ضبط الضريبة إلى 0 إذا كانت غير مفعّلة
          if (!hasTax) {
            taxPrice = 0;
          }

          let datecreated = `<t:${parseInt(Date.now() / 1000)}:R>`;
          for (const channel of category.children.cache) {
            const op = {
              channelId: channel[0],
              categoryId: categoryId,
              everyoneMentions: evcount,
              hereMentions: hecount,
              shopmen: shopmen,
              shoprole: shoprole,
              shopRoleMentions: shcount,
              date: datecreated,
              maxWarns: maxWarns,
              taxPrice: taxPrice,
              hasTax: hasTax,
              nametype: nametype,
              pirefix: pirefix,
              shopname: channel[1].name,
            };
            await db.set(`shop_${channel[0]}_${guildId}`, op);
            await db.set(`shop_${channel[0]}_${guildId}.warns`, "0");
            await db.set(`shop_${channel[0]}_${guildId}.status`, "1");
          }
          const ob = {
            categoryId: categoryId,
            everyoneMentions: evcount,
            hereMentions: hecount,
            shopRoleMentions: shcount,
            pirefix: pirefix,
            shoprole: shoprole,
            shopmen: shopmen,
            maxWarns: maxWarns, // إضافة أقصى عدد تحذيرات
            hasTax: hasTax,
            taxPrice: taxPrice,
            shopPrice: shopPrice,
            nametype: nametype,
          };
          await db.set(`categoryMentions_${categoryId}_${guildId}`, ob);
          //  await i.reply({ content: `✅ ` })
          await i.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(
                  `**تـم الـتـحـديـد مـعـلـومـات الـنـوع: ${nametype || "غـيـر مـحـدد"}**`,
                )
                .setDescription(
                  ED.commandsD_002({
                    config,
                    evcount,
                    hasTax,
                    hecount,
                    maxWarns,
                    pirefix,
                    shcount,
                    shopPrice,
                    shopmen,
                    shoprole,
                    taxPrice,
                  }),
                )
                .addFields({
                  name: "الـكـتـاغـوري",
                  value: `(${i.guild.channels.cache.get(categoryId)?.id || "غـيـر مـعـروف"})`,
                  inline: true,
                })
                .setImage(imageUrl || `${config.line}`),
            ],
          });
        }
        break;
      case "edit-type":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال إلـى سـيـرفـر الـدعـم!**",
            );
          }

          const categoryId = i.options.get("category").value;
          const key = `categoryMentions_${categoryId}_${i.guild.id}`;
          const oldData = await db.get(key);

          if (!oldData) {
            return i.reply({
              content:
                "❌ **هـذا الـنـوع غـيـر مـوجـود، لا يـمـكـن تـعـديـلـه.**",
              ephemeral: true,
            });
          }

          const { member } = i;
          const guildId = i.guild.id;
          const highstaff = await db.get(`highstaff_${guildId}`);

          if (!highstaff) {
            return i.reply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
              ephemeral: true,
            });
          }

          if (!member.roles.cache.has(highstaff)) {
            return i.reply({
              content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
              ephemeral: true,
            });
          }

          // 🔥 جمع القيم الجديدة إذا موجودة، وإذا ما أرسلها يأخذ القديمة مثل ما هي
          const newData = {
            categoryId,
            nametype: i.options.getString("name") || oldData.nametype,
            everyoneMentions:
              i.options.getInteger("everyone_mention_count") ??
              oldData.everyoneMentions,
            hereMentions:
              i.options.getInteger("here_mention_count") ??
              oldData.hereMentions,
            shopRoleMentions:
              i.options.getInteger("shop_mention_count") ??
              oldData.shopRoleMentions,
            pirefix: i.options.getString("pirefix") || oldData.pirefix,
            shopEmoji:
              i.options.getString("shop-emoji") ?? oldData.shopEmoji ?? "",
            shoprole: i.options.getRole("shop_role")?.id || oldData.shoprole,
            shopmen: i.options.getRole("shop_mention")?.id || oldData.shopmen,
            maxWarns: i.options.getInteger("maxwarns") ?? oldData.maxWarns,
            shopPrice: i.options.getInteger("shop_price") ?? oldData.shopPrice,
            hasTax: i.options.getBoolean("has_tax") ?? oldData.hasTax,
            taxPrice: i.options.getInteger("tax_price") ?? oldData.taxPrice,
            guildId,
          };

          // إذا الضريبة صايرة false نخلي السعر 0
          if (newData.hasTax === false) newData.taxPrice = 0;

          await db.set(key, newData);

          const imageUrl = await db.get(`image_${guildId}`);

          await i.reply({
            content: "✅ **تـم تـعـديـل الـنـوع بـنـجـاح!**",
            ephemeral: true,
          });

          await i.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> **تـم تـعـديـل الـنـوع: ${newData.nametype}**`)
                      .setColor(_ec.color(i.guild?.id))
         
                .setDescription(ED.commandsD_003({ config, newData }))
                .addFields({ name: "الـكـتـاغـوري", value: `(${categoryId})` })
                .setFooter({
                  text: "تـلـمـيـح: اكـتـب هـنـا فـي الـزخـرفـة مـs�ـان لـلإيـمـوجـي : ネ〢「هـنـا」︲",
                })
                .setImage(imageUrl || config.line),
            ],
          });
        }
        break;
      case "check-types":
        {
          const guildId = i.guild.id;
          const { member } = i;

          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            return i.reply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) مـن خـلال /setup",
              ephemeral: true,
            });
          }

          if (!member.roles.cache.has(highstaff)) {
            return i.reply({
              content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
              ephemeral: true,
            });
          }

          const all = await db.all();
          const types = all.filter(
            (e) =>
              e.id.startsWith("categoryMentions_") &&
              e.id.endsWith(`_${guildId}`),
          );

          if (types.length === 0) {
            return i.reply({
              content: "❌ لا تـوجـد أنـواع مـتـاجـر فـي الـسـيـرفـر.",
              ephemeral: true,
            });
          }

          let valid = 0;
          let deleted = 0;

          for (const entry of types) {
            const data = entry.value;
            const cat = i.guild.channels.cache.get(data.categoryId);

            if (!cat) {
              await db.delete(entry.id);
              deleted++;
            } else {
              valid++;
            }
          }

          const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  فـحـص الأنـواع")
            .setDescription(ED.commandsD_004({ deleted, valid }))
            .setTimestamp();

          return i.reply({ embeds: [embed] });
        }
        break;
      case "remove-helper":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }
          const guildId = i.guild.id;
          const { member, guild } = i;
          const { options } = i;
          const part = options.getUser("helper");
          const shop = options.getChannel("shop") || i.channel; // استخدم القناة الحالية إذا لم يتم تحديد قناة

          const admins = await db.get(`shopad_${guildId}`);
          if (!admins) {
            await i.editReply({
              content:
                "يـرجـى تـحـديـد الادمـن عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
            });
            return;
          }

          if (!member.roles.cache.has(admins)) {
            await i.editReply(
              `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر تـحـتـاج رتـبـه <@&${admins}>`,
            );
            return;
          }

          await i.deferReply();

          try {
            const data = await db.get(`shop_${shop.id}_${guildId}`);
            if (!data) {
              return i.editReply("** هـذة الـروم لـيـسـت مـتـجـر **");
            }

            const existingPartners = data.partners || [];
            if (!existingPartners.includes(part.id)) {
              return i.editReply(
                "** هـذا الـعـضـو لـيـس عـمـيـل فـي هـذا الـمـتـجـر. **",
              );
            }

            const shopChannel = await i.guild.channels.fetch(shop.id);
            await shopChannel.permissionOverwrites.delete(part.id);

            const updatedPartners = existingPartners.filter(
              (partnerId) => partnerId !== part.id,
            );
            await db.set(
              `shop_${shop.id}_${guildId}.partners`,
              updatedPartners,
            );

            const logs = await db.get(`logs_${guildId}`);
            const logg = logs ? i.guild.channels.cache.get(logs) : null;

            await i.editReply(
              `** الـعـمـيـل <@${part.id}> تـم ازالـتـه مـن الـمـتـجـر <#${shop.id}> بـ نـجـاح. **`,
            );
            await shopChannel.send({
              content: `** تـم ازالـة : <@${part.id}> \n كـ عـمـيـل مـن الـمـتـجـر **`,
            });

            if (logg) {
              await logg.send({
                content: `** تـم ازالـة : <@${part.id}> \n كـ عـمـيـل مـن الـمـتـجـر **\n<@${i.user.id}> عـن طـريـق`,
              });
            }
          } catch (error) {
            console.error(error);
            return i.editReply(
              "وجـدت مـشـكـلـة أثـنـاء إزالـة الـعـمـيـل مـن الـمـتـجـر.",
            );
          }
        }
        break;
      case "types":
        {
          const guildId = i.guild.id;
          const { member } = i;

          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            return i.reply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
              ephemeral: true,
            });
          }

          if (!member.roles.cache.has(highstaff)) {
            return i.reply({
              content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
              ephemeral: true,
            });
          }

          const allCategories = await db.all();
          const categories = allCategories
            .filter(
              (entry) =>
                entry.id.startsWith(`categoryMentions_`) &&
                entry.id.endsWith(`_${guildId}`),
            )
            .map((entry) => entry.value);

          if (categories.length === 0) {
            return i.reply({
              content: `❌ **لا تـوجـد أنـواع مـتـاجـر مـحـددة فـي هـذا الـسـيـرفـر.**`,
              ephemeral: false,
            });
          }

          const imageUrl = await db.get(`image_${guildId}`);

          // الإيمبد الأول: قائمة أسماء الأنواع
          const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  قـائـمـة أنـواع الـمـتـاجـر")
            .setDescription(ED.commandsD_005({ categories, i }))
            .setImage(imageUrl || `${config.line}`)
            .setColor(_ec.color(guildId));

          // إنشاء أزرار لكل نوع، 5 أزرار لكل صف
          const rows = [];
          let currentRow = new ActionRowBuilder();
          let btnCount = 0;

          for (const category of categories) {
            const btn = new ButtonBuilder()
              .setCustomId(`type_${category.categoryId}`)
              .setLabel(category.nametype || "غـيـر مـحـدد")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(emojis.list);

            currentRow.addComponents(btn);
            btnCount++;

            // كل 5 أزرار نبدأ صف جديد
            if (btnCount === 5) {
              rows.push(currentRow);
              currentRow = new ActionRowBuilder();
              btnCount = 0;
            }
          }

          // إضافة آخر صف إذا فيه أزرار
          if (currentRow.components.length > 0) {
            rows.push(currentRow);
          }

          // إرسال الإيمبد مع الأزرار
          await i.reply({
            embeds: [embed],
            components: rows,
            ephemeral: false,
          });
          const filter = (btnInt) =>
            btnInt.user.id === i.user.id && btnInt.customId.startsWith("type_");
          const collector = i.channel.createMessageComponentCollector({
            filter,
            time: 60000,
          });

          collector.on("collect", async (btnInt) => {
            const categoryId = btnInt.customId.replace("type_", "");
            const categoryData = categories.find(
              (c) => c.categoryId === categoryId,
            );

            if (!categoryData) {
              return btnInt.reply({
                content:
                  "❌ لـم أتـمـكـن مـن الـعـثـور عـلـى بـيـانـات هـذا الـنـوع.",
                ephemeral: true,
              });
            }

            const categoryChannel = i.guild.channels.cache.get(
              categoryData.categoryId,
            );
            const channelName = categoryChannel?.name || "غـيـر مـعـروف";

            const detailEmbed = new EmbedBuilder()
              .setTitle(
                ` مـعـلـومـات الـنـوع: ${categoryData.nametype || "غـيـر مـحـدد"}`,
              )
              .setDescription(
                ED.commandsD_006({ categoryData, channelName, config }),
              )
              .setImage(imageUrl || `${config.line}`)
              .setColor(_ec.color(guildId))
              .setFooter(D.footer(i.guild))
              .setThumbnail(D.thumb(i.guild))
              .setTimestamp();

            await btnInt.reply({ embeds: [detailEmbed], ephemeral: true });
          });
        }
        break;
      case "typeswas":
        {
          const guildId = i.guild.id;
          const { member } = i;
          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            await i.reply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
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

          // الحصول على جميع الأنواع المرتبطة بالسيرفر
          const allCategories = await db.all();
          const categories = allCategories
            .filter(
              (entry) =>
                entry.id.startsWith(`categoryMentions_`) &&
                entry.id.endsWith(`_${guildId}`),
            )
            .map((entry) => entry.value);

          if (categories.length === 0) {
            return i.reply({
              content: `❌ **لا تـوجـد أنـواع مـتـاجـر مـحـددة فـي هـذا الـسـيـرفـر.**`,
              ephemeral: false,
            });
          }

          // الحصول على صورة من قاعدة البيانات إذا كانت موجودة
          const imageUrl = await db.get(`image_${guildId}`);

          // إنشاء إيمبد لعرض أسماء الأنواع
          const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  قـائـمـة أنـواع الـمـتـاجـر")
               .setColor(_ec.color(i.guild?.id))
         
            .setDescription(ED.commandsD_007({ categories, i }))
            .setImage(imageUrl || `${config.line}`); // إضافة الصورة إذا كانت موجودة

          // إرسال الإيمبد في رسالة واحدة
          await i.reply({
            embeds: [embed],
            ephemeral: false,
          });

          // إرسال معلومات كل نوع في نفس الرسالة
          const categoryEmbeds = categories
            .map((category) => {
              const categoryChannel = i.guild.channels.cache.get(
                category.categoryId,
              );

              // إذا كان الكاتيجوري موجودًا
              if (categoryChannel) {
                return new EmbedBuilder()
                  .setTitle(
                    `**مـعـلـومـات الـنـوع: ${category.nametype || "غـيـر مـحـدد"}**`,
                  )
                  .setDescription(ED.commandsD_008({ category, config }))
                  .addFields({
                    name: "الـكـتـاغـوري",
                    value: `(${i.guild.channels.cache.get(category.categoryId)?.id || "غـيـر مـعـروف"})`,
                    inline: true,
                  })
                  .setAuthor({
                    name: i.guild.name,
                    iconURL: i.guild.iconURL({ size: 1024 }),
                  })
                  .setFooter(D.footer(i.guild))
                  .setThumbnail(D.thumb(i.guild))
                  .setTimestamp()
                  .setThumbnail(i.guild.iconURL({ size: 1024 }))
                  .setImage(imageUrl || `${config.line}`);
              }
            })
            .filter((embed) => embed); // التأكد من أن الإيمبد ليس فارغًا

          // إرسال الإيمبد الخاص بكل نوع في نفس الرسالة
          await i.followUp({
            embeds: categoryEmbeds,
            ephemeral: false,
          });
        }
        break;
      // الكود الجديد
      case "remove-type":
        {
          const categoryId = i.options.get("category").value;
          const guildId = i.guild.id;
          const key = `categoryMentions_${categoryId}_${guildId}`;
          const { member } = i;
          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            await i.reply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
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

          const existingData = await db.get(key);

          if (!existingData) {
            return i.reply({
              content: `❌ **لـم يـتـم الـعـثـور عـلـى الـنـوع الـمـرتـبـط بـهـذا الـكـاتـيـجـوري.**`,
              ephemeral: true,
            });
          }

          await db.delete(key);

          return i.reply({
            content: `✅ **تـم حـذف الـنـوع الـمـرتـبـط بـالـكـاتـيـجـوري بـنـجـاح!**`,
            ephemeral: true,
          });
        }
        break;
      case "remove-all-types":
        {
          const guildId = i.guild.id;
          const { member } = i;

          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            return i.reply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الأمـر الـتـالـي: `/setup`",
              ephemeral: true,
            });
          }

          if (!member.roles.cache.has(highstaff)) {
            return i.reply({
              content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
              ephemeral: true,
            });
          }

          // جلب جميع المفاتيح المرتبطة بأنواع المتاجر في هذا السيرفر
          const allKeys = await db.all();
          const categoryKeys = allKeys
            .map((entry) => entry.id)
            .filter(
              (key) =>
                key.startsWith(`categoryMentions_`) &&
                key.includes(`_${guildId}`),
            );

          if (categoryKeys.length === 0) {
            return i.reply({
              content: `❌ **لا يـوجـد أنـواع مـتـاجـر مـسـجـلـة فـي هـذا الـسـيـرفـر.**`,
              ephemeral: true,
            });
          }

          // حذف جميع أنواع المتاجر
          for (const key of categoryKeys) {
            await db.delete(key);
          }

          return i.reply({
            content: `✅ **تـم حـذف جـمـيـع أنـواع الـمـتـاجـر فـي هـذا الـسـيـرفـر بـنـجـاح!**`,
            ephemeral: true,
          });
        }
        break;
      case "active":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }
          await i.deferReply({ ephemeral: false });

          const shopi = i.options.getChannel("shop") || i.channel;
          const shopoo = await i.guild.channels.fetch(shopi.id);
          const guildId = i.guild.id;
          const { member } = i;
          const admins = await db.get(`shopad_${guildId}`);

          if (!admins) {
            await i.editReply({
              content:
                "يـرجـى تـحـديـد الادمـن عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
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

          if (!shopoo) {
            await i.editReply("**لا أسـتـطـيـع الـعـثـور عـلـي هـذه الـروم**");
            return;
          }

          const shppp = await db.get(`shop_${shopi.id}_${guildId}`);

          if (!shppp) {
            await i.editReply("**هـذا الـروم لـيـس مـتـجـر**");
            return;
          }

          if (shppp.status === "1") {
            await i.editReply("**الـروم لـيـس مـعـطـل**");
            return;
          }

          if (shppp.status === "0") {
            await shopi.permissionOverwrites.edit(i.guild.roles.everyone, {
              ViewChannel: true,
            });

            // استرجاع رابط الصورة من قاعدة البيانات
            const imageUrl = await db.get(`image_${guildId}`);

            const embedlog = new EmbedBuilder()
              .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> تـم تـفـعـيـل الـمـتـجـر`)
              .setDescription(ED.commandsD_009())
              .setFooter(D.footer(i.guild))
              .setThumbnail(D.thumb(i.guild))
              .setTimestamp(new Date())
              // إضافة الصورة إذا كانت موجودة
              .setImage(imageUrl || `${config.line}`);

            const uuiio = await db.get(`shop_${shopi.id}_${guildId}`);
            await db.set(`shop_${shopi.id}_${guildId}.status`, "1");

            await shopi.send({
              embeds: [embedlog],
              content: `<@${uuiio.sellerId}>`,
            });
            await i.editReply("**تـم تـفـعـيـل الـمـتـجـر بـنـجـاح**");

            const embedlogi = new EmbedBuilder()
              .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> تـم تـفـعـيـل مـتـجـر`)
              .setDescription(ED.commandsD_010({ i }))
              .addFields({
                name: "الـمـتـجـر  : ",
                value: `<#${shopi.id}>`,
                inline: true,
              })
              .setFooter(D.footer(i.guild))
              .setThumbnail(D.thumb(i.guild))
              .setTimestamp(new Date())
              // إضافة الصورة إذا كانت موجودة
              .setImage(imageUrl || `${config.line}`);

            const channelToSendId = await db.get(`logs_${guildId}`);
            const channelToSend = await i.guild.channels.fetch(channelToSendId);
            await channelToSend.send({ embeds: [embedlogi] });

            await i.editReply({ embeds: [embedlogi] });
          }
        }
        break;
      case "active-all":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }

          await i.deferReply({ ephemeral: true });

          const guildId = i.guild.id;
          const { member } = i;
          const highstaff = await db.get(`highstaff_${guildId}`);

          if (!highstaff) {
            await i.editReply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
              ephemeral: true,
            });
            return;
          }

          if (!member.roles.cache.has(highstaff)) {
            await i.editReply({
              content: `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر. تـحـتـاج رتـبـه <@&${highstaff}>.`,
              ephemeral: true,
            });
            return;
          }

          // جلب قائمة المتاجر المعطلة من قاعدة البيانات
          const shops = await db.all();
          const shopChannels = shops.filter(
            (entry) =>
              entry.id.startsWith(`shop_`) && entry.value.status === "0",
          );

          if (shopChannels.length === 0) {
            await i.editReply(
              "**لا تـوجـد مـتـاجـر مـعـطـلـة لـتـفـعـيـلـهـا.**",
            );
            return;
          }

          const confirmButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm-activate-all")
              .setLabel("تـأكـيـد الـتـفـعـيـل")
              .setStyle("Primary")
              .setEmoji(emojis.confirm),
          );

          const confirmationEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـأكـيـد تـفـعـيـل الـمـتـاجـر")
            .setDescription(ED.commandsD_011({ shopChannels }))
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp(new Date());

          await i.editReply({
            embeds: [confirmationEmbed],
            components: [confirmButton],
            ephemeral: true,
          });

          const filter = (interaction) =>
            interaction.customId === "confirm-activate-all" &&
            interaction.user.id === i.user.id;
          const collector = i.channel.createMessageComponentCollector({
            filter,
            time: 60000,
          });

          collector.on("collect", async (buttonInteraction) => {
            await buttonInteraction.deferUpdate();

            // تعطيل الزر بعد الضغط عليه
            const disabledButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("confirm-activate-all")
                .setLabel("تـأكـيـد الـتـفـعـيـل")
                .setStyle("Primary")
                .setDisabled(true)
                .setEmoji(emojis.confirm),
            );

            await i.editReply({
              components: [disabledButton],
              ephemeral: true,
            });

            const imageUrl = await db.get(`image_${guildId}`);
            const logChannelId = await db.get(`logs_${guildId}`);
            const logChannel = logChannelId
              ? await i.guild.channels.fetch(logChannelId).catch(() => null)
              : null;

            let activatedCount = 0;

            for (const shop of shopChannels) {
              const channelId = shop.id.split("_")[1]; // استخراج ID القناة
              const channel = await i.guild.channels
                .fetch(channelId)
                .catch(() => null);
              if (!channel) continue;

              // تفعيل القناة بجعلها مرئية
              await channel.permissionOverwrites.edit(i.guild.roles.everyone, {
                ViewChannel: true,
              });

              // إرسال رسالة التفعيل في القناة
              const embed = new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـم تـفـعـيـل الـمـتـجـر")
                .setDescription(ED.commandsD_012())
                .setFooter(D.footer(i.guild))
                .setThumbnail(D.thumb(i.guild))
                .setTimestamp(new Date())
                .setImage(imageUrl || "");

              await channel.send({ embeds: [embed] });

              // تحديث حالة المتجر في قاعدة البيانات
              await db.set(shop.id, { ...shop.value, status: "1" });

              // إرسال اللوج
              if (logChannel) {
                const logEmbed = new EmbedBuilder()
                  .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـم تـفـعـيـل مـتـجـر")
                  .setDescription(ED.commandsD_013({ i }))
                  .addFields({
                    name: "الـمـتـجـر :",
                    value: `<#${channel.id}>`,
                    inline: true,
                  })
                  .setFooter(D.footer(i.guild))
                  .setThumbnail(D.thumb(i.guild))
                  .setTimestamp(new Date())
                  .setImage(imageUrl || "");

                await logChannel.send({ embeds: [logEmbed] });
              }

              activatedCount++;
            }

            await i.editReply({
              content: `**تـم تـفـعـيـل جـمـيـع الـمـتـاجـر بـنـجـاح (${activatedCount}) مـتـجـر.**`,
              embeds: [],
              components: [],
            });

            collector.stop();
          });

          collector.on("end", (collected) => {
            if (!collected.size) {
              i.editReply({
                content: "**تـم إلـغـاء الإجـراء بـسـبـب عـدم الـتـأكـيـد.**",
                embeds: [],
                components: [],
              });
            }
          });
        }
        break;
      case "disable":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }
          await i.deferReply({ ephemeral: true });

          const shop = i.options.getChannel("shop");
          const reason = i.options.getString("reason");
          const guildId = i.guild.id;
          const { member } = i;
          const admins = await db.get(`shopad_${guildId}`);

          if (!admins) {
            await i.editReply({
              content:
                "يـرجـى تـحـديـد الادمـن عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
            });
            return;
          }

          if (!member.roles.cache.has(admins)) {
            await i.editReply(
              `لـيـس لـديـك صـلاحـيـة لإسـتـخـدام هـذا الأمـر تـحـتـاج رتـبـه <@&${admins}>`,
            );
            return;
          }

          const datap = await db.get(`shop_${shop.id}_${guildId}`);
          if (!datap) {
            await i.editReply("**هـذا الـروم لـيـس مـتـجـر**");
            return;
          }

          const iiff = await i.guild.channels.fetch(shop.id);

          if (datap.status === "0") {
            await i.editReply("**هـذا الـروم مـعـطـل بـالـفـعـل**");
            return;
          }

          if (datap.status === "1") {
            await iiff.permissionOverwrites.edit(i.guild.roles.everyone, {
              ViewChannel: false,
            });

            // استرجاع رابط الصورة من قاعدة البيانات
            const imageUrl = await db.get(`image_${guildId}`);

            const embedlog = new EmbedBuilder()
              .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> تـم تـعـطـيـل الـمـتـجـر`)
              .setDescription(ED.commandsD_014({ i }))
              .addFields({
                name: "الـسـبـب",
                value: reason,
                inline: true,
              })
              .setFooter(D.footer(i.guild))
              .setThumbnail(D.thumb(i.guild))
              .setTimestamp(new Date())
              // إضافة الصورة إذا كانت موجودة
              .setImage(imageUrl || "");

            iiff.send({ content: `<@${datap.sellerId}>`, embeds: [embedlog] });
            await i.editReply("**تـم تـعـطـيـل الـمـتـجـر بـنـجـاح**");

            const embeddlog = new EmbedBuilder()
              .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> تـم تـعـطـيـل مـتـجـر`)
              .setDescription(ED.commandsD_015({ i }))
              .addFields(
                {
                  name: "الـمـتـجـر",
                  value: `<#${shop.id}>`,
                  inline: true,
                },
                {
                  name: "الـسـبـب",
                  value: reason,
                  inline: true,
                },
              )
              .setFooter(D.footer(i.guild))
              .setThumbnail(D.thumb(i.guild))
              .setTimestamp(new Date())
              // إضافة الصورة إذا كانت موجودة
              .setImage(imageUrl || `${config.line}`);
            const channelToSendId = await db.get(`logs_${guildId}`);
            const channelToSend = await i.guild.channels.fetch(channelToSendId);
            channelToSend.send({ embeds: [embeddlog] });
            await i.editReply({ embeds: [embeddlog] });
            await db.set(`shop_${shop.id}_${guildId}.status`, "0");
          }
        }
        break;
      case "disable-all":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }

          await i.deferReply({ ephemeral: true });

          const guild = i.guild;
          const { member } = i;
          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            await i.editReply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
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

          const categories = guild.channels.cache.filter(
            (channel) => channel.type === ChannelType.GuildCategory,
          );
          if (!categories.size) {
            await i.editReply(
              "**لا يـوجـد كـاتـيـجـور   � فـي هـذا الـسـيـرفـر**",
            );
            return;
          }

          const confirmButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm-disable-all")
              .setLabel("تـأكـيـد الـتـعـطـيـل")
              .setStyle("Primary") // زر Primary
              .setEmoji(emojis.pause),
          );

          const confirmationEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـأكـيـد تـعـطـيـل جـمـيـع الـمـتـاجـر")
            .setDescription(ED.commandsD_016())
            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp(new Date());

          await i.editReply({
            embeds: [confirmationEmbed],
            components: [confirmButton],
            ephemeral: true,
          });

          const filter = (interaction) =>
            interaction.customId === "confirm-disable-all" &&
            interaction.user.id === i.user.id;
          const collector = i.channel.createMessageComponentCollector({
            filter,
            time: 60000,
          });

          collector.on("collect", async (buttonInteraction) => {
            await buttonInteraction.deferUpdate();

            const disabledButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("confirm-disable-all")
                .setLabel("تـأكـيـد الـتـعـطـيـل")
                .setStyle("Primary")
                .setDisabled(true)
                .setEmoji(emojis.pause),
            );
            // تحديث الرسالة لتعطيل الزر
            await i.editReply({
              components: [disabledButton],
            });

            const imageUrl = await db.get(`image_${guild.id}`);
            let disabledCount = 0;

            for (const [categoryId, category] of categories) {
              const channels = category.children.cache;

              for (const [channelId, channel] of channels) {
                const channelDataKey = `shop_${channel.id}_${guild.id}`;
                const channelData = await db.get(channelDataKey);

                if (channelData && channelData.status === "1") {
                  await channel.permissionOverwrites.edit(
                    guild.roles.everyone,
                    {
                      ViewChannel: false,
                    },
                  );

                  const embed = new EmbedBuilder()
                    .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> تـم تـعـطـيـل جـمـيـع الـمـتـاجـر`)
                    .setDescription(ED.commandsD_017({ i }))
                    .setFooter(D.footer(i.guild))
                    .setThumbnail(D.thumb(i.guild))
                    .setTimestamp(new Date())
                    .setImage(imageUrl || `${config.line}`);

                  await channel.send({ embeds: [embed] });

                  await db.set(`${channelDataKey}.status`, "0");
                  disabledCount++;
                }
              }
            }

            await i.editReply({
              content: `**تـم تـعـطـيـل ${disabledCount} مـتـجـر بـنـجـاح وإرسـال إشـعـار لـلـجـمـيـع**`,
              embeds: [],
              components: [],
            });

            collector.stop();
          });

          collector.on("end", (collected) => {
            if (!collected.size) {
              i.editReply({
                content: "**تـم إلـغـاء الإجـراء بـسـبـب عـدم الـتـأكـيـد.**",
                embeds: [],
                components: [],
              });
            }
          });
        }
        break;
      case "tax-time":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }
          await i.deferReply({ ephemeral: true });
          const guild = i.guild;
          const { member } = i;
          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            await i.editReply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
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
          const categories = guild.channels.cache.filter(
            (channel) => channel.type === ChannelType.GuildCategory,
          );
          if (!categories.size) {
            await i.editReply(
              "**لا يـوجـد كـاتـيـجـوري فـي هـذا الـسـيـرفـر**",
            );
            return;
          }
          const confirmButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm-tax")
              .setLabel("تـأكـيـد ارسـال ضـريـبـة الـمـتـاجـر")
              .setStyle("Primary") // زر Primary
              .setEmoji(emojis.tax),
          );
          const confirmationEmbed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تـأكـيـد ارسـال ضـريـبـة الـمـتـاجـر")
            .setDescription(ED.commandsD_018())
              .setColor(_ec.color(i.guild?.id))

            .setFooter(D.footer(i.guild))
            .setThumbnail(D.thumb(i.guild))
            .setTimestamp(new Date());
          await i.editReply({
            embeds: [confirmationEmbed],
            components: [confirmButton],
          });
          const filter = (interaction) =>
            interaction.customId === "confirm-tax" &&
            interaction.user.id === i.user.id;

          const collector = i.channel.createMessageComponentCollector({
            filter,
            time: 60000,
          });
          collector.on("collect", async (buttonInteraction) => {
            await buttonInteraction.deferUpdate();

            const disabledButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("confirm-tax")
                .setLabel("تـأكـيـد ارسـال ضـريـبـة الـمـتـاجـر")
                .setStyle("Primary")
                .setDisabled(true)
                .setEmoji(emojis.tax),
            );

            // تحديث الرسالة لتعطيل الزر
            await i.editReply({
              components: [disabledButton],
            });

            const imageUrl = await db.get(`image_${guild.id}`);
            let disabledCount = 0;
            for (const [categoryId, category] of categories) {
              const channels = category.children.cache;
              for (const [channelId, channel] of channels) {
                const channelDataKey = `shop_${channel.id}_${guild.id}`;
                const channelData = await db.get(channelDataKey);
                // Check if tax is enabled for the category
                const hasTax = await db.get(
                  `shop_${channel.id}_${guild.id}.hasTax`,
                );
                const taxPrice = await db.get(
                  `shop_${channel.id}_${guild.id}.taxPrice`,
                );
                const owner = await db.get(
                  `shop_${channel.id}_${guild.id}.sellerId`,
                );
                if (channelData && channelData.status === "1" && hasTax) {
                  await channel.permissionOverwrites.edit(
                    guild.roles.everyone,
                    {
                      ViewChannel: false,
                    },
                  );
                  await channel.permissionOverwrites.edit(owner, {
                    ViewChannel: true,
                    SendMessages: true,
                    AddReactions: true,
                    AttachFiles: true,
                    EmbedLinks: true,
                    UseExternalEmojis: true,
                    ReadMessageHistory: true,
                  });
                  // Prepare embed for the tax notification
                  const buytax = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setCustomId("buy-tax")
                      .setLabel("دفـع الـضـريـبـة")
                      .setStyle("Primary") // زر Primary
                      .setEmoji(emojis.payTax),
                  );
                  const embed = new EmbedBuilder()
                    .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> حـان وقـت الـضـريـبـة!`)
                    .setDescription(ED.commandsD_019({ taxPrice }))
                    .setFooter(D.footer(i.guild))
                    .setThumbnail(D.thumb(i.guild))
                    .setTimestamp(new Date())
                    .setImage(imageUrl || "");
                  await channel.send({ embeds: [embed], components: [buytax] });
                  await db.set(`${channelDataKey}.status`, "0");
                  disabledCount++;
                }
              }
            }
            await i.editReply({
              content: `**تـم تـفـعـيـل وضـع الـضـريـبـه ${disabledCount} مـتـجـر بـنـجـاح وإرسـال إشـعـار لـلـجـمـيـع**`,
              embeds: [],
              components: [],
            });
            collector.stop();
          });
          collector.on("end", (collected) => {
            if (!collected.size) {
              i.editReply({
                content: "**تـم إلـغـاء الإجـراء بـسـبـب عـدم الـتـأكـيـد.**",
                embeds: [],
                components: [],
              });
            }
          });
        }
        break;
      case "say-emabed":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }
          const { member } = i;
          const highstaff = await db.get(`highstaff_${guildId}`);
          if (!highstaff) {
            await i.reply({
              content:
                "يـرجـى تـحـديـد رتـبـة الـعـلـيـا (highstaff) عـن طـريـق اسـتـخـدام الامـر الاتـي: /setup",
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
          const ch = i.options.getChannel("room");
          const targetChannel = ch ?? i.channel;
          const title = i.options.getString(`title`);
          const msg = i.options.getString(`msg`);
          const im = i.options.getString(`image`);
          const guild = i.guild;
          const serverName = guild.name;
          const serverIcon = guild.iconURL();

          const embed = new EmbedBuilder()
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ${title || `${serverName}`}`)
            .setDescription(ED.commandsD_020({ msg }))
            .setColor(_ec.color(i.guild?.id))
            .setImage(im)
            .setThumbnail(serverIcon)
            .setTimestamp()
            .setFooter({ text: `by ${i.user.tag}`, iconURL: `${serverIcon}` });

          await targetChannel.send({ embeds: [embed] });

          i.reply({ content: "** Done ✅ **", ephemeral: true });
        }
        break;
      case "server-info":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }
          const guildId = i.guild.id;
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content:
                "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator** لاسـتـخـدام هـذا الأمـر!",
              ephemeral: true,
            });
          }
          // استرجاع القيم من قاعدة البيانات
          const imageUrl = await db.get(`image_${guildId}`);
          const logs = await db.get(`logs_${guildId}`);
          const orderRoom = await db.get(`orderroom_${guildId}`);
          const actionRoom = await db.get(`auctionroom_${guildId}`);
          const shopcat = await db.get(`catbuy_shop_${guildId}`);
          const auctioncat = await db.get(`catbuy_auction_${guildId}`);
          const ordercat = await db.get(`catbuy_order_${guildId}`);
          const shopAdmin = await db.get(`shopad_${guildId}`);
          const orderAdmin = await db.get(`orderad_${guildId}`);
          const auctionAdmin = await db.get(`auctionad_${guildId}`);
          const bank = await db.get(`bank_${guildId}`);
          const highstaff = await db.get(`highstaff_${guildId}`);

          // تحضير الرد مع القيم المحددة أو "غير محدد"
          const embed = new EmbedBuilder()
            .setColor(_ec.color(guildId))
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> مـعـلـومـات الـسـيـرفـر")
            .addFields(
              {
                name: "روم لـوق الـمـتـاجـر",
                value: logs ? `<#${logs}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "روم الـطـلـبـات",
                value: orderRoom ? `<#${orderRoom}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "روم الـمـزادات",
                value: actionRoom ? `<#${actionRoom}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "كـتـاغـوري تـكـتـات شـراء مـتـاجـر",
                value: shopcat ? `<#${shopcat}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "كـتـاغـوري تـكـتـات شـراء مـزاد",
                value: auctioncat ? `<#${auctioncat}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "كـتـاغـوري تـكـتـات شـراء طـلـبـات",
                value: ordercat ? `<#${ordercat}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول الـمـتـاجـر",
                value: shopAdmin ? `<@&${shopAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول الـطـلـبـات",
                value: orderAdmin ? `<@&${orderAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول الـمـزاد",
                value: auctionAdmin ? `<@&${auctionAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "بـنـك الـسـيـرفـر",
                value: bank ? `<@${bank}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "رتـبـة الـعـلـيـا",
                value: highstaff ? `<@&${highstaff}>` : "غـيـر مـحـدد",
                inline: true,
              },
            )
            .setFooter({ text: "مـعـلـومـات الـسـيـرفـر" })
            // إضافة الصورة إذا كانت موجودة
            .setImage(imageUrl || `${config.line}`);

          i.reply({ embeds: [embed] });
        }
        break;
      case "setup":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content:
                "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator** لاسـتـخـدام هـذا الأمـر!",
              ephemeral: true,
            });
          }
          const guildId = i.guild.id;

          // تحديث القيم إذا تم تحديدها
          if (i.options.getChannel("logs"))
            db.set(`logs_${guildId}`, i.options.getChannel("logs").id);
          if (i.options.getChannel("scam-logs"))
            db.set(`scam_logs_${guildId}`, i.options.getChannel("scam-logs").id);
          if (i.options.getChannel("order-room"))
            db.set(
              `orderroom_${guildId}`,
              i.options.getChannel("order-room").id,
            );
          if (i.options.getChannel("action-room"))
            db.set(
              `auctionroom_${guildId}`,
              i.options.getChannel("action-room").id,
            );
          if (i.options.getChannel("buy-shop-tickets"))
            db.set(
              `catbuy_shop_${guildId}`,
              i.options.getChannel("buy-shop-tickets").id,
            );
          if (i.options.getChannel("buy-auction-tickets"))
            db.set(
              `catbuy_auction_${guildId}`,
              i.options.getChannel("buy-auction-tickets").id,
            );
          if (i.options.getChannel("buy-order-tickets"))
            db.set(
              `catbuy_order_${guildId}`,
              i.options.getChannel("buy-order-tickets").id,
            );
          if (i.options.getRole("high-staff"))
            db.set(`highstaff_${guildId}`, i.options.getRole("high-staff").id);
          if (i.options.getRole("shop-admin"))
            db.set(`shopad_${guildId}`, i.options.getRole("shop-admin").id);
          if (i.options.getRole("order-admin"))
            db.set(`orderad_${guildId}`, i.options.getRole("order-admin").id);
          if (i.options.getRole("order-mention-role"))
            db.set(
              `order-mentionrole_${guildId}`,
              i.options.getRole("order-mention-role").id,
            );
          if (i.options.getString("embed-color")) {
            const raw = i.options
              .getString("embed-color")
              .trim()
              .replace("#", "0x");
            db.set(`embed_color_${guildId}`, raw);
            try {
              require("./embedColor").setGuildColor(guildId, raw);
            } catch {}
          }
          if (i.options.getRole("auction-admin"))
            db.set(
              `auctionad_${guildId}`,
              i.options.getRole("auction-admin").id,
            );
          if (i.options.getRole("auction-mzad-role"))
            db.set(
              `auctionmzadrole_${guildId}`,
              i.options.getRole("auction-mzad-role").id,
            );
          if (i.options.getUser("bank"))
            db.set(`bank_${guildId}`, i.options.getUser("bank").id);
          if (i.options.getChannel("buy-roles-tickets"))
            db.set(
              `roles_cat_${guildId}`,
              i.options.getChannel("buy-roles-tickets").id,
            );
          if (i.options.getRole("roles-admin"))
            db.set(
              `roles_admin_${guildId}`,
              i.options.getRole("roles-admin").id,
            );
          if (i.options.getChannel("support-category"))
            db.set(
              `support_cat_${guildId}`,
              i.options.getChannel("support-category").id,
            );
          if (i.options.getRole("support-admin"))
            db.set(
              `support_admin_${guildId}`,
              i.options.getRole("support-admin").id,
            );
          if (i.options.getRole("scam-admin"))
            db.set(`scam_admin_${guildId}`, i.options.getRole("scam-admin").id);
          if (i.options.getChannel("scam-room"))
            db.set(
              `scam_room_${guildId}`,
              i.options.getChannel("scam-room").id,
            );
          if (i.options.getChannel("commands-room"))
            db.set(
              `commandsRoom_${guildId}`,
              i.options.getChannel("commands-room").id,
            );
          if (i.options.getChannel("rating-channel"))
            db.set(
              `rating_ch_${guildId}`,
              i.options.getChannel("rating-channel").id,
            );

          // استلام الصورة الرمزية إذا تم تحديدها
          const imageAttachment = i.options.getAttachment("line");
          if (imageAttachment) db.set(`image_${guildId}`, imageAttachment.url);
          const imageUrl = await db.get(`image_${guildId}`);
          const logs = await db.get(`logs_${guildId}`);
          const orderRoom = await db.get(`orderroom_${guildId}`);
          const actionRoom = await db.get(`auctionroom_${guildId}`);
          const shopcat = await db.get(`catbuy_shop_${guildId}`);
          const auctioncat = await db.get(`catbuy_auction_${guildId}`);
          const ordercat = await db.get(`catbuy_order_${guildId}`);
          const shopAdmin = await db.get(`shopad_${guildId}`);
          const orderAdmin = await db.get(`orderad_${guildId}`);
          const auctionAdmin = await db.get(`auctionad_${guildId}`);
          const auctionMzadRole = await db.get(`auctionmzadrole_${guildId}`);
          const bank = await db.get(`bank_${guildId}`);
          const highstaff = await db.get(`highstaff_${guildId}`);
          const rolesCat = await db.get(`roles_cat_${guildId}`);
          const rolesAdmin = await db.get(`roles_admin_${guildId}`);
          const supportCat = await db.get(`support_cat_${guildId}`);
          const supportAdmin = await db.get(`support_admin_${guildId}`);
          const scamAdmin = await db.get(`scam_admin_${guildId}`);
          const scamRoom = await db.get(`scam_room_${guildId}`);
          const commandsRoom = await db.get(`commandsRoom_${guildId}`);
          const ratingCh = await db.get(`rating_ch_${guildId}`);

          const embed = new EmbedBuilder()
            .setColor(_ec.color(guildId))
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> الإعـدادات الـتـي تـم تـحـديـدهـا")
            .addFields(
              {
                name: "روم لـوق الـمـتـاجـر",
                value: logs ? `<#${logs}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "روم الـطـلـبـات",
                value: orderRoom ? `<#${orderRoom}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "روم الـمـزادات",
                value: actionRoom ? `<#${actionRoom}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "كـتـاغـوري تـكـتـات شـراء مـتـاجـر",
                value: shopcat ? `<#${shopcat}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "كـتـاغـوري تـكـتـات شـراء مـزاد",
                value: auctioncat ? `<#${auctioncat}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "كـتـاغـوري تـكـتـات شـراء طـلـبـات",
                value: ordercat ? `<#${ordercat}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "كـتـاغـوري تـكـتـات شـراء رتـب",
                value: rolesCat ? `<#${rolesCat}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "كـتـاغـوري تـكـتـات الـدعـم والـتـشـهـيـر",
                value: supportCat ? `<#${supportCat}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول الـمـتـاجـر",
                value: shopAdmin ? `<@&${shopAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول الـطـلـبـات",
                value: orderAdmin ? `<@&${orderAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول الـمـزاد",
                value: auctionAdmin ? `<@&${auctionAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول شـراء الـرتـب",
                value: rolesAdmin ? `<@&${rolesAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول الـدعـم الـفـنـي",
                value: supportAdmin ? `<@&${supportAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "مـسـؤول الـتـشـهـيـر",
                value: scamAdmin ? `<@&${scamAdmin}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "روم نـشـر الـتـشـهـيـر",
                value: scamRoom ? `<#${scamRoom}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "رول مـنـشـن مـزاد",
                value: auctionMzadRole
                  ? `<@&${auctionMzadRole}>`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "بـنـك الـسـيـرفـر",
                value: bank ? `<@${bank}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "رتـبـة الـعـلـيـا",
                value: highstaff ? `<@&${highstaff}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "روم الأوامـر",
                value: commandsRoom ? `<#${commandsRoom}>` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "روم تـقـيـيـمـات الـتـكـتـات",
                value: ratingCh ? `<#${ratingCh}>` : "غـيـر مـحـدد",
                inline: true,
              },
            );
          if (imageUrl) embed.setImage(imageUrl);
          await i.reply({ embeds: [embed], ephemeral: true });
        }
        break;

   
            
// ============ add-roles ============
      case "add-roles":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          const role = i.options.getRole("role");
          const price = i.options.getInteger("price");
          const benefits = i.options.getString("benefits");
          let roles = (await db.get(`buy_roles_${guildId}`)) || [];
          if (roles.length >= 5) {
            return i.reply({
              content:
                "**❌ وصـلـت الـحـد الأقـصـى (5 رتـب). احـذف رتـبـة قـبـل الإضـافـة.**",
              ephemeral: true,
            });
          }
          if (roles.find((r) => r.roleId === role.id)) {
            return i.reply({
              content: `**❌ الـرتـبـة ${role} مـوجـودة بـالـفـعـل فـي الـقـائـمـة.**`,
              ephemeral: true,
            });
          }
          roles.push({ roleId: role.id, name: role.name, price, benefits });
          await db.set(`buy_roles_${guildId}`, roles);
          await i.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت إضافة الرتبة")
                .addFields(
                  { name: " الـرتـبـة", value: `${role}`, inline: true },
                  { name: " الـسـعـر", value: `${price}`, inline: true },
                  { name: " الـمـمـيـزات", value: benefits },
                )
                    .setColor(_ec.color(i.guild?.id))
         ],
            ephemeral: true,
          });
        }
        break;

      // ============ remove-roles ============
      case "remove-roles":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          const roles = (await db.get(`buy_roles_${guildId}`)) || [];
          if (roles.length === 0) {
            return i.reply({
              content: "**❌ لا تـوجـد رتـب مـضـافـة.**",
              ephemeral: true,
            });
          }
          const menu = new StringSelectMenuBuilder()
            .setCustomId(`roles_delete_select_${guildId}`)
            .setPlaceholder("اخـتـر الـرتـبـة الـتـي تـريـد حـذفـهـا")
            .addOptions(
              roles.map((r) => ({
                label: r.name,
                description: `الـسـعـر: ${r.price}`,
                value: r.roleId,
              })),
            );
          await i.reply({
            content: "**اخـتـر الـرتـبـة لـلـحـذف:**",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true,
          });
        }
        break;

      // ============ list-roles ============
      case "list-roles":
        {
          const roles = (await db.get(`buy_roles_${guildId}`)) || [];
          if (roles.length === 0) {
            return i.reply({
              content: "**❌ لا تـوجـد رتـب مـضـافـة بـعـد.**",
              ephemeral: true,
            });
          }
          const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504>  قـائـمـة الـرتـب الـمـتـاحـة لـلـشـراء")
             .setColor(_ec.color(i.guild?.id))
           .setDescription(ED.commandsD_021({ roles }))
            .setTimestamp();
          const delBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`roles_delete_panel_${guildId}`)
              .setLabel("حـذف رتـبـة")
              .setStyle(ButtonStyle.Danger)
              .setEmoji(emojis.delete),
          );
          const buyBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("ticket-roles")
              .setLabel("شـراء رتـبـة")
              .setStyle(ButtonStyle.Success)
              .setEmoji(emojis.ticketRoles),
          );
          await i.reply({ embeds: [embed], components: [delBtn, buyBtn] });
        }
        break;

      // ============ add-select-role ============
      case "add-select-role":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          const selRole = i.options.getRole("role");
          const selEmoji = i.options.getString("emoji") || "";
          let selectRoles = (await db.get(`select_roles_${guildId}`)) || [];
          if (selectRoles.length >= 25) {
            return i.reply({
              content: "**❌ وصـلـت الـحـد الأقـصـى (25 رتـب).**",
              ephemeral: true,
            });
          }
          if (selectRoles.find((r) => r.roleId === selRole.id)) {
            return i.reply({
              content: `**❌ الـرتـبـة ${selRole} مـوجـودة بـالـفـعـل.**`,
              ephemeral: true,
            });
          }
          selectRoles.push({ roleId: selRole.id, name: selRole.name, emoji: selEmoji });
          await db.set(`select_roles_${guildId}`, selectRoles);
          await i.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت إضافة الرتبة للقائمة")
                .addFields(
                  { name: "الـرتـبـة", value: `${selRole}`, inline: true },
                  { name: "الإيـموجـي", value: selEmoji || "بدون", inline: true },
                )
                .setColor(_ec.color(i.guild?.id)),
            ],
            ephemeral: true,
          });
        }
        break;

      // ============ remove-select-role ============
      case "remove-select-role":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          const selectRoles2 = (await db.get(`select_roles_${guildId}`)) || [];
          if (selectRoles2.length === 0) {
            return i.reply({ content: "**❌ لا تـوجـد رتـب مـضـافـة.**", ephemeral: true });
          }
          const selMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_role_delete_${guildId}`)
            .setPlaceholder("اخـتـر الـرتـبـة لـلـحـذف")
            .addOptions(
              selectRoles2.map((r) => ({
                label: r.name,
                description: r.emoji ? `إيموجي: ${r.emoji}` : "بدون إيموجي",
                value: r.roleId,
              })),
            );
          await i.reply({
            content: "**اخـتـر الـرتـبـة لـلـحـذف:**",
            components: [new ActionRowBuilder().addComponents(selMenu)],
            ephemeral: true,
          });
        }
        break;

      // ============ list-select-roles ============
      case "list-select-roles":
        {
          const selectRoles3 = (await db.get(`select_roles_${guildId}`)) || [];
          if (selectRoles3.length === 0) {
            return i.reply({ content: "**❌ لا تـوجـد رتـب مـضـافـة.**", ephemeral: true });
          }
          const desc = selectRoles3.map((r, i) => `${i + 1}. ${r.emoji || ""} <@&${r.roleId}> — \`${r.roleId}\``).join("\n");
          const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> قـائـمـة الرتـب الـمـتـاحـة للاختيار")
            .setDescription(desc)
            .setColor(_ec.color(i.guild?.id));
          await i.reply({ embeds: [embed], ephemeral: true });
        }
        break;

      // ============ send-role-panel ============
      case "send-role-panel":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          const selectRoles4 = (await db.get(`select_roles_${guildId}`)) || [];
          if (selectRoles4.length === 0) {
            return i.reply({ content: "**❌ أضف رتـب أولاً بـأمر /add-select-role**", ephemeral: true });
          }
          const targetChannel = i.options.getChannel("channel");
          const panelTitle = i.options.getString("title") || "اختر رتبتك";
          const panelDesc = i.options.getString("description") || "اختر الرتبة التي تريد من القائمة أدناه";

          const roleOptions = selectRoles4.map((r) => ({
            label: r.name,
            value: r.roleId,
            emoji: r.emoji || undefined,
          }));

          const roleSelect = new StringSelectMenuBuilder()
            .setCustomId("free_role_select")
            .setPlaceholder("اختر رتبتك")
            .setMinValues(0)
            .setMaxValues(Math.min(roleOptions.length, 25))
            .addOptions(roleOptions);

          const panelEmbed = new EmbedBuilder()
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ${panelTitle}`)
            .setDescription(panelDesc)
            .setColor(_ec.color(i.guild?.id))
            .setTimestamp();

          await targetChannel.send({
            embeds: [panelEmbed],
            components: [new ActionRowBuilder().addComponents(roleSelect)],
          });

          await i.reply({
            content: `**✅ تم إرسال لوحة الرتب إلى ${targetChannel}**`,
            ephemeral: true,
          });
        }
        break;

      case "setup-prices":
        {
          const blacklist = (await db.get("blacklist")) || [];
          if (blacklist.includes(i.user.id)) {
            return i.reply(
              "**أنـت فـي الـبـلاك لـسـت، لـمـعـلـومـات أكـثـر تـعـال سـيـرفـر الـسـبـورت!**",
            );
          }
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content:
                "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator** لاسـتـخـدام هـذا الأمـر!",
              ephemeral: true,
            });
          }

          const guildId = i.guild.id;

          // تحديث القيم إذا تم تحديدها

          if (i.options.getInteger("remove-warn-credit"))
            db.set(
              `removewarncredit_${guildId}`,
              i.options.getInteger("remove-warn-credit"),
            );
          if (i.options.getInteger("change-partners-credit"))
            db.set(
              `changepartnerscredit_${guildId}`,
              i.options.getInteger("change-partners-credit"),
            );
          if (i.options.getInteger("everyone-price"))
            db.set(
              `evrypri_${guildId}`,
              i.options.getInteger("everyone-price"),
            );
          if (i.options.getInteger("here-price"))
            db.set(`herepri_${guildId}`, i.options.getInteger("here-price"));
          if (i.options.getInteger("shop-mention-price"))
            db.set(
              `shopprice_${guildId}`,
              i.options.getInteger("shop-mention-price"),
            );
          if (i.options.getInteger("order-every-price-credit"))
            db.set(
              `order-evrypri_${guildId}`,
              i.options.getInteger("order-every-price-credit"),
            );
          if (i.options.getInteger("order-here-price-credit"))
            db.set(
              `order-herepri_${guildId}`,
              i.options.getInteger("order-here-price-credit"),
            );
          if (i.options.getInteger("order-order-price-credit"))
            db.set(
              `order-orderpri_${guildId}`,
              i.options.getInteger("order-order-price-credit"),
            );
          if (i.options.getInteger("auction-every-price-credit"))
            db.set(
              `auction-evrypri_${guildId}`,
              i.options.getInteger("auction-every-price-credit"),
            );
          if (i.options.getInteger("auction-here-price-credit"))
            db.set(
              `auction-herepri_${guildId}`,
              i.options.getInteger("auction-here-price-credit"),
            );
          if (i.options.getInteger("auction-mzad-price-credit"))
            db.set(
              `auction-mzadpri_${guildId}`,
              i.options.getInteger("auction-mzad-price-credit"),
            );
          if (i.options.getInteger("change-name"))
            db.set(
              `changename_${guildId}`,
              i.options.getInteger("change-name"),
            );
          if (i.options.getInteger("change-owner"))
            db.set(
              `changeowner_${guildId}`,
              i.options.getInteger("change-owner"),
            );
          if (i.options.getInteger("auto-message"))
            db.set(
              `automessage_${guildId}`,
              i.options.getInteger("auto-message"),
            );
          if (i.options.getInteger("change-shape"))
            db.set(
              `changeshape_${guildId}`,
              i.options.getInteger("change-shape"),
            );
          if (i.options.getInteger("change-type-price"))
            db.set(
              `changetypeprice_${guildId}`,
              i.options.getInteger("change-type-price"),
            );
          if (i.options.getInteger("shop-vacation"))
            db.set(
              `shopvacation_${guildId}`,
              i.options.getInteger("shop-vacation"),
            );
          if (i.options.getInteger("disable-auto-price"))
            db.set(
              `disableauto_${guildId}`,
              i.options.getInteger("disable-auto-price"),
            );
          if (i.options.getInteger("activate-shop-price"))
            db.set(
              `activateshopprice_${guildId}`,
              i.options.getInteger("activate-shop-price"),
            );
          if (i.options.getInteger("sell-shop-price"))
            db.set(
              `sellshopprice_${guildId}`,
              i.options.getInteger("sell-shop-price"),
            );
          if (i.options.getString("shop-category-price")) {
            const input = i.options.getString("shop-category-price");
            const parts = input.trim().split(/\s+/);
            if (parts.length < 2) {
              return i.reply({ content: "الصيغة الصحيحة: shop-category-price categoryId السعر", ephemeral: true });
            }
            const catId = parts[0];
            const newPrice = parseInt(parts[1]);
            if (isNaN(newPrice) || newPrice <= 0) {
              return i.reply({ content: "السعر يجب أن يكون رقم موجب", ephemeral: true });
            }
            const catData = await db.get(`categoryMentions_${catId}_${guildId}`);
            if (!catData) {
              return i.reply({ content: `لم يتم العثور على نوع المتجر: "${catId}"`, ephemeral: true });
            }
            catData.shopPrice = newPrice;
            await db.set(`categoryMentions_${catId}_${guildId}`, catData);
            await i.reply({ content: `تم تحديث سعر نوع المتجر **${catData.nametype || catId}** إلى **${newPrice.toLocaleString()}$**` });
          }

          // استرجاع القيم من قاعدة البيانات لعرضها
          const removeWarnCredit = await db.get(`removewarncredit_${guildId}`);
          const changePartnersCredit = await db.get(
            `changepartnerscredit_${guildId}`,
          );
          const changeName = await db.get(`changename_${guildId}`);
          const changeOwner = await db.get(`changeowner_${guildId}`);
          const autoMessage = await db.get(`automessage_${guildId}`);
          const changeShape = await db.get(`changeshape_${guildId}`);
          const changeTypePrice = await db.get(`changetypeprice_${guildId}`);
          const shopVacation = await db.get(`shopvacation_${guildId}`);
          const disableAuto = await db.get(`disableauto_${guildId}`);
          const activateShopPrice = await db.get(
            `activateshopprice_${guildId}`,
          );
          const sellShopPrice = await db.get(`sellshopprice_${guildId}`);

          const everyonePrice = await db.get(`evrypri_${guildId}`);
          const herePrice = await db.get(`herepri_${guildId}`);
          const shopMentionPrice = await db.get(`shopprice_${guildId}`);

          const orderEveryPriceCredit = await db.get(
            `order-evrypri_${guildId}`,
          );
          const orderHerePriceCredit = await db.get(`order-herepri_${guildId}`);
          const orderOrderPriceCredit = await db.get(
            `order-orderpri_${guildId}`,
          );

          const auctionEveryPriceCredit = await db.get(
            `auction-evrypri_${guildId}`,
          );
          const auctionHerePriceCredit = await db.get(
            `auction-herepri_${guildId}`,
          );
          const auctionMzadPriceCredit = await db.get(
            `auction-mzadpri_${guildId}`,
          );

          // إعداد الـ Embed لعرض الإعدادات
          const embed = new EmbedBuilder()
            .setColor(_ec.color(guildId))
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> أسـعـار الـخـدمـات الـتـي تـم تـحـديـدهـا")
            .addFields(
              {
                name: "سـعـر ازالـة الـتـحـذيـر",
                value: removeWarnCredit
                  ? `${removeWarnCredit}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر اضـافـة/حـذف شـريـك",
                value: changePartnersCredit
                  ? `${changePartnersCredit}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن ايـفـري لـلـمـتـاجـر",
                value: everyonePrice ? `${everyonePrice}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن هـيـر لـلـمـتـاجـر",
                value: herePrice ? `${herePrice}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن مـتـجـر",
                value: shopMentionPrice
                  ? `${shopMentionPrice}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن ايـفـري بـا الـكـردت لـلـطـلـبـات",
                value: orderEveryPriceCredit
                  ? `${orderEveryPriceCredit}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن هـيـر بـا الـكـردت لـلـطـلـبـات",
                value: orderHerePriceCredit
                  ? `${orderHerePriceCredit}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن طـلـبـات (رول) بـالـكـردت",
                value: orderOrderPriceCredit
                  ? `${orderOrderPriceCredit}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن ايـفـري لـلـمـزاد بـالـكـردت",
                value: auctionEveryPriceCredit
                  ? `${auctionEveryPriceCredit}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن هـيـر بـا الـكـردت لـلـمـزادات",
                value: auctionHerePriceCredit
                  ? `${auctionHerePriceCredit}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر مـنـشـن مـزاد (رول) بـالـكـردت",
                value: auctionMzadPriceCredit
                  ? `${auctionMzadPriceCredit}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر تـغـيـيـر اسـم الـمـتـجـر",
                value: changeName ? `${changeName}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر تـغـيـيـر صـاحـب الـمـتـجـر",
                value: changeOwner ? `${changeOwner}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر نـشـر تـلـقـائـي لـلـمـتـاجـر",
                value: autoMessage ? `${autoMessage}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر تـغـيـيـر شـكـل الـمـتـجـر",
                value: changeShape ? `${changeShape}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر تـغـيـيـر نـوع الـمـتـجـر",
                value: changeTypePrice ? `${changeTypePrice}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر إجـازة الـمـتـجـر",
                value: shopVacation ? `${shopVacation}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر تـعـطـيـل الإرسـال الـتـلـقـائـي",
                value: disableAuto ? `${disableAuto}` : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر تـفـعـيـل الـمـتـجـر",
                value: activateShopPrice
                  ? `${activateShopPrice}`
                  : "غـيـر مـحـدد",
                inline: true,
              },
              {
                name: "سـعـر بـيـع الـمـتـجـر",
                value: sellShopPrice ? `${sellShopPrice}` : "غـيـر مـحـدد",
                inline: true,
              },
            );

          // إرسال الـ Embed
          await i.reply({ embeds: [embed], ephemeral: true });
        }
        break;
case "setup-images":
    {
        const blacklist = (await db.get("blacklist")) || [];
        if (blacklist.includes(i.user.id))
            return i.reply("**أنت في البلاك لست!**");

        if (!i.member.permissions.has("Administrator"))
            return i.reply({ content: "❌ صلاحياتك غير كافية", ephemeral: true });

        await i.deferReply({ ephemeral: true });

        const guildId = _ec.gid(i);
        const isValidUrl = (url) => {
            try { new URL(url); return true; } catch { return false; }
        };

        const imageOptions = [
            { key: `buyshopimage_${guildId}`, link: "buy-shop-image", file: "buy-shop-image-attachment" },
            { key: `buyorderimage_${guildId}`, link: "buy-order-image", file: "buy-order-image-attachment" },
            { key: `buyauctionimage_${guildId}`, link: "buy-auction-image", file: "buy-auction-image-attachment" },
            { key: `buyrolesimage_${guildId}`, link: "buy-roles-image", file: "buy-roles-image-attachment" },
            { key: `rulesImage_${guildId}`, link: "rules-server", file: "rules-server-attachment" },
            { key: `priceRolesImage_${guildId}`, link: "price-roles", file: "price-roles-attachment" },
            { key: `priceShopImage_${guildId}`, link: "price-shop", file: "price-shop-attachment" },
            { key: `priceOrdersImage_${guildId}`, link: "price-orders", file: "price-orders-attachment" },
            { key: `priceAuctionImage_${guildId}`, link: "price-auction", file: "price-auction-attachment" },
            { key: `image_${guildId}`, link: "line", file: "line-attachment" },
        ];

        let uploadedCount = 0;

        for (const opt of imageOptions) {
            const url = i.options.getString(opt.link);
            const attachment = i.options.getAttachment(opt.file);

            try {
                let finalUrl = null;

                if (attachment) {
                    // ✅ رفع المرفق لـ Catbox
                    finalUrl = await uploadImageToHost(attachment.url);
                    uploadedCount++;
                } else if (url && isValidUrl(url)) {
                    // إذا الرابط من Discord (مؤقت)، نرفعه لـ Catbox
                    if (url.includes("discord") || url.includes("discordapp")) {
                        finalUrl = await uploadImageToHost(url);
                        uploadedCount++;
                    } else {
                        finalUrl = url;
                    }
                }

                if (finalUrl) {
                    await db.set(opt.key, finalUrl);
                }
            } catch (err) {
                console.error(`فشل رفع ${opt.key}:`, err.message);
            }
        }

        const embedColor = _ec.color(guildId);
        const linePreview = await db.get(`image_${guildId}`);

        const container = new ContainerBuilder().setAccentColor(embedColor);
        container.addSectionComponents(
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# ✅ تم تحديث صور السيرفر")
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**تم رفع ${uploadedCount} صورة إلى الاستضافة الدائمة وحفظها بنجاح.**`)
        );

        if (linePreview && linePreview.startsWith("http")) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(linePreview))
            );
        }

        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ${i.guild.name} | تم تحديث الصور`)
        );

        await i.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
    break;
    }
  });
  client.on("interactionCreate", async (i) => {
    if (!i.isChatInputCommand()) return;
    if (!i.guild) return;
    const guildId = i.guild.id;
    switch (i.commandName) {
      case "r-mzad":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          const rules = i.options.getString("rules");
          await db.set(`mzad_rules_${guildId}`, rules);
          await i.reply({
            content: `**✅ تـم حـفـظ قـوانـيـن الـمـزاد بـنـجـاح.**`,
            ephemeral: true,
          });
        }
        break;

      case "add-mzad-room":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          const room = i.options.getChannel("room");
          const rooms = (await db.get(`auctionrooms_${guildId}`)) || [];
          if (rooms.includes(room.id)) {
            return i.reply({
              content: `**❌ الـروم ${room} مـوجـود بـالـفـعـل فـي الـقـائـمـة.**`,
              ephemeral: true,
            });
          }
          rooms.push(room.id);
          await db.set(`auctionrooms_${guildId}`, rooms);
          await i.reply({
            content: `**✅ تـم إضـافـة ${room} لـقـائـمـة رومـات الـمـزاد.**\n**الـرومـات الـحـالـيـة: ${rooms.length}**`,
            ephemeral: true,
          });
        }
        break;

      case "remove-mzad-room":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          const room = i.options.getChannel("room");
          let rooms = (await db.get(`auctionrooms_${guildId}`)) || [];
          const idx = rooms.indexOf(room.id);
          if (idx === -1) {
            return i.reply({
              content: `**❌ الـروم ${room} غـيـر مـوجـود فـي الـقـائـمـة.**`,
              ephemeral: true,
            });
          }
          rooms.splice(idx, 1);
          await db.set(`auctionrooms_${guildId}`, rooms);
          await i.reply({
            content: `**✅ تـم حـذف ${room} مـن قـائـمـة رومـات الـمـزاد.**`,
            ephemeral: true,
          });
        }
        break;

      //============ add-rule ============
      //--- كـود add-rule ---
      case "add-rule":
        {
          if (!i.member.permissions.has("Administrator"))
            return i.reply({
              content: "❌ لـيـس لـد يـك صـلاحـيـة!",
              ephemeral: true,
            });

          const label = i.options.getString("label");
          const content = i.options.getString("content");
          const emoji = i.options.getString("emoji");
          const imageUrl = i.options.getString("image_url");
          const imageFile = i.options.getAttachment("image_file");

          let rules = (await db.get(`server_rules_${guildId}`)) || [];
          if (rules.length >= 5)
            return i.reply({
              content: "**❌ الـحـد الأقـصـى 5 قـوانـيـن.**",
              ephemeral: true,
            });

          const finalImage = imageFile ? imageFile.url : imageUrl || null;
          const ruleId = Date.now().toString().slice(-8);

          rules.push({
            id: ruleId,
            label,
            content,
            emoji: emoji || null,
            image: finalImage,
          });
          await db.set(`server_rules_${guildId}`, rules);

          const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> تمت إضافة الزر بنجاح")
            .addFields(
              { name: "الاسـم", value: label, inline: true },
              { name: "الـمـحـتـوى", value: content.slice(0, 500) },
            )
        .setColor(_ec.color(i.guild?.id))
              if (finalImage) embed.setImage(finalImage);

          await i.reply({ embeds: [embed], ephemeral: true });
        }
        break;

      //--- كـود send-rule ---
      case "send-rule":
        {
          if (!i.member.permissions.has("Administrator"))
            return i.reply({
              content: "❌ لـيـس لـد يـك صـلاحـيـة!",
              ephemeral: true,
            });

          const ruleName = i.options.getString("rule_name");
          const targetChannel = i.options.getChannel("channel");

          const rules = (await db.get(`server_rules_${guildId}`)) || [];
          const rule = rules.find((r) => r.label === ruleName);

          if (!rule)
            return i.reply({
              content:
                "❌ **لـم يـتـم الـعـثـور عـلـى قـانـون بـهـذا الاسـم.**",
              ephemeral: true,
            });

          const ruleEmbed = new EmbedBuilder()
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> ${rule.label}`)
            .setDescription(rule.content)
     .setColor(_ec.color(i.guild?.id))
                   .setTimestamp();

          if (rule.image) ruleEmbed.setImage(rule.image);
          else {
            const linePreview = await db.get(`image_${guildId}`);
            if (linePreview) ruleEmbed.setImage(linePreview);
          }

          await targetChannel.send({ embeds: [ruleEmbed] });
          await i.reply({
            content: `✅ تـم إر سـال الـقـانـون إلـى ${targetChannel} بـنـجـاح.`,
            ephemeral: true,
          });
        }
        break;

      //============ remove-rule ============
      case "remove-rule":
        {
          if (!i.member.permissions.has("Administrator"))
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          const rules = (await db.get(`server_rules_${guildId}`)) || [];
          if (rules.length === 0)
            return i.reply({
              content: "**❌ لا تـوجـد قـوانـيـن مـضـافـة.**",
              ephemeral: true,
            });
          const menu = new StringSelectMenuBuilder()
            .setCustomId(`rule_remove_select_${guildId}`)
            .setPlaceholder("اخـتـر الـقـانـون الـذي تـريـد حـذفـه")
            .addOptions(
              rules.map((r) => ({
                label: r.label.slice(0, 100),
                description: r.content.slice(0, 50),
                value: r.id,
              })),
            );
          await i.reply({
            content: "**اخـتـر الـقـانـون:**",
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true,
          });
        }
        break;

      //============ panel-rules ============
  //==============================================================================
// 1. بـانـل الـقـوانـيـن (panel-rules)
//==============================================================================
case "panel-rules": {
    const guildId = i.guild.id;
    const highstaff = await db.get(`highstaff_${guildId}`);

    if (highstaff && !i.member.roles.cache.has(highstaff)) {
        return i.reply({ content: `**❌ تـحـتـاج رتـبـة <@&${highstaff}>.**`, ephemeral: true });
    }

    const rules = (await db.get(`server_rules_${guildId}`)) || [];
    if (rules.length === 0) {
        return i.reply({ content: "**❌ لـم تـضـف أي قـوانـيـن بـعـد. اسـتـخـدم `/add-rule`.**", ephemeral: true });
    }

    const text = i.options.getString("embed-text");
    const serverColor = _ec.color(guildId);
    const rulesImage = await db.get(`rulesImage_${guildId}`);
    const linePreview = await db.get(`image_${guildId}`);

    const btnRow = new ActionRowBuilder().addComponents(
        rules.map((r) => {
            const btn = new ButtonBuilder()
                .setCustomId(`rule_show_${guildId}_${r.id}`)
                .setLabel(r.label.slice(0, 80))
                .setStyle(ButtonStyle.Secondary);
            if (r.emoji) try { btn.setEmoji(r.emoji); } catch { btn.setEmoji(emojis.rules); }
            else btn.setEmoji(emojis.rules);
            return btn;
        })
    );

    const rulesEmbed = new EmbedBuilder()
        .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> قـوانـيـن سـيـرفـر ${i.guild.name}`)
        .setDescription(text || `مـرحـبـاً بـكـم فـي قـوانـيـن **${i.guild.name}**\nاضـغـط عـلـى أي زر لـعـرض الـقـانـون بـتـفـاصـيـلـه.`)
        .setColor(serverColor)
        .setTimestamp();

    // صـورة الـقـوانـيـن أو الـخـط
    if (rulesImage) rulesEmbed.setImage(rulesImage);
    else if (linePreview) rulesEmbed.setImage(linePreview);

    await i.channel.send({ embeds: [rulesEmbed], components: [btnRow] });
    await i.reply({ content: "**✅ تـم إر سـال بـانـل الـقـوانـيـن.**", ephemeral: true });
} break;

//==============================================================================
// 2. بـانـل الـتـكـتـات (panel-tickets) - يـسـحـب الـبـنـر تـلـقـائـيـاً
//==============================================================================
case "panel-tickets": {
    const guildId = i.guild.id;
    const highstaff = await db.get(`highstaff_${guildId}`);

    if (highstaff && !i.member.roles.cache.has(highstaff)) {
        return i.reply({ content: `**❌ تـحـتـاج رتـبـة <@&${highstaff}>.**`, ephemeral: true });
    }

    const text = i.options.getString("embed-text");
    const serverColor = _ec.color(guildId);
    
    // جـلـب بـنـر الـسـيـرفـر تـلـقـائـيـاً
    const serverBanner = i.guild.bannerURL({ size: 1024, extension: 'png' });
    const linePreview = await db.get(`image_${guildId}`);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy_shop").setLabel("شـراء مـتـجـر").setStyle(ButtonStyle.Secondary).setEmoji(emojis.shop),
        new ButtonBuilder().setCustomId("ticket-auction").setLabel("تـكـت مـزاد").setStyle(ButtonStyle.Secondary).setEmoji(emojis.auction),
        new ButtonBuilder().setCustomId("ticket-order").setLabel("تـكـت طـلـبـات").setStyle(ButtonStyle.Secondary).setEmoji(emojis.order),
        new ButtonBuilder().setCustomId("ticket-roles").setLabel("شـراء رتـبـة").setStyle(ButtonStyle.Secondary).setEmoji(emojis.roles),
    );

    const ticketsEmbed = new EmbedBuilder()
        .setTitle(`<a:ggeg1_944745994256438:1541881273658773504> قـسـم الـتـكـتـات والـمـبـيـعـات`)
        .setDescription(text || `**أهـلاً بـك فـي قـسـم الـتـكـتـات لـسـيـرفـر __${i.guild.name}__**\n\n# - هـنـا يـمـكـنـك الـحـصـول عـلـى:\nـ مـتـاجـر مـتـنـوعـة\nـ مـزادات حـصـر يـة\nـ طـلـبـات مـخـصـصـة\nـ رتـب مـمـيـزة`)
        .setAuthor({ name: i.guild.name, iconURL: i.guild.iconURL({ size: 1024 }) })
        .setColor(serverColor)
        .setTimestamp();

    // وضـع الـبـنـر كـصـورة أسـاسـيـة، وإذا مـا فـي بـنـر يـحـط الـخـط
    if (serverBanner) {
        ticketsEmbed.setImage(serverBanner);
    } else if (linePreview) {
        ticketsEmbed.setImage(linePreview);
    }

    await i.channel.send({ embeds: [ticketsEmbed], components: [row] });
    await i.reply({ content: "**✅ تـم إر سـال بـانـل الـتـكـتـات بـنـجـاح.**", ephemeral: true });
} break;

      //============ all-for-panel ============
case "all-for-panel":
    {
      const guildId = i.guild.id;
      const highstaff = await db.get(`highstaff_${guildId}`);
      
      if (highstaff && !i.member.roles.cache.has(highstaff)) {
        return i.reply({
          content: `**❌ تـحـتـاج رتـبـة <@&${highstaff}> لـتـنـفـيـذ هـذا الأمـر.**`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await i.deferReply({ flags: MessageFlags.Ephemeral });

      const linePreview = await db.get(`image_${guildId}`); // صـورة الـخـط الـعـامـة
      const serverBanner = i.guild.bannerURL({ size: 1024, extension: 'png' }); // جـلـب بـنـر الـسـيـرفـر
      const customText = i.options.getString("text");

      const allInOneEmbed = new EmbedBuilder()
        .setAuthor({
          name: i.guild.name,
          iconURL: i.guild.iconURL({ size: 1024 }),
        })
        .setTitle(`<a:ggeg1_944745994256438:1541881273658773504>  الـبـانـل الـشـامـل لـسـيـرفـر ${i.guild.name} `)
        .setDescription(ED.commandsD_022({ customText }))
        .setColor(_ec.color(guildId))
        .setTimestamp();

      // وضـع الـبـنـر كـصـورة أسـاسـيـة، وإذا مـا فـي بـنـر يـحـط الـخـط الـتـلـقـائـي
      if (serverBanner) {
          allInOneEmbed.setImage(serverBanner);
      } else if (linePreview) {
          allInOneEmbed.setImage(linePreview);
      }

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`allinone_prices_${guildId}`)
          .setLabel("الأسـعـار")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis.prices),
        new ButtonBuilder()
          .setCustomId(`allinone_rules_${guildId}`)
          .setLabel("الـقـوانـيـن")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis.rules),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`allinone_tickets_${guildId}`)
          .setLabel("الـتـكـتـات")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis.tickets),
        new ButtonBuilder()
          .setCustomId(`allinone_roles_${guildId}`)
          .setLabel("الـرّتـب")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis.roles),
      );

      await i.channel.send({ embeds: [allInOneEmbed], components: [row1, row2] });
      await i.editReply({ content: "**✅ تـم إر سـال الـبـانـل الـشـامـل بـنـجـاح.**" });
    }
    break;

      //============ نقاطي ============
      case "نقاطي":
        {
          const myPts =
            (await db.get(`ticket_pts_${i.user.id}_${guildId}`)) || 0;
          const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> نـقـاطـك فـي الـتـكـتـات")
            .setDescription(ED.commandsD_023({ i, myPts }))
            .setColor(_ec.color(i.guild?.id))
            .setThumbnail(i.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: `${i.guild.name} | نـظـام الـنـقـاط` })
            .setTimestamp();
          await i.reply({ embeds: [embed] });
        }
        break;

      //============ توب-نقاط ============
      case "توب-نقاط":
        {
          await i.deferReply();
          const allData = await db.all();
          const suffix = `_${guildId}`;
          const prefix = "ticket_pts_";
          const entries = allData
            .filter((e) => e.ID.startsWith(prefix) && e.ID.endsWith(suffix))
            .map((e) => ({
              userId: e.ID.replace(prefix, "").replace(suffix, ""),
              pts: e.value || 0,
            }))
            .filter((e) => e.pts > 0)
            .sort((a, b) => b.pts - a.pts)
            .slice(0, 10);

          if (!entries.length)
            return i.editReply({
              content: "**❌ لا تـوجـد نـقـاط مـسـجـلـة بـعـد.**",
            });

          const medals = ["🥇", "🥈", "🥉"];
          const rows = await Promise.all(
            entries.map(async (e, idx) => {
              const member = await i.guild.members
                .fetch(e.userId)
                .catch(() => null);
              const name = member ? member.displayName : `<@${e.userId}>`;
              return `${medals[idx] || `**${idx + 1}.**`} ${name} — **${e.pts}** نـقـطـة`;
            }),
          );

          const embed = new EmbedBuilder()
            .setTitle("<a:ggeg1_944745994256438:1541881273658773504> أعـلـى الـمـسـؤولـيـن نـقـاطـاً")
            .setDescription(ED.commandsD_024({ rows }))
            .setColor(_ec.color(i.guild?.id))
            .setFooter({ text: `${i.guild.name} | نـظـام الـنـقـاط` })
            .setTimestamp();
          await i.editReply({ embeds: [embed] });
        }
        break;

      //============ panel-support ============
  
            case "panel-support":
    {
        const guildId = i.guild.id;
        const highstaff = await db.get(`highstaff_${guildId}`);
        
        if (highstaff && !i.member.roles.cache.has(highstaff)) {
            return i.reply({
                content: `**❌ تـحـتـاج رتـبـة <@&${highstaff}> لـتـنـفـيـذ هـذا الأمـر.**`,
                ephemeral: true,
            });
        }

        const text = i.options.getString("embed-text");
        const linePreview = await db.get(`image_${guildId}`); // صـورة الـخـط لـلإحـتـيـاط
        const serverBanner = i.guild.bannerURL({ size: 1024, extension: 'png' }); // جـلـب بـنـر الـسـيـرفـر
        const serverColor = _ec.color(guildId); // لـون الـسـيـرفـر الـتـلـقـائـي

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket-support")
                .setLabel("الـدعـم الـفـنـي")
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojis.support),
            new ButtonBuilder()
                .setCustomId("ticket-scam")
                .setLabel("الـتـشـهـيـر والـبـلاغـات")
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.scam),
        );

        const supportEmbed = new EmbedBuilder()
            .setAuthor({
                name: i.guild.name,
                iconURL: i.guild.iconURL({ size: 1024 }),
            })
            .setTitle(`<a:ggeg1_944745994256438:1541881273658773504>  قـسـم الـدعـم والـمـسـاعـدة `)
            .setDescription(ED.commandsD_025({ text }) || `**أهـلاً بـك فـي مـركـز الـدعـم لـسـيـرفـر ${i.guild.name}**\n\n# - يـمـكـنـك فـتـح تـذكـرة لـ:\nـ طـلـب مـسـاعـدة فـنـيـة\nـ الإبـلاغ عـن حـالات الـتـلاحـب والـتـشـهـيـر`)
            .setColor(serverColor)
            .setThumbnail(i.guild.iconURL({ size: 256 }))
            .setFooter({ text: `${i.guild.name} | نـظـام الـدعـم الـمـتـكـامـل` })
            .setTimestamp();

        // وضـع الـبـنـر كـصـورة أسـاسـيـة، وإذا لـم يـوجـد بـنـر يـوضـع الـخـط
        if (serverBanner) {
            supportEmbed.setImage(serverBanner);
        } else if (linePreview) {
            supportEmbed.setImage(linePreview);
        }

        await i.channel.send({ embeds: [supportEmbed], components: [row] });
        await i.reply({
            content: "**✅ تـم إر سـال بـانـل الـدعـم بـنـجـاح.**",
            ephemeral: true,
        });
    }
    break;

    case "set-auction-msg":
      {
        if (!i.member.permissions.has("Administrator")) {
          return i.reply({
            content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
            ephemeral: true,
          });
        }
        const template = i.options.getString("template");
        await db.set(`auction_msg_template_${guildId}`, template);
        await i.reply({
          content: `**✅ تـم تـعـيـن قـالـب رسـالـة الـمـزاد.**\n\n**القالب الحالي:**\n\`\`\`\n${template}\n\`\`\`\n\n**المتغيرات المتاحة:**\n\`{mention}\` = المنشن\n\`{item}\` = اسم السلعة\n\`{price}\` = السعر الابتدائي\n\`{tax}\` = الضريبة\n\`{owner}\` = صاحب المزاد\n\`{time}\` = الوقت المتبقي`,
          ephemeral: true,
        });
      }
      break;

    case "reset-auction-msg":
      {
        if (!i.member.permissions.has("Administrator")) {
          return i.reply({
            content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
            ephemeral: true,
          });
        }
        await db.delete(`auction_msg_template_${guildId}`);
        await i.reply({
          content: "**✅ تـم إعـاده تـعـيـن قـالـب رسـالـة الـمـزاد إلـى الافتراضي.**",
          ephemeral: true,
        });
      }
      break;

      case "refresh-embeds":
        {
          if (!i.member.permissions.has("Administrator")) {
            return i.reply({
              content: "❌ يـجـب أن تـكـون لـديـك صـلاحـيـة **Administrator**!",
              ephemeral: true,
            });
          }
          await i.reply({
            content: "**⏳ جارٍ تحديث الإيمبدات... يرجى الانتظار.",
            ephemeral: true,
          });

          // جلب جميع الإيموجي الصالحة في السيرفر
          const validEmojiIds = new Set();
          const guildEmojis = await i.guild.emojis.fetch();
          for (const [, emoji] of guildEmojis) {
            validEmojiIds.add(emoji.id);
          }

          // خريطة الاستبدال: الإيموجي القديمة (المكسورة) → الجديدة (من emojis.js)
          const emojis = require("./emojis");
          const replacements = [
            { old: "1541881273658773504", newEmoji: emojis.shop },
            { old: "1463819348357638165", newEmoji: emojis.shop },
            { old: "1281941107808628758", newEmoji: emojis.shop },
          ];

          // دالة لاستخراج جميع الإيموجي من نص
          function extractEmojis(text) {
            if (!text) return [];
            const regex = /<(a|std):([^:]+):(\d+)>/g;
            const found = [];
            let match;
            while ((match = regex.exec(text)) !== null) {
              found.push({
                full: match[0],
                animated: match[1] === "a",
                name: match[2],
                id: match[3],
              });
            }
            return found;
          }

          // دالة لاستبدال الإيموجي المكسورة
          function replaceBrokenEmojis(text) {
            if (!text) return { text, count: 0 };
            let result = text;
            let count = 0;
            const emojisFound = extractEmojis(text);

            for (const em of emojisFound) {
              if (!validEmojiIds.has(em.id)) {
                // البحث عن بديل
                const repl = replacements.find((r) => r.old === em.id);
                if (repl && repl.newEmoji) {
                  result = result.split(em.full).join(repl.newEmoji);
                  count++;
                } else {
                  // ما في بديل - نحذف الإيموجي المكسورة
                  result = result.split(em.full).join("");
                  count++;
                }
              }
            }
            return { text: result.replace(/  +/g, " ").trim(), count };
          }

          let totalReplaced = 0;
          let updatedMessages = 0;
          let scannedMessages = 0;
          let scannedChannels = 0;
          const errors = [];

          const textChannels = i.guild.channels.cache.filter(
            (ch) => ch.isTextBased() && !ch.isVoiceBased(),
          );

          for (const [, channel] of textChannels) {
            scannedChannels++;
            try {
              let lastId;
              let keepGoing = true;
              while (keepGoing) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;
                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) break;

                for (const [, msg] of messages) {
                  scannedMessages++;
                  if (msg.author.id !== i.client.user.id) continue;

                  let msgReplaced = 0;
                  let needsEdit = false;

                  // فحص المحتوى
                  const contentResult = replaceBrokenEmojis(msg.content);
                  let newContent = msg.content;
                  if (contentResult.count > 0) {
                    newContent = contentResult.text;
                    msgReplaced += contentResult.count;
                    needsEdit = true;
                  }

                  // فحص الإيمبدات
                  let newEmbeds = [];
                  for (const embed of msg.embeds) {
                    let embedChanged = false;
                    const eb = { ...embed.data };

                    if (eb.title) {
                      const r = replaceBrokenEmojis(eb.title);
                      if (r.count > 0) {
                        eb.title = r.text;
                        msgReplaced += r.count;
                        embedChanged = true;
                      }
                    }
                    if (eb.description) {
                      const r = replaceBrokenEmojis(eb.description);
                      if (r.count > 0) {
                        eb.description = r.text;
                        msgReplaced += r.count;
                        embedChanged = true;
                      }
                    }
                    if (eb.fields) {
                      for (const f of eb.fields) {
                        if (f.value) {
                          const r = replaceBrokenEmojis(f.value);
                          if (r.count > 0) {
                            f.value = r.text;
                            msgReplaced += r.count;
                            embedChanged = true;
                          }
                        }
                      }
                    }

                    if (embedChanged) {
                      newEmbeds.push(eb);
                      needsEdit = true;
                    } else {
                      newEmbeds.push(embed.data);
                    }
                  }

                  if (needsEdit) {
                    try {
                      await msg.edit({
                        content: newContent || undefined,
                        embeds: newEmbeds.length > 0 ? newEmbeds : undefined,
                      });
                      totalReplaced += msgReplaced;
                      updatedMessages++;
                      await new Promise((r) => setTimeout(r, 500));
                    } catch (e) {
                      errors.push(`${channel.name}: ${e.message}`);
                    }
                  }

                  lastId = msg.id;
                }
                if (messages.size < 100) keepGoing = false;
              }
            } catch (e) {
              errors.push(`${channel.name}: ${e.message}`);
            }
          }

          // الإحصائيات
          const stats = [
            `**✅ تم تحديث الإيمبدات بنجاح!**`,
            ``,
            `📊 **الإحصائيات:**`,
            `• القنوات المفحوصة: \`${scannedChannels}\``,
            `• الرسائل المفحوصة: \`${scannedMessages}\``,
            `• الرسائل المعدّلة: \`${updatedMessages}\``,
            `• الإيموجي المستبدلة: \`${totalReplaced}\``,
          ];

          if (errors.length > 0) {
            stats.push(`\n⚠️ أخطاء (${errors.length}):`);
            errors.slice(0, 5).forEach((e) => stats.push(`• ${e}`));
          }

          await i.editReply({ content: stats.join("\n") });
        }
        break;

    }
  });
};
