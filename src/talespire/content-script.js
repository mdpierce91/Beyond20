const TALESPIRE_URL = `talespire://dice`;


// function advantageTalespireRoll(advantage, r1) {
//     try {
//         const format = (str, args) => {
//             for (const [key, value] of Object.entries(args))
//                 str = str.replace(new RegExp(`{${key}}`, "g"), value)
//             return str;
//         }
//         return {
//             [RollType.NORMAL]: " {{normal=1}}",
//             [RollType.DOUBLE]: " {{always=1}} {{r2=" + r1 + "}}",
//             [RollType.THRICE]: " {{always=1}} {{r2=" + r1 + "}} {{r3=" + r1 + "}}",
//             [RollType.QUERY]: format(ROLL20_ADVANTAGE_QUERY, { r2: r1, r2kh: r1.replace("1d20", "2d20kh1"), r2kl: r1.replace("1d20", "2d20kl1") }),
//             [RollType.ADVANTAGE]: " {{advantage=1}} {{r2=" + r1 + "}}",
//             [RollType.DISADVANTAGE]: " {{disadvantage=1}} {{r2=" + r1 + "}}",
//             [RollType.SUPER_ADVANTAGE]: " {{advantage=1}} {{r2=" + r1.replace("1d20", "2d20kh1") + "}}",
//             [RollType.SUPER_DISADVANTAGE]: " {{disadvantage=1}} {{r2=" + r1.replace("1d20", "2d20kl1") + "}}",
//         }[advantage];
//     } catch (err) {
//         return " {{normal=1}}";
//     }
// }

function createLabelledDice(request, name, properties) {
    if (properties.r1 === undefined){
        return '';
    }
    let dice = `${properties.r1.replace(/ /g,'')}`;
    let label = `${properties.charname}- ${properties.rname}`;
    if (request.advantage !== undefined && properties.normal === undefined && properties.always === undefined
        && ["simple", "atk", "atkdmg"].includes(name)) {
        return {
            [RollType.NORMAL]: `/${label}:${dice}`,
            [RollType.DOUBLE]: `/${label}:${dice}/${label}:${dice}`,
            [RollType.THRICE]: `/${label}:${dice}/${label}:${dice}/${label}:${dice}`,
            // [RollType.QUERY]: format(ROLL20_ADVANTAGE_QUERY, { r2: r1, r2kh: r1.replace("1d20", "2d20kh1"), r2kl: r1.replace("1d20", "2d20kl1") }),
            [RollType.ADVANTAGE]: `/${label} - Advantage:${dice}/${label} - Advantage:${dice}`,
            [RollType.DISADVANTAGE]: `/${label} - Disadvantage:${dice}/${label} - Disadvantage:${dice}`,
            [RollType.SUPER_ADVANTAGE]: `/${label} - Super Advantage:${dice}/${label} - Super Advantage:${dice}/${label} - Super Advantage:${dice}`,
            [RollType.SUPER_DISADVANTAGE]: `/${label} - Super Disadvantage:${dice}/${label} - Super Disadvantage:${dice}/${label} - Super Disadvantage:${dice}`,
        }[request.advantage];
    }
    else{
        return `/${label}:${dice}`;
    }
}

function addTalespireDamage(request, name, properties) {
    let result = '';
    let label = `${properties.charname}- ${properties.rname}: Damage`;
    for(let i=0; i< 5; i++){
        let dmg = properties[`dmg${i}`];
        if (dmg !== undefined){
            dmg = dmg.replace(/ /g, '');
            result += `/${label}:${dmg}`;
        }
    }
    return result;
}

function talespireTemplate(request, name, properties) {
    console.log('Recieved request to template.', request);
    console.log('With name: ', name);
    console.log('And properties', properties);

    if (request.whisper == WhisperType.HIDE_NAMES) {
        if (properties["charname"])
            properties["charname"] = "???"
        // Take into account links for disabled auto-roll-damages option
        if (properties["rname"])
            properties["rname"] = properties["rname"].includes("](!") ?
                properties["rname"].replace(/\[[^\]]*\]\(\!/, "[???](!") : "???";
        if (properties["rnamec"])
            properties["rnamec"] = properties["rnamec"].includes("](!") ?
                properties["rnamec"].replace(/\[[^\]]*\]\(\!/, "[???](!") : "???";
        delete properties["description"];
    }

    
    let dice = createLabelledDice(request, name, properties) + addTalespireDamage(request, name, properties);
    if (dice === undefined || dice.length === 0){
        return '';
    }

    let result = `${TALESPIRE_URL}${dice}`;

    console.log(`Giving result: "${result}"`);
    return result;
}

function talespireSubRolls(text, damage_only = false, overrideCB = null) {
    let replaceCB = overrideCB;
    if (!overrideCB) {
        replaceCB = (dice, modifier) => {
            if (damage_only && dice == "")
                return dice + modifier;
            const dice_formula = (dice === "" ? "1d20" : dice) + modifier;
            return genTalespireRoll(dice_formula);
        }
    }

    const result = replaceRolls(text, replaceCB);
    return result.replace(/\]\](\s*\+\s*)\[\[/g, '$1')
}

function rollTalespireSkill(request, custom_roll_dice = "") {
    console.log('Rolling a skill.');
    let modifier = request.modifier;
    return talespireTemplate(request, "simple", {
        "charname": request.character.name,
        "rname": request.skill,
        "mod": modifier + talespire_format_plus_mod(custom_roll_dice),
        "r1": genTalespireRoll(request.d20 || "1d20", { [request.ability]: modifier, "CUSTOM": custom_roll_dice })
    });
}

function rollTalespireAbility(request, custom_roll_dice = "") {
    const dice_roll = genTalespireRoll(request.d20 || "1d20", { [request.ability]: request.modifier, "CUSTOM": custom_roll_dice });
    return talespireTemplate(request, "simple", {
        "charname": request.character.name,
        "rname": request.name,
        "mod": request.modifier + talespire_format_plus_mod(custom_roll_dice),
        "r1": dice_roll
    });
}

function rollTalespireSavingThrow(request, custom_roll_dice = "") {
    return talespireTemplate(request, "simple", {
        "charname": request.character.name,
        "rname": request.name + " Save",
        "mod": request.modifier + talespire_format_plus_mod(custom_roll_dice),
        "r1": genTalespireRoll(request.d20 || "1d20", { [request.ability]: request.modifier, "CUSTOM": custom_roll_dice })
    });
}

function rollTalespireInitiative(request, custom_roll_dice = "") {
    const roll_properties = {
        "charname": request.character.name,
        "rname": "Initiative",
        "mod": request.initiative + talespire_format_plus_mod(custom_roll_dice),
        "r1": genTalespireRoll(request.d20 || "1d20", { "INIT": request.initiative, "CUSTOM": custom_roll_dice })
    }
    return talespireTemplate(request, "simple", roll_properties);
}

function rollTalespireHitDice(request) {
    const rname = "Hit Dice" + (request.multiclass ? `(${request.class})` : "");
    return talespireTemplate(request, "simple", {
        "charname": request.character.name,
        "rname": rname,
        "mod": request["hit-dice"],
        "r1": talespireSubRolls(request["hit-dice"]),
        "normal": 1
    });
}

function rollTalespireItem(request) {
    return rollTalespireTrait(request);
}

function rollTalespireTrait(request) {
    let source = request.type;
    if (request["source-type"] !== undefined) {
        source = request["source-type"];
        if (request.source.length > 0)
            source += ": " + request.source;
    } else if (request["item-type"] !== undefined) {
        source = request["item-type"];
    }
    return talespireTemplate(request, "traits", {
        "charname": request.character.name,
        "name": request.name,
        "source": source,
        "description": talespireTemplate(request, request.description)
    });
}

function rollTalespireDeathSave(request, custom_roll_dice = "") {
    return talespireTemplate(request, "simple", {
        "charname": request.character.name,
        "rname": "Death Saving Throw",
        "mod": talespire_format_plus_mod(custom_roll_dice),
        "r1": genTalespireRoll(request.d20 || "1d20", { "CUSTOM": custom_roll_dice }),
        "normal": 1
    });
}

function talespireSubDamageRolls(text) {
    return talespireSubRolls(text, true);
}

function damagesToTalespireRollProperties(damages, damage_types, crits, crit_types) {
    const properties = {
        "damage": 1,
        "dmg1flag": 1
    }

    properties["dmg1"] = talespireSubDamageRolls(damages[0]);
    properties["dmg1type"] = damage_types[0];
    if (crits && crits.length > 0)
        properties["crit1"] = settings["crit-prefix"] + talespireSubDamageRolls(crits[0]);

    if (damages.length > 1) {
        properties["dmg2flag"] = 1;
        properties["dmg2"] = talespireSubDamageRolls(damages.slice(1).join(" | "));
        properties["dmg2type"] = damage_types.slice(1).join(" | ");
        if (crits && crits.length > 1)
            properties["crit2"] = settings["crit-prefix"] + talespireSubDamageRolls(crits.slice(1).join(" | "));
    } else if (crits != undefined && crits.length > 1) {
        // If there are more than 1 crit but only 1 damage (brutal critical/savage attacks), then show all the crits as part of the first damage;
        properties["crit1"] = settings["crit-prefix"] + talespireSubDamageRolls(crits.join(" | "));
    }

    return properties;
}

function buildTalespireRangeString(request) {
    let range = request.range;
    if (request.aoe) {
        const shape = request['aoe-shape'] || "AoE";
        range += ` (${shape} ${request.aoe})`;
    }
    return range;
}

function rollTalespireAttack(request, custom_roll_dice = "") {
    const properties = {
        "charname": request.character.name,
        "rname": request.name
    }
    let template_type = "atkdmg";
    let dmg_props = {}
    if (request.rollAttack && request["to-hit"] !== undefined) {
        let d20_roll = request.d20 || "1d20";
        if (request["critical-limit"])
            d20_roll += "cs>" + request["critical-limit"];
        properties["mod"] = request["to-hit"] + talespire_format_plus_mod(custom_roll_dice);
        properties["r1"] = genTalespireRoll(d20_roll, { "": request["to-hit"], "CUSTOM": custom_roll_dice });
        properties["attack"] = 1;
    }
    if (request.damages !== undefined) {
        const damages = request.damages;
        const damage_types = request["damage-types"];
        const crit_damages = request["critical-damages"];
        const crit_damage_types = request["critical-damage-types"];

        dmg_props = damagesToTalespireRollProperties(damages, damage_types, crit_damages, crit_damage_types);
    }
    if (request.range !== undefined) {
        properties["range"] = buildTalespireRangeString(request);
    }

    if (request["save-dc"] !== undefined) {
        dmg_props["save"] = 1;
        dmg_props["saveattr"] = request["save-ability"];
        dmg_props["savedc"] = request["save-dc"];
    }
    if (request.rollDamage && !request.rollAttack) {
        template_type = "dmg";
        dmg_props["charname"] = request.character.name;
        dmg_props["rname"] = request.name;
    }
    if (request.damages && request.damages.length > 0 && 
        request["to-hit"] !== undefined && !request.rollDamage) {
        template_type = "atk";
        dmg_props["charname"] = request.character.name;
        dmg_props["rname"] = request.name;
        dmg_props["crit"] = 1;
        const dmg_template_crit = talespireTemplate(request, "dmg", dmg_props);
        delete dmg_props["crit"];
        delete dmg_props["crit1"];
        delete dmg_props["crit2"];
        dmg_template = talespireTemplate(request, "dmg", dmg_props);
        properties["rname"] = "[" + request.name + "](!\n" + dmg_template + ")";
        properties["rnamec"] = "[" + request.name + "](!\n" + dmg_template_crit + ")";
    } else {
        for (let key in dmg_props)
            properties[key] = dmg_props[key];
    }

    return talespireTemplate(request, template_type, properties);
}

function rollTalespireSpellAttack(request, custom_roll_dice) {
    const properties = {
        "charname": request.character.name,
        "rname": request.name
    }
    let template_type = "atkdmg";
    let dmg_props = {}
    if (request.rollAttack && request["to-hit"] !== undefined) {
        let d20_roll = request.d20 || "1d20";
        if (request["critical-limit"])
            d20_roll += "cs>" + request["critical-limit"];
        properties["mod"] = request["to-hit"] + talespire_format_plus_mod(custom_roll_dice);
        properties["r1"] = genTalespireRoll(d20_roll, { "": request["to-hit"], "CUSTOM": custom_roll_dice });
        properties["attack"] = 1;
    }
    if (request.damages !== undefined) {
        const damages = request.damages;
        const damage_types = request["damage-types"];
        const critical_damages = request["critical-damages"];
        const critical_damage_types = request["critical-damage-types"];
        if (request.name === "Chromatic Orb") {
            let chromatic_type = "?{Choose damage type";
            let chromatic_damage = null;
            let crit_damage = null;
            for (let dmgtype of ["Acid", "Cold", "Fire", "Lightning", "Poison", "Thunder"]) {
                let idx = damage_types.findIndex(t => t === dmgtype);
                chromatic_damage = damages.splice(idx, 1)[0];
                damage_types.splice(idx, 1);
                idx = critical_damage_types.findIndex(t => t === dmgtype);
                if (idx >= 0) {
                    crit_damage = critical_damages.splice(idx, 1)[0];
                    critical_damage_types.splice(idx, 1)[0];
                }
                chromatic_type += "|" + dmgtype;
            }
            chromatic_type += "}";
            damages.splice(0, 0, chromatic_damage);
            damage_types.splice(0, 0, chromatic_type);
            critical_damages.splice(0, 0, crit_damage);
            critical_damage_types.splice(0, 0, chromatic_type);
        } else if (request.name === "Dragon's Breath") {
            let dragons_breath_type = "?{Choose damage type";
            let dragons_breath_damage = null;
            for (let dmgtype of ["Acid", "Cold", "Fire", "Lightning", "Poison"]) {
                let idx = damage_types.findIndex(t => t === dmgtype);
                dragons_breath_damage = damages.splice(idx, 1)[0];
                damage_types.splice(idx, 1);
                dragons_breath_type += "|" + dmgtype;
            }
            dragons_breath_type += "}";
            damages.splice(0, 0, dragons_breath_damage);
            damage_types.splice(0, 0, dragons_breath_type);
        } else if (request.name.includes("Chaos Bolt")) {
            let base_damage = null;
            let crit_damage = null;
            for (let dmgtype of ["Acid", "Cold", "Fire", "Force", "Lightning", "Poison", "Psychic", "Thunder"]) {
                let idx = damage_types.findIndex(t => t === dmgtype);
                base_damage = damages.splice(idx, 1)[0];
                damage_types.splice(idx, 1);
                idx = critical_damage_types.findIndex(t => t === dmgtype);
                crit_damage = critical_damages.splice(idx, 1)[0];
                critical_damage_types.splice(idx, 1)[0];
            }
            damages.splice(0, 0, base_damage);
            damage_types.splice(0, 0, "Chaotic energy");
            critical_damages.splice(0, 0, crit_damage);
            critical_damage_types.splice(0, 0, "Chaotic energy");
        } else if (request.name === "Life Transference") {
            damages.push("Twice the Necrotic damage");
            damage_types.push("Healing");
        } else if (request.name === "Toll the Dead") {
            damages[0] = ROLL20_TOLL_THE_DEAD_QUERY.replace("d8", damages[0]).replace("d12", damages[0].replace("d8", "d12"));
        }
        dmg_props = damagesToTalespireRollProperties(damages, damage_types, critical_damages, critical_damage_types);
    }
    if (request.range !== undefined) {
        properties["range"] = buildTalespireRangeString(request);
    }
    if (request["save-dc"] != undefined) {
        dmg_props["save"] = 1;
        dmg_props["saveattr"] = request["save-ability"];
        dmg_props["savedc"] = request["save-dc"];
    }
    if (request["cast-at"] !== undefined)
        dmg_props["hldmg"] = genTalespireRoll(request["cast-at"][0]) + request["cast-at"].slice(1) + " Level";
    let components = request.components;
    if (settings["components-display"] === "all") {
        if (components != "") {
            properties["desc"] = settings["component-prefix"] + components;
            components = "";
        }
    } else if (settings["components-display"] === "material") {
        while (components != "") {
            if (["V", "S"].includes(components[0])) {
                components = components.slice(1);
                if (components.startsWith(", "))
                    components = components.slice(2);
            }
            if (components[0] == "M") {
                properties["desc"] = settings["component-prefix"] + components.slice(2, -1);
                components = "";
            }
        }
    }
    if (settings["roll20-spell-description-display"] === true) {
		properties["desc"] = properties["desc"] ? properties["desc"] + "\n\n" : "";
		properties["desc"] += `Description: ${request.description}`;
    }
    if (request.rollDamage && !request.rollAttack) {
        template_type = "dmg";
        dmg_props["charname"] = request.character.name;
        dmg_props["rname"] = request.name;
    }
    if (request.damages && request.damages.length > 0 &&
        request["to-hit"] !== undefined && !request.rollDamage) {
        template_type = "atk";
        dmg_props["charname"] = request.character.name;
        dmg_props["rname"] = request.name;
        dmg_props["crit"] = 1;
        const dmg_template_crit = talespireTemplate(request, "dmg", dmg_props);
        delete dmg_props["crit"];
        delete dmg_props["crit1"];
        delete dmg_props["crit2"];
        const dmg_template = talespireTemplate(request, "dmg", dmg_props);
        properties["rname"] = "[" + request.name + "](!\n" + dmg_template + ")";
        properties["rnamec"] = "[" + request.name + "](!\n" + dmg_template_crit + ")";
    } else {
        for (let key in dmg_props)
            properties[key] = dmg_props[key];
    }

    return talespireTemplate(request, template_type, properties);
}

async function handleTalespireRoll(request) {
    let custom_roll_dice = "";
    if (request.character.type == "Character")
        custom_roll_dice = request.character.settings["custom-roll-dice"] || "";
    if (request.type == "skill") {
        roll = rollTalespireSkill(request, custom_roll_dice);
    }
    else if (request.type == "ability") {
        roll = rollTalespireAbility(request, custom_roll_dice);
    }
    else if (request.type == "saving-throw") {
        roll = rollTalespireSavingThrow(request, custom_roll_dice);
    } 
    else if (request.type == "initiative") {
        roll = rollTalespireInitiative(request, custom_roll_dice);
    } 
    else if (request.type == "hit-dice") {
        roll = rollTalespireHitDice(request);
    } 
    else if (request.type == "item") {
        roll = rollTalespireItem(request);
    } 
    else if (["feature", "trait", "action"].includes(request.type)) {
        console.log('Messages(trait) are not supported by Talespire');
        return false;
    } 
    else if (request.type == "death-save") {
        roll = rollTalespireDeathSave(request, custom_roll_dice);
    } 
    else if (request.type == "attack") {
        roll = rollTalespireAttack(request, custom_roll_dice);
    } 
    else if (request.type == "spell-card") {
        console.log('Messages("spell-card") are not supported by Talespire');
        return false;
    } 
    else if (request.type == "spell-attack") {
        roll = rollTalespireSpellAttack(request, custom_roll_dice);
    } 
    else if (request.type == "chat-message") {
        console.log('Messages are not supported by Talespire');
        return false;
    } 
    else {
        // 'custom' || anything unexpected;
        const mod = request.modifier != undefined ? request.modifier : request.roll;
        const rname = request.name != undefined ? request.name : request.type;
        roll = talespireTemplate(request, "simple", {
            "charname": request.character.name,
            "rname": rname,
            "mod": mod,
            "r1": talespireSubRolls(request.roll),
            "normal": 1
        });
    }
    console.log(`Trying to open talespire link: "${roll}"`);

    try{
        // If there is a future integration that lets us post text a description could be nice.
        // window.open(request.description, "_self");
        if (roll !== undefined && roll.length > 0){
            window.open(roll, "_self");
        }
        else{
            console.log('Invalid roll aborted', roll);
        }
        
    }
    catch(e) {
        console.log(`Opened talespire link, recieved error: `, e);
    }
    return true;
}

function talespire_format_plus_mod(custom_roll_dice) {
    const prefix = custom_roll_dice && !["+", "-", "?", "&", ""].includes(custom_roll_dice.trim()[0]) ? " + " : "";
    // Handle crits here maybe?
    // return prefix + (custom_roll_dice || "").replace(/([0-9]*d[0-9]+)/, "$1cs0cf0");
    return prefix + (custom_roll_dice || "");
}

function genTalespireRoll(dice, modifiers = {}) {
    let roll = dice;
    for (let m in modifiers) {
        let mod = modifiers[m].trim();
        if (mod.length > 0) {
            if (["+", "-", "?", "&"].includes(mod[0])) {
                roll += " " + mod;
            } else {
                roll += "+" + mod;
            }
        }
    }
    return roll;
}


function handleTalespireMessage(request, sender, sendResponse) {
    // console.log("Got wrapped request: ", requestWrapper);
    // if (requestWrapper.target === "talespire") {
        // let request = requestWrapper.request;
        console.log("Got request : ", request);
        console.log("From  : ", sender);
        console.log("With sendResponse: ", sendResponse);
        if (request.action == "roll") {
            console.log('Recieved roll event.');
            if (request.type == "avatar") {
                roll_renderer.displayAvatarToDiscord(request);
                roll = rollAvatarDisplay(request);
                const character_name = request.whisper !== WhisperType.NO ? "???" : request.character.name;
                return postChatMessage(roll, character_name);
            }
            handleTalespireRoll(request);
        }
        else {
            console.log('Recieved a non-roll event, Talespire can currently only handle rolls');
        }
    // }
    // else{
    //     console.log('Non-talespire event, ignoring');
    // }
}

chrome.runtime.onMessage.addListener(handleTalespireMessage);