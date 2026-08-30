// Auto-generated centralized embed .setDescription() texts.
// Each function takes an object with the variables it needs and returns the description string.
// To edit a description, find its key (e.g. shopInteractions_007) and modify the function body.

module.exports = {
    // handlers/modules/exchangeSystem.js:232
    exchangeSystem_001: ({ cfg, isPaid, scheduleLabel, userPosts }) => {
        return (
            `** إحصائياتك:**\n` +
            `• منشوراتك: \`${userPosts.length}/${cfg.userLimit}\`\n` +
            `• السعر للمنشور: ${isPaid ? `\`${cfg.price.toLocaleString()}\`` : "`مجاني`"}\n` +
            `• وقت النشر: \`${scheduleLabel(cfg.schedule)}\`\n` +
            `• الحالة: ${cfg.enabled ? "<a:emoji_83:1542937629560152064> مفعّل" : "<a:emoji_82:1542937626569482260> معطّل"}\n\n` +
            `**<a:emoji_14:1542937623763484754> قنوات النشر:** ${cfg.rooms.length ? cfg.rooms.map((id) => `<#${id}>`).join(" ") : " لم تُحدَّد"}`
        );
    },
    // handlers/modules/exchangeSystem.js:259
    exchangeSystem_002: ({ cfg, scheduleLabel }) => {
        return (
            `**الحالة:** ${cfg.enabled ? "<a:emoji_83:1542937629560152064> مفعّل" : "<a:emoji_82:1542937626569482260> معطّل"}\n` +
            `**النوع:** ${cfg.price > 0 ? `<a:mg_money1:1542937635717259325> مدفوع (${cfg.price.toLocaleString()})` : "<:RenFriends:1542952365676695663> مجاني"}\n\n` +
            `<a:brown5:1542937546185773086> •  الرتب المسموحة: ${cfg.allowedRoles.length === 0 ? "`الكل`" : cfg.allowedRoles.map((r) => `<@&${r}>`).join(" ")}\n` +
            `<a:orx_star_light:1542937640758804602> •  قنوات النشر (${cfg.rooms.length}): ${cfg.rooms.map((r) => `<#${r}>`).join(" ") || "—"}\n` +
            `• <a:RAW_109:1542937643447226488> وقت النشر: \`${scheduleLabel(cfg.schedule)}\`\n` +
            `<a:011_1367454588252454943:1542937524274470974> • الحد للشخص: \`${cfg.userLimit}\`\n` +
            `<a:011_1367454588252454943:1542937524274470974> •  إجمالي مرات النشر: \`${cfg.totalPublished || 0}\`\n` +
            (cfg.price > 0
                ? `\n**إعدادات الدفع:**\n` +
                  `<a:77:1542937530071253215> •  روم التحويل: ${cfg.transferRoom ? `<#${cfg.transferRoom}>` : "❌"}\n` +
                  `<a:77:1542937530071253215> •  البنك: ${cfg.bankId ? `<@${cfg.bankId}>` : "❌"}\n` +
                  `<a:77:1542937530071253215> •  روم اللوق: ${cfg.logRoom ? `<#${cfg.logRoom}>` : "❌"}\n`
                : "")
        );
    },
    // handlers/modules/exchangeSystem.js:302
    exchangeSystem_003: ({ cfg, isPaid, scheduleLabel }) => {
        return (
            `اضـغـط عـلـى زر **"نـشـر تـلـقـائـي"** بـالأدنى لـتـنـظـيـم مـنـشـوراتـك فـي نـظـام الـتـبـادل.\n\n` +
            `<a:77:1542937530071253215> •  الـحـد الأقـصـى لـلـشـخـص: \`${cfg.userLimit}\` مـنـشـور\n` +
            `<a:77:1542937530071253215> •  الـسـعـر لـلـمـنـشـور: ${isPaid ? `\`${cfg.price.toLocaleString()}\`` : "`مـجـانـي`"}\n` +
            `<a:77:1542937530071253215> • وقـت الـنـشـر الـتـلـقـائـي: \`${scheduleLabel(cfg.schedule)}\`\n` +
            (cfg.allowedRoles.length
                ? `<a:77:1542937530071253215> •  الـرتـب الـمـسـمـوحـة: ${cfg.allowedRoles.map((r) => `<@&${r}>`).join(" ")}\n`
                : "") +
            `\n**مـمـنـوع:** الـروابـط الـخـارجـيـة، أرقـام الـتـواصـل، الـمـنـشـنـات.`
        );
    },

    // handlers/modules/exchangeSystem.js:727
    exchangeSystem_004: ({ pend, userId }) => {
        return `<@${userId}> | الـمـبـلـغ: **${pend.tax.toLocaleString()}**`;
    },
    // handlers/modules/earlyInteractions.js:139
    earlyInteractions_001: () => {
        return "لـقـد تـم اخـفـاء الـمـتـجـر بـسـبـب تـجـاوز الـحـد الـمـسـمـوح لـلـتـحـذيـرات.";
    },
    // handlers/modules/earlyInteractions.js:204
    earlyInteractions_002: () => {
        return "تـم اعـادة فـتـح مـتـجـرك بـعـد انـخـفـاض عـدد الـتـحـذيـرات.";
    },
    // handlers/modules/earlyInteractions.js:235
    earlyInteractions_003: () => {
        return "<a:emoji_82:1542937626569482260> **لـيـس لـد يـك صـلاحـيـة لاسـتـخـدام هـذا الأمـر.**";
    },
    // handlers/modules/earlyInteractions.js:244
    earlyInteractions_004: () => {
        return "<a:emoji_82:1542937626569482260> **يـجـب تـحـديـد عـضـو لإرسـال الـرّسـالـة.**";
    },
    // handlers/modules/earlyInteractions.js:250
    earlyInteractions_005: () => {
        return "<a:emoji_82:1542937626569482260> **لا يـمـكـنـك اسـتـخـدام الأمـر عـلـى الـبـوتـات.**";
    },
    // handlers/modules/earlyInteractions.js:256
    earlyInteractions_006: ({ message, msg }) => {
        return `**<a:orx_star_light:1542937640758804602> - رسـالـة: ${msg || "لا يـوجـد سـبـب"}\n<a:opn_Mouse:1542937638007476386> - الـقـنـاة: ${message.channel}**`;
    },
    // handlers/modules/earlyInteractions.js:267
    earlyInteractions_007: () => {
        return "✅ **تـم اسـتـدعـاء الـعـضـو بـنـجـاح**";
    },
    // handlers/modules/earlyInteractions.js:271
    earlyInteractions_008: () => {
        return "<a:emoji_82:1542937626569482260> **تـعـذر إرسـال الـرّسـالـة. قـد يـكـون الـعـضـو مـغـلـقـاً لـلـرّسـائـل الـخـاصـة.**";
    },
    // handlers/modules/earlyInteractions.js:338
    earlyInteractions_009: ({ owner }) => {
        return `عـفـواً يـجـب أن تـكـون صـاحـب الـمـتـجـر أو شـريـك فـيـه لاسـتـخـدام هـذه الأزرار\nصـاحـب الـمـتـجـر الـحـالـي: <@${owner || "غـيـر مـعـروف"}>`;
    },

    earlyInteractions_010: ({ config }) => {
        return `
     <a:orx_star_light:1542937640758804602> \`-\` يــرجــى اخــتيــار الخــدمة عن طــريق الأزرار بالأسفل 
        > <a:orx_star_light:1542937640758804602> \`-\` جــميع الخــدمــات تلقــائية 
        > <a:orx_star_light:1542937640758804602> \`-\` كــن حــذراً عند اختــيار الخــدمة 
        > <a:orx_star_light:1542937640758804602> \`-\` أي عمــلية تحــويل داخــل المتــجر 
        > <a:orx_star_light:1542937640758804602> \`-\` كــل عمــلية تحــويل لها وقــت محدد 
        > <a:orx_star_light:1542937640758804602> \`-\` يــجب عليك التــحويل بــعد رســالة البــوت 
        > <a:orx_star_light:1542937640758804602> \`-\` لتــجنب حدــوث مشاكل يــرجى اتــباع تعلــيمات البــوت`;
    },
    // handlers/modules/earlyInteractions.js:443

    earlyInteractions_011: ({ data }) => {
        return `عـفـواً يـجـب أن تـكـون صـاحـب الـمـتـجـر لاسـتـخـدام هـذه الأزرار\nصـاحـب الـمـتـجـر الـحـالـي: <@${data.sellerId || "غـيـر مـعـروف"}>`;
    },
    // handlers/modules/earlyInteractions.js:449
    earlyInteractions_012: () => {
        return `هـل انـت مـتـاكـد مـن انـك تـريـد حـذف مـتـجـرك؟`;
    },
    // handlers/modules/earlyInteractions.js:488
    earlyInteractions_013: ({ data }) => {
        return `عـفـواً يـجـب أن تـكـون صـاحـب الـمـتـجـر لاسـتـخـدام هـذه الأزرار\nصـاحـب الـمـتـجـر الـحـالـي: <@${data.sellerId || "غـيـر مـعـروف"}>`;
    },
    // handlers/modules/earlyInteractions.js:497
    earlyInteractions_014: ({ interaction }) => {
        return `تـم حـذف مـتـجـرك ${interaction.channel.name}`;
    },
    // handlers/modules/earlyInteractions.js:509
    earlyInteractions_015: ({ interaction }) => {
        return `تـم حـذف الـمـتـجـر ${interaction.channel.name}`;
    },

    earlyInteractions_016: ({
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
    }) => {
        return `**
        > ${config.wahitsprkle}  \﹣\ صـاحـب المـتـجـر : <@${sellerId}>
        > 
        > ${config.wahitsprkle}  \﹣\ نـوع المـتـجر : ${nametype || "لم يتم العثور عليه"}
        > 
        > ${config.wahitsprkle}  \﹣\ رتبة هاذا النوع قوقو : <@&${shoprole || "لم يتم العثور عليه"}> 
        > 
        > ${config.wahitsprkle}  \﹣\ تم انـشـائـة منذ : <t:${parseInt(Date.now() / 1000)}:R>
        > 
        > ${config.wahitsprkle}  \﹣\ اقصى عدد للتحذيرات : ${maxWarns || "غير محدد"}
        > 
        > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${hasTax === true ? "نعم" : hasTax === false ? "لا" : "غير محدد"}
        > 
        ${config.yelloshop} \-\ __ @everyone : ${everyoneMentions} __
        ${config.whaitshop} \-\ __ @here : ${hereMentions} __
        ${config.shopemoji} \-\ __ <@&${shopmen}> : ${shopRoleMentions} __
        **`;
    },
    // handlers/modules/earlyInteractions.js:917
    earlyInteractions_017: ({ data }) => {
        return `عـفـواً يـجـب أن تـكـون صـاحـب الـمـتـجـر لاسـتـخـدام هـذه الأزرار\nصـاحـب الـمـتـجـر الـحـالـي: <@${data.sellerId || "غير معروف"}>`;
    },
    // handlers/modules/earlyInteractions.js:1070
    earlyInteractions_018: ({ data }) => {
        return `عـفـواً يـجـب أن تـكـون صـاحـب الـمـتـجـر لاسـتـخـدام هـذه الأزرار\nصـاحـب الـمـتـجـر الـحـالـي: <@${data.sellerId || "غير معروف"}>`;
    },
    // handlers/modules/earlyInteractions.js:1098
    earlyInteractions_019: ({ data }) => {
        return `You are not the owner of the shop. the owner is <@${data.sellerId || "Not found in the database"}>`;
    },
    // handlers/modules/earlyInteractions.js:1132
    earlyInteractions_020: ({ partner }) => {
        return `<@${partner}> هـو شـريـك فـي الـمـتـجـر بـلـفـعـل`;
    },
    // handlers/modules/earlyInteractions.js:1143
    earlyInteractions_021: ({ partner }) => {
        return `** عـزيـزي الـبـائـع لـقـد طـلـبـت ب إضـافـة هـذا الـشـريـك\nالـشـريـك : <@${partner}>**`;
    },
    // handlers/modules/earlyInteractions.js:1192
    earlyInteractions_022: ({ data }) => {
        return `عـفـواً يـجـب أن تـكـون صـاحـب الـمـتـجـر لاسـتـخـدام هـذه الأزرار\nصـاحـب الـمـتـجـر الـحـالـي: <@${data.sellerId || "غير معروف"}>`;
    },
    // handlers/modules/earlyInteractions.js:1197
    earlyInteractions_023: ({ parttax, price, transfer }) => {
        return `لـقـد اخـتـرت اضـافـه شـريـك\nالـسـعـر : \`${parttax}\`
                \`\`\`Re <@!${transfer}> ${parttax}\`\`\`
                الـسـعـر الاصـلـي ${price}`;
    },
    // handlers/modules/earlyInteractions.js:1278
    earlyInteractions_024: ({ partner }) => {
        return `تـم اضـافـه شـريـك بـنـجـاح\nالـشـريـك : <@${partner}>`;
    },
    // handlers/modules/earlyInteractions.js:1287
    earlyInteractions_025: ({
        config,
        guildName,
        i,
        partner,
        parttax,
        result,
        transfer,
    }) => {
        return `
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                 **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**

                **الـتـفـاصـيـل:**
                - الـعـمـلـيـة :\nاضـافـة شـريـك 
                - الـشـريـك :\n<@!${partner}>
                - الـمـتـجـر الـمـسـتـفـيـد : ${i.channel} ${config.shopemoji}
                - تـم الـتـحـويـل لـ :\n ${transfer.id} | <@!${transfer.id}>
                - الـسـيـرفـر :\n ${i.guild.id} | ${guildName}
                - الـمـشـتـري :\n ${i.user} | \`${i.user.id}\`
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ

                - الـسـعـر الإجـمـالـي: \`${result}\` ${config.money}
                - الـضـريـبـة: \`${parttax - result}\` ${config.money} 
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                - **الـمـجـمـوع الـكـلـي:** \`${parttax}\` ${config.money}
                `;
    },
    // handlers/modules/earlyInteractions.js:1319
    earlyInteractions_026: () => {
        return "انـتـهـى الـوقـت لـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:1367
    earlyInteractions_027: ({ data }) => {
        return `عـفـواً يـجـب أن تـكـون صـاحـب الـمـتـجـر لاسـتـخـدام هـذه الأزرار\nصـاحـب الـمـتـجـر الـحـالـي: <@${data.sellerId || "غير معروف"}>`;
    },
    // handlers/modules/earlyInteractions.js:1398
    earlyInteractions_028: ({ data }) => {
        return `<@${data.sellerId}> هـو صـاحـب الـمـتـجـر بـلـفـعـل`;
    },
    // handlers/modules/earlyInteractions.js:1408
    earlyInteractions_029: ({ owner }) => {
        return `** عـزيـزي الـبـائـع لـقـد طـلـبـت ب  تـغـيـيـر مـلـكـيـة الـمـتـجـر\nصـاحـب الـمـتـجـر الـجـديـد : <@${owner}>**`;
    },
    // handlers/modules/earlyInteractions.js:1459
    earlyInteractions_030: ({ owntax, price, transfer }) => {
        return `لـقـد اخـتـرت تـغـيـيـر مـلـكـيـة الـمـتـجـر\nالـسـعـر : \`${owntax}\`
                \`\`\`Re <@!${transfer}> ${owntax}\`\`\`
                الـسـعـر الاصـلـي ${price}`;
    },
    // handlers/modules/earlyInteractions.js:1545
    earlyInteractions_031: ({ newowner }) => {
        return `تـم تـغـيـر مـلـكـيـة الـمـتـجـر بـنـجـاح بـنـجـاح\nالـمـالـك الـجـديـد لـلـمـتـجـر : <@${newowner}>`;
    },
    // handlers/modules/earlyInteractions.js:1554
    earlyInteractions_032: ({
        Thebank,
        config,
        guildName,
        i,
        newowner,
        owntax,
        result,
        transfer,
    }) => {
        return `
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                 **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**

                **الـتـفـاصـيـل:**
                - الـعـمـلـيـة :\nتـغـيـر مـلـكـيـة 
                - الـمـالـك الـجـديـد :\n<@!${newowner}>
                - الـمـتـجـر الـمـسـتـفـيـد : ${i.channel} ${config.shopemoji}
                - تـم الـتـحـويـل لـ :\n ${transfer.id} | ${Thebank}
                - الـسـيـرفـر :\n ${i.guild.id} | ${guildName}
                - الـمـشـتـري :\n ${i.user} | \`${i.user.id}\`
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ

                - الـسـعـر الإجـمـالـي: \`${result}\` ${config.money}
                - الـضـريـبـة: \`${owntax - result}\` ${config.money} 
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                - **الـمـجـمـوع الـكـلـي:** \`${owntax}\` ${config.money}
                `;
    },
    // handlers/modules/earlyInteractions.js:1586
    earlyInteractions_033: () => {
        return "انـتـهـى الـوقـت لـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:1647
    earlyInteractions_034: ({ owner }) => {
        return `عـفـواً يـجـب أن تـكـون صـاحـب الـمـتـجـر لاسـتـخـدام هـذه الأزرار\nصـاحـب الـمـتـجـر الـحـالـي: <@${owner || "غير معروف"}>`;
    },
    // handlers/modules/earlyInteractions.js:1665
    earlyInteractions_035: ({ newname }) => {
        return `**- عـزيـزي الـتـاجـر لـقـد طـلـبـت بـتـغـيـيـر اسـم الـمـتـجـر\n- الاسـم الـجـديـد: \`${newname}\`\n**`;
    },
    // handlers/modules/earlyInteractions.js:1696
    earlyInteractions_036: ({ price, tax, thename, transfer }) => {
        return `لـقـد اخـتـرت تـغـيـيـر اسـم الـمـتـجـر\nالاسـم الـجـديـد: \`${thename}\`\nالـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${transfer || "لـم يـتـم تـحـديـد بـنـك الـسـيـرفـر"} ${tax}\`\`\``;
    },
    // handlers/modules/earlyInteractions.js:1772
    earlyInteractions_037: ({ builtPirefix, i, name2, price, theoldname }) => {
        return `
                ## تـم تـغـيـيـر اسـم الـمـتـجـر بـنـجـاح
                ### الـمـتـجـر: <#${i.channel.id}>
                ### الـسـعـر: ${price} كـريـدت
                ### الاسـم الـجـديـد: ${builtPirefix}${name2} 
                ### الاسـم الـقـديـم: ${theoldname}
                `;
    },

    earlyInteractions_038: ({
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
    }) => {
        return `
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
         **تمت عملية الشراء بنجاح!**
          
        **التفاصيل:**
        تم تغيير اســم المتـجر:
        - الاسم الجديد : \`${builtPirefix}${name2}\` 
        - الاسم القديم : \`${theoldname}\`
        - المتــجر المستفيد : ${i.channel} ${config.shopemoji}
        - تم التحويل لـ :\n ${bankId} | ${transfer}
        - السيــرفر :\n ${i.guild.id} | ${guildName}
        - المشتري :\n ${i.user} | \`${i.user.id}\`
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
        
        - السعر الاصلـي: \`${result}\` ${config.money}
        - الضريبة: \`${tax - result}\` ${config.money} 
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
        - **المجموع الكلي:** \`${tax}\` ${config.money}
        `;
    },
    // handlers/modules/earlyInteractions.js:1820
    earlyInteractions_039: () => {
        return `انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ`;
    },
    // handlers/modules/earlyInteractions.js:1905
    earlyInteractions_040: ({ amount }) => {
        return `**- عـزيـزي الـتـاجـر لـقـد طـلـبـت حـذف تـحـذيـرات\n- عـدد الـتـحـذيـرات: \`${amount}\`\n**`;
    },
    // handlers/modules/earlyInteractions.js:1936
    earlyInteractions_041: ({ amount, price, tax, transfer }) => {
        return `لـقـد اخـتـرت حـذف تـحـذيـرات\nالـعـدد: \`${amount}\`\nالـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${transfer || "لـم يـتـم تـحـديـد بـنـك الـسـيـرفـر"} ${tax}\`\`\``;
    },
    // handlers/modules/earlyInteractions.js:2005
    earlyInteractions_042: ({ amount, newWarns }) => {
        return `تـم حـذف الـتـحـذيـرات بـنـجـاح\nالـعـدد الـمـحـذوف: \`${amount}\`\nالـتـحـذيـرات الـمـتـبـقـيـة: \`${newWarns}\``;
    },
    // handlers/modules/earlyInteractions.js:2013
    earlyInteractions_043: ({ amount, i, newWarns, price }) => {
        return `
                ## تـم حـذف الـتـحـذيـرات بـنـجـاح
                ### الـمـتـجـر: <#${i.channel.id}>
                ### الـسـعـر: ${price} كـريـدت
                ### الـكـمـيـة: ${amount} تـحـذيـر
                ### الـتـحـذيـرات الـمـتـبـقـيـة: ${newWarns}
                `;
    },
    // handlers/modules/earlyInteractions.js:2026
    earlyInteractions_044: ({
        amount,
        bankId,
        config,
        guildName,
        i,
        result,
        tax,
        transfer,
    }) => {
        return `
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                 **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**

                **الـتـفـاصـيـل:**
                تـم ازالـة عـدد تـحـذيـرات الـمـتـجـر:
                - الـعـدد : \`${amount}\` تـحـذيـر 
                - الـمـتـجـر الـمـسـتـفـيـد : ${i.channel} ${config.shopemoji}
                - تـم الـتـحـويـل لـ :\n ${bankId} | ${transfer}
                - الـسـيـرفـر :\n ${i.guild.id} | ${guildName}
                - الـمـشـتـري :\n ${i.user} | \`${i.user.id}\`
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ

                - الـسـعـر الاصـلـي: \`${result}\` ${config.money}
                - الـضـريـبـة: \`${tax - result}\` ${config.money} 
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                - **الـمـجـمـوع الـكـلـي:** \`${tax}\` ${config.money}
                `;
    },
    // handlers/modules/earlyInteractions.js:2060
    earlyInteractions_045: () => {
        return `انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ`;
    },
    // handlers/modules/earlyInteractions.js:2138
    earlyInteractions_046: ({ amount }) => {
        return `**- عـزيـزي الـتـاجـر لـقـد طـلـبـت شـراء مـنـشـنـات\n- عـدد الـمـنـشـنـات : \`${amount}\`\nاخـتـار ادنـاه نـوع الـمـنـشـنـات الـتـي تـريـد شـرائـهـا.**`;
    },
    // handlers/modules/earlyInteractions.js:2195
    earlyInteractions_047: ({ amount, result, shoptax, transfer }) => {
        return `لـقـد اخـتـرت مـنـشـنـات مـتـاجـر\nالـعـدد : \`${amount}\`\nالـسـعـر : \`${result}\`
                \`\`\`Re ${transfer || "لـم يـتـم تـحـديـد بـنـك الـسـيـرفـر ._."} ${shoptax}\`\`\``;
    },
    // handlers/modules/earlyInteractions.js:2277
    earlyInteractions_048: ({ amount, data }) => {
        return `تـم شـراء مـنـشـنـات مـتـاجـر بـنـجـاح\nالـعـدد : \`${amount}\`\nالـعـدد الان : \`${data.shopRoleMentions}\``;
    },
    // handlers/modules/earlyInteractions.js:2285
    earlyInteractions_049: ({ amount, i, result }) => {
        return `
                ## تـم شـراء مـنـشـنـات مـتـاجـر بـنـجـاح
                ### الـمـتـجـر : <#${i.channel.id}> 
                ### الـسـعـر : ${result}
                ### الـكـمـيـه : ${amount}
                `;
    },
    // handlers/modules/earlyInteractions.js:2297
    earlyInteractions_050: ({
        amount,
        bankId,
        config,
        guildName,
        i,
        result,
        shoptax,
        transfer,
    }) => {
        return `
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                 **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**

                **الـتـفـاصـيـل:**
                - الـعـدد : \`${amount}\` مـنـشـن 
                - نـوع الـمـنـشـن : \`(shop)\`
                - الـمـتـجـر الـمـسـتـفـيـد : ${i.channel} ${config.shopemoji}
                - تـم الـتـحـويـل لـ :\n ${bankId} | ${transfer}
                - الـسـيـرفـر :\n ${i.guild.id} | ${guildName}
                - الـمـشـتـري :\n ${i.user} | \`${i.user.id}\`
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ

                - الـسـعـر الإجـمـالـي: \`${result}\` ${config.money}
                - الـضـريـبـة: \`${shoptax - result}\` ${config.money} 
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                - **الـمـجـمـوع الـكـلـي:** \`${shoptax}\` ${config.money}
                `;
    },
    // handlers/modules/earlyInteractions.js:2328
    earlyInteractions_051: () => {
        return `انـتـهـى الـوقـت لـم يـتـم تـحـويـل الـمـبـلـغ`;
    },
    // handlers/modules/earlyInteractions.js:2370
    earlyInteractions_052: ({ amount, heretax, result, transfer }) => {
        return `لـقـد اخـتـرت مـنـشـنـات هـيـر\nالـعـدد : \`${amount}\`\nالـسـعـر : \`${result}\`
                \`\`\`Re ${transfer || "لـم يـتـم تـحـديـد بـنـك الـسـيـرفـر ._."} ${heretax}\`\`\``;
    },
    // handlers/modules/earlyInteractions.js:2452
    earlyInteractions_053: ({ amount, data }) => {
        return `تـم شـراء مـنـشـنـات هـيـر بـنـجـاح\nالـعـدد : \`${amount}\`\nالـعـدد الان : \`${data.hereMentions}\``;
    },
    // handlers/modules/earlyInteractions.js:2460
    earlyInteractions_054: ({ amount, i, result }) => {
        return `
                ## تـم شـراء مـنـشـنـات هـيـر بـنـجـاح
                ### الـمـتـجـر : <#${i.channel.id}> 
                ### الـسـعـر : ${result}
                ### الـكـمـيـه : ${amount}
                `;
    },
    // handlers/modules/earlyInteractions.js:2472
    earlyInteractions_055: ({
        amount,
        bankId,
        config,
        guildName,
        heretax,
        i,
        result,
        transfer,
    }) => {
        return `
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                 **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**

                **الـتـفـاصـيـل:**
                - الـعـدد : \`${amount}\` مـنـشـن 
                - نـوع الـمـنـشـن : \`(here)\`
                - الـمـتـجـر الـمـسـتـفـيـد : ${i.channel} ${config.shopemoji}
                - تـم الـتـحـويـل لـ :\n ${bankId} | ${transfer}
                - الـسـيـرفـر :\n ${i.guild.id} | ${guildName}
                - الـمـشـتـري :\n ${i.user} | \`${i.user.id}\`
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ

                - الـسـعـر الإجـمـالـي: \`${result}\` ${config.money}
                - الـضـريـبـة: \`${heretax - result}\` ${config.money} 
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                - **الـمـجـمـوع الـكـلـي:** \`${heretax}\` ${config.money}
                `;
    },
    // handlers/modules/earlyInteractions.js:2503
    earlyInteractions_056: () => {
        return `انـتـهـى الـوقـت لـم يـتـم تـحـويـل الـمـبـلـغ
                ### **مـلاحـظـة**
                اذا فـعـلا تـم الـتـحـويـل و حـولـت الـكـردت ومـا وصـلـك الـمـنـشـن
                تـواصـل مـع الاونـر و قـولـة يـخـلـي بـروبـوت انـجـلـيـزي
                اسـتـخـدم امـر:
                /set-lang:en
                الامـر مـوجـود فـي بـروبـوت`;
    },
    // handlers/modules/earlyInteractions.js:2554
    earlyInteractions_057: ({ amount, evrytax, result, transfer }) => {
        return `لـقـد اخـتـرت مـنـشـنـات افـري\nالـعـدد : \`${amount}\`\nالـسـعـر : \`${result}\`\nلـديـك 60 ثـانـيـة قـم بـنـسـخ الـرسـالـة ادنـاه لـلـتـحـويـل\n
                \`\`\`Re ${transfer || "لـم يـتـم تـحـديـد بـنـك الـسـيـرفـر ._."} ${evrytax}\`\`\``;
    },
    // handlers/modules/earlyInteractions.js:2635
    earlyInteractions_058: ({ amount, data }) => {
        return `تـم شـراء مـنـشـنـات ايـفـري بـنـجـاح\nالـعـدد : \`${amount}\`\nالـعـدد الان : \`${data.everyoneMentions}\``;
    },
    // handlers/modules/earlyInteractions.js:2643
    earlyInteractions_059: ({ amount, i, result }) => {
        return `
                ## تـم شـراء مـنـشـنـات ايـفـري بـنـجـاح
                ### الـمـتـجـر : <#${i.channel.id}> 
                ### الـسـعـر : ${result}
                ### الـكـمـيـه : ${amount}
                `;
    },
    // handlers/modules/earlyInteractions.js:2654
    earlyInteractions_060: ({
        amount,
        bankId,
        config,
        evrytax,
        guildName,
        i,
        result,
        transfer,
    }) => {
        return `
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                 **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**

                **الـتـفـاصـيـل:**
                - الـعـدد : \`${amount}\` مـنـشـن 
                - نـوع الـمـنـشـن : \`(evryone)\`
                - الـمـتـجـر الـمـسـتـفـيـد : ${i.channel} ${config.shopemoji}
                - تـم الـتـحـويـل لـ :\n ${bankId} | ${transfer}
                - الـسـيـرفـر :\n ${i.guild.id} | ${guildName}
                - الـمـشـتـري :\n ${i.user} | \`${i.user.id}\`
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ

                - الـسـعـر الإجـمـالـي: \`${result}\` ${config.money}
                - الـضـريـبـة: \`${evrytax - result}\` ${config.money} 
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                - **الـمـجـمـوع الـكـلـي:** \`${evrytax}\` ${config.money}
                `;
    },
    // handlers/modules/earlyInteractions.js:2684
    earlyInteractions_061: () => {
        return `انـتـهـى الـوقـت لـم يـتـم تـحـويـل الـمـبـلـغ`;
    },
    // handlers/modules/earlyInteractions.js:2754
    earlyInteractions_062: ({ config }) => {
        return `${config.warn} اسـتـبـيـان تـحـذيـر الـمـتـاجـر`;
    },
    // handlers/modules/earlyInteractions.js:2972
    earlyInteractions_063: ({ bank, newEmoji, price, tax }) => {
        return `**- الإيـمـوجـي الـجـديـد: ${newEmoji}\n- الـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${bank} ${tax}\`\`\`**`;
    },
    // handlers/modules/earlyInteractions.js:3024
    earlyInteractions_064: ({ i, newEmoji, price }) => {
        return `## الإيـمـوجـي الـجـديـد: ${newEmoji}\n### الـمـتـجـر: <#${i.channel.id}>\n### الـسـعـر: ${price} كـريـدت`;
    },
    // handlers/modules/earlyInteractions.js:3027
    earlyInteractions_065: () => {
        return "انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:3067
    earlyInteractions_066: ({ bank, newPrif, preview, price, tax }) => {
        return `**- الـزخـرفـة الـجـديـدة: \`${newPrif}\`\n- مـعـايـنـة الاسـم: \`${preview}اسـم الـمـتـجـر\`\n- الـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${bank} ${tax}\`\`\`**`;
    },
    // handlers/modules/earlyInteractions.js:3113
    earlyInteractions_067: ({ newChannelName, newPrif, price }) => {
        return `## الـزخـرفـة الـجـديـدة: \`${newPrif}\`\n## اسـم الـروم الـجـديـد: ${newChannelName}\n### الـسـعـر: ${price} كـريـدت`;
    },
    // handlers/modules/earlyInteractions.js:3116
    earlyInteractions_068: () => {
        return "انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:3149
    earlyInteractions_069: ({ bank, fullName, price, tax }) => {
        return `**- الاسـم الـجـديـد: \`${fullName}\`\n- الـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${bank} ${tax}\`\`\`**`;
    },
    // handlers/modules/earlyInteractions.js:3183
    earlyInteractions_070: ({ fullName, oldName, price }) => {
        return `## الاسـم الـجـديـد: ${fullName}\n### الاسـم الـقـديـم: ${oldName}\n### الـسـعـر: ${price} كـريـدت`;
    },
    // handlers/modules/earlyInteractions.js:3186
    earlyInteractions_071: () => {
        return "انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:3353
    earlyInteractions_072: ({ desc }) => {
        return desc;
    },
    // handlers/modules/earlyInteractions.js:3409
    earlyInteractions_073: ({ currentPrice, currentTypeData }) => {
        return `**نـوعـك الـحـالـي:** ${currentTypeData?.nametype || "غـيـر مـحـدد"} — \`${currentPrice}\` كـريـدت\n\n> اخـتـر الـنـوع الـجـديـد (يـجـب أن يـكـون أعـلـى سـعـراً)\n> **الـسـعـر = الـفـرق بـيـن الـنـوعـيـن**`;
    },
    // handlers/modules/earlyInteractions.js:3445
    earlyInteractions_074: ({
        bankMember,
        currentPrice,
        diffPrice,
        newPrice,
        newTypeData,
        tax,
    }) => {
        return `**- الـنـوع الـجـديـد: \`${newTypeData.nametype}\`\n- الـسـعـر الـحـالـي: \`${currentPrice}\` كـريـدت\n- الـسـعـر الـجـديـد: \`${newPrice}\` كـريـدت\n- الـمـبـلـغ الـمـطـلـوب (الـفـرق): \`${diffPrice}\` كـريـدت\n\`\`\`Re ${bankMember} ${tax}\`\`\`**`;
    },
    // handlers/modules/earlyInteractions.js:3506
    earlyInteractions_075: ({ diffPrice, i, newTypeData }) => {
        return `## الـنـوع الـجـديـد: ${newTypeData.nametype}\n### الـمـتـجـر: <#${i.channel.id}>\n### الـفـرق الـمـدفـوع: ${diffPrice} كـريـدت`;
    },
    // handlers/modules/earlyInteractions.js:3510
    earlyInteractions_076: () => {
        return "انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:3529
    earlyInteractions_077: ({ bankMember, price, tax }) => {
        return `**- سـيـتـم وضـع الـمـتـجـر فـي وضـع الإجـازة 🏖️\n- الـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${bankMember} ${tax}\`\`\`**`;
    },
    // handlers/modules/earlyInteractions.js:3574
    earlyInteractions_078: ({ i, price }) => {
        return `### الـمـتـجـر: <#${i.channel.id}>\n### الـسـعـر: ${price} كـريـدت\n\n**اضـغـط الـزر أدنـاه عـنـد الـرجـوع مـن الإجـازة لإعـادة تـفـعـيـل الـمـتـجـر**`;
    },
    // handlers/modules/earlyInteractions.js:3578
    earlyInteractions_079: () => {
        return "انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:3594
    earlyInteractions_080: ({ i }) => {
        return `### الـمـتـجـر: <#${i.channel.id}>\n### تـم إعـادة تـفـعـيـل الـمـتـجـر بـنـجـاح `;
    },
    // handlers/modules/earlyInteractions.js:3647
    earlyInteractions_081: ({ bankId, bankMember, price, tax, text }) => {
        return `**- الـنـص الـمـحـدد:**\n\`\`\`${text.slice(0, 150)}${text.length > 150 ? "..." : ""}\`\`\`- الـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${bankMember || bankId} ${tax}\`\`\``;
    },
    // handlers/modules/earlyInteractions.js:3676
    earlyInteractions_082: ({ interval, labels }) => {
        return `**سـتـنـشـر رسـالـتـك كـل ${labels[interval] || interval + " دقـيـقـة"} تـلـقـائـيـاً**\n\nاخـتـر نـوع الـمـنـشـن ثـم اضـغـط **تـأكـيـد الـدفـع**`;
    },
    // handlers/modules/earlyInteractions.js:3706
    earlyInteractions_083: ({
        mention,
        mentionLabels,
        pending,
        timeLabels,
    }) => {
        return `**الـفـتـرة:** كـل ${timeLabels[pending.intervalMinutes] || pending.intervalMinutes + " دقـيـقـة"}\n**الـمـنـشـن:** ${mentionLabels[mention]}\n\nاضـغـط **تـأكـيـد الـدفـع** لـبـدء الـنـشـر الـتـلـقـائـي`;
    },
    // handlers/modules/earlyInteractions.js:3754
    earlyInteractions_084: ({
        i,
        intervalMinutes,
        mention,
        mentionLabels,
        price,
        timeLabels,
    }) => {
        return `### الـمـتـجـر: <#${i.channel.id}>\n### الـفـتـرة: كـل ${timeLabels[intervalMinutes] || intervalMinutes + " دقـيـقـة"}\n### الـمـنـشـن: ${mentionLabels[mention]}\n### الـسـعـر: ${price} كـريـدت\n### **تـم نـشـر أول رسـالـة الآن** `;
    },
    // handlers/modules/earlyInteractions.js:3763
    earlyInteractions_085: () => {
        return "انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:3780
    earlyInteractions_086: ({ bankMember, price, tax }) => {
        return `**- سـيـتـم تـعـطـيـل الـنـشـر الـتـلـقـائـي لـجـمـيـع مـتـاجـرك فـي الـسـيـرفـر\n- الـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${bankMember} ${tax}\`\`\`**`;
    },
    // handlers/modules/earlyInteractions.js:3817
    earlyInteractions_087: ({ price }) => {
        return `### تـم تـعـطـيـل الـنـشـر الـتـلـقـائـي لـجـمـيـع مـتـاجـرك\n### الـسـعـر: ${price} كـريـدت`;
    },
    // handlers/modules/earlyInteractions.js:3820
    earlyInteractions_088: () => {
        return "انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:3839
    earlyInteractions_089: ({ bankMember, price, tax }) => {
        return `**- سـيـتـم تـفـعـيـل مـتـجـرك وإعـادة الـصـلاحـيـات لـه\n- الـسـعـر: \`${price}\` كـريـدت\n\`\`\`Re ${bankMember} ${tax}\`\`\`**`;
    },
    // handlers/modules/earlyInteractions.js:3881
    earlyInteractions_090: ({ i, price }) => {
        return `### الـمـتـجـر: <#${i.channel.id}>\n### الـسـعـر: ${price} كـريـدت`;
    },
    // handlers/modules/earlyInteractions.js:3884
    earlyInteractions_091: () => {
        return "انـتـهـى الـوقـت ولـم يـتـم تـحـويـل الـمـبـلـغ";
    },
    // handlers/modules/earlyInteractions.js:3938
    earlyInteractions_092: ({ bankId, cmdChannel, i, salePrice, tax }) => {
        return `**صـاحـب <#${i.channel.id}> يـريـد بـيـع مـتـجـره لـك بـسـعـر \`${salePrice}\` كـريـدت**\n\n> تـوجـه إلـى ${cmdChannel || "#روم-الأوامر"}\n> واكـتـب: \`\`\`Re <@!${bankId}> ${tax}\`\`\`\n> لـديـك **5 دقـائـق** لإتـمـام الـشـراء`;
    },
    // handlers/modules/earlyInteractions.js:3948
    earlyInteractions_093: ({ bankId, i, newOwnerMember, salePrice, tax }) => {
        return `${newOwnerMember} لـديـك **5 دقـائـق** لـشـراء مـتـجـر <#${i.channel.id}>\n**الـسـعـر:** \`${salePrice}\` كـريـدت\n\`\`\`Re <@!${bankId}> ${tax}\`\`\``;
    },
    // handlers/modules/earlyInteractions.js:3973
    earlyInteractions_094: ({ i, newOwnerId, oldOwnerId, salePrice, tax }) => {
        return `ـــــــــــ\n **تـمـت عـمـلـيـة الـبـيـع بـنـجـاح!**\n- الـمـتـجـر: <#${i.channel.id}>\n- الـبـائـع: <@${oldOwnerId}>\n- الـمـشـتـري: <@${newOwnerId}>\n- الـسـعـر: \`${salePrice}\` \n- الـضـريـبـة: \`${tax - salePrice}\` \n- الـمـجـمـوع: \`${tax}\` \nـــــــــــ`;
    },
    // handlers/modules/earlyInteractions.js:3976
    earlyInteractions_095: ({ i, newOwnerId, salePrice }) => {
        return `### الـمـالـك الـجـديـد: <@${newOwnerId}>\n### الـمـتـجـر: <#${i.channel.id}>\n### الـسـعـر: ${salePrice} كـريـدت`;
    },
    // handlers/modules/earlyInteractions.js:3981
    earlyInteractions_096: ({ i }) => {
        return `انـتـهـى وقـت شـراء مـتـجـر <#${i.channel.id}> — لـم يـتـم الـتـحـويـل فـي الـوقـت الـمـحـدد`;
    },
    // handlers/modules/earlyInteractions.js:4084
    earlyInteractions_097: ({ stoppedByLabel, userId }) => {
        return `### تـم إيـقـاف الـنـشـر الـتـلـقـائـي لـهـذا الـمـتـجـر بـواسـطـة <@${userId}>\n### الـصـفـة: ${stoppedByLabel}`;
    },
    // handlers/modules/earlyInteractions.js:4106
    earlyInteractions_098: () => {
        return "اخـتـر مـن الـخـيـارات أدنـاه:";
    },
    // handlers/modules/earlyInteractions.js:4130
    earlyInteractions_099: () => {
        return "اخـتـر عـدد الـنـجـوم:";
    },
    // handlers/modules/earlyInteractions.js:4185
    earlyInteractions_100: ({ reason, stars }) => {
        return `تـقـيـيـمـك: ${"⭐".repeat(stars)}${reason ? `\n> ${reason}` : ""}`;
    },
    // handlers/modules/earlyInteractions.js:4208
    earlyInteractions_101: () => {
        return "**لا يـوجـد تـقـيـيـم مـسـجـل مـنـك لـهـذا الـمـتـجـر.**\nقـم بـتـقـيـيـم الـمـتـجـر أولاً.";
    },
    // handlers/modules/earlyInteractions.js:4230
    earlyInteractions_102: ({ myRatings }) => {
        return (
            "اخـتـر تـقـيـيـمـك الـحـالـي مـن الـقـائـمـة لـتـعـديـلـه:\n\n" +
            myRatings
                .map(
                    (r) =>
                        `${"⭐".repeat(r.rating)} — ${r.reason || "بـدون سـبـب"} — <t:${Math.floor(r.timestamp / 1000)}:R>`,
                )
                .join("\n")
        );
    },
    // handlers/modules/earlyInteractions.js:4254
    earlyInteractions_103: () => {
        return "اخـتـر تـقـيـيـمـك الـجـديـد:";
    },
    // handlers/modules/earlyInteractions.js:4315
    earlyInteractions_104: ({ reason, stars }) => {
        return `تـقـيـيـمـك الـجـديـد: ${"⭐".repeat(stars)}${reason ? `\n> ${reason}` : ""}`;
    },
    // handlers/modules/earlyInteractions.js:4336
    earlyInteractions_105: () => {
        return "**لا تـوجـد تـقـيـيـمـات بـعـد.**";
    },
    // handlers/modules/earlyInteractions.js:4351
    earlyInteractions_106: ({ avg, lines, ratings }) => {
        return `**مـتـوسـط الـتـقـيـيـم: ${avg}/5 ⭐ — (${ratings.length} تـقـيـيـم)**\n\n${lines}`;
    },
    // handlers/modules/earlyInteractions.js:4374
    earlyInteractions_107: ({ pending }) => {
        return `سـيـتـم حـذف ${pending.length} مـتـجـر.`;
    },
    // handlers/modules/earlyInteractions.js:4391
    earlyInteractions_108: ({ deleted, interaction }) => {
        return `**الإداري:** <@${interaction.user.id}>\n**تـم حـذف:** ${deleted} مـتـجـر`;
    },
    // handlers/modules/earlyInteractions.js:4422
    earlyInteractions_109: ({ violUserId, violation }) => {
        return `<@${violUserId}> يـا وحـش ، تـم اكـتـشـاف اسـتـخـدام كـلـمـة غـيـر مـشـفـره مـع الـمـنـشـن فـي مـتـجـرك.\n\n**الـسـبـب:** عـدم تـشـفـيـر كـلـمـة\n**الـكـلـمـة:** \`${violation.word}\`\n**الـرسـالـة:**\n> ${violation.content.slice(0, 300)}\n\n**يـرجـى الالـتـزام بـقـوانـيـن الـسـيـرفـر.**`;
    },
    // handlers/modules/earlyInteractions.js:4430
    earlyInteractions_110: ({
        interaction,
        violChannelId,
        violUserId,
        violation,
    }) => {
        return `**الـمـتـجـر:** <#${violChannelId}>\n**الـمـخـالـف:** <@${violUserId}>\n**الـكـلـمـة:** \`${violation.word}\`\n**بـواسـطـة:** <@${interaction.user.id}>`;
    },
    // handlers/modules/earlyInteractions.js:4461
    earlyInteractions_111: ({ foundWord, message }) => {
        return `<@${message.author.id}> يـا وحـش، تـم حـذف رسـالـتـك لاحـتـوائـهـا عـلـى كـلـمـة مـمـنـوعـة مـع مـنـشـن.\n\n**الـسـبـب:** عـدم تـشـفـيـر كـلـمـة\n**الـكـلـمـة:** \`${foundWord}\`\n**الـرسـالـة:**\n> ${message.content.slice(0, 300)}`;
    },
    // handlers/modules/earlyInteractions.js:4482
    earlyInteractions_112: ({ channelId, foundWord, message }) => {
        return `**الـمـتـجـر:** <#${channelId}>\n**الـمـخـالـف:** <@${message.author.id}>\n**الـكـلـمـة الـمـمـنـوعـة:** \`${foundWord}\`\n**الـرسـالـة:**\n> ${message.content.slice(0, 400)}`;
    },
    // handlers/modules/shopInteractions.js:56
    shopInteractions_001: ({ type, typeLabels }) => {
        return `شـكـراً لـتـواصـلـك مـعـنـا!\nكـيـف تـقـيـم الـخـدمـة فـي تـكـت **${typeLabels[type] || type}**؟\n\nتـقـيـيـمـك يـسـاعـدنـا عـلـى الـتـحـسـيـن <:RenFriends:1542952365676695663>`;
    },
    // handlers/modules/shopInteractions.js:244

    shopInteractions_002: ({
        bank,
        config,
        evcount,
        hasTax,
        hecount,
        maxWarns,
        nametype,
        shcount,
        shopPrice,
        shopmen,
        shoprole,
        taxPrice,
    }) => {
        return `
                  **
                  > ${config.wahitsprkle}   النــوع اسم : ${nametype || "غير محدد"}  
                  > ${config.wahitsprkle}  \﹣\ رتــبة هاذا الــنوع :
                  > <@&${shoprole || "غير محدد"}>
                  >                         ༺═──────────{مــعــلومــات}───────────═༻
                  >                         
                  > ${config.refrechmark}  \﹣\ بضريبه؟ : ${hasTax === true ? "نعم" : hasTax === false ? "غير محدد" : "لا"}
                  > ${config.money}  \﹣\ سعر الضريبه : ${taxPrice || "غير محدد"} 
                  > ${config.warn} \-\ __ أقصى عدد تحذيرات وينقفل المتجر: ${maxWarns || "غير محدد"} __
                  >                         ༺═──────────{الـــمنـشنات}───────────═༻ 
                  >                          
                  > ${config.yelloshop} \-\ __ @everyone : ${evcount || "غير محدد"} __
                  > ${config.whaitshop} \-\ __ @here : ${hecount || "غير محدد"} __
                  > ${config.shopemoji} \-\ __ <@&${shopmen || "غير محدد"}> : ${shcount || "غير محدد"} __   
                  >                         ༺═──────────{الــســعر}───────────═༻
                  >                         
                  > ${config.money}  \﹣\__ الــسعــر  : ${shopPrice || "غير محدد"}  __ 
                  >                          
                   التـحـويـل لـ  <@!${bank || "غير محدد"}> ${config.hatemoji} 
                  **`;
    },
    // handlers/modules/shopInteractions.js:667
    shopInteractions_003: ({ categoryData, channel, config, i }) => {
        return ` **
        > ${config.wahitsprkle}  \﹣\ المـتـجـر : ${channel}
        > 
        > ${config.wahitsprkle}  \﹣\ صـاحـب المـتـجـر : <@${i.user.id}>
        > 
        > ${config.wahitsprkle}  \﹣\ نـوع المـتـجر : ${categoryData.nametype || "لم يتم العثور عليه"}
        > 
        > ${config.wahitsprkle}  \﹣\ رتبة هاذا النوع  : <@&${categoryData.shoprole || "لم يتم العثور عليه"}> 
        > 
        > ${config.wahitsprkle}  \﹣\ اقصى عدد للتحذيرات : ${categoryData.maxWarns || "غير محدد"}
        > 
        > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${categoryData.hasTax === true ? "نعم" : categoryData.hasTax === false ? "لا" : "غير محدد"}
        
        ${config.yelloshop} \-\ __ @everyone : ${categoryData.everyoneMentions} __
        ${config.whaitshop}: \-\ __ @here : ${categoryData.hereMentions} __
        ${config.shopemoji} \-\ __ <@&${categoryData.shopmen}> : ${categoryData.shopRoleMentions} __
        
        **`;
    },
    // handlers/modules/shopInteractions.js:711
    shopInteractions_004: ({
        bank,
        channel,
        config,
        guildName,
        i,
        shopPrice,
        totalPrice,
    }) => {
        return `
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                 **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**

                **الـتـفـاصـيـل:**
                - تـم شـراء مـتـجـر 
                - الـمـتـجـر : ${channel} ${config.shopemoji}
                - تـم الـتـحـويـل لـ :\n ${bank} | <@!${bank}>
                - الـسـيـرفـر :\n ${i.guild.id} | ${guildName}
                - الـمـشـتـري :\n ${i.user} | \`${i.user.id}\`
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ

                - الـسـعـر الاصـلـي: \`${shopPrice}\` ${config.money}
                - الـضـريـبـة: \`${totalPrice - shopPrice}\` ${config.money} 
                ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
                - **الـمـجـمـوع الـكـلـي:** \`${totalPrice}\` ${config.money}
                `;
    },
    // handlers/modules/shopInteractions.js:781
    shopInteractions_005: () => {
        return "**سـيـتـم إغـلاق الـتـذكـرة خـلال 5 ثـوانـي...**";
    },
    // handlers/modules/shopInteractions.js:809
    shopInteractions_006: () => {
        return "**تـم إغـلاق الـتـذكـرة. يـمـكـنـك فـتـحـهـا أو حـذفـهـا بـاسـتـخـدام الأزرار أدنـاه.**";
    },
    // handlers/modules/shopInteractions.js:836
    shopInteractions_007: () => {
        return "**تـم فـتـح الـتـذكـرة مـرة أخـرى.**";
    },
    // handlers/modules/shopInteractions.js:1050
    shopInteractions_008: () => {
        return "**سـيـتـم إغـلاق الـتـذكـرة خـلال 5 ثـوانـي...**";
    },
    // handlers/modules/shopInteractions.js:1078
    shopInteractions_009: () => {
        return "**تـم إغـلاق الـتـذكـرة. يـمـكـنـك فـتـحـهـا أو حـذفـهـا بـاسـتـخـدام الأزرار أدنـاه.**";
    },
    // handlers/modules/shopInteractions.js:1105
    shopInteractions_010: () => {
        return "**تـم فـتـح الـتـذكـرة مـرة أخـرى.**";
    },
    // handlers/modules/shopInteractions.js:1265
    shopInteractions_011: ({
        config,
        durationMinutes,
        includesTax,
        itemName,
        mentionType,
        startPrice,
        userId,
    }) => {
        return (
            `> ${config.mzademoji} **الـسـلـعـة:** ${itemName}\n` +
            `> ${config.mzademoji} **الـسـعـر الـمـبـدئـي:** ${startPrice}\n` +
            `> ${config.mzademoji} **الـضـريـبـة:** ${includesTax ? "نـعـم" : "لا"}\n` +
            `> ${config.mzademoji} **مـدة الـمـزاد:** ${durationMinutes} دقـيـقـة\n` +
            `> ${config.mzademoji} **الـمـنـشـن:** ${mentionType}\n` +
            `> ${config.mzademoji} **صـاحـب الـمـزاد:** <@${userId}>`
        );
    },
    // handlers/modules/shopInteractions.js:1328
    shopInteractions_012: ({ bank, config, evrypri, totalPrice }) => {
        return `ـــــــــ\n **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**\n- تـم شـراء مـزاد\n- تـم الـتـحـويـل لـ: <@!${bank}>\n- نـوع الـمـنـشـن: (everyone)\nـــــــــ\n- الـسـعـر الاصـلـي: \`${evrypri}\` ${config.money}\n- الـضـريـبـة: \`${totalPrice - evrypri}\` ${config.money}\n- **الـمـجـمـوع:** \`${totalPrice}\` ${config.money}`;
    },
    // handlers/modules/shopInteractions.js:1382
    shopInteractions_013: ({ bank, config, herepri, totalPrice }) => {
        return `ـــــــــ\n **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**\n- تـم شـراء مـزاد\n- تـم الـتـحـويـل لـ: <@!${bank}>\n- نـوع الـمـنـشـن: (here)\nـــــــــ\n- الـسـعـر الاصـلـي: \`${herepri}\` ${config.money}\n- الـضـريـبـة: \`${totalPrice - herepri}\` ${config.money}\n- **الـمـجـمـوع:** \`${totalPrice}\` ${config.money}`;
    },
    // handlers/modules/shopInteractions.js:1438
    shopInteractions_014: ({
        bank,
        config,
        mzadRoleId,
        mzadpri,
        totalPrice,
    }) => {
        return `ـــــــــ\n **تـمـت عـمـلـيـة الـشـراء بـنـجـاح!**\n- تـم شـراء مـزاد\n- تـم الـتـحـويـل لـ: <@!${bank}>\n- نـوع الـمـنـشـن: <@&${mzadRoleId}>\nـــــــــ\n- الـسـعـر الاصـلـي: \`${mzadpri}\` ${config.money}\n- الـضـريـبـة: \`${totalPrice - mzadpri}\` ${config.money}\n- **الـمـجـمـوع:** \`${totalPrice}\` ${config.money}`;
    },
    // handlers/modules/shopInteractions.js:1520
    shopInteractions_015: ({ userId }) => {
        return `> تـم إلـغـاء الـمـزاد مـن قـبـل <@${userId}>\n> سـيـتـم حـذف الـتـكـت خـلال 5 ثـوانـي...`;
    },
    // handlers/modules/shopInteractions.js:1756
    shopInteractions_016: ({ openerId, ownerId }) => {
        return (
            `> <a:emoji_14:1542937623763484754> \`-\` ** صـاحـب الـطـلـب:** <@${ownerId}>\n` +
            `> <a:emoji_14:1542937623763484754> \`-\` ** فـاتـح الـثـريـد:** <@${openerId}>\n\n` +
            `*هـذا الـثـريـد خـاص ولا يـرى إلا مـن قـبـلـكـمـا.*`
        );
    },
    // handlers/modules/shopInteractions.js:1878
    shopInteractions_017: ({ bank, config, evrypri, herepri }) => {
        return (
            `${config.mzademoji} **@everyone:** ${evrypri || "غـيـر مـحـدد"}\n` +
            `${config.mzademoji} **@here:** ${herepri || "غـيـر مـحـدد"}\n\n` +
            `الـتـحـويـل لـ: ${bank ? `<@!${bank}>` : "غـيـر مـحـدد"}`
        );
    },
    // handlers/modules/shopInteractions.js:1926
    shopInteractions_018: ({ auctionRules }) => {
        return auctionRules;
    },
    // handlers/modules/shopInteractions.js:1953
    shopInteractions_019: ({ bank, evrypri, herepri, mzadpri }) => {
        return `مـنـشـن @everyone : ${evrypri || "غـيـر مـحـدد"}\nمـنـشـن @here : ${herepri || "غـيـر مـحـدد"}\nمـنـشـن مـزاد (رول) : ${mzadpri || "غـيـر مـحـدد"}\n\nالـتـحـويـل لـ: ${bank ? `<@!${bank}>` : "غـيـر مـحـدد"}`;
    },
    // handlers/modules/shopInteractions.js:1997
    shopInteractions_020: ({ interaction, td }) => {
        return (
            `> **تـم إلـغـاء الـمـزاد مـن قـبـل <@${interaction.user.id}>**\n` +
            (td?.draft?.itemName
                ? `> ** الـسـلـعـة:** ${td.draft.itemName}\n`
                : "") +
            (td?.draft?.startPrice
                ? `> ** الـسـعـر الابـتـدائـي:** ${td.draft.startPrice}`
                : "")
        );
    },
    // handlers/modules/shopInteractions.js:2150
    shopInteractions_021: ({ lines }) => {
        return lines.join("\n");
    },
    // handlers/modules/shopInteractions.js:2208
    shopInteractions_022: ({ auctionRules }) => {
        return auctionRules;
    },
    // handlers/modules/shopInteractions.js:2533
    shopInteractions_023: ({ basePrice, roleTax, selectedRoleId, userId }) => {
        return (
            `> **الـعـضـو:** <@${userId}>\n` +
            `> **الـرتـبـة:** <@&${selectedRoleId}>\n` +
            `> **الـسـعـر:** \`${basePrice}\` (الـمـطـلـوب تـحـويـل: \`${roleTax}\`)\n\n` +
            `**لـم يـتـم تـأكـيـد الـتـحـويـل خـلال الـوقـت الـمـحـدد.**\n` +
            `الـتـكـت مـفـتـوح — يـرجـى مـن الإدارة مـراجـعـتـه وإغـلاقـه يـدويـاً.`
        );
    },
    // handlers/modules/shopInteractions.js:2587
    shopInteractions_024: ({ reason, roleData, selectedRoleId, userId }) => {
        return (
            `> **الـعـضـو:** <@${userId}>\n` +
            `> **الـرتـبـة:** <@&${selectedRoleId}>\n` +
            `> **الـسـعـر:** \`${roleData.price}\`\n` +
            reason +
            "\n\n" +
            `**الـدفـع تـم بـنـجـاح — يـرجـى مـن الإدارة مـنـح الـرتـبـة يـدويـاً وإغـلاق الـتـكـت.**`
        );
    },
    // handlers/modules/shopInteractions.js:2625
    shopInteractions_025: ({ buyRoles }) => {
        return buyRoles
            .map(
                (r, idx) =>
                    `**${idx + 1}. > <a:005:1542937522362122292>  \`-\` <@&${r.roleId}>**\n > <a:005:1542937522362122292>  \`-\` الـسـعـر : \`${r.price}\`\n > <a:005:1542937522362122292>  \`-\` ${r.benefits}`,
            )
            .join("\n\n");
    },
    // handlers/modules/shopInteractions.js:2731
    shopInteractions_026: ({ interaction, isScam, ticketNum }) => {
        return (
            `> <a:emoji_14:1542937623763484754> \`-\` **صـاحـب الـتـكـت:** /${interaction.user} \`(${interaction.user.tag})\`\n` +
            `> <a:emoji_14:1542937623763484754> \`-\` **الـنـوع:** ${isScam ? " تـشـهـيـر نـصـاب" : "دعـم فـنـي"}\n` +
            `> <a:emoji_14:1542937623763484754> \`-\` **الـرقـم:** \`#${ticketNum}\`\n\n` +
            (isScam
                ? `**<a:emoji_14:1542937623763484754> \`-\` تـعـلـيـمـات الـتـشـهـيـر:** \n > 
<a:emoji_14:1542937623763484754> \`-\`انـتـظـر أحـد الـمـسـؤولـيـن لـيـبـدأ مـعـك الـتـشـهـيـر \n > <a:emoji_14:1542937623763484754> \`-\` يـجـب تـوفـر الأدلـة (صـور/مـقـاطـع) \n > <a:emoji_14:1542937623763484754> \`-\` قـدّم مـعـلـومـات دقـيـقـة وصـحـيـحـة\n > <a:emoji_14:1542937623763484754> \`-\`اي تـشـهـيـر ظـلـم او مـافـيـه ادلـه كـافـيـه او مـعـدلـه يـؤدي لـعـقـوبـة`
                : `**<a:emoji_14:1542937623763484754> \`-\` تـعـلـيـمـات الـدعـم:**\n > <a:emoji_14:1542937623763484754> \`-\`اشـرح مـشـكـلـتـك بـالـتـفـصـيـل\n ><a:emoji_14:1542937623763484754> \`-\`  انـتـظـر رد فـريـق الـدعـم\n > <a:emoji_14:1542937623763484754> \`-\`لا تـفـتـح اكـثـر مـن تـكـت \n > <a:emoji_14:1542937623763484754> \`-\`يـجـب احـتـرام الاداره عـدم احـتـرامـهـم يـؤدي إلـى الـبـانـد او تـايـم`)
        );
    },

    // handlers/modules/shopInteractions.js:2799
    shopInteractions_027: ({ interaction }) => {
        return `**<@${interaction.user.id}>** استلم التكت`;
    },
    // handlers/modules/shopInteractions.js:3210
    shopInteractions_028: ({ interaction }) => {
        return `**أُغلق التكت بواسطة <@${interaction.user.id}>**\nاضغط على الزر أدناه لحذف القناة نهائياً.`;
    },
    // handlers/modules/shopInteractions.js:3273
    shopInteractions_029: ({ rule }) => {
        return rule.content;
    },
    // handlers/modules/shopInteractions.js:3299
    shopInteractions_030: ({ toDelete }) => {
        return `تم حذف **${toDelete.label}** من القائمة.`;
    },
    // handlers/modules/shopInteractions.js:3326
    shopInteractions_031: ({ toDelete }) => {
        return `تم حذف **${toDelete.name}** من قائمة البيع.`;
    },
    // handlers/modules/shopInteractions.js:3343
    shopInteractions_032: () => {
        return `**> <a:003_1367454575254044763:1542937518566014976>  \`-\` اهـلاً بـك فـي قـسـم الأسـعـار**\n > <a:003_1367454575254044763:1542937518566014976>  \`-\` اخـتـر الـقـسـم الـمـطـلـوب`;
    },
    // handlers/modules/shopInteractions.js:3369
    shopInteractions_033: ({ interaction }) => {
        return `> <a:011_1367454588252454943:1542937524274470974>  \`-\` مـرحـبـاً بـكـم فـي قـسـم الـقـوانـيـن **${interaction.guild.name}**\n > <a:011_1367454588252454943:1542937524274470974> \`-\` اضـغـط عـلـى أي زر لـعـرض قـانـون الـمـخـصـص`;
    },
    // handlers/modules/shopInteractions.js:3394
    shopInteractions_034: () => {
        return `**> <a:005:1542937522362122292>  \`-\` اهـلاً بـك فـي قـسـم ا �ـتـكـتـات**\n > <a:005:1542937522362122292>  \`-\` يـرجـى اخـتـيـار الـتـكـت الـمـطـلـوب`;
    },

    shopInteractions_035: ({ lines }) => {
        return lines;
    },
    // handlers/modules/shopInteractions.js:3448
    shopInteractions_036: () => {
        return "يرجى التواصل مع الإدارة.";
    },
    // handlers/modules/shopInteractions.js:3463
    shopInteractions_037: ({
        interaction,
        rating,
        stars,
        type,
        typeLabels,
    }) => {
        return `**المقيّم:** <@${interaction.user.id}>\n**نوع التكت:** ${typeLabels[type] || type}\n**التقييم:** ${stars} (${rating}/5)`;
    },
    // handlers/modules/shopInteractions.js:3483
    shopInteractions_038: ({ stars }) => {
        return `تم إرسال تقييمك **${stars}** بنجاح <:RenFriends:1542952365676695663>\nرأيك يساعدنا على تحسين خدماتنا.`;
    },
    // handlers/modules/lateInteractions.js:82
    lateInteractions_001: () => {
        return "يرجى اختيار الأمر الذي تريد معرفته";
    },
    // handlers/modules/lateInteractions.js:112
    lateInteractions_002: ({ config }) => {
        return `
        ${config.offline} \`-\` /setup
        -# الأمر الذي تعد فيه إعدادات البوت من حيث الأسعار والإدارة.
        ${config.offline} \`-\` /server-info
        -# يعرض معلومات السيرفر المحددة.
        ${config.offline} \`-\` /add-type
        -# تحديد نوع الكتاغوري وعدد المنشنات.
        ${config.offline} \`-\` /say-all-shops 
        -# إرسال رسالة لجميع المتاجر.
        ${config.offline} \`-\` /active-all 
        -# تفعيل جميع المتاجر.
        ${config.offline} \`-\` /disable-all 
        -# تعطيل جميع المتاجر.
        ${config.offline} \`-\` /unwarn-all 
        -# حذف جميع تحذيرات المتاجر.
        ${config.offline} \`-\` /types 
        -# عرض جميع أنواع المتاجر.
        ${config.offline} \`-\` /reset-mentions 
        -# إعادة تعيين جميع المنشنات.
                `;
    },
    // handlers/modules/lateInteractions.js:142
    lateInteractions_003: ({ config }) => {
        return `
        ${config.offline} \`-\` /auction-panel 
        -# إرسال بانل المزاد التلقائي.
        ${config.offline} \`-\` /order-panel 
        -# إرسال بانل الطلبات التلقائي.
        ${config.offline} \`-\` /buy-panel
        -# إرسال بانل الطلبات والمزاد التلقائي.
        ${config.offline} \`-\` /send-tashfeer 
        -# إرسال زر التشفير التلقائي.
                `;
    },
    // handlers/modules/lateInteractions.js:162
    lateInteractions_004: ({ config }) => {
        return `
        ${config.offline} \`-\` /add-sticker-channel
        -# تحديد روم لإضافة الاستيكرات تلقائيًا.
        ${config.offline} \`-\` /add-emoji-channel
        -# تحديد روم لإضافة الإيموجيات تلقائيًا.
        ${config.offline} \`-\` /add-tax-channel
        -# تحديد روم لإرسال الضرائب.
        ${config.offline} \`-\` /remove-sticker-channel
        -# حذف روم الاستيكر.
        ${config.offline} \`-\` /remove-emoji-channel
        -# حذف روم الإيموجي.
        ${config.offline} \`-\` /remove-tax-channel
        -# حذف روم الضرائب.
        ${config.offline} \`-\` /add-autoreply
        -# إضافة رد تلقائي.
        ${config.offline} \`-\` /remove-autoreply
        -# حذف رد تلقائي.
        ${config.offline} \`-\` /list-autoreplies 
        -# عرض الردود التلقائية.
                `;
    },
    // handlers/modules/lateInteractions.js:200
    lateInteractions_005: () => {
        return "يرجى اختيار الأمر الذي تريد معرفته";
    },
    // handlers/modules/lateInteractions.js:230
    lateInteractions_006: ({ config }) => {
        return `
        > ${config.offline} \`-\` /shop
        > -# الامر الي يسوي متاجر
        > ${config.offline} \`-\` /delete-shop
        > -# يحذف متجر
        > ${config.offline} \`-\` /add-shop-data
        > -# يضيف متجر للداتا (ما يسوي متجر) يخلي الروم متجر
        > ${config.offline} \`-\` /add-mention
        > -# يضيف منشنات للمتجر
        > ${config.offline} \`-\` /set-mention
        > -# يحدد عدد منشنات للمتجر
        > ${config.offline} \`-\` /remove-shop-data
        > -# يشيل متجر من الداتا (ما يحذف)
        > ${config.offline} \`-\` /warn
        > -# يحذر متجر
        > ${config.offline} \`-\` /unwarn
        > -# يشيل تحذير متجر
        > ${config.offline} \`-\` /active
        > -# يظهر متجر (يفعل متجر)
        > ${config.offline} \`-\` /disable
        > -# يخفي متجر (يوقف تفعيله)
        > ${config.offline} \`-\` /add-helper
        > -# يضيف شريك (مساعد) للمتجر
        > ${config.offline} \`-\` /remove-helper
        > -# يشيل شريك (مساعد) من المتجر
        `;
    },
    // handlers/modules/lateInteractions.js:266
    lateInteractions_007: ({ config }) => {
        return `
        ${config.offline} \`-\` /order
        -# ينشر طلب في روم الطلبات
        `;
    },
    // handlers/modules/lateInteractions.js:279
    lateInteractions_008: ({ config }) => {
        return `
        ${config.offline} \`-\` /مزاد
        -# ينشئ مزادًا
        `;
    },
    // handlers/modules/lateInteractions.js:517
    lateInteractions_009: ({ bank, taxPrice, totalPrice }) => {
        return `يرجى التحويل الضريبه\nالسعر : \`${taxPrice}\`\n\`\`\`Re ${bank || "لم يتم تحديد بنك السيرفر ._."} ${totalPrice}\`\`\``;
    },
    // handlers/modules/lateInteractions.js:559
    lateInteractions_010: () => {
        return `تم دفع ضريـــبة المتــجر بنجــح و تم اظهار المتجر\nشكرا لـتعاملـك معنــا:)`;
    },
    // handlers/modules/lateInteractions.js:644
    lateInteractions_011: ({ target }) => {
        return `✅ **تم اختراق ${target.username} بنجاح!** ☠️`;
    },
    // handlers/modules/lateInteractions.js:694
    lateInteractions_012: () => {
        return "❌ الرجاء إرسال ملصق، صورة، أو كتابة ID الخاص بالملصق.";
    },
    // handlers/modules/lateInteractions.js:714
    lateInteractions_013: () => {
        return "❌ لقد وصل السيرفر إلى الحد الأقصى من الملصقات المسموح بها.";
    },
    // handlers/modules/lateInteractions.js:731
    lateInteractions_014: () => {
        return "❌ الملف المرفق يجب أن يكون صورة صالحة.";
    },
    // handlers/modules/lateInteractions.js:755
    lateInteractions_015: ({ sticker }) => {
        return `✅ تم إضافة الملصق بنجاح: [${sticker.name}](${sticker.url})`;
    },
    // handlers/modules/lateInteractions.js:762
    lateInteractions_016: () => {
        return "❌ حدث خطأ أثناء إضافة الملصق. تأكد من صحة البيانات.";
    },
    // handlers/modules/lateInteractions.js:792
    lateInteractions_017: () => {
        return "❌ لا يمكنك إضافة أكثر من 30 إيموجي في رسالة واحدة.";
    },
    // handlers/modules/lateInteractions.js:860
    lateInteractions_018: ({
        addedEmojis,
        currentAnimatedEmojis,
        currentStaticEmojis,
        maxEmojis,
    }) => {
        return `✅ تم إضافة ${addedEmojis.length} إيموجي بنجاح!  
                        \nتم إضافة: ${addedEmojis.map((e) => e.toString()).join(" ")}  
                        \nالإيموجيات الحالية: ${currentStaticEmojis + currentAnimatedEmojis + addedEmojis.length}/${maxEmojis}`;
    },
    // handlers/modules/lateInteractions.js:866
    lateInteractions_019: () => {
        return "❌ لم يتم إضافة أي إيموجيات. قد تكون الإيموجيات موجودة بالفعل أو الرسالة لا تحتوي على صورًا صالحة.";
    },
    // handlers/modules/lateInteractions.js:874
    lateInteractions_020: () => {
        return "❌ حدث خطأ أثناء تنفيذ الأمر.";
    },
    // handlers/modules/lateInteractions.js:1105
    lateInteractions_021: ({ ping, uptime }) => {
        return `**🔹 بنق البوت:** \`${ping}ms\`\n**⏳ مدة التشغيل:** <t:${Math.floor(Date.now() / 1000 - uptime)}:R>\nتقدر تسوي بوتك الخاص با الاسم و الصوره الي تبيه من الموقع \n https://discord.com/developers/applications\n اذا ما تعرف كيف روح يوتيوب ;-;\n كل شخص له بوت واحد فقط\n ما يحتاج تعيد البينات بتلاقيها متسجله علطول`;
    },
    // handlers/modules/lateInteractions.js:1211
    lateInteractions_022: () => {
        return "**البوتات التي قمت بإضافتها:**";
    },
    // handlers/modules/lateInteractions.js:1286
    lateInteractions_023: () => {
        return "تم تسجيل بيانات البوت بنجاح في النظام.";
    },
    // handlers/modules/lateInteractions.js:1322
    lateInteractions_024: ({ i }) => {
        return `تمت إضافة بوت جديد بواسطة ${i.user.tag}`;
    },
    // handlers/modules/lateInteractions.js:1392
    lateInteractions_025: () => {
        return "تم حذف هذا التوكن من النظام";
    },
    // handlers/modules/lateInteractions.js:1445
    lateInteractions_026: ({ tokenData }) => {
        return `تم تحديث معرف السيرفر للبوت ${tokenData.botId}`;
    },
    // handlers/modules/lateInteractions.js:1484
    lateInteractions_027: () => {
        return "تم حذف هذا التوكن من النظام";
    },
    // handlers/modules/lateInteractions.js:1621
    lateInteractions_028: ({ leaderboard }) => {
        return leaderboard.join("\n");
    },
    // handlers/modules/lateInteractions.js:1678
    lateInteractions_029: ({ data }) => {
        return `
        ** > <a:MEX_SHOP:1542937632453959721>  \`-\` __Everyone__ : ${data.everyoneMentions || 0}**
        **> <a:MEX_SHOP:1542937632453959721>  \`-\` __Here__ : ${data.hereMentions || 0}**
        **> <a:MEX_SHOP:1542937632453959721>  \`-\` __Shop mention__ : ${data.shopRoleMentions || 0}**
        `;
    },
    // handlers/modules/commandsD.js:80
    commandsD_001: ({
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
    }) => {
        return `**
        > ${config.wahitsprkle}  ﹣  رتبة النوع: <@&${shoprole || "غير محدد"}>
        > ${config.wahitsprkle}  ﹣  بضريبة؟: ${hasTax ? "نعم" : "لا"}
        > ${config.wahitsprkle}  ﹣  سعر الضريبة: ${taxPrice || "لا يوجد"}
        > ${config.wahitsprkle}  ﹣  سعر النوع: ${shopPrice || "غير محدد"}
        > ${config.wahitsprkle}  ﹣  الزخرفة: ${pirefix || "لا يوجد"}
        > ${config.wahitsprkle}  ﹣  الإيموجي: ${shopEmoji || "لا يوجد"}
        ${config.yelloshop}  @everyone: ${evcount}
        ${config.whaitshop}  @here: ${hecount}
        ${config.shopemoji}  <@&${shopmen}>: ${shcount}
        ${config.warn}  أقصى تحذيرات: ${maxWarns}**`;
    },
    // handlers/modules/commandsD.js:231
    commandsD_002: ({
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
    }) => {
        return `
                  **
                  > ${config.wahitsprkle}  \﹣\ رتــبة هاذا الــنوع : <@&${shoprole || "غير محدد"}>
                  > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${hasTax === true ? "نعم" : hasTax === false ? "لا" : "غير محدد"}
                  > ${config.wahitsprkle}  \﹣\ سعر الضريبه : ${taxPrice || "غير محدد"}
                  > ${config.wahitsprkle}  \﹣\ سعر هاذا النوع : ${shopPrice || "غير محدد"} 
                  > ${config.wahitsprkle}  \﹣\ الـــزخرفــة : ${pirefix || "لا يوجد"}
                  ${config.yelloshop} \-\ __ @everyone : ${evcount || "غير محدد"} __
                  ${config.whaitshop} \-\ __ @here : ${hecount || "غير محدد"} __
                  ${config.shopemoji} \-\ __ <@&${shopmen || "غير محدد"}> : ${shcount || "غير محدد"} __
                  ${config.warn} \-\ __ أقصى عدد تحذيرات: ${maxWarns || "غير محدد"} __
                  **`;
    },
    // handlers/modules/commandsD.js:314
    commandsD_003: ({ config, newData }) => {
        return `
        **> رتبة النوع: <@&${newData.shoprole}>
        > هل يوجد ضريبة؟: ${newData.hasTax ? "نعم" : "لا"}
        > سعر الضريبة: ${newData.taxPrice}
        > سعر النوع: ${newData.shopPrice}
        > الزخرفة: ${newData.pirefix || "لا يوجد"}
        > الإيموجي: ${newData.shopEmoji || "لا يوجد"}
        
        ${config.yelloshop} - @everyone: ${newData.everyoneMentions}
        ${config.whaitshop} - @here: ${newData.hereMentions}
        ${config.shopemoji} - <@&${newData.shopmen}>: ${newData.shopRoleMentions}
        ${config.warn} - أقصى التحذيرات: ${newData.maxWarns}
        **`;
    },
    // handlers/modules/commandsD.js:380
    commandsD_004: ({ deleted, valid }) => {
        return `
        **الأنواع الصالحة:** ${valid}
        **الأنواع المحذوفة:** ${deleted}
            `;
    },
    // handlers/modules/commandsD.js:477
    commandsD_005: ({ categories, i }) => {
        return categories
            .map(
                (cat, index) =>
                    `${index + 1}. ${i.guild.channels.cache.get(cat.categoryId)?.name || "غير معروف"}`,
            )
            .join("\n");
    },
    // handlers/modules/commandsD.js:531
    commandsD_006: ({ categoryData, channelName, config }) => {
        return `**━━━━━━━━━━━━━━━━━━**
        **اسم النوع:** ${categoryData.nametype || "غير محدد"}
        **الكتاغوري:** ${channelName} (${categoryData.categoryId})
        
        > ${config.wahitsprkle} رتبة النوع: <@&${categoryData.shoprole || "غير محدد"}>
        > ${config.wahitsprkle} الزخرفة: ${categoryData.pirefix || "لا يوجد"}
        > ${config.wahitsprkle} ضريبة؟ ${categoryData.hasTax ? "نعم" : "لا"}
        > ${config.wahitsprkle} سعر الضريبة: ${categoryData.taxPrice || "غير محدد"}
        > ${config.wahitsprkle} سعر النوع: ${categoryData.shopPrice || "غير محدد"}
        
        ${config.yelloshop} @everyone: ${categoryData.everyoneMentions || "غير محدد"}
        ${config.whaitshop} @here: ${categoryData.hereMentions || "غير محدد"}
        ${config.shopemoji} <@&${categoryData.shopmen || "غير محدد"}>: ${categoryData.shopRoleMentions}
        ${config.warn} أقصى تحذيرات: ${categoryData.maxWarns || "غير محدد"}
        **`;
    },
    // handlers/modules/commandsD.js:593
    commandsD_007: ({ categories, i }) => {
        return categories
            .map(
                (cat, index) =>
                    `${index + 1}. ${i.guild.channels.cache.get(cat.categoryId)?.name || "غير معروف"}`,
            )
            .join("\n");
    },
    // handlers/modules/commandsD.js:612
    commandsD_008: ({ category, config }) => {
        return `**
        > ${config.wahitsprkle}  \﹣\ رتــبة هاذا الــنوع : <@&${category.shoprole || "غير محدد"}> 
        
        > ${config.wahitsprkle}  \﹣\ الـــزخرفــة : ${category.pirefix || "لا يوجد"}
        > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${category.hasTax === true ? "نعم" : category.hasTax === false ? "لا" : "غير محدد"}
        > ${config.wahitsprkle}  \﹣\ سعر الضريبه : ${category.taxPrice || "غير محدد"}
        > ${config.wahitsprkle}  \﹣\ سعر هاذا النوع : ${category.shopPrice || "غير محدد"}
        
        ${config.yelloshop} \-\ __ @everyone : ${category.everyoneMentions || "غير محدد"} __
        ${config.whaitshop} \-\ __ @here : ${category.hereMentions || "غير محدد"} __
        ${config.shopemoji} \-\ __ <@&${category.shopmen || "غير محدد"}> : ${category.shopRoleMentions} __
        ${config.warn} \-\ __ أقصى عدد تحذيرات: ${category.maxWarns || "غير محدد"} __
        **`;
    },
    // handlers/modules/commandsD.js:777
    commandsD_009: () => {
        return `يـرجـي قـرائـه الـقـوانـيـن و الإلـتـزام بـهـا`;
    },
    // handlers/modules/commandsD.js:791
    commandsD_010: ({ i }) => {
        return `الـمـسـؤول : <@${i.user.id}>`;
    },
    // handlers/modules/commandsD.js:858
    commandsD_011: ({ shopChannels }) => {
        return `يوجد ${shopChannels.length} متجر معطل.\nهل تريد بالتأكيد تفعيل جميع المتاجر؟`;
    },
    // handlers/modules/commandsD.js:908
    commandsD_012: () => {
        return `يـرجـى قـرائـة الـقـوانـيـن و الإلـتـزام بـهـا`;
    },
    // handlers/modules/commandsD.js:922
    commandsD_013: ({ i }) => {
        return `الـمـسـؤول : <@${i.user.id}>`;
    },
    // handlers/modules/commandsD.js:1002
    commandsD_014: ({ i }) => {
        return `الـمـسـؤول : <@${i.user.id}>`;
    },
    // handlers/modules/commandsD.js:1020
    commandsD_015: ({ i }) => {
        return `الـمـسـؤول : <@${i.user.id}>`;
    },
    // handlers/modules/commandsD.js:1087
    commandsD_016: () => {
        return "هل أنت متأكد أنك تريد تعطيل جميع المتاجر؟";
    },
    // handlers/modules/commandsD.js:1134
    commandsD_017: ({ i }) => {
        return `الـمـسـؤول : <@${i.user.id}>`;
    },
    // handlers/modules/commandsD.js:1203
    commandsD_018: () => {
        return "هل أنت متأكد أنك تريد ارسال ضريبة المتاجر؟";
    },
    // handlers/modules/commandsD.js:1268
    commandsD_019: ({ taxPrice }) => {
        return `يرجى دفع ضريـبة المتــجر
        وقــدرهــا $ ${taxPrice}
        عنــ طريق اســتخدام الــزر اللــذي بــ الاســفل`;
    },
    // handlers/modules/commandsD.js:1330
    commandsD_020: ({ msg }) => {
        return `${msg}`;
    },
    // handlers/modules/commandsD.js:1534
    commandsD_021: ({ roles }) => {
        return roles
            .map(
                (r, idx) =>
                    `**${idx + 1}. <@&${r.roleId}>**\n > <a:mg_money1:1542937635717259325> - السعر: \`${r.price}\`\n > <a:77:1542937530071253215> - المميزات: ${r.benefits}`,
            )
            .join("\n\n");
    },
    // handlers/modules/commandsD.js:1868
    commandsD_022: ({ customText }) => {
        return (
            customText ||
            ` المعلومات قابلة للتعديل في أي وقت\n تحويل كل مبالغ الكردت تكون عبر البوت`
        );
    },
    // handlers/modules/commandsD.js:1891
    commandsD_023: ({ i, myPts }) => {
        return `**<@${i.user.id}>**\n\nإجمالي نقاط الاستلام: **${myPts}** نقطة`;
    },
    // handlers/modules/commandsD.js:1923
    commandsD_024: ({ rows }) => {
        return rows.join("\n");
    },
    // handlers/modules/commandsD.js:1943
    commandsD_025: ({ text }) => {
        return (
            text ||
            `> <a:005:1542937522362122292> \`-\` الدعم الفني لمشاكل السيرفر والبوت\n` +
                `> <a:005:1542937522362122292> \`-\` تشهير نصاب لفتح تقرير رسمي ضد نصاب\n` +
                `> <a:005:1542937522362122292> \`-\` يجب قراءة القوانين قبل فتح أي تكت\n` +
                `> <a:005:1542937522362122292> \`-\` فتح تكت بدون سبب قد يؤدي لعقوبة\n\n` +
                `**> <a:005:1542937522362122292> \`-\`اضغط على الزر المناسب لفتح تكت:**`
        );
    },
    // handlers/modules/orderInteractions.js:164
    orderInteractions_001: () => {
        return "**سيتم إغلاق التذكرة خلال 5 ثواني...**";
    },
    // handlers/modules/orderInteractions.js:192
    orderInteractions_002: () => {
        return "**تم إغلاق التذكرة. يمكنك فتحها أو حذفها باستخدام الأزرار أدناه.**";
    },
    // handlers/modules/orderInteractions.js:218
    orderInteractions_003: () => {
        return "**تم فتح التذكرة مرة أخرى.**";
    },
    // handlers/modules/orderInteractions.js:497
    orderInteractions_004: ({
        bank,
        config,
        evrypri,
        guildName,
        interaction,
        totalPrice,
        userMessage,
    }) => {
        return `
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
         **تمت عملية الشراء بنجاح!**
          
        **التفاصيل:**
        - تم شـراء طلــب
        - تم التحويل لـ :\n ${bank} | <@!${bank}>
        - السيــرفر :\n ${interaction.guild.id} | ${guildName}
        - المشتري :\n ${interaction.user} | \`${interaction.user.id}\`
        - الطلــب المرســل :\n ${userMessage}
        - نـوع المنــنشن : (everyone) 
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
        
        - السعر الاصلـي: \`${evrypri}\` ${config.money}
        - الضريبة: \`${totalPrice - evrypri}\` ${config.money} 
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
        - **المجموع الكلي:** \`${totalPrice}\` ${config.money}
        `;
    },
    // handlers/modules/orderInteractions.js:953
    orderInteractions_005: ({
        bank,
        config,
        guildName,
        herepris,
        interaction,
        totalPrice,
        userMessage,
    }) => {
        return `
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
         **تمت عملية الشراء بنجاح!**
          
        **التفاصيل:**
        - تم شـراء طلــب
        - تم التحويل لـ :\n ${bank} | <@!${bank}>
        - السيــرفر :\n ${interaction.guild.id} | ${guildName}
        - المشتري :\n ${interaction.user} | \`${interaction.user.id}\`
        - الطلــب المرســل :\n ${userMessage}
        - نـوع المنــنشن : (here) 
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
        
        - السعر الاصلـي: \`${herepris}\` ${config.money}
        - الضريبة: \`${totalPrice - herepris}\` ${config.money} 
        ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
        - **المجموع الكلي:** \`${totalPrice}\` ${config.money}
        `;
    },
    // handlers/modules/orderInteractions.js:1090
    orderInteractions_006: () => {
        return "يرجى اختيار نوع المتجر من الأزرار أدناه.";
    },
    // handlers/modules/orderInteractions.js:1192
    orderInteractions_007: ({ categoryData, channel, config, sellerId }) => {
        return ` **
        > ${config.wahitsprkle}  \﹣\ المـتـجـر : ${channel}
        > 
        > ${config.wahitsprkle}  \﹣\ صـاحـب المـتـجـر : <@${sellerId}>
        > 
        > ${config.wahitsprkle}  \﹣\ نـوع المـتـجر : ${categoryData.nametype || "لم يتم العثور عليه"}
        > 
        > ${config.wahitsprkle}  \﹣\ رتبة هاذا النوع  : <@&${categoryData.shoprole || "لم يتم العثور عليه"}> 
        > 
        > ${config.wahitsprkle}  \﹣\ اقصى عدد للتحذيرات : ${categoryData.maxWarns || "غير محدد"}
        > 
        > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${categoryData.hasTax === true ? "نعم" : categoryData.hasTax === false ? "لا" : "غير محدد"}
        **`;
    },
    // handlers/modules/orderInteractions.js:1329
    orderInteractions_008: () => {
        return "يرجى اختيار نوع المتجر من الأزرار أدناه.";
    },
    // handlers/modules/orderInteractions.js:1425
    orderInteractions_009: ({
        categoryData,
        config,
        interaction,
        sellerId,
    }) => {
        return ` **
        > ${config.wahitsprkle}  \﹣\ المـتـجـر : ${interaction.channel}
        > 
        > ${config.wahitsprkle}  \﹣\ صـاحـب المـتـجـر : <@${sellerId}>
        > 
        > ${config.wahitsprkle}  \﹣\ نـوع المـتـجر : ${categoryData.nametype || "لم يتم العثور عليه"}
        > 
        > ${config.wahitsprkle}  \﹣\ رتبة هاذا النوع  : <@&${categoryData.shoprole || "لم يتم العثور عليه"}> 
        > 
        > ${config.wahitsprkle}  \﹣\ اقصى عدد للتحذيرات : ${categoryData.maxWarns || "غير محدد"}
        > 
        > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${categoryData.hasTax === true ? "نعم" : categoryData.hasTax === false ? "لا" : "غير محدد"}
        **`;
    },
    // handlers/modules/orderInteractions.js:1533
    orderInteractions_010: ({ config }) => {
        return `${config.warn} اسـتـبـيـان تحـذيـر المـتـاجـر`;
    },
    // handlers/modules/orderInteractions.js:1608
    orderInteractions_011: ({ shopChannel }) => {
        return `تم حذف متجرك ${shopChannel.name}`;
    },
    // handlers/modules/orderInteractions.js:1621
    orderInteractions_012: ({ shopChannel }) => {
        return `تم حذف متجر ${shopChannel.name}`;
    },
    // handlers/modules/orderInteractions.js:1727
    orderInteractions_013: () => {
        return `تـم تـحـديـد صـاحـب مـتـجـر بـنـجـاح.`;
    },
    // handlers/modules/orderInteractions.js:2036
    orderInteractions_014: ({ data }) => {
        return `
         ** > <a:MEX_SHOP:1542937632453959721>  \`-\` __Everyone__ : ${data.everyoneMentions || 0}**
        **> <a:MEX_SHOP:1542937632453959721>  \`-\` __Here__ : ${data.hereMentions || 0}**
        **> <a:MEX_SHOP:1542937632453959721>  \`-\` __Shop mention__ : ${data.shopRoleMentions || 0}**
                       `;
    },
    // handlers/modules/orderInteractions.js:2264
    orderInteractions_015: () => {
        return `
                أهلاً بك! اختر أحد الخيارات من الأسفل للحصول على المساعدة.
                إذا كنت بحاجة إلى مزيد من الدعم، قم بزيارة سيرفر الدعم.
              `;
    },
    // handlers/modules/commandsA.js:159
    commandsA_001: ({
        channel,
        config,
        every,
        hasTax,
        here,
        maxWarns,
        nametype,
        sellerId,
        shop,
        shopmen,
        shoprole,
    }) => {
        return ` **
        > ${config.wahitsprkle}  \﹣\ المـتـجـر : ${channel}
        > 
        > ${config.wahitsprkle}  \﹣\ صـاحـب المـتـجـر : <@${sellerId}>
        > 
        > ${config.wahitsprkle}  \﹣\ نـوع المـتـجر : ${nametype || "لم يتم العثور عليه"}
        > 
        > ${config.wahitsprkle}  \﹣\ رتبة هاذا النوع  : <@&${shoprole || "لم يتم العثور عليه"}> 
        > 
        > ${config.wahitsprkle}  \﹣\ تم انـشائـة منذ : <t:${parseInt(Date.now() / 1000)}:R>
        > 
        > ${config.wahitsprkle}  \﹣\ اقصى عدد للتحذيرات : ${maxWarns || "غير محدد"}
        > 
        > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${hasTax === true ? "نعم" : hasTax === false ? "لا" : "غير محدد"}
        
        ${config.yelloshop} \-\ __ @everyone :  ${every || "لم يتم العثور عليه"} __
        ${config.whaitshop} \-\ __ @here :  ${here || "لم يتم العثور عليه"} __
        ${config.shopemoji} \-\ __ <@&${shopmen || "لم يتم العثور عليه"}> :  ${shop || "لم يتم العثور عليه"} __
        **`;
    },
    // handlers/modules/commandsA.js:287
    commandsA_002: () => {
        return "**تـم تـرسـيـت الـمـنـشـنـات !**";
    },
    // handlers/modules/commandsA.js:415
    commandsA_003: ({
        channel,
        config,
        every,
        hasTax,
        here,
        maxWarns,
        nametype,
        sellerId,
        shop,
        shopmen,
        shoprole,
    }) => {
        return ` **
        > ${config.wahitsprkle}  \﹣\ المـتـجـر : ${channel}
        > 
        > ${config.wahitsprkle}  \﹣\ صـاحـب المـتـجـر : <@${sellerId}>
        > 
        > ${config.wahitsprkle}  \﹣\ نـوع المـتـجر : ${nametype || "لم يتم العثور عليه"}
        > 
        > ${config.wahitsprkle}  \﹣\ رتبة هاذا النوع  : <@&${shoprole || "لم يتم العثور عليه"}> 
        > 
        > ${config.wahitsprkle}  \﹣\ اقصى عدد للتحذيرات : ${maxWarns || "غير محدد"}
        > 
        > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${hasTax === true ? "نعم" : hasTax === false ? "لا" : "غير محدد"}
        
        ${config.yelloshop} \-\ __ @everyone :  ${every || "لم يتم العثور عليه"} __
        ${config.whaitshop} \-\ __ @here :  ${here || "لم يتم العثور عليه"} __
        ${config.shopemoji} \-\ __ <@&${shopmen || "لم يتم العثور عليه"}> :  ${shop || "لم يتم العثور عليه"} __
        **`;
    },
    // handlers/modules/commandsA.js:518
    commandsA_004: ({
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
    }) => {
        return `**
        > ${config.wahitsprkle}  \﹣\ صـاحـب المـتـجـر : <@${sellerId}>
        > 
        > ${config.wahitsprkle}  \﹣\ نـوع المـتـجر : ${nametype || "لم يتم العثور عليه"}
        > 
        > ${config.wahitsprkle}  \﹣\ رتبة هاذا النوع  : <@&${shoprole || "لم يتم العثور عليه"}> 
        > 
        > ${config.wahitsprkle}  \﹣\ تم انـشـائـة منذ : <t:${parseInt(Date.now() / 1000)}:R>
        > 
        > ${config.wahitsprkle}  \﹣\ اقصى عدد للتحذيرات : ${maxWarns || "غير محدد"}
        > 
        > ${config.wahitsprkle}  \﹣\ بضريبه؟ : ${hasTax === true ? "نعم" : hasTax === false ? "لا" : "غير محدد"}
        > 
        ${config.yelloshop} \-\ __ @everyone : ${everyoneMentions} __
        ${config.whaitshop} \-\ __ @here : ${hereMentions} __
        ${config.shopemoji} \-\ __ <@&${shopmen}> : ${shopRoleMentions} __
        **`;
    },
    // handlers/modules/commandsA.js:644
    commandsA_005: () => {
        return "**تفاصيل الحساب:**";
    },
    // handlers/modules/commandsA.js:854
    commandsA_006: () => {
        return "اضغط على الأزرار أدناه لعرض التفاصيل أو حذف الرد.";
    },
    // handlers/modules/commandsA.js:1027
    commandsA_007: ({ shopChannel }) => {
        return `تم حذف متجرك ${shopChannel.name}`;
    },
    // handlers/modules/commandsA.js:1039
    commandsA_008: ({ shopChannel }) => {
        return `تم حذف المتجر ${shopChannel.name}`;
    },
    // handlers/modules/commandsA.js:1298
    commandsA_009: ({ partnerMentions }) => {
        return `**- العـملاء:** ${partnerMentions}`;
    },
    // handlers/modules/commandsA.js:1343
    commandsA_010: ({ inactiveShops, totalShops, typeLines }) => {
        return `**إجمالي المتاجر:** ${totalShops}\n**غير المتفاعلة (بدون رسائل):** ${inactiveShops}\n\n**التفصيل حسب النوع:**\n${typeLines}`;
    },
    // handlers/modules/commandsA.js:1382
    commandsA_011: ({ daysStr, toDelete }) => {
        return `سيتم حذف **${toDelete.length}** متجر غير متفاعل خلال \`${daysStr}\`.\n\nهل أنت متأكد؟`;
    },
    // handlers/modules/commandsA.js:1397
    commandsA_012: ({ days, message, room }) => {
        return `**المدة:** كل \`${days}\` يوم\n**الروم:** <#${room.id}>\n**الرسالة:** ${message}`;
    },
    // handlers/modules/commandsA.js:1413
    commandsA_013: ({ cfg }) => {
        return `**المدة:** \`${cfg.days}\` يوم\n**الروم:** <#${cfg.roomId}>\n**الرسالة:** ${cfg.message}\n**النوع:** ${cfg.type || "الكل"}`;
    },
    // handlers/modules/commandsA.js:1445
    commandsA_014: ({ words }) => {
        return words.map((w, n) => `\`${n + 1}.\` ${w}`).join("\n");
    },
    // handlers/modules/commandsA.js:1460
    commandsA_015: ({ mode, room }) => {
        return `**الوضع:** ${
            mode === "auto" ? " تلقائي (يحذر ويمسح فوراً)" : "إرسال للروم"
        }\n${room ? `**روم المخالفات:** <#${room.id}>` : ""}`;
    },
    // handlers/modules/commandsB.js:99
    commandsB_001: () => {
        return "تم حذف رسالة العد التنازلي. هل تريد إنهاء المزاد؟";
    },
    // handlers/modules/commandsB.js:235
    commandsB_002: ({ reason }) => {
        return `تم تعيين حالتك كـ AFK: ${reason}`;
    },
    // handlers/modules/commandsB.js:312
    commandsB_003: () => {
        return `
                أهلاً بك! اختر أحد الخيارات من الأسفل للحصول على المساعدة.
                إذا كنت بحاجة إلى مزيد من الدعم، قم بزيارة سيرفر الدعم.
              `;
    },
    // handlers/modules/commandsB.js:797
    commandsB_004: () => {
        return "هل تريد بالتأكيد إرسال الرسالة لجميع المتاجر؟";
    },
    // handlers/modules/commandsB.js:834
    commandsB_005: ({ i, messageContent }) => {
        return `الـمـسـؤول : <@${i.user.id}>
        الرسالة
        ${messageContent}`;
    },
    // handlers/modules/commandsC.js:135
    commandsC_001: ({ config }) => {
        return `${config.warn} اسـتـبـيـان تحـذيـر المـتـاجـر`;
    },
    // handlers/modules/commandsC.js:514
    commandsC_002: ({ shop }) => {
        return `تـم نـقـل مـلـكـيـة مـتـجـر ${shop} بـنـجـاح.`;
    },
    // handlers/modules/commandsC.js:690
    commandsC_003: ({ taxChannel }) => {
        return taxChannel !== "غير مسجل"
            ? `الروم المسجل: <#${taxChannel}>`
            : "🚫 لا يوجد روم ضرائب مسجل.";
    },
    // handlers/modules/commandsC.js:789
    commandsC_004: ({ emojiChannel }) => {
        return emojiChannel !== "غير مسجل"
            ? `الروم المسجل: <#${emojiChannel}>`
            : "🚫 لا يوجد روم إيموجي مسجل.";
    },
    // handlers/modules/commandsC.js:895
    commandsC_005: ({ stickerChannelId }) => {
        return stickerChannelId !== "غير مسجل"
            ? `الروم المسجل: <#${stickerChannelId}>`
            : "🚫 لا يوجد روم استيكر مسجل.";
    },
    // index.js:2833
    index_001: ({ message }) => {
        return `**الـشـخـص الـذي أرسـل الـرسـالـه: ${message.author.tag} - <@${message.author.id}>\n\nالـرسـالـه: \`${message.content}\`**`;
    },
    // index.js:3194
    index_002: ({ PLAN_DURATIONS, botName, fmtDate, plan, updated }) => {
        return `**البوت:** ${botName}\n**الخطة:** ${PLAN_DURATIONS[plan].label}\n**تاريخ الانتهاء الجديد:** ${fmtDate(updated.expiresAt)}\n**نهاية فترة السماح:** ${fmtDate(updated.graceEndsAt)}`;
    },
    // index.js:3201
    index_003: ({ PLAN_DURATIONS, botName, fmtDate, plan, updated }) => {
        return `**البوت:** ${botName}\n**الخطة:** ${PLAN_DURATIONS[plan].label}\n**ينتهي في:** ${fmtDate(updated.expiresAt)}`;
    },
    // index.js:3206
    index_004: ({ PLAN_DURATIONS, botName, fmtDate, plan, updated }) => {
        return `**البوت:** ${botName}\n**الراعي:** <@${updated.ownerId}>\n**الخطة:** ${PLAN_DURATIONS[plan].label}\n**ينتهي:** ${fmtDate(updated.expiresAt)}`;
    },
    // index.js:3235
    index_005: ({ botName, fmtDate, sub }) => {
        return `**البوت:** ${botName}\n**الراعي:** <@${sub.ownerId}>\n**انتهى في:** ${fmtDate(sub.expiresAt)}\n\n **البوت أصبح متوقفاً.**\nأمامك **7 أيام** للتجديد قبل حذف بيانات البوت نهائياً.\n**موعد الحذف:** ${fmtDate(sub.graceEndsAt)}`;
    },
    // index.js:3284
    index_006: ({ botName, sub }) => {
        return `**البوت:** ${botName}\n**الراعي:** <@${sub.ownerId}>\n\n **انتهت فترة السماح (7 أيام) دون تجديد.**\nتم حذف توكن البوت وكل بياناته نهائياً.`;
    },
};
