const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const emojis = require("./emojis");

const PAYMENT_BOT_ID = "1535048804078977164";

const AR_QAM_BTAHWIL = String.fromCharCode(1602, 1575, 1605, 32, 1576, 1578, 1581, 1608, 1610, 1604);
const AR_TAM_TAHWIL = String.fromCharCode(1578, 1605, 32, 1578, 1581, 1608, 1610, 1604);
const AR_BTAHWIL = String.fromCharCode(1576, 1578, 1581, 1608, 1610, 1604);

const AR_TRANSFER_DETECTED = String.fromCharCode(1578, 1605, 32, 1603, 1588, 1601, 32, 1578, 1604, 1602, 1575, 1569);
const AR_AMOUNT = String.fromCharCode(1575, 1604, 1605, 1576, 1604, 1594);
const AR_TO = String.fromCharCode(1573, 1604, 1610);
const AR_CHANNEL = String.fromCharCode(1575, 1604, 1585, 1608, 1605);
const AR_SHOP = String.fromCharCode(1605, 1578, 1580, 1585);
const AR_AUCTION = String.fromCharCode(1605, 1586, 1575, 1583);
const AR_ORDER = String.fromCharCode(1591, 1604, 1576);
const AR_UNKNOWN = String.fromCharCode(1605, 1594, 1585, 1601);

module.exports = function autoSellSystem(client, db, config) {

    console.log("[AutoSell] Module loaded, PAYMENT_BOT_ID=" + PAYMENT_BOT_ID);

    client.on("messageCreate", async (message) => {
        if (!message.guild) return;
        if (message.author.id !== PAYMENT_BOT_ID) return;

        const content = message.content;
        const guildId = message.guild.id;

        const isTransfer = content.includes("has transferred") || content.includes(AR_QAM_BTAHWIL) || content.includes(AR_TAM_TAHWIL);
        if (!isTransfer) return;

        const bank = await db.get("bank_" + guildId);
        if (!bank) return;

        const bankMentionOk = content.includes("<@!" + bank + ">") || content.includes("<@" + bank + ">");
        if (!bankMentionOk) return;

        let paidAmount = 0;
        const backtickMatch = content.match(/`[\$]?([\d,]+(?:\.\d+)?)\$?`/);
        if (backtickMatch) paidAmount = Number(backtickMatch[1].replace(/,/g, ""));
        if (!paidAmount) {
            const anyNumber = content.match(/`[\$]?([\d,]+)\$?`/);
            if (anyNumber) paidAmount = Number(anyNumber[1].replace(/,/g, ""));
        }
        if (!paidAmount) {
            const largeNumber = content.match(/([\d,]{4,})/);
            if (largeNumber) paidAmount = Number(largeNumber[1].replace(/,/g, ""));
        }

        if (paidAmount <= 0) return;

        const channelName = message.channel.name.toLowerCase();
        let typeText = AR_UNKNOWN;
        if (channelName.includes("shop")) typeText = AR_SHOP;
        else if (channelName.includes("auction") || channelName.includes("mzad")) typeText = AR_AUCTION;
        else if (channelName.includes("order")) typeText = AR_ORDER;

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("\u{2705} " + AR_TRANSFER_DETECTED)
            .setDescription(
                "**" + AR_AMOUNT + ":** " + paidAmount.toLocaleString() + "$\n" +
                "**" + AR_CHANNEL + ":** <#" + message.channel.id + ">\n" +
                "**" + String.fromCharCode(1575, 1604, 1606, 1608, 1593) + ":** " + typeText
            )
            .setTimestamp();

        await message.channel.send({ embeds: [embed] }).catch(() => {});

        console.log("[AutoSell] Transfer detected: " + paidAmount + "$ in #" + message.channel.name + " (type: " + typeText + ")");
    });
};
