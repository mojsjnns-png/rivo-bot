const PAYMENT_BOT_ID = "1535048804078977164";

const AR_QAM_BTAHWIL = String.fromCharCode(1602, 1575, 1605, 32, 1576, 1578, 1581, 1608, 1610, 1604);
const AR_TAM_TAHWIL = String.fromCharCode(1578, 1605, 32, 1578, 1581, 1608, 1610, 1604);
const AR_BTAHWIL = String.fromCharCode(1576, 1578, 1581, 1608, 1610, 1604);

async function verifyPayment({ channel, userId, requiredAmount, bankId, timeout = 120000 }) {
    return new Promise((resolve) => {
        const filter = (m) => {
            if (m.author.id !== PAYMENT_BOT_ID) return false;

            const content = m.content;
            console.log("[verifyPayment] Message from bot: " + content.substring(0, 200));

            const bankMentionOk = content.includes("<@!" + bankId + ">") || content.includes("<@" + bankId + ">");
            if (!bankMentionOk) {
                console.log("[verifyPayment] Bank mention not found. Looking for: " + bankId);
                return false;
            }

            const isTransfer = content.includes("has transferred") || content.includes(AR_QAM_BTAHWIL) || content.includes(AR_TAM_TAHWIL);
            if (!isTransfer) {
                console.log("[verifyPayment] Transfer keyword not found");
                return false;
            }

            let paidAmount = 0;
            const backtickMatch = content.match(/`[\$]?([\d,]+(?:\.\d+)?)\$?`/);
            if (backtickMatch) paidAmount = Number(backtickMatch[1].replace(/,/g, ""));

            if (!paidAmount) {
                const engMatch = content.match(/transferred\s+[\$]?([\d,]+)/i);
                if (engMatch) paidAmount = Number(engMatch[1].replace(/,/g, ""));
            }

            if (!paidAmount) {
                const arMatch = content.match(new RegExp(AR_BTAHWIL + "\\s+[\\$]?([\\d,]+)"));
                if (arMatch) paidAmount = Number(arMatch[1].replace(/,/g, ""));
            }

            if (!paidAmount) {
                const anyNumber = content.match(/`[\$]?([\d,]+)\$?`/);
                if (anyNumber) paidAmount = Number(anyNumber[1].replace(/,/g, ""));
            }

            if (!paidAmount) {
                const largeNumber = content.match(/([\d,]{4,})/);
                if (largeNumber) paidAmount = Number(largeNumber[1].replace(/,/g, ""));
            }

            console.log("[verifyPayment] paidAmount=" + paidAmount + ", requiredAmount=" + requiredAmount + ", match=" + (paidAmount >= requiredAmount));

            return paidAmount >= requiredAmount;
        };

        const collector = channel.createMessageCollector({
            filter,
            time: timeout,
        });

        collector.on("collect", (m) => {
            console.log("[verifyPayment] Payment collected: " + m.content.substring(0, 100));
            collector.stop("SUCCESS");
        });

        collector.on("end", (_collected, reason) => {
            console.log("[verifyPayment] Collector ended: reason=" + reason);
            if (reason === "SUCCESS") {
                resolve({ success: true, reason: "SUCCESS" });
            } else {
                resolve({ success: false, reason: "TIMEOUT" });
            }
        });
    });
}

module.exports = { verifyPayment };
