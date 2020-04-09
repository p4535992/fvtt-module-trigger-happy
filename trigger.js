class TriggerHappy {
    constructor() {
        game.settings.register("trigger-happy", "journalName", {
            name: "Name of the Trigger Journal to use",
            hint: "The name of the journal entry to use for listing triggers. There can only be one. Refer to README file in module website for how to configure triggers.",
            scope: "world",
            config: true,
            default: "Trigger Happy",
            type: String,
            onChange: this._parseJournals.bind(this)
        });
        Hooks.on("ready", this._parseJournals.bind(this));
        Hooks.on("canvasReady", this._onCanvasReady.bind(this));
        Hooks.on('controlToken', this._onControlToken.bind(this));
        Hooks.on('createJournalEntry', this._parseJournals.bind(this));
        Hooks.on('updateJournalEntry', this._parseJournals.bind(this));
        Hooks.on('deleteJournalEntry', this._parseJournals.bind(this));
        Hooks.on("preUpdateToken", this._onPreUpdateToken.bind(this));
        Hooks.on("preUpdateToken", this._finishTokenTriggers.bind(this));


        this.triggers = [];
    }

    get journalName() {
        return game.settings.get("trigger-happy", "journalName") || "Trigger Happy";
    }
    get journals() {
        const folders = game.folders.entities.filter(f => f.type === "JournalEntry" && f.name === this.journalName);
        const journals = game.journal.entities.filter(j => j.name === this.journalName);
        return this._getFoldersContentsRecursive(folders, journals);
    }

    _getFoldersContentsRecursive(folders, contents) {
        return folders.reduce((contents, folder) => {
            // Cannot use folder.content and folder.children because they are set on populate and only show what the user can see
            const content = game.journal.entities.filter(j => j.data.folder === folder.id)
            const children = game.folders.entities.filter(f => f.type === "JournalEntry" && f.data.parent === folder.id)
            contents.push(...content)
            return this._getFoldersContentsRecursive(children, contents);
        }, contents);
    }

    _parseJournals() {
        this.triggers = []
        this.journals.forEach(journal => this._parseJournal(journal));
    }
    _parseJournal(journal) {
        const triggerLines = journal.data.content.replace(/(<p>|<div>|<br *\/?>)/gm, '\n').split("\n");
        for (const line of triggerLines) {
            const entityLinks = CONST.ENTITY_LINK_TYPES.concat(["ChatMessage", "Token", "Trigger"])
            const entityMatchRgx = `@(${entityLinks.join("|")})\\[([^\\]]+)\\](?:{([^}]+)})?`;
            const rgx = new RegExp(entityMatchRgx, 'g');
            let trigger = null;
            let options = [];
            const effects = []
            for (let match of line.matchAll(rgx)) {
                const [string, entity, id, label] = match;
                if (entity === "Trigger") {
                    options = id.split(" ");
                    continue;
                }
                if (!trigger && entity !== "Actor" && entity !== "Token" && entity !== "Scene") break;
                let effect = null;
                if (entity === "ChatMessage") {
                    effect = new ChatMessage({ content: id, speaker: {alias: label} });
                } else if (entity === "Token") {
                    effect = new Token({ name: id });
                } else {
                    const config = CONFIG[entity];
                    if (!config) continue;
                    effect = config.entityClass.collection.get(id)
                    if (!effect)
                        effect = config.entityClass.collection.entities.find(e => e.name === id);
                }
                if (!trigger && !effect) break;
                if (!trigger) {
                    trigger = effect;
                    continue;
                }
                if (!effect) continue;
                effects.push(effect)
            }
            if (trigger)
                this.triggers.push({ trigger, effects, options })
        }
    }

    async _executeTriggers(triggers) {
        if (!triggers.length) return;
        for (const trigger of triggers) {
            for (let effect of trigger.effects) {
                if (effect.entity === "Scene") {
                    if (trigger.options.includes("preload"))
                        await game.scenes.preload(effect.id);
                    else
                        await effect.view();
                } else if (effect.entity === "Macro") {
                    await effect.execute();
                } else if (effect.entity === "RollTable") {
                    await effect.draw();
                } else if (effect.entity === "ChatMessage") {
                    const chatData = duplicate(effect.data)
                    if (trigger.options.includes("ooc"))
                        chatData.type = CONST.CHAT_MESSAGE_TYPES.OOC;
                    else if (trigger.options.includes("emote"))
                        chatData.type = CONST.CHAT_MESSAGE_TYPES.EMOTE;
                    else if (trigger.options.includes("whisper")) {
                        chatData.type = CONST.CHAT_MESSAGE_TYPES.WHISPER;
                        chatData.whisper = ChatMessage.getWhisperRecipients("GM");
                    }
                    await ChatMessage.create(chatData);
                } else if (effect.constructor.name === "Token") {
                    const token = canvas.tokens.placeables.find(t => t.name === effect.name)
                    if (token)
                        await token.control();
                } else {
                    await effect.sheet.render(true);
                }
            }
        }
    }
    /**
     * Checks if a token is causing a trigger to be activated
     * @param {Token} token       The token to test
     * @param {Object} trigger    The trigger to test against
     * @param {String} type       Type of trigger, can be 'click' or 'move'
     */
    _isTokenTrigger(token, trigger, type) {
        const isTrigger = ((trigger.trigger.entity === "Actor" && trigger.trigger.id === token.data.actorId) ||
            (trigger.trigger.constructor.name === "Token" && trigger.trigger.data.name === token.data.name));
        if (!isTrigger) return false;
        if (type === "click")
            return trigger.options.includes('click') || (!trigger.options.includes('move') && !token.data.hidden);
        if (type === "move")
            return trigger.options.includes('move') || (!trigger.options.includes('click') && token.data.hidden);
        if (type === "capture")
            return trigger.options.includes("capture");
        return true;
    }
    _isSceneTrigger(scene, trigger) {
        return trigger.trigger.entity === "Scene" && trigger.trigger.id === scene.id;
    }
    _getTokensAt(tokens, position) {
        return tokens.filter(target => {
            console.log("target ", target.name,  target.data.x, target.data.y, target.w, target.h, target.data.width, target.data.height)
            return (target.data.x <= position.x) && (target.data.x + target.w >= position.x)
                && (target.data.y <= position.y) && (target.data.y + target.h >= position.y);
        });
    }

    _getTriggerTokens (tokens, triggers, type) {
        return tokens.filter(token => triggers.some(trigger => this._isTokenTrigger(token, trigger, type)));
    }

    _getTokenTriggers(tokens, triggers, type) {
        return triggers.filter(trigger => tokens.some(token => this._isTokenTrigger(token, trigger, type)));
    }

    _onCanvasReady(canvas) {
        const triggers = this.triggers.filter(trigger => this._isSceneTrigger(canvas.scene, trigger));
        this._executeTriggers(triggers);
        canvas.stage.on('mousedown', (ev) => this._onMouseDown(ev))
    }
    
    _getMousePosition(event) {
        let transform = canvas.tokens.worldTransform;
        return {
            x: (event.data.global.x - transform.tx) / canvas.stage.scale.x,
            y: (event.data.global.y - transform.ty) / canvas.stage.scale.y
        };
    }
    _onMouseDown(event) {
        const position = this._getMousePosition(event);
        const clickTokens = this._getTokensAt(canvas.tokens.placeables, position);
        if (clickTokens.length === 0) return;
        const downTriggers = this._getTokenTriggers(clickTokens, this.triggers, 'click');
        if (downTriggers.length === 0) return;
        canvas.stage.once('mouseup', (ev) => this._onMouseUp(ev, clickTokens, downTriggers));
    }

    _onMouseUp(event, tokens, downTriggers) {
        const position = this._getMousePosition(event);
        const upTokens = this._getTokensAt(tokens, position);
        if (upTokens.length === 0) return;
        const triggers = this._getTokenTriggers(upTokens, this.triggers, 'click');
        this._executeTriggers(triggers);
    }

    _onControlToken(token, controlled) {
        if (!controlled) return;
        const tokens = [token];
        const triggers = this._getTokenTriggers(tokens, this.triggers, 'click');
        if (triggers.length === 0) return;
        token.once('click', (ev) => this._onMouseUp(ev, tokens, triggers));
    }

    _finishTokenTriggers(scene, userId, update) {
        if (!scene.isView) return true;
        if (update.x === undefined && update.y === undefined) return true;
        const token = scene.data.tokens.find(t => t._id === update._id);
        if (token.hidden) return true; // don't stop ivnisible tokens?
        const position = {
            x: (update.x || token.x) + token.width * scene.data.grid / 2,
            y: (update.y || token.y) + token.height * scene.data.grid / 2
        };
        const movementTokens = canvas.tokens.placeables.filter(tok => tok.data._id !== token._id);
        const tokens = this._getTokensAt(movementTokens, position);
        if (tokens.length === 0) return true;
        const triggers = this._getTokenTriggers(tokens, this.triggers, 'move');
        if (triggers.length === 0) return true;
        if (triggers.some(trigger => trigger.options.includes("stopMovement"))) {
            this._executeTriggers(triggers);
            return false;
        }
        Hooks.once('updateToken', () => this._executeTriggers(triggers));
        return true;
    }
  
    _onPreUpdateToken(scene, id, update) {
        if (!scene.isView) return true;
        if (update.x === undefined && update.y === undefined) return true;
        const token = scene.data.tokens.find(t => t._id === update._id);
        if (token.hidden) return true; // don't stop ivnisible tokens?

        // Get all trigger tokens in scene
        let targets = this._getTriggerTokens(canvas.tokens.placeables, this.triggers, 'capture');
        if (!targets) return true;

        let x = update.x || token.x;
        let  y = update.y || token.y;
        let tw = token.width * canvas.scene.data.grid / 2;
        let th = token.height * canvas.scene.data.grid / 2;
        let motion = new Ray({x: token.x + tw, y: token.y + th}, {x: x + tw, y: y + th});

        // don't trigger on tokens that are already captured
        targets = targets.filter(target => token.x !== target.x + target.w  / 2 - tw || token.y !== target.y + target.h / 2 - th)
        
        // sort list by distance from start token position
        targets.sort((a , b) => dist(token.x, token.y, b.x, b.y) - dist(token.x, token.y, a.x, a.y));
        
        targets.forEach(target => {
            // test motion vs token diagonals
            if (motion.intersectSegment([target.x, target.y, target.x + target.w, target.y + target.h])
            || motion.intersectSegment([target.x, target.y + target.h, target.x + target.w, target.y])) {
                update.x = target.x + target.w / 2 - tw;
                update.y = target.y + target.h / 2 - th;
                return true;
            }
        })
        return true;
    };
}

let dist = (x0, y0, x1, y1) => {
    return (x0 - x1)**2 + (y0-y1)**2;
}

Hooks.on('init', () => game.triggers = new TriggerHappy())
