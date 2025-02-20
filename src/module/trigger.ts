import CONSTANTS from './constants';
import { HTMLEnricherTriggers } from './HTMLEnricherTriggers.js';
import { i18n, log, warn } from './lib/lib.js';
import { registerSettings } from './settings.js';
import { registerSocket } from './socket';
import {
  ChatLink,
  CompendiumLink,
  EffectLink,
  EVENT_TRIGGER_ENTITY_TYPES,
  SoundLink,
  TriggerHappyJournal,
  TRIGGER_ENTITY_TYPES,
} from './trigger-happy-models.js';

export class TriggerHappy {
  registeredEffects: string[] = [];
  triggers: TriggerHappyJournal[] = [];
  arrayTriggers: string[] = [];
  arrayEvents: string[] = [];
  arrayPlaceableObjects: string[] = [];
  arrayNoPlaceableObjects: string[] = [];
  journals: TriggerHappyJournal[] = [];
  taggerModuleActive: boolean;
  release: boolean;
  enableRelease: boolean;
  ifNoTokenIsFoundTryToUseActor: boolean;

  constructor() {
    Hooks.on('ready', (...args) => {
      this._parseJournals();
    });
    Hooks.on('canvasReady', (...args) => {
      this._onCanvasReady(canvas);
    });
    Hooks.on('controlToken', this._onControlToken.bind(this));
    Hooks.on('createJournalEntry', (entityData, data) => {
      const folders = <Folder[]>game.folders?.contents.filter((f) => {
        return f.type === 'JournalEntry' && f.name === this.folderJournalName;
      });
      if (
        folders.some((folder) => {
          return folder.name == entityData.folder?.name;
        })
      ) {
        this._parseJournals();
      }
    });
    Hooks.on('updateJournalEntry', (entityData, data) => {
      //@ts-ignore
      if (game.triggers?.journals?.filter((e) => e.id === entityData.id).length > 0) {
        this._parseJournals();
      }
    });
    Hooks.on('deleteJournalEntry', (entityData, data) => {
      //@ts-ignore
      if (game.triggers?.journals?.filter((e) => e.id === entityData.id).length > 0) {
        this._parseJournals();
      }
    });
    Hooks.on('preUpdateToken', this._onPreUpdateToken.bind(this));
    Hooks.on('preUpdateWall', this._onPreUpdateWall.bind(this));
    Hooks.on('renderSettingsConfig', (...args) => {
      this._parseJournals();
    }); // TODO maybe we don't need this anymore ???
    Hooks.on('preUpdateNote', this._onPreUpdateNote.bind(this));
    Hooks.on('getSceneNavigationContext', (...args) => {
      this._parseJournals();
    }); // parse again the journal when change scene

    this.registeredEffects = [];
    this.triggers = [];
    this.arrayTriggers = Object.values(TRIGGER_ENTITY_TYPES);
    this.arrayEvents = Object.values(EVENT_TRIGGER_ENTITY_TYPES);
    this.arrayPlaceableObjects = [
      TRIGGER_ENTITY_TYPES.TOKEN,
      TRIGGER_ENTITY_TYPES.DRAWING,
      TRIGGER_ENTITY_TYPES.DOOR,
      TRIGGER_ENTITY_TYPES.JOURNAL_ENTRY,
      TRIGGER_ENTITY_TYPES.STAIRWAY,
    ];
    this.arrayNoPlaceableObjects = [
      TRIGGER_ENTITY_TYPES.ACTOR,
      TRIGGER_ENTITY_TYPES.CHAT_MESSAGE,
      TRIGGER_ENTITY_TYPES.COMPENDIUM,
      TRIGGER_ENTITY_TYPES.SCENE,
      TRIGGER_ENTITY_TYPES.SOUND_LINK,
      TRIGGER_ENTITY_TYPES.PLAYLIST,
      // New support key ????
      TRIGGER_ENTITY_TYPES.OOC,
      TRIGGER_ENTITY_TYPES.EMOTE,
      TRIGGER_ENTITY_TYPES.WHISPER,
      TRIGGER_ENTITY_TYPES.SELF_WHISPER,
    ];
    this.journals = [];
  }

  init() {
    this.taggerModuleActive = <boolean>game.modules.get('tagger')?.active;
    this.release = <boolean>game.settings.get('core', 'leftClickRelease');
    this.enableRelease = <boolean>game.settings.get(CONSTANTS.MODULE_NAME, 'enableAvoidDeselectOnTriggerEvent');
    this.ifNoTokenIsFoundTryToUseActor = <boolean>(
      game.settings.get(CONSTANTS.MODULE_NAME, 'ifNoTokenIsFoundTryToUseActor')
    );
    // this.triggers = [];
    // this.arrayTriggers = Object.values(TRIGGER_ENTITY_TYPES);
    // this.arrayEvents = Object.values(EVENT_TRIGGER_ENTITY_TYPES);
    // this.arrayPlaceableObjects = [
    //   TRIGGER_ENTITY_TYPES.TOKEN,
    //   TRIGGER_ENTITY_TYPES.DRAWING,
    //   TRIGGER_ENTITY_TYPES.DOOR,
    //   TRIGGER_ENTITY_TYPES.JOURNAL_ENTRY,
    //   TRIGGER_ENTITY_TYPES.STAIRWAY,
    // ];
    // this.arrayNoPlaceableObjects = [
    //   TRIGGER_ENTITY_TYPES.ACTOR,
    //   TRIGGER_ENTITY_TYPES.CHAT_MESSAGE,
    //   TRIGGER_ENTITY_TYPES.COMPENDIUM,
    //   TRIGGER_ENTITY_TYPES.SCENE,
    //   TRIGGER_ENTITY_TYPES.SOUND_LINK,
    //   TRIGGER_ENTITY_TYPES.PLAYLIST,
    //   // New support key ????
    //   TRIGGER_ENTITY_TYPES.OOC,
    //   TRIGGER_ENTITY_TYPES.EMOTE,
    //   TRIGGER_ENTITY_TYPES.WHISPER,
    //   TRIGGER_ENTITY_TYPES.SELF_WHISPER,
    // ];
    // this.journals = [];
  }

  get folderJournalName() {
    return <string>game.settings.get(CONSTANTS.MODULE_NAME, 'folderJournalName') || CONSTANTS.FOLDER_JOURNAL_DEFAULT;
  }

  get journalName() {
    return <string>game.settings.get(CONSTANTS.MODULE_NAME, 'journalName') || CONSTANTS.FOLDER_JOURNAL_DEFAULT;
  }

  registerEffect(keyName) {
    if (keyName) {
      this.registeredEffects.push(keyName);
    }
  }

  _updateJournals() {
    const folders = game.folders?.contents.filter(
      (f) => f.type === 'JournalEntry' && f.name === this.folderJournalName,
    );
    const journals = game.journal?.contents.filter((j) => j.name === this.journalName);
    // Make sure there are no duplicates (journal name is within a folder with the trigger name)
    this.journals = Array.from(new Set(this._getFoldersContentsRecursive(folders, journals)));
  }

  _getFoldersContentsRecursive(folders, contents) {
    const currentScene = game.scenes?.current;
    const enableJournalForScene = game.settings.get(CONSTANTS.MODULE_NAME, 'enableJournalForSceneIntegration');
    const onlyUseJournalForScene = game.settings.get(CONSTANTS.MODULE_NAME, 'onlyUseJournalForSceneIntegration');

    return folders.reduce((contents, folder) => {
      // Cannot use folder.content and folder.children because they are set on populate and only show what the user can see
      let content: JournalEntry[] = game.journal?.contents.filter((j) => j.data.folder === folder.id) || []; // This is the array of journalEntry under the current folder
      if (enableJournalForScene) {
        const contentTmp: JournalEntry[] = [];
        content.forEach((journalEntry) => {
          if (
            currentScene &&
            (journalEntry.data.name.startsWith(<string>currentScene.name) ||
              journalEntry.id?.startsWith(currentScene.id))
          ) {
            contentTmp.push(journalEntry);
          } else {
            if (!onlyUseJournalForScene) {
              contentTmp.push(journalEntry); // standard
            }
          }
        });
        content = contentTmp;
      }
      if (content && content.length > 0) contents.push(...content);
      const children = game.folders?.contents.filter((f) => f.type === 'JournalEntry' && f.data.parent === folder.id);
      return this._getFoldersContentsRecursive(children, contents);
    }, contents);
  }

  async _parseJournals() {
    this.triggers = [];
    if (game.user?.isGM && !game.settings.get(CONSTANTS.MODULE_NAME, 'enableTriggers')) {
      return;
    }
    this._updateJournals();
    this.journals.forEach((journal) => this._parseJournal(journal));
  }

  async _parseJournal(journal) {
    const triggerLines = journal.data.content
      .replace(/(<p>|<div>|<br *\/?>)/gm, '\n')
      .replace(/&nbsp;/gm, ' ')
      .split('\n');

    // Remove empty/undefined/non valid lines before loop more easy to debug
    const filteredTriggerLines = triggerLines.filter(function (el) {
      return el != null && el != undefined && el != '' && el.includes('@');
    });

    const entityLinks = Object.keys(CONFIG).concat(this.arrayTriggers);
    entityLinks.push(...this.registeredEffects);

    //const entityMatchRgx = `@(${entityLinks.join('|')})\\[([^\\]]+)\\](?:{([^}]+)})?`;
    // const entityMatchRgx = `@(${entityLinks.join('|')})\\[((?:[^\[\\]]+|\\[(?:[^\\[\\]]+|\\[[^\\[\\]]*\\])*\\])*)\\](?:{([^}]+)})?`;
    const entityMatchRgx = `@(${entityLinks.join(
      '|',
    )})\\[((?:[^[\\]]+|\\[(?:[^\\[\\]]+|\\[[^\\[\\]]*\\])*\\])*)\\](?:{([^}]+)})?`;
    const rgx = new RegExp(entityMatchRgx, 'ig');

    const entityMatchRgxTagger = `@(Tag)\\[([^\\]]+)\\]`;
    const rgxTagger = new RegExp(entityMatchRgxTagger, 'ig');

    for (const line of filteredTriggerLines) {
      // We check this anyway with module tagger active or no
      const matchAllTags = line.matchAll(rgxTagger) || [];
      const filterTags: string[] = [];
      let lineTmp = line;
      for (const matchTag of matchAllTags) {
        if (matchTag) {
          const [triggerJournal, entity, id, label] = matchTag;
          lineTmp = lineTmp.replace(triggerJournal, '');
          // Remove prefix '@Tag[' and suffix ']'
          filterTags.push(...triggerJournal.substring(5, triggerJournal.length - 1).split(','));
        }
      }

      const options: string[] = [];
      const triggers: string[] = [];
      const effects: any[] = [];

      const matchs = lineTmp.matchAll(rgx);
      let index = 0;
      for (const match of matchs) {
        const [triggerJournal, entityTmp, id, label] = match;
        const entity = entityTmp.toLowerCase(); // force lowercase for avoid miss typing from the user
        if (index === 0) {
          // Special case '*'
          if (id === '*') {
            const triggersTmp = this._retrieveAllFromEntity(entity) ?? [];
            for (let trigger of triggersTmp) {
              if (trigger != null && trigger != undefined) {
                trigger = this._checkTagsOnTrigger(entity, trigger, filterTags);
                if (trigger) {
                  if (typeof trigger === 'string' || trigger instanceof String) {
                    trigger = trigger.toLowerCase(); // force lowercase for avoid miss typing from the user
                  }
                }
                if (trigger) {
                  triggers.push(trigger);
                }
              }
            }
          } else {
            if (!game.settings.get(CONSTANTS.MODULE_NAME, 'enableMultipleTriggerSearch')) {
              let trigger = this._manageTriggerEvent(triggerJournal, entity, id, label);
              if (!trigger) {
                break;
              }
              trigger = this._checkTagsOnTrigger(entity, trigger, filterTags);
              if (!trigger) {
                break;
              }
              if (trigger) {
                if (typeof trigger === 'string' || trigger instanceof String) {
                  trigger = trigger.toLowerCase(); // force lowercase for avoid miss typing from the user
                }
              }
              if (trigger) {
                triggers.push(trigger);
              }
            } else {
              const triggersTmp = <any[]>this._manageTriggerEventMultiple(triggerJournal, entity, id, label) ?? [];
              for (let trigger of triggersTmp) {
                if (trigger != null && trigger != undefined) {
                  trigger = <any>this._checkTagsOnTrigger(entity, trigger, filterTags);
                  if (trigger) {
                    if (typeof trigger === 'string' || trigger instanceof String) {
                      trigger = trigger.toLowerCase(); // force lowercase for avoid miss typing from the user
                    }
                  }
                  if (trigger) {
                    triggers.push(trigger);
                  }
                }
              }
            }
          }
        } else if (entity === TRIGGER_ENTITY_TYPES.TRIGGER) {
          const ids = id.split(' ');
          for (const id1 of ids) {
            let eventLink = this._manageTriggerEvent(triggerJournal, entity, id1, label);
            if (eventLink) {
              if (typeof eventLink === 'string' || eventLink instanceof String) {
                eventLink = eventLink.toLowerCase(); // force lowercase for avoid miss typing from the user
              }
            }
            if (eventLink) {
              options.push(eventLink);
            }
          }
        } else {
          // see if there is a custom one
          let foundCustomEffect = false;
          if (this.registeredEffects.length > 0) {
            this.registeredEffects.forEach((registeredEffect) => {
              if (registeredEffect.toLowerCase() === entity.toLowerCase()) {
                foundCustomEffect = true;
                if (id) {
                  const ids: string[] = id ? id.split(' ') : [];
                  let args: string[] = [];
                  if (typeof ids === 'string' || ids instanceof String) {
                    args = Array.from(ids);
                  } else {
                    args = ids;
                  }
                  const effectLink = new EffectLink(registeredEffect, args);
                  effects.push(effectLink);
                } else {
                  if (!game.settings.get(CONSTANTS.MODULE_NAME, 'disableWarningMessages')) {
                    warn(`Can't manage the event '${entity}' on '${triggerJournal}'`);
                  }
                }
              }
            });
          }
          if (foundCustomEffect) {
            continue;
          }
          let effect = this._manageTriggerEvent(triggerJournal, entity, id, label);
          if (effect) {
            if (typeof effect === 'string' || effect instanceof String) {
              effect = effect.toLowerCase(); // force lowercase for avoid miss typing from the user
            }
          }
          if (effect) {
            effects.push(effect);
          }
        }
        index++;
      }

      if (triggers.length > 0 && effects.length > 0) {
        if (options.length == 0) {
          options.push('click');
        }
        triggers.forEach((trigger) => {
          this.triggers.push({ trigger, effects, options });
        });
      }
    }
  }

  _checkTagsOnTrigger(entity, trigger, filterTags): string | null {
    // If is a placeable object
    if (
      this.arrayPlaceableObjects.find((el) => {
        return el.toLowerCase() === entity.toLowerCase();
      })
    ) {
      // MAnage the special case DoorControl is not a placeable object the wall is
      if (trigger instanceof DoorControl) {
        trigger = trigger.wall;
      }
      if (trigger && trigger instanceof PlaceableObject) {
        // Before do anything check the tagger feature module settings (only for placeable object)
        //@ts-ignore
        if (this.taggerModuleActive && window.Tagger && filterTags) {
          // Check if the current placeable object has the specific tags from the global module settings
          // const tagsFromPlaceableObject = Tagger.getTags(trigger) || [];
          const tagsFromSetting =
            <string[]>(<string>game.settings.get(CONSTANTS.MODULE_NAME, 'enableTaggerIntegration'))?.split(',') || [];
          const filteredTagsFromSetting = tagsFromSetting.filter(function (el) {
            return el != null && el != undefined && el != '';
          });
          if (filteredTagsFromSetting.length > 0) {
            // Check if every tags on settings is included on the current placeableObject tag list
            //@ts-ignore
            const isValid = Tagger.hasTags(trigger, filteredTagsFromSetting, {
              caseInsensitive: true,
              sceneId: game.scenes?.current?.id,
            });
            if (!isValid) {
              trigger = null;
            }
          }
          // Check if the current placeable object has the specific tags from the specific placeable object settings
          if (trigger && filterTags && filterTags.length > 0) {
            // Check if the current placeable object has the specific tag from the @TAG[label] annotation
            //@ts-ignore
            const isValid = Tagger.hasTags(trigger, filterTags, {
              caseInsensitive: true,
              sceneId: game.scenes?.current?.id,
            });
            if (!isValid) {
              trigger = null;
            }
          }
        }
      }
      if (!trigger) {
        trigger = null;
      }
    }
    return trigger;
  }

  _manageTriggerEvent(triggerJournal, entity, id, label) {
    let trigger;
    if (!id && !label) {
      if (!game.settings.get(CONSTANTS.MODULE_NAME, 'disableWarningMessages')) {
        warn(`Can't manage the empty trigger '${entity}' on '${triggerJournal}'`);
      }
      return;
    }
    let isAManagedTrigger = false;
    // If is a trigger event (special case)
    if (entity === TRIGGER_ENTITY_TYPES.TRIGGER) {
      isAManagedTrigger = true;
      const found = this.arrayEvents.find((el) => {
        return el.toLowerCase() === id?.toLowerCase() || el.toLowerCase() === label?.toLowerCase();
      });
      if (!found) {
        if (!game.settings.get(CONSTANTS.MODULE_NAME, 'disableWarningMessages')) {
          warn(`Can't manage the event '${entity}' on '${triggerJournal}'`);
        }
        return;
      }
      if (id) {
        trigger = id;
      }
      if (label) {
        trigger = label;
      }
    }
    // If is a placeable object
    else if (
      this.arrayPlaceableObjects.find((el) => {
        return el.toLowerCase() === entity.toLowerCase();
      })
    ) {
      isAManagedTrigger = true;
      let relevantDocument = this._retrieveFromEntity(entity, id, label);
      if (!relevantDocument && label) {
        relevantDocument = this._retrieveFromEntity(entity, label, label);
      }
      trigger = relevantDocument;
      // const placeableObjectId = relevantDocument.id;
      // Filter your triggers only for the current scene
      // const placeableObjects = this._getObjectsFromScene(game.scenes.current);
      // const placeableObjectTrigger = placeableObjects.filter((obj) => obj.id === placeableObjectId)[0];
      // const placeableObjectTrigger = relevantDocument;
      // trigger = placeableObjectTrigger;
    }
    // If is not a placeable object
    else if (
      this.arrayNoPlaceableObjects.find((el) => {
        return el.toLowerCase() === entity.toLowerCase();
      })
    ) {
      isAManagedTrigger = true;
      let relevantDocument = this._retrieveFromEntity(entity, id, label);
      if (!relevantDocument && label) {
        relevantDocument = this._retrieveFromEntity(entity, label, label);
      }
      trigger = relevantDocument;
    }
    // Generic last standing try to find a configuration for the key
    if (!trigger && !isAManagedTrigger) {
      let configKey;
      for (const key of Object.keys(CONFIG)) {
        if (key.toLowerCase() === entity) {
          configKey = key;
          break;
        }
      }
      const config = CONFIG[configKey];
      if (!config) {
        if (!game.settings.get(CONSTANTS.MODULE_NAME, 'disableWarningMessages')) {
          warn(`Can't manage the config with entity '${entity}' and key '${configKey}' on '${triggerJournal}'`);
        }
        return;
      }
      if (!config.collection) {
        if (!game.settings.get(CONSTANTS.MODULE_NAME, 'disableWarningMessages')) {
          warn(
            `Can't manage the config collection with entity '${entity}' and key '${configKey}' on '${triggerJournal}'`,
          );
        }
        return;
      }
      trigger = config.collection.instance.get(id);
      if (!trigger && id) {
        trigger = config.collection.instance.getName(id);
      }
      if (!trigger && label) {
        trigger = config.collection.instance.get(label);
      }
      if (!trigger && label) {
        trigger = config.collection.instance.getName(label);
      }
    } else {
      if (!trigger) {
        if (!game.settings.get(CONSTANTS.MODULE_NAME, 'disableWarningMessages')) {
          warn(
            `Can't retrieve the config with entity '${entity}' and key '${id}' or '${label}' on '${triggerJournal}'`,
          );
        }
      }
    }
    return trigger;
  }

  _manageTriggerEventMultiple(triggerJournal: string, entity: string, id: string, label: string): string[] | null {
    let triggers: any[] = [];
    if (!id && !label) {
      if (!game.settings.get(CONSTANTS.MODULE_NAME, 'disableWarningMessages')) {
        warn(`Can't manage the empty trigger '${entity}' on '${triggerJournal}'`);
      }
      return null;
    }
    // let isAManagedTrigger = false;
    // If is a placeable object
    if (
      this.arrayPlaceableObjects.find((el) => {
        return el.toLowerCase() === entity.toLowerCase();
      })
    ) {
      // isAManagedTrigger = true;
      let relevantDocuments = this._retrieveFromEntityMultiple(entity, id, label);
      if ((!relevantDocuments || relevantDocuments.length == 0) && label) {
        relevantDocuments = this._retrieveFromEntityMultiple(entity, label, label);
      }
      triggers = <WallDocument[] | Note[]>relevantDocuments;
    }
    // If is not a placeable object
    else if (
      this.arrayNoPlaceableObjects.find((el) => {
        return el.toLowerCase() === entity.toLowerCase();
      })
    ) {
      // isAManagedTrigger = true;
      let relevantDocuments = this._retrieveFromEntityMultiple(entity, id, label);
      if ((!relevantDocuments || relevantDocuments.length == 0) && label) {
        relevantDocuments = this._retrieveFromEntityMultiple(entity, label, label);
      }
      triggers = <WallDocument[] | Note[]>relevantDocuments;
    }
    if (!triggers || triggers.length == 0) {
      if (!game.settings.get(CONSTANTS.MODULE_NAME, 'disableWarningMessages')) {
        warn(`Can't retrieve the config with entity '${entity}' and key '${id}' or '${label}' on '${triggerJournal}'`);
      }
    }
    return triggers;
  }

  async _executeTriggers(triggers) {
    if (!triggers.length) {
      return;
    }
    for (const trigger of triggers) {
      // CHECK FOR TH HIDE/UNHIDE MECHANISM
      if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.ONLY_IF_HIDDEN)) {
        if (trigger.trigger.data?.hidden == false) {
          return;
        }
      }
      if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.ONLY_IF_UNHIDDEN)) {
        if (trigger.trigger.data?.hidden == true) {
          return;
        }
      }
      if (game.settings.get(CONSTANTS.MODULE_NAME, 'disableAllHidden')) {
        if (
          trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.ONLY_IF_UNHIDDEN) ||
          trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.ONLY_IF_HIDDEN)
        ) {
          // Do nothing
        } else {
          if (trigger.trigger.data?.hidden == true) {
            return;
          }
        }
      }

      for (const effect of trigger.effects) {
        if (effect.documentName === 'Scene') {
          if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.PRELOAD)) {
            await game.scenes?.preload(effect.id);
          } else {
            const scene = <Scene>game.scenes?.get(effect.id);
            await scene.view();
          }
        } else if (effect instanceof Macro) {
          await effect.execute();
        } else if (effect instanceof RollTable) {
          await effect.draw();
        } else if (effect instanceof ChatMessage) {
          const chatData = duplicate(effect.data);
          if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.OOC)) {
            chatData.type = CONST.CHAT_MESSAGE_TYPES.OOC;
          } else if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.EMOTE)) {
            chatData.type = CONST.CHAT_MESSAGE_TYPES.EMOTE;
          } else if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.WHISPER)) {
            chatData.type = CONST.CHAT_MESSAGE_TYPES.WHISPER;
          } else if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.SELF_WHISPER)) {
            chatData.type = CONST.CHAT_MESSAGE_TYPES.WHISPER;
          }
          if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.WHISPER)) {
            chatData.whisper = []; //ChatMessage.getWhisperRecipients('GM');
            for (const user of ChatMessage.getWhisperRecipients('GM')) {
              chatData.whisper.push(user.id);
            }
          } else if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.SELF_WHISPER)) {
            chatData.whisper = [<string>game.user?.id];
          }
          // strange bug fix so the chat message is like is speak from the token instead from the player ?
          // need a selected token anyway
          // if(canvas?.tokens?.controlled?.length > 0){
          //   let tokenId = chatData.speaker.token;
          //   let actorId = chatData.speaker.actor;
          //   let sceneId = chatData.speaker.scene;
          //   let token = canvas?.tokens?.controlled[0];
          //   let alias = effect.alias;
          //   let scene = canvas.scene;
          //   let user = game.userId;
          //   //, message = new ChatMessage;
          //   if(tokenId){
          //     token = scene.tokens.get(tokenId)
          //   }
          //   if(!actorId){
          //     actorId = token.actor.id
          //   }
          //   if(sceneId){
          //     sceneId = scene.id
          //   }
          //   if(actorId || tokenId){
          //     if(!alias){
          //       if(token){
          //         alias = token.name
          //       } else {
          //         alias = game.actors.get(actorId).name
          //       }
          //     }
          //     chatData.speaker = {scene: sceneId, actor: actorId, token: tokenId, alias: alias};
          //   }
          // }
          await ChatMessage.create(chatData);
        } else if (effect instanceof ChatLink) {
          const chatData = duplicate(effect.chatMessage.data);
          if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.OOC)) {
            chatData.type = CONST.CHAT_MESSAGE_TYPES.OOC;
          } else if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.EMOTE)) {
            chatData.type = CONST.CHAT_MESSAGE_TYPES.EMOTE;
          } else if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.WHISPER)) {
            chatData.type = CONST.CHAT_MESSAGE_TYPES.WHISPER;
          } else if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.SELF_WHISPER)) {
            chatData.type = CONST.CHAT_MESSAGE_TYPES.WHISPER;
          }
          if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.WHISPER)) {
            chatData.whisper = []; //ChatMessage.getWhisperRecipients('GM');
            if (effect.whisper && effect.whisper.length > 0) {
              chatData.whisper = effect.whisper;
            } else {
              for (const user of ChatMessage.getWhisperRecipients('GM')) {
                chatData.whisper.push(user.id);
              }
            }
            // chatData.whisper =
            //   effect.whisper && effect.whisper.length > 0 ? effect.whisper : ChatMessage.getWhisperRecipients('GM');
          } else if (trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.SELF_WHISPER)) {
            chatData.whisper = effect.whisper && effect.whisper.length > 0 ? effect.whisper : [game.user?.id];
          }
          // strange bug fix so the chat message is like is speak from the token instead from the player ?
          // need a selected token anyway
          // if(canvas?.tokens?.controlled?.length > 0){
          //   let tokenId = chatData.speaker.token;
          //   let actorId = chatData.speaker.actor;
          //   let sceneId = chatData.speaker.scene;
          //   let token = canvas?.tokens?.controlled[0];
          //   let alias = effect.alias;
          //   let scene = canvas.scene;
          //   let user = game.userId;
          //   //, message = new ChatMessage;
          //   if(tokenId){
          //     token = scene.tokens.get(tokenId)
          //   }
          //   if(!actorId){
          //     actorId = token.actor.id
          //   }
          //   if(sceneId){
          //     sceneId = scene.id
          //   }
          //   if(actorId || tokenId){
          //     if(!alias){
          //       if(token){
          //         alias = token.name
          //       } else {
          //         alias = game.actors.get(actorId).name
          //       }
          //     }
          //     chatData.speaker = {scene: sceneId, actor: actorId, token: tokenId, alias: alias};
          //   }
          // }
          await ChatMessage.create(chatData);
        } else if (effect instanceof Token || effect instanceof TokenDocument) {
          const placeablesToken = this._getTokens(undefined);
          const tokenDocument = placeablesToken.find((t) => t.name === effect.name || t.id === effect.id);
          if (tokenDocument) {
            await tokenDocument.object?.control();
          }
        } else if (effect instanceof CompendiumLink) {
          const pack = <CompendiumCollection<CompendiumCollection.Metadata>>game.packs.get(effect.packId);
          if (!pack.index.size) {
            await pack.getIndex();
          }
          const compendium = await pack.getDocument(effect.id);
          if (compendium) {
            //@ts-ignore
            await compendium.sheet.render(true);
          }
        } else if (effect instanceof SoundLink) {
          const startsWith = '';
          const playlistName = effect.playlistName;
          const soundName = effect.soundName;
          const playlist = game.playlists?.contents.find((p) =>
            startsWith ? p.name?.startsWith(playlistName) : p.name === playlistName,
          );
          if (!playlist) {
            return;
          }
          const sound = <PlaylistSound>playlist.sounds.find((s) => {
            return (startsWith && s.name?.startsWith(soundName)) || s.name === soundName;
          });
          if (sound) {
            playlist.updateEmbeddedDocuments('PlaylistSound', [{ _id: sound.id, playing: !sound.playing }]);
          }
        } else if (effect instanceof Playlist) {
          const sounds = (effect.sounds && effect.sounds.contents) ?? [];
          if (sounds && sounds.length > 0) {
            const sound = sounds[Math.floor(Math.random() * sounds.length)];
            if (sound) {
              effect.updateEmbeddedDocuments('PlaylistSound', [{ _id: sound.id, playing: !sound.playing }]);
            }
          }
        } else if (effect instanceof Note || effect instanceof NoteDocument) {
          const placeablesToken = this._getNotes(undefined);
          const note = placeablesToken.find((t) => t.name === effect.name || t.id === effect.id);
          if (note) {
            await note.sheet?.render(true);
          }
        } else if (effect.documentName === 'JournalEntry') {
          const placeablesJournal = this._getJournals();
          const journal = placeablesJournal.find((t) => t.name === effect.name || t.id === effect.id);
          if (journal) {
            await journal.sheet?.render(true);
          }
        } else if (effect instanceof WallDocument || effect instanceof Wall) {
          let wall = effect;
          if (wall instanceof Wall && wall.document) {
            //@ts-ignore
            wall = effect.document;
          }
          const state = effect.data.ds;
          const states = CONST.WALL_DOOR_STATES;
          // Determine whether the player can control the door at this time
          if (!game.user?.can('WALL_DOORS')) {
            return;
          }
          if (game.paused && !game.user?.isGM) {
            ui.notifications.warn('GAME.PausedWarning', { localize: true });
            return;
          }
          // Play an audio cue for locked doors
          if (state === states.LOCKED) {
            AudioHelper.play({ src: CONFIG.sounds.lock });
            return;
          }
          // Toggle between OPEN and CLOSED states
          //@ts-ignore
          if (effect.document) {
            //@ts-ignore
            effect.document.update({ ds: state === states.CLOSED ? states.OPEN : states.CLOSED });
          } else {
            //@ts-ignore
            effect.update({ ds: state === states.CLOSED ? states.OPEN : states.CLOSED });
          }
        } else if (effect instanceof EffectLink) {
          const key = effect.key;
          const args = effect.args;
          Hooks.call('TriggerHappy', key, args);
        } else {
          await effect.sheet.render(true);
        }
      }
    }
  }

  _isTokenTrigger(token, trigger, type) {
    const isTrigger =
      (trigger.trigger instanceof Actor && trigger.trigger.id === token.data.actorId) ||
      (trigger.trigger instanceof TokenDocument && trigger.trigger.id === token.id) ||
      (trigger.trigger instanceof Token && trigger.trigger.id === token.id);
    if (!isTrigger) {
      return false;
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CLICK) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK) ||
        (!trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE) && !token.data.hidden)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.MOVE) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE) ||
        (!trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK) && token.data.hidden)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CAPTURE) {
      return trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CAPTURE);
    }
    return true;
  }

  _isNoteTrigger(note, trigger, type) {
    const isTrigger =
      (trigger.trigger instanceof Note && trigger.trigger.id === note.id) ||
      (trigger.trigger instanceof NoteDocument && trigger.trigger.id === note.id) ||
      (trigger.trigger.documentName === 'JournalEntry' && trigger.trigger.sceneNote?.id === note.id);
    if (!isTrigger) {
      return false;
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CLICK) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK) ||
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.MOVE) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE) ||
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CAPTURE) {
      return trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CAPTURE);
    }
    return true;
  }

  _isJournalTrigger(journal, trigger, type) {
    const isTrigger = trigger.trigger.documentName === 'JournalEntry' && trigger.trigger.id === journal.id;
    if (!isTrigger) {
      return false;
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CLICK) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK) ||
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.MOVE) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE) ||
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CAPTURE) {
      return trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CAPTURE);
    }
    return true;
  }

  _isStairwayTrigger(stairway, trigger, type) {
    // const isTrigger =
    //   (trigger.trigger instanceof Stairway && trigger.trigger.id === stairway.id) ||
    //   (trigger.trigger instanceof StairwayDocument && trigger.trigger.id === stairway.id);
    const isTrigger =
      (trigger.trigger?.document?.documentName === 'Stairway' && trigger.trigger.id === stairway.id) ||
      (trigger.trigger?.documentName === 'Stairway' && trigger.trigger.id === stairway.id);
    if (!isTrigger) {
      return false;
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CLICK) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK) ||
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.MOVE) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE) ||
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CAPTURE) {
      return trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CAPTURE);
    }
    return true;
  }

  _isDrawingTrigger(drawing, trigger, type) {
    const isTrigger =
      (trigger.trigger instanceof Drawing && trigger.trigger.id === drawing.id) ||
      (trigger.trigger instanceof DrawingDocument && trigger.trigger.id === drawing.id);
    if (!isTrigger) {
      return false;
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CLICK) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK) ||
        (!trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE) && !drawing.data.hidden)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.MOVE) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE) ||
        (!trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK) && drawing.data.hidden)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CAPTURE) {
      return trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CAPTURE);
    }
    return true;
  }

  _isSceneTrigger(scene, trigger) {
    return trigger.trigger instanceof Scene && trigger.trigger.id === scene.id;
  }

  _isWallTrigger(wall, trigger, type) {
    const isTrigger =
      (trigger.trigger instanceof Wall && trigger.trigger.id === wall.id) ||
      (trigger.trigger instanceof WallDocument && trigger.trigger.id === wall.id) ||
      (trigger.trigger instanceof DoorControl && trigger.trigger.doorControl?.id === wall.id);
    if (!isTrigger) {
      return false;
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CLICK) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK) ||
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.MOVE) {
      return (
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.MOVE) ||
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CLICK)
      );
    }
    if (type === EVENT_TRIGGER_ENTITY_TYPES.CAPTURE) {
      return trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.CAPTURE);
    }
    return true;
  }

  _placeableContains(placeable, position) {
    // TODO FIND A BETTER METHOD FOR THIS IF I SCALE A PLACEABLE OBJECT IS

    // Tokens have getter (since width/height is in grid increments) but drawings use data.width/height directly
    // The placeable could have many types: TokenDocument, DrawingDocument, NoteDocument, JournalEntry, and perhaps others
    // If I understand correctly, however, only TokenDocuments and DrawingDocuments have an 'area' to consider for collisions

    // return Number.between(position.x, x, x + w) && Number.between(position.y, y, y + h);
    if (placeable instanceof TokenDocument) {
      // TokenDocument.data reports width and height in terms of grid units. We could calculate the size in pixels manually, but
      // TokenDocument.object already reports the size and position of the token in pixels, so we will use it instead.
      //
      // TokenDocument.object.w and .h report the size of the token object according to its boundaries on the grid (orange rectangle on hover)
      // while .width and .height refer to the token image, which takes into account the image scale as well. For the purpose of clicks and token
      // collisions, we will consider scaling and rotation of the token image to be purely aesthetic, and work off of the token's grid dimensions
      //@ts-ignore
      const x = placeable.object.x;
      //@ts-ignore
      const y = placeable.object.y;
      //@ts-ignore
      const width = placeable.object.w;
      //@ts-ignore
      const height = placeable.object.h;

      // For both Tokens and Drawings, we will start by determining if 'position' is inside the placeable's bounding box
      // Since tokens have rectangular boundaries, we don't need to perform any other calculations
      return Number.between(position.x, x, x + width) && Number.between(position.y, y, y + height);
    } else if (placeable instanceof DrawingDocument) {
      // For a DrawingDocument, the width and height of the contents are stored in DrawingDocument.data
      // the .data member also includes .points, which contains the coordinates of the drawing's vertices relative to the drawing's origin
      const x = placeable.data.x;
      const y = placeable.data.y;
      const width = placeable.data.width;
      const height = placeable.data.height;
      // Possible drawing types: (r)ectangle, circl(e), (p)olygon, (f)reehand
      const type = placeable.data.type;

      if (placeable.data.rotation != 0) {
        // It looks like Foundry applies the rotation to the image drawn on the canvas, but not to the position or size of the DrawingData
        // Instead of rotating the entire DrawingData to match what is rendered on the canvas, we can just inverse-rotate position
        const drawing_center = [x + 0.5 * width, y + 0.5 * height];
        position = {
          x:
            Math.cos((-placeable.data.rotation * Math.PI) / 180) * (position.x - <number>drawing_center[0]) -
            Math.sin((-placeable.data.rotation * Math.PI) / 180) * (position.y - <number>drawing_center[1]) +
            <number>drawing_center[0],
          y:
            Math.sin((-placeable.data.rotation * Math.PI) / 180) * (position.x - <number>drawing_center[0]) +
            Math.cos((-placeable.data.rotation * Math.PI) / 180) * (position.y - <number>drawing_center[1]) +
            <number>drawing_center[1],
        };
      }

      // For both Tokens and Drawings, we will start by determining if 'position' is inside the placeable's bounding box
      if (Number.between(position.x, x, x + width) && Number.between(position.y, y, y + height)) {
        // If the position is within the bounding box, then we can perform additional tests to see if it is within the drawing's geometry
        if (type == 'r') {
          // A rectangle is its own bounding box, so we've already determined that it contains the position
          return true;
        } else if (type == 'e') {
          // All points inside an ellipse satisfy the following inequality
          return (
            (position.x - x - 0.5 * width) ** 2 * (0.5 * height) ** 2 +
              (position.y - y - 0.5 * height) ** 2 * (0.5 * width) ** 2 <=
            (0.5 * width) ** 2 * (0.5 * height) ** 2
          );
        } else if (type == 'p' || type == 'f') {
          // Point and freehand drawings have point data that we can use to perform a point inclusion in polygon test as described in https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html
          // To get the pixel coordinates of the vertices, we have to add the drawing origin
          const vertices = placeable.data.points.map((point) => [point[0] + x, point[1] + y]);
          let isInside = false;
          // let i = 0,
          //   j = vertices.length - 1;
          for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            if (
              //@ts-ignore
              vertices[i][1] > position.y != vertices[j][1] > position.y &&
              position.x <
                //@ts-ignore
                ((vertices[j][0] - vertices[i][0]) * (position.y - vertices[i][1])) /
                  //@ts-ignore
                  (vertices[j][1] - vertices[i][1]) +
                  //@ts-ignore
                  vertices[i][0]
            ) {
              isInside = !isInside;
            }
          }
          return isInside;
        } else {
          // If this runs, then foundry added a new drawing type. Guess we'll default to just using the bounding box
          return true;
        }
      } else {
        // If the position is outside the bounding box, then we know immediately that the drawing does not contain it
        return false;
      }
    }

    // TODO other specific placeable case NoteDocument, WallDocument
    else {
      // Other types of placeables don't have an area that could contain the position
      let width = placeable.w || placeable.data?.width || placeable.width;
      if (placeable?.object) {
        width = placeable?.object?.w || placeable?.object?.data?.width || placeable?.object?.width || width;
      }
      let height = placeable.h || placeable.data?.height || placeable.height;
      if (placeable?.object) {
        height = placeable?.object?.h || placeable?.object?.data?.height || placeable?.object?.height || height;
      }
      let x = placeable.x || placeable?.data?.x;
      if (placeable?.object) {
        x = placeable?.object?.x || placeable?.object?.data?.x || x;
      }
      let y = placeable?.y || placeable?.data?.y;
      if (placeable?.object) {
        y = placeable?.object?.y || placeable?.object?.data?.y || placeable?.object?.y || y;
      }
      return Number.between(position.x, x, x + width) && Number.between(position.y, y, y + height);
    }
  }

  _getPlaceablesAt(placeables, position) {
    return placeables.filter((placeable) => this._placeableContains(placeable, position));
  }

  // return all tokens which have a token trigger
  _getTokensFromTriggers(tokens, triggers, type) {
    return tokens.filter((token) => triggers.some((trigger) => this._isTokenTrigger(token, trigger, type)));
  }

  _getDrawingsFromTriggers(drawings, triggers, type) {
    return drawings.filter((drawing) => triggers.some((trigger) => this._isDrawingTrigger(drawing, trigger, type)));
  }

  _getNotesFromTriggers(notes, triggers, type) {
    return notes.filter((note) => triggers.some((trigger) => this._isNoteTrigger(note, trigger, type)));
  }

  _getJournalsFromTriggers(journals, triggers, type) {
    return journals.filter((journal) => triggers.some((trigger) => this._isJournalTrigger(journal, trigger, type)));
  }

  _getStairwaysFromTriggers(stairways, triggers, type) {
    return stairways.filter((stairway) => triggers.some((trigger) => this._isStairwayTrigger(stairway, trigger, type)));
  }

  // return all triggers for the set of tokens
  _getTriggersFromTokens(triggers, tokens, type) {
    return triggers.filter((trigger) => tokens.some((token) => this._isTokenTrigger(token, trigger, type)));
  }

  _getTriggersFromNotes(triggers, notes, type) {
    // Don't trigger on notes while on the note layer.
    if (canvas.activeLayer === canvas.notes) return [];
    return triggers.filter((trigger) => notes.some((note) => this._isNoteTrigger(note, trigger, type)));
  }

  _getTriggersFromJournals(triggers, journals, type) {
    // Don't trigger on notes while on the note layer.
    if (canvas.activeLayer === canvas.notes) return [];
    return triggers.filter((trigger) => journals.some((journal) => this._isJournalTrigger(journal, trigger, type)));
  }

  _getTriggersFromStairways(triggers, stairways, type) {
    // Don't trigger on stairways while on the stairway layer.
    //@ts-ignore
    if (canvas.activeLayer === canvas.stairways) return [];
    return triggers.filter((trigger) => stairways.some((stairway) => this._isStairwayTrigger(stairway, trigger, type)));
  }

  _getTriggersFromDrawings(triggers, drawings, type) {
    // Don't trigger on drawings while on the drawing layer.
    if (canvas.activeLayer === canvas.drawings) return [];
    return triggers.filter((trigger) => drawings.some((drawing) => this._isDrawingTrigger(drawing, trigger, type)));
  }

  async _onCanvasReady(canvas) {
    try {
      const triggers = this.triggers.filter((trigger) => this._isSceneTrigger(canvas.scene, trigger));
      await this._executeTriggers(triggers);
      canvas.stage.on('mousedown', (ev) => this._onMouseDown(ev));
    } finally {
      this._parseJournals();
    }
  }

  _getMousePosition(event) {
    // let transform = canvas.tokens.worldTransform;
    // return {
    //   x: (event.data.global.x - transform.tx) / canvas.stage.scale.x,
    //   y: (event.data.global.y - transform.ty) / canvas.stage.scale.y,
    // };
    // NEW METHOD SEEM MORE PRECISE
    const position = canvas.app?.renderer.plugins.interaction.mouse.getLocalPosition(canvas.app.stage);
    return {
      x: position.x,
      y: position.y,
    };
  }

  _onMouseDown(event) {
    const position = this._getMousePosition(event);
    const clickTokens = this._getPlaceablesAt(this._getTokens(undefined), position);
    const clickDrawings = this._getPlaceablesAt(this._getDrawings(undefined), position);
    const clickNotes = this._getPlaceablesAt(this._getNotes(undefined), position);
    const clickJournals = this._getPlaceablesAt(this._getJournals(), position);
    const clickStairways = this._getPlaceablesAt(this._getStairways(event.sceneId), position);

    if (
      clickTokens.length === 0 &&
      clickDrawings.length == 0 &&
      clickNotes.length == 0 &&
      clickStairways.length == 0 &&
      clickJournals == 0
    ) {
      return;
    }
    const downTriggers = this._getTriggersFromTokens(this.triggers, clickTokens, EVENT_TRIGGER_ENTITY_TYPES.CLICK);
    downTriggers.push(...this._getTriggersFromDrawings(this.triggers, clickDrawings, EVENT_TRIGGER_ENTITY_TYPES.CLICK));
    downTriggers.push(...this._getTriggersFromNotes(this.triggers, clickNotes, EVENT_TRIGGER_ENTITY_TYPES.CLICK));
    downTriggers.push(...this._getTriggersFromJournals(this.triggers, clickJournals, EVENT_TRIGGER_ENTITY_TYPES.CLICK));
    downTriggers.push(
      ...this._getTriggersFromStairways(this.triggers, clickStairways, EVENT_TRIGGER_ENTITY_TYPES.CLICK),
    );
    if (downTriggers.length === 0) {
      return;
    }
    // Needed this for module compatibility and the release on click left option active
    if (this.release && this.enableRelease) {
      game.settings.set('core', 'leftClickRelease', false);
    }
    canvas.stage?.once('mouseup', (ev) =>
      this._onMouseUp(ev, downTriggers, clickTokens, clickDrawings, clickNotes, clickJournals, clickStairways),
    );
  }

  _onMouseUp(event, downTriggers, tokens, drawings, notes, journals, stairways) {
    try {
      const position = this._getMousePosition(event);
      const upTokens = this._getPlaceablesAt(tokens, position);
      const upDrawings = this._getPlaceablesAt(drawings, position);
      const upNotes = this._getPlaceablesAt(notes, position);
      const upJournals = this._getPlaceablesAt(journals, position);
      const upStairways = this._getPlaceablesAt(stairways, position);
      if (
        upTokens.length === 0 &&
        upDrawings.length === 0 &&
        upNotes.length === 0 &&
        upStairways.length === 0 &&
        upJournals.length === 0
      ) {
        return;
      }
      const triggers = this._getTriggersFromTokens(this.triggers, upTokens, EVENT_TRIGGER_ENTITY_TYPES.CLICK);
      triggers.push(...this._getTriggersFromDrawings(this.triggers, upDrawings, EVENT_TRIGGER_ENTITY_TYPES.CLICK));
      triggers.push(...this._getTriggersFromNotes(this.triggers, upNotes, EVENT_TRIGGER_ENTITY_TYPES.CLICK));
      triggers.push(...this._getTriggersFromJournals(this.triggers, upJournals, EVENT_TRIGGER_ENTITY_TYPES.CLICK));
      triggers.push(...this._getTriggersFromStairways(this.triggers, upStairways, EVENT_TRIGGER_ENTITY_TYPES.CLICK));
      this._executeTriggers(triggers);
    } finally {
      if (this.enableRelease) {
        // Needed this for module compatibility and the release on click left option active
        game.settings.set('core', 'leftClickRelease', this.release);
      }
    }
  }

  _onControlToken(token, controlled) {
    if (!controlled) return;
    const tokens = [token];
    const triggers = this._getTriggersFromTokens(this.triggers, tokens, EVENT_TRIGGER_ENTITY_TYPES.CLICK);
    if (triggers.length === 0) return;
    // Needed this for module compatibility and the release on click left option active
    if (this.release && this.enableRelease) {
      game.settings.set('core', 'leftClickRelease', false);
    }
    token.once('click', (ev) => this._onMouseUp(ev, triggers, tokens, [], [], [], []));
  }

  _doMoveTriggers(tokenDocument, scene, update) {
    const token = tokenDocument.object;
    const position = {
      x: (update.x || token.x) + (token.data.width * scene.data.grid) / 2,
      y: (update.y || token.y) + (token.data.height * scene.data.grid) / 2,
    };
    const movementTokens = this._getTokens(undefined).filter((tok) => tok.data._id !== token.id);
    const tokens = this._getPlaceablesAt(movementTokens, position);
    const drawings = this._getPlaceablesAt(this._getDrawings(undefined), position);
    const notes = this._getPlaceablesAt(this._getNotes(undefined), position);
    const journals = this._getPlaceablesAt(this._getJournals(), position);
    const stairways = this._getPlaceablesAt(this._getStairways(undefined), position);
    if (
      tokens.length === 0 &&
      drawings.length === 0 &&
      notes.length === 0 &&
      journals.length === 0 &&
      stairways.length === 0
    ) {
      return true;
    }
    const triggers = this._getTriggersFromTokens(this.triggers, tokens, EVENT_TRIGGER_ENTITY_TYPES.MOVE);
    triggers.push(...this._getTriggersFromDrawings(this.triggers, drawings, EVENT_TRIGGER_ENTITY_TYPES.MOVE));
    triggers.push(...this._getTriggersFromNotes(this.triggers, notes, EVENT_TRIGGER_ENTITY_TYPES.MOVE));
    triggers.push(...this._getTriggersFromJournals(this.triggers, journals, EVENT_TRIGGER_ENTITY_TYPES.MOVE));
    triggers.push(...this._getTriggersFromStairways(this.triggers, stairways, EVENT_TRIGGER_ENTITY_TYPES.MOVE));

    if (triggers.length === 0) return true;
    if (triggers.some((trigger) => trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.STOP_MOVEMENT))) {
      this._executeTriggers(triggers);
      return false;
    }
    Hooks.once('updateToken', () => this._executeTriggers(triggers));
    return true;
  }

  _doCaptureTriggers(tokenDocument, scene, update) {
    // Get all trigger tokens in scene
    const token = tokenDocument.object;
    let targets = this._getTokensFromTriggers(
      this._getTokens(undefined),
      this.triggers,
      EVENT_TRIGGER_ENTITY_TYPES.CAPTURE,
    );
    targets.push(
      ...this._getDrawingsFromTriggers(this._getDrawings(undefined), this.triggers, EVENT_TRIGGER_ENTITY_TYPES.CAPTURE),
    );
    targets.push(
      ...this._getNotesFromTriggers(this._getNotes(undefined), this.triggers, EVENT_TRIGGER_ENTITY_TYPES.CAPTURE),
    );
    targets.push(
      ...this._getJournalsFromTriggers(this._getJournals(), this.triggers, EVENT_TRIGGER_ENTITY_TYPES.CAPTURE),
    );
    targets.push(
      ...this._getStairwaysFromTriggers(
        this._getStairways(undefined),
        this.triggers,
        EVENT_TRIGGER_ENTITY_TYPES.CAPTURE,
      ),
    );

    if (targets.length === 0) {
      return;
    }

    const finalX = update.x || token.x;
    const finalY = update.y || token.y;
    // need to calculate this by hand since token is just token data
    const tokenWidth = (token.data.width * <number>canvas.scene?.data.grid) / 2;
    const tokenHeight = (token.data.height * <number>canvas.scene?.data.grid) / 2;

    const motion = new Ray(
      { x: token.x + tokenWidth, y: token.y + tokenHeight },
      { x: finalX + tokenWidth, y: finalY + tokenHeight },
    );

    // don't consider targets if the token's start position is inside the target
    targets = targets.filter(
      (target) => !this._placeableContains(target, { x: token.x + tokenWidth, y: token.y + tokenHeight }),
    );

    // sort targets by distance from the token's start position
    targets.sort((a, b) =>
      targets.sort((a, b) => Math.hypot(token.x - a.x, token.y - a.y) - Math.hypot(token.x - b.x, token.y - b.y)),
    );

    for (const target of targets) {
      // TODO I REALLY NEED THIS ? THEY ARE JUST DOCUMENTS...
      let w = target.w || target?.data?.width || target.width;
      if (target?.object) {
        w = target?.object?.w || target?.object?.data?.width || target?.object?.width || w;
      }
      let h = target?.h || target?.data?.height || target?.height;
      if (target?.object) {
        h = target?.object?.h || target?.object?.data?.height || target?.object?.height || h;
      }
      let x = target.x || target?.data?.x;
      if (target?.object) {
        x = target?.object?.x || target?.object?.data?.x || x;
      }
      let y = target?.y || target?.data?.y;
      if (target?.object) {
        y = target?.object?.y || target?.object?.data?.y || target?.object?.y || y;
      }
      const tx = x;
      const ty = y;
      const tw = w;
      const th = h;
      // const tcenterx = target?.center?.x || tx;
      // const tcentery = target?.center?.y || ty;
      // const tx = target.data.x;
      // const ty = target.data.y;
      // const tw = target.w || target.data.width;
      // const th = target.h || target.data.height;

      let intersects;
      // test motion vs token diagonals
      if (
        tw > <number>canvas.grid?.w &&
        th > <number>canvas.grid?.w &&
        tw * th > 4 * <number>canvas.grid?.w * <number>canvas.grid?.w
      ) {
        // big token so do boundary lines
        intersects =
          motion.intersectSegment([tx, ty, tx + tw, ty]) ||
          motion.intersectSegment([tx + tw, ty, tx + tw, ty + th]) ||
          motion.intersectSegment([tx + tw, ty + th, tx, ty + th]) ||
          motion.intersectSegment([tx, ty + th, tx, ty]);
      } else {
        // just check the diagonals
        intersects =
          motion.intersectSegment([tx, ty, tx + tw, ty + th]) || motion.intersectSegment([tx, ty + th, tx + tw, ty]);
      }
      if (intersects) {
        if (target.center) {
          update.x = target.center.x - tokenWidth;
          update.y = target.center.y - tokenHeight;
        }
        return true;
      }
    }
    return true;
  }

  // Arguments match the new prototype of FVTT 0.8.x
  _onPreUpdateToken(tokenDocument, update, options, userId) {
    if (!tokenDocument.object?.scene?.isView) {
      return true;
    }
    if (update.x === undefined && update.y === undefined) {
      return true;
    }
    let stop;
    if (game.settings.get(CONSTANTS.MODULE_NAME, 'edgeCollision')) {
      stop = this._doCaptureTriggersEdge(tokenDocument, tokenDocument.object.scene, update);
    } else {
      stop = this._doCaptureTriggers(tokenDocument, tokenDocument.object.scene, update);
    }
    if (stop === false) return false;
    return this._doMoveTriggers(tokenDocument, tokenDocument.object.scene, update);
  }

  _onPreUpdateWall(wallDocument, update, options, userId) {
    // Only trigger on door state changes
    if (wallDocument.data.door === 0 || update.ds === undefined) return;
    const triggers = this.triggers.filter((trigger) => {
      //if (!(trigger.trigger instanceof WallDocument)) return false;
      if (
        !(
          trigger.trigger instanceof Wall ||
          trigger.trigger instanceof WallDocument ||
          trigger.trigger instanceof DoorControl
        )
      ) {
        return false;
      }
      //@ts-ignore
      if (wallDocument.data.c.toString() !== trigger.trigger.data.c.toString()) {
        return false;
      }
      const onClose = trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.DOOR_CLOSE);
      const onOpen =
        !trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.DOOR_CLOSE) ||
        trigger.options.includes(EVENT_TRIGGER_ENTITY_TYPES.DOOR_OPEN);
      return (update.ds === 1 && onOpen) || (update.ds === 0 && onClose && wallDocument.data.ds === 1);
    });
    this._executeTriggers(triggers);
  }

  _onPreUpdateNote(noteDocument, update, options, userId) {
    const triggers = this.triggers.filter((trigger) => {
      const tri = trigger.trigger;
      if (tri && !(tri instanceof NoteDocument)) {
        return false;
      }
    });
    this._executeTriggers(triggers);
  }

  static getSceneControlButtons(buttons) {
    const tokenButton = buttons.find((b) => b.name == 'token');

    if (tokenButton && game.settings.get(CONSTANTS.MODULE_NAME, 'enableTriggerButton')) {
      tokenButton.tools.push({
        name: 'triggers',
        title: i18n(`${CONSTANTS.MODULE_NAME}.labels.button.layer.enableTriggerHappy`),
        icon: 'fas fa-grin-squint-tears',
        toggle: true,
        active: game.settings.get(CONSTANTS.MODULE_NAME, 'enableTriggers'),
        visible: game.user?.isGM,
        onClick: (value) => {
          game.settings.set(CONSTANTS.MODULE_NAME, 'enableTriggers', value);
          //@ts-ignore
          if (game.triggers) {
            //@ts-ignore
            game.triggers._parseJournals.bind(game.triggers)();
          }
        },
      });
    }
  }

  _doCaptureTriggersEdge(tokenDocument, scene, update) {
    const token = tokenDocument.object;
    // Get all trigger tokens in scene
    let targets = this._getTokensFromTriggers(
      this._getTokens(undefined),
      this.triggers,
      EVENT_TRIGGER_ENTITY_TYPES.CAPTURE,
    );
    targets.push(
      ...this._getDrawingsFromTriggers(this._getDrawings(undefined), this.triggers, EVENT_TRIGGER_ENTITY_TYPES.CAPTURE),
    );
    targets.push(
      ...this._getNotesFromTriggers(this._getNotes(undefined), this.triggers, EVENT_TRIGGER_ENTITY_TYPES.CAPTURE),
    );
    targets.push(
      ...this._getJournalsFromTriggers(this._getJournals(), this.triggers, EVENT_TRIGGER_ENTITY_TYPES.CAPTURE),
    );
    targets.push(
      ...this._getStairwaysFromTriggers(
        this._getStairways(undefined),
        this.triggers,
        EVENT_TRIGGER_ENTITY_TYPES.CAPTURE,
      ),
    );

    if (!targets) {
      return;
      undefined;
    }
    const finalX = update.x || token.x;
    const finalY = update.y || token.y;
    // need to calculate this by hand since token is just token data
    const tokenWidth = (token.data.width * <number>canvas.scene?.data.grid) / 2;
    const tokenHeight = (token.data.height * <number>canvas.scene?.data.grid) / 2;

    const motion = new Ray(
      { x: token.x + tokenWidth, y: token.y + tokenHeight },
      { x: finalX + tokenWidth, y: finalY + tokenHeight },
    );

    // don't trigger on tokens that are already captured
    targets = targets.filter(
      (target) => !this._placeableContains(target, { x: token.x + tokenWidth, y: token.y + tokenHeight }),
    );

    // sort list by distance from start token position
    targets.sort((a, b) =>
      targets.sort((a, b) => Math.hypot(token.x - a.x, token.y - a.y) - Math.hypot(token.x - b.x, token.y - b.y)),
    );
    const gridSize = <number>canvas.grid?.size;

    for (const target of targets) {
      // TODO I REALLY NEED THIS ? THEY ARE JUST DOCUMENTS...
      let w = target.w || target?.data?.width || target.width;
      if (target?.object) {
        w = target?.object?.w || target?.object?.data?.width || target?.object?.width || w;
      }
      let h = target?.h || target?.data?.height || target?.height;
      if (target?.object) {
        h = target?.object?.h || target?.object?.data?.height || target?.object?.height || h;
      }
      let x = target.x || target?.data?.x;
      if (target?.object) {
        x = target?.object?.x || target?.object?.data?.x || x;
      }
      let y = target?.y || target?.data?.y;
      if (target?.object) {
        y = target?.object?.y || target?.object?.data?.y || target?.object?.y || y;
      }
      const tx = x;
      const ty = y;
      const tw = w;
      const th = h;
      // const tcenterx = target?.center?.x || tx;
      // const tcentery = target?.center?.y || ty;
      // const tx = target.x;
      // const ty = target.y;
      // const tw = target.w || target.data.width;
      // const th = target.h || target.data.height;
      const tgw = Math.ceil(target.data.width / gridSize); // target token width in grid units
      const tgh = Math.ceil(target.data.height / gridSize); // target token height in grid units

      let intersects;
      // test motion vs token diagonals
      if (tgw > 1 && tgh > 1 && tgw * tgh > 4) {
        // big token so do boundary lines
        intersects =
          motion.intersectSegment([tx, ty, tx + tw, ty]) ||
          motion.intersectSegment([tx + tw, ty, tx + tw, ty + th]) ||
          motion.intersectSegment([tx + tw, ty + th, tx, ty + th]) ||
          motion.intersectSegment([tx, ty + th, tx, ty]);
      } else {
        // just check the diagonals
        intersects =
          motion.intersectSegment([tx, ty, tx + tw, ty + th]) || motion.intersectSegment([tx, ty + th, tx + tw, ty]);
      }
      if (intersects) {
        if (tgw === 1 && tgh === 1) {
          // simple case size 1 target, return straight away.
          if (target.center) {
            update.x = target.center.x - tokenWidth;
            update.y = target.center.y - tokenHeight;
          }
          return true;
        }
        // Create a grid of the squares covered by the target token
        const corners = Array(tgw)
          .fill(Array(tgh).fill(0))
          .map((v, i) =>
            v.map((_, j) => {
              return { x: target.data.x + i * gridSize, y: target.data.y + j * gridSize };
            }),
          )
          .flat();

        // Find the closest square to the token start position that intersets the motion
        const closest = corners.sort(
          (a, b) =>
            Math.hypot(token.x + tokenWidth - (a.x + gridSize / 2), token.y + tokenHeight - (a.y + gridSize / 2)) -
            Math.hypot(token.x + tokenWidth - (b.x + gridSize / 2), token.y + tokenHeight - (b.y + gridSize / 2)),
        );
        for (const corner of closest) {
          if (
            motion.intersectSegment([corner.x, corner.y, corner.x + gridSize, corner.y + gridSize]) ||
            motion.intersectSegment([corner.x, corner.y + gridSize, corner.x + gridSize, corner.y])
          ) {
            update.x = corner.x;
            update.y = corner.y;
            return true;
          }
        }
        warn('Help me the universe is non-euclidean');
      }
    }
    return true;
  }

  // _getObjectsFromScene(scene) {
  //   return [
  //     ...Array.from(scene.tokens),
  //     ...Array.from(scene.lights),
  //     ...Array.from(scene.sounds),
  //     ...Array.from(scene.templates),
  //     ...Array.from(scene.tiles),
  //     ...Array.from(scene.walls),
  //     ...Array.from(scene.drawings),
  //     ...Array.from(scene.stairways), // Add module stairways...
  //   ]
  //     .deepFlatten()
  //     .filter(Boolean);
  // }

  _retrieveFromEntityMultiple(entity: string, idOrName: string, label: string) {
    if (!entity) return null;
    entity = entity.toLowerCase();
    if (entity == TRIGGER_ENTITY_TYPES.TRIGGER) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.CHAT_MESSAGE) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.OOC) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.EMOTE) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.WHISPER) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.SELF_WHISPER) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.COMPENDIUM) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.SOUND_LINK) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.PLAYLIST) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.TOKEN) {
      const tokenTargetsResult: TokenDocument[] = [];
      let tokenTargets = this._retrieveFromIdOrNameMultiple(this._getTokens(undefined), idOrName);
      // Some strange retrocompatibility use case or just compatibility with other modules like token mold
      if ((!tokenTargets || tokenTargets.length == 0) && this.ifNoTokenIsFoundTryToUseActor) {
        tokenTargets = this._getTokens(undefined)?.filter((t) => {
          // If token is referenced to a actor
          return t && t.data.actorId && this._retrieveFromIdOrName(this._getActors(), idOrName)?.id === t.data.actorId;
        });
      }
      for (const tokenTarget of tokenTargets) {
        tokenTargetsResult.push(tokenTarget);
      }
      return tokenTargetsResult;
    } else if (entity == TRIGGER_ENTITY_TYPES.ACTOR) {
      // NOTE THIS WORK BECAUSE THE MULTIPLE FUNCTION
      // MUST BE CALLED ONLY FROM TRIGGER
      let actorTargetsResult: TokenDocument[] = [];
      const actorTargets = this._retrieveFromIdOrNameMultiple(this._getActors(), idOrName);
      if (actorTargets && actorTargets.length > 0) {
        actorTargetsResult = this._getTokens(undefined)?.filter((t) => {
          if (actorTargets.filter((e) => e.id === t.data.actorId).length > 0) {
            // If token is referenced to the specific actor
            return t;
          }
        });
      }
      // for(let actorTarget of actorTargets){
      //   actorTargetsResult.push(actorTarget);
      // }
      // TODO ADD AMBIENT LIGHT INTEGRATION
      // } else if (relevantDocument instanceof AmbientLightDocument) {
      //   const ambientLightTarget = this._retrieveFromIdOrNameMultiple(this._getAmbientLights(), idOrName);
      //   return ambientLightTarget;
      // TODO ADD AMBIENT SOUND INTEGRATION
      // } else if (relevantDocument instanceof AmbientSoundDocument) {
      //   const ambientSoundTarget = this._retrieveFromIdOrNameMultiple(this._getAmbientSounds(), idOrName);
      //   return ambientSoundTarget;
      // TODO ADD TILE INTEGRATION
      // } else if (relevantDocument instanceof TileDocument) {
      //   const tileTarget = this._retrieveFromIdOrNameMultiple(this._getTiles(), idOrName);
      //   return tileTarget;
      return actorTargetsResult;
    } else if (entity == TRIGGER_ENTITY_TYPES.DOOR) {
      const doorControlTargetsResult: WallDocument[] = [];
      const doorControlTargets = this._retrieveFromIdOrNameMultiple(this._getDoors(undefined), idOrName);
      const coords = idOrName.split(',').map((c) => Number(c)) ?? [];
      if (coords && coords.length > 0 && coords.length == 4) {
        for (const wall of this._getDoors(undefined)) {
          let mywall = wall;
          if (wall instanceof DoorControl) {
            mywall = wall.wall.document;
          }
          if (wall instanceof Wall) {
            mywall = wall.document;
          }
          if (
            mywall.data?.door > 0 &&
            mywall.data?.c[0] == coords[0] &&
            mywall.data?.c[1] == coords[1] &&
            mywall.data?.c[2] == coords[2] &&
            mywall.data?.c[3] == coords[3]
          ) {
            doorControlTargets.push(mywall);
          }
        }
      }
      for (const doorControlTarget of doorControlTargets) {
        // Retrocompatibility check
        // if (!doorControlTarget) {
        //   const coords = idOrName.split(',').map((c) => Number(c)) ?? [];
        //   if (coords && coords.length > 0 && coords.length == 4) {
        //     doorControlTarget = this._getDoors()?.find((wall) => {
        //       let mywall = wall;
        //       if (wall instanceof DoorControl) {
        //         mywall = wall.wall.document;
        //       }
        //       if (wall instanceof Wall) {
        //         mywall = wall.document;
        //       }
        //       return (
        //         mywall.data?.door > 0 &&
        //         mywall.data?.c[0] == coords[0] &&
        //         mywall.data?.c[1] == coords[1] &&
        //         mywall.data?.c[2] == coords[2] &&
        //         mywall.data?.c[3] == coords[3]
        //       );
        //     });
        //     // doorControlTarget = new WallDocument({ door: 1, c: coords }, {});
        //     doorControlTargetsResult.push(doorControlTarget);
        //   }
        // } else {
        //    doorControlTargetsResult.push(doorControlTarget);
        // }
        if (doorControlTargetsResult.filter((e) => e.id === doorControlTarget.id).length <= 0) {
          doorControlTargetsResult.push(doorControlTarget);
        }
      }
      return doorControlTargetsResult;
    } else if (entity == TRIGGER_ENTITY_TYPES.DRAWING) {
      const drawingTargetsResult: DrawingDocument[] = [];
      const drawingTargets = this._retrieveFromIdOrNameMultiple(this._getDrawings(undefined), idOrName);
      for (const drawingTarget of drawingTargets) {
        drawingTargetsResult.push(drawingTarget);
      }
      return drawingTargetsResult;
    } else if (entity == TRIGGER_ENTITY_TYPES.JOURNAL_ENTRY) {
      const noteTargetsResult: any[] = [];
      const noteTargets = this._retrieveFromIdOrNameMultiple(this._getNotes(undefined), idOrName);
      for (const noteTarget of noteTargets) {
        if (!noteTarget) {
          const journalTargets: JournalEntry[] = this._retrieveFromIdOrNameMultiple(this._getJournals(), idOrName);
          for (const journalTarget of journalTargets) {
            if (journalTarget?.sceneNote) {
              noteTargetsResult.push(journalTarget.sceneNote.document);
            } else {
              noteTargetsResult.push(journalTarget);
            }
          }
        }
        noteTargetsResult.push(noteTarget);
      }
      return noteTargetsResult;
    } else if (entity == TRIGGER_ENTITY_TYPES.STAIRWAY) {
      const stairwayTargetsResult: any[] = [];
      const stairwayTargets = this._retrieveFromIdOrNameMultiple(this._getStairways(undefined), idOrName);
      for (const stairwayTarget of stairwayTargets) {
        stairwayTargetsResult.push(stairwayTarget);
      }
      return stairwayTargetsResult;
    } else if (entity == TRIGGER_ENTITY_TYPES.SCENE) {
      const sceneTargetsResult: Scene[] = [];
      const sceneTargets = this._retrieveFromIdOrNameMultiple(this._getScenes(), idOrName);
      for (const sceneTarget of sceneTargets) {
        sceneTargetsResult.push(sceneTarget);
      }
      return sceneTargetsResult;
    } else {
      return null;
    }
  }

  _retrieveFromEntity(entity, idOrName, label) {
    if (!entity) return null;
    entity = entity.toLowerCase();
    if (entity == TRIGGER_ENTITY_TYPES.TRIGGER) {
      return idOrName; // Should be always the label like 'Click'
    } else if (entity == TRIGGER_ENTITY_TYPES.CHAT_MESSAGE) {
      // chat messages can only be effects not triggers
      const chatMessage = new ChatMessage({ content: idOrName, speaker: { alias: label } }, {});
      return chatMessage;
    } else if (entity == TRIGGER_ENTITY_TYPES.OOC) {
      // chat link can only be effects not triggers
      // {alias: alias, token: tokenId, actor: actorId, scene: scene.id, };
      const [myalias, mywhisper, mytokenid, myactorid, mysceneid] = label ? label.split('|') : '';
      const chatMessage = new ChatMessage(
        {
          content: idOrName,
          speaker: {
            alias: myalias ? myalias : undefined,
            token: mytokenid ? mytokenid : undefined,
            scene: mysceneid ? mysceneid : game.scenes?.current?.id,
            //actor: myactorid ? myactorid : (token.actor ? token.actor.id : undefined)
          },
        },
        {},
      );
      const chatLink = new ChatLink(chatMessage, TRIGGER_ENTITY_TYPES.OOC, mywhisper);
      return chatLink;
    } else if (entity == TRIGGER_ENTITY_TYPES.EMOTE) {
      // chat link can only be effects not triggers
      // {alias: alias, token: tokenId, actor: actorId, scene: scene.id, };
      const [myalias, mywhisper, mytokenid, myactorid, mysceneid] = label ? label.split('|') : '';
      const chatMessage = new ChatMessage(
        {
          content: idOrName,
          speaker: {
            alias: myalias ? myalias : undefined,
            token: mytokenid ? mytokenid : undefined,
            scene: mysceneid ? mysceneid : game.scenes?.current?.id,
            // actor: myactorid ? myactorid : (token.actor ? token.actor.id : undefined)
          },
        },
        {},
      );
      const chatLink = new ChatLink(chatMessage, TRIGGER_ENTITY_TYPES.EMOTE, mywhisper);
      return chatLink;
    } else if (entity == TRIGGER_ENTITY_TYPES.WHISPER) {
      // chat link can only be effects not triggers
      // {alias: alias, token: tokenId, actor: actorId, scene: scene.id, };
      const [myalias, mywhisper, mytokenid, myactorid, mysceneid] = label ? label.split('|') : '';
      const chatMessage = new ChatMessage(
        {
          content: idOrName,
          speaker: {
            alias: myalias ? myalias : undefined,
            token: mytokenid ? mytokenid : undefined,
            scene: mysceneid ? mysceneid : game.scenes?.current?.id,
            // actor: myactorid ? myactorid : (token.actor ? token.actor.id : undefined)
          },
        },
        {},
      );
      const chatLink = new ChatLink(chatMessage, TRIGGER_ENTITY_TYPES.WHISPER, mywhisper);
      return chatLink;
    } else if (entity == TRIGGER_ENTITY_TYPES.SELF_WHISPER) {
      // chat link can only be effects not triggers
      // {alias: alias, token: tokenId, actor: actorId, scene: scene.id, };
      const [myalias, mywhisper, mytokenid, myactorid, mysceneid] = label ? label.split('|') : '';
      const chatMessage = new ChatMessage(
        {
          content: idOrName,
          speaker: {
            alias: myalias ? myalias : undefined,
            token: mytokenid ? mytokenid : undefined,
            scene: mysceneid ? mysceneid : game.scenes?.current?.id,
            // actor: myactorid ? myactorid : (token.actor ? token.actor.id : undefined)
          },
        },
        {},
      );
      const chatLink = new ChatLink(chatMessage, TRIGGER_ENTITY_TYPES.SELF_WHISPER, mywhisper);
      return chatLink;
    } else if (entity == TRIGGER_ENTITY_TYPES.COMPENDIUM) {
      // compendium links can only be effects not triggers
      // e.g. @Compendium[SupersHomebrewPack.classes.AH3dUnrFxZHDvY2o]{Bard}
      const parts = idOrName.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const compendiumLink = new CompendiumLink(parts.slice(0, 2).join('.'), parts[2], label);
      return compendiumLink;
    } else if (entity == TRIGGER_ENTITY_TYPES.SOUND_LINK) {
      // sound links can only be effects not triggers
      // e.g. @Sound[Test|Medieval_Fantasy City Under Attack audio atmosphere]{Attack}
      const [playlistName, soundName] = idOrName.split('|');
      const soundLink = new SoundLink(playlistName, soundName, label);
      return soundLink;
    } else if (entity == TRIGGER_ENTITY_TYPES.PLAYLIST) {
      // playlist can only be effects not triggers
      const playlistTarget = this._retrieveFromIdOrName(this._getPlaylists(), idOrName);
      return playlistTarget;
    } else if (entity == TRIGGER_ENTITY_TYPES.TOKEN) {
      let tokenTarget = this._retrieveFromIdOrName(this._getTokens(undefined), idOrName);
      // Some strange retrocompatibility use case or just compatibility with other modules like token mold
      if (!tokenTarget && this.ifNoTokenIsFoundTryToUseActor) {
        tokenTarget = this._getTokens(undefined)?.find((t) => {
          // If token is referenced to a actor
          return t && t.data.actorId && this._retrieveFromIdOrName(this._getActors(), idOrName)?.id === t.data.actorId;
        });
      }
      return tokenTarget;
    } else if (entity == TRIGGER_ENTITY_TYPES.ACTOR) {
      const actorTarget = this._retrieveFromIdOrName(this._getActors(), idOrName);
      return actorTarget;
      // TODO ADD AMBIENT LIGHT INTEGRATION
      // } else if (relevantDocument instanceof AmbientLightDocument) {
      //   const ambientLightTarget = this._retrieveFromIdOrName(this._getAmbientLights(), idOrName);
      //   return ambientLightTarget;
      // TODO ADD AMBIENT SOUND INTEGRATION
      // } else if (relevantDocument instanceof AmbientSoundDocument) {
      //   const ambientSoundTarget = this._retrieveFromIdOrName(this._getAmbientSounds(), idOrName);
      //   return ambientSoundTarget;
      // TODO ADD TILE INTEGRATION
      // } else if (relevantDocument instanceof TileDocument) {
      //   const tileTarget = this._retrieveFromIdOrName(this._getTiles(), idOrName);
      //   return tileTarget;
    } else if (entity == TRIGGER_ENTITY_TYPES.DOOR) {
      let doorControlTarget = this._retrieveFromIdOrName(this._getDoors(undefined), idOrName);
      // Retrocompatibility check
      if (!doorControlTarget) {
        const coords = idOrName.split(',').map((c) => Number(c)) ?? [];
        if (coords && coords.length > 0 && coords.length == 4) {
          doorControlTarget = this._getDoors(undefined)?.find((wall) => {
            let mywall = wall;
            if (wall instanceof DoorControl) {
              mywall = wall.wall.document;
            }
            if (wall instanceof Wall) {
              mywall = wall.document;
            }
            return (
              mywall.data?.door > 0 &&
              mywall.data?.c[0] == coords[0] &&
              mywall.data?.c[1] == coords[1] &&
              mywall.data?.c[2] == coords[2] &&
              mywall.data?.c[3] == coords[3]
            );
          });
          // doorControlTarget = new WallDocument({ door: 1, c: coords }, {});
          return doorControlTarget;
        }
      } else {
        return doorControlTarget;
      }
    } else if (entity == TRIGGER_ENTITY_TYPES.DRAWING) {
      const drawingTarget = this._retrieveFromIdOrName(this._getDrawings(undefined), idOrName);
      return drawingTarget;
    } else if (entity == TRIGGER_ENTITY_TYPES.JOURNAL_ENTRY) {
      const noteTarget = this._retrieveFromIdOrName(this._getNotes(undefined), idOrName);
      if (!noteTarget) {
        const journalTarget = this._retrieveFromIdOrName(this._getJournals(), idOrName);
        if (journalTarget?.sceneNote) {
          return journalTarget.sceneNote;
        } else {
          return journalTarget;
        }
      }
      return noteTarget;
    } else if (entity == TRIGGER_ENTITY_TYPES.STAIRWAY) {
      const stairwayTarget = this._retrieveFromIdOrName(this._getStairways(undefined), idOrName);
      return stairwayTarget;
    } else if (entity == TRIGGER_ENTITY_TYPES.SCENE) {
      const sceneTarget = this._retrieveFromIdOrName(this._getScenes(), idOrName);
      return sceneTarget;
    } else {
      return null;
    }
  }

  _retrieveFromIdOrName(placeables, IdOrName) {
    let target;
    if (!placeables || placeables.length == 0) {
      return target;
    }
    if (!IdOrName) {
      return target;
    }
    target = placeables?.find((x) => {
      return x && x.id?.toLowerCase() == IdOrName.toLowerCase();
    });
    if (!target) {
      target = placeables?.find((x) => {
        return x && x.name?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target) {
      target = placeables?.find((x) => {
        return x && x.data?.name?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target) {
      target = placeables?.find((x) => {
        return x && x.label?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target) {
      target = placeables?.find((x) => {
        return x && x.data?.text?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target) {
      target = placeables?.find((x) => {
        return x && x.data?.label?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target) {
      target = placeables?.find((x) => {
        return x && x.entryId?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    return target;
  }

  _retrieveFromIdOrNameMultiple(placeables, IdOrName): any[] {
    let target: any[] = [];
    if (!placeables || placeables.length == 0) {
      return target;
    }
    if (!IdOrName) {
      return target;
    }
    target = placeables?.filter((x) => {
      return x && x.id?.toLowerCase() == IdOrName.toLowerCase();
    });
    if (!target || target.length == 0) {
      target = placeables?.filter((x) => {
        return x && x.name?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target || target.length == 0) {
      target = placeables?.filter((x) => {
        return x && x.label?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target || target.length == 0) {
      target = placeables?.filter((x) => {
        return x && x.data?.name?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target || target.length == 0) {
      target = placeables?.filter((x) => {
        return x && x.data?.text?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target || target.length == 0) {
      target = placeables?.filter((x) => {
        return x && x.data?.label?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    if (!target || target.length == 0) {
      target = placeables?.filter((x) => {
        return x && x.entryId?.toLowerCase() == IdOrName.toLowerCase();
      });
    }
    return target ?? [];
  }

  // getPlaceableObjectCenter(placeableObject) {
  //   const width = placeableObject.w || placeableObject.data.width || placeableObject.width;
  //   const height = placeableObject.h || placeableObject.data.height || placeableObject.height;
  //   const shapes = this.getPlaceableObjectShape(placeableObject, width, height);
  //   if (shapes && shapes.length > 0) {
  //     const shape0 = shapes[0];
  //     return { x: shape0.x, y: shape0.y };
  //   }
  //   const placeableObjectCenter = { x: placeableObject.x + width / 2, y: placeableObject.y + height / 2 };
  //   return placeableObjectCenter;
  // }

  // getPlaceableObjectShape(placeableObject, width, height) {
  //   if (game.scenes.current.data.gridType === CONST.GRID_TYPES.GRIDLESS) {
  //     return [{ x: 0, y: 0 }];
  //   } else if (game.scenes.current.data.gridType === CONST.GRID_TYPES.SQUARE) {
  //     const topOffset = -Math.floor(height / 2);
  //     const leftOffset = -Math.floor(width / 2);
  //     const shape = [];
  //     for (let y = 0; y < height; y++) {
  //       for (let x = 0; x < width; x++) {
  //         shape.push({ x: x + leftOffset, y: y + topOffset });
  //       }
  //     }
  //     return shape;
  //   } else {
  //     // Hex grids
  //     if (game.modules.get('hex-size-support')?.active && CONFIG.hexSizeSupport.getAltSnappingFlag(placeableObject)) {
  //       const borderSize = placeableObject.data.flags['hex-size-support'].borderSize;
  //       let shape = [{ x: 0, y: 0 }];
  //       if (borderSize >= 2)
  //         shape = shape.concat([
  //           { x: 0, y: -1 },
  //           { x: -1, y: -1 },
  //         ]);
  //       if (borderSize >= 3)
  //         shape = shape.concat([
  //           { x: 0, y: 1 },
  //           { x: -1, y: 1 },
  //           { x: -1, y: 0 },
  //           { x: 1, y: 0 },
  //         ]);
  //       if (borderSize >= 4)
  //         shape = shape.concat([
  //           { x: -2, y: -1 },
  //           { x: 1, y: -1 },
  //           { x: -1, y: -2 },
  //           { x: 0, y: -2 },
  //           { x: 1, y: -2 },
  //         ]);
  //       //@ts-ignore
  //       if (Boolean(CONFIG.hexSizeSupport.getAltOrientationFlag(placeableObject)) !== canvas.grid?.grid?.options.columns)
  //         shape.forEach((space) => (space.y *= -1));
  //       if (canvas.grid?.grid?.options.columns)
  //         shape = shape.map((space) => {
  //           return { x: space.y, y: space.x };
  //         });
  //       return shape;
  //     } else {
  //       return [{ x: 0, y: 0 }];
  //     }
  //   }
  // }

  _retrieveAllFromEntity(entity) {
    if (!entity) return null;
    entity = entity.toLowerCase();
    if (entity == TRIGGER_ENTITY_TYPES.TRIGGER) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.CHAT_MESSAGE) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.OOC) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.EMOTE) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.WHISPER) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.SELF_WHISPER) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.COMPENDIUM) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.SOUND_LINK) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.PLAYLIST) {
      return null; // NOT SUPPORTED
    } else if (entity == TRIGGER_ENTITY_TYPES.TOKEN) {
      return this._getTokens(undefined);
    } else if (entity == TRIGGER_ENTITY_TYPES.ACTOR) {
      return this._getActors();
      // TODO ADD AMBIENT LIGHT INTEGRATION
      // TODO ADD AMBIENT SOUND INTEGRATION
      // TODO ADD TILE INTEGRATION
    } else if (entity == TRIGGER_ENTITY_TYPES.DOOR) {
      return this._getDoors(undefined);
    } else if (entity == TRIGGER_ENTITY_TYPES.DRAWING) {
      return this._getDrawings(undefined);
    } else if (entity == TRIGGER_ENTITY_TYPES.JOURNAL_ENTRY) {
      const noteTargets = this._getNotes(undefined) ?? [];
      const journalTargets = this._getJournals() ?? [];
      for (const journalTarget of journalTargets) {
        if (journalTarget?.sceneNote) {
          noteTargets.push(journalTarget.sceneNote.document);
        }
      }
      return noteTargets;
    } else if (entity == TRIGGER_ENTITY_TYPES.STAIRWAY) {
      return this._getStairways(undefined);
    } else if (entity == TRIGGER_ENTITY_TYPES.SCENE) {
      return this._getScenes();
    } else {
      return null;
    }
  }

  _getTokens(sceneId: string | undefined): TokenDocument[] {
    if (!sceneId) {
      const placeablesToken: TokenDocument[] = [];
      if (canvas.tokens?.placeables && canvas.tokens?.placeables.length > 0) {
        canvas.tokens?.placeables.forEach((token, key) => {
          placeablesToken.push(token.document);
        });
      }
      game.scenes?.current?.tokens?.contents.forEach((token, key) => {
        if (placeablesToken.filter((e) => e.id === token.id).length <= 0) {
          placeablesToken.push(token);
        }
      });
      return placeablesToken ?? [];
    } else {
      const placeablesToken: TokenDocument[] = [];
      game.scenes?.get(sceneId)?.tokens?.contents.forEach((tokenDocument, key) => {
        placeablesToken.push(tokenDocument);
      });
      return placeablesToken ?? [];
    }
  }

  _getActors(): Actor[] {
    const placeablesActor = game.actors?.contents;
    return placeablesActor ?? [];
  }

  _getDoors(sceneId: string | undefined): WallDocument[] {
    if (!sceneId) {
      const placeablesDoors: WallDocument[] = [];
      if (canvas.controls?.doors?.children && canvas.controls?.doors?.children.length > 0) {
        canvas.controls?.doors?.children.forEach((door, key) => {
          //@ts-ignore
          if (door.wall && door.wall.document) {
            //@ts-ignore
            placeablesDoors.push(door.wall.document);
          }
        });
      }
      const doors = game.scenes?.current?.walls?.contents.filter((wall) => {
        return wall.data?.door > 0;
      });
      if (doors && doors.length > 0) {
        //placeablesDoors.push(...doors);
        doors.forEach((door, key) => {
          if (placeablesDoors.filter((e) => e.id === door.id).length <= 0) {
            placeablesDoors.push(door);
          }
        });
      }
      return placeablesDoors ?? [];
    } else {
      const placeablesDoors: WallDocument[] = [];
      const doors = game.scenes?.get(sceneId)?.walls?.contents.filter((wall) => {
        return wall.data?.door > 0;
      });
      if (doors && doors.length > 0) {
        // placeablesDoors.push(...doors);
        doors.forEach((door, key) => {
          if (placeablesDoors.filter((e) => e.id === door.id).length <= 0) {
            placeablesDoors.push(door);
          }
        });
      }
      return placeablesDoors ?? [];
    }
  }

  _getDrawings(sceneId: string | undefined): DrawingDocument[] {
    if (!sceneId) {
      const placeablesDrawings: DrawingDocument[] = [];
      if (canvas.drawings?.placeables && canvas.drawings?.placeables.length > 0) {
        canvas.drawings?.placeables.forEach((drawing, key) => {
          placeablesDrawings.push(drawing.document);
        });
      }
      game.scenes?.current?.drawings?.contents.forEach((drawing, key) => {
        if (placeablesDrawings.filter((e) => e.id === drawing.id).length <= 0) {
          placeablesDrawings.push(drawing);
        }
      });
      return placeablesDrawings ?? [];
    } else {
      const placeablesDrawings: DrawingDocument[] = [];
      game.scenes?.get(sceneId)?.drawings?.contents.forEach((drawing, key) => {
        placeablesDrawings.push(drawing);
      });
      return placeablesDrawings ?? [];
    }
  }

  _getNotes(sceneId: string | undefined): NoteDocument[] {
    if (!sceneId) {
      const placeablesNotes: NoteDocument[] = [];
      if (canvas.notes?.placeables && canvas.notes?.placeables.length > 0) {
        canvas.notes?.placeables.forEach((note, key) => {
          placeablesNotes.push(note.document);
        });
      }
      game.scenes?.current?.notes?.contents.forEach((note, key) => {
        if (placeablesNotes.filter((e) => e.id === note.id).length <= 0) {
          placeablesNotes.push(note);
        }
      });
      return placeablesNotes ?? [];
    } else {
      const placeablesNotes: NoteDocument[] = [];
      game.scenes?.get(sceneId)?.notes?.contents.forEach((note, key) => {
        placeablesNotes.push(note);
      });
      return placeablesNotes ?? [];
    }
  }

  _getJournals(): JournalEntry[] {
    const placeablesJournals = game.journal?.contents;
    return placeablesJournals ?? [];
  }

  _getStairways(sceneId: string | undefined): any[] {
    if (!sceneId) {
      const placeablesStairways: any[] = [];
      //@ts-ignore
      if (canvas.stairways?.placeables && canvas.stairways?.placeables.length > 0) {
        //@ts-ignore
        canvas.stairways?.placeables.forEach((stairway, key) => {
          placeablesStairways.push(stairway.document);
        });
      }
      //@ts-ignore
      game.scenes.current.stairways?.contents.forEach((stairway, key) => {
        if (placeablesStairways.filter((e) => e.id === stairway.id).length <= 0) {
          placeablesStairways.push(stairway);
        }
      });
      return placeablesStairways ?? [];
    } else {
      const currentScene = game.scenes?.find((x) => {
        return x && x.id == sceneId;
      });
      //@ts-ignore
      const placeablesStairways = currentScene.stairways?.contents;
      return placeablesStairways ?? [];
    }
  }

  _getScenes(): Scene[] {
    const placeablesScenes = game.scenes?.contents;
    return placeablesScenes ?? [];
  }

  _getCompendiums(): CompendiumCollection<CompendiumCollection.Metadata>[] {
    const placeablesCompendiums = game.packs.contents;
    return placeablesCompendiums ?? [];
  }

  _getAmbientLights(sceneId: string | undefined): AmbientLightDocument[] {
    if (!sceneId) {
      const placeablesLightings: AmbientLightDocument[] = [];
      if (canvas.lighting?.placeables && canvas.lighting?.placeables.length > 0) {
        canvas.lighting?.placeables.forEach((ambientLight, key) => {
          placeablesLightings.push(ambientLight.document);
        });
      }
      game.scenes?.current?.lights.contents.forEach((ambientLight, key) => {
        if (placeablesLightings.filter((e) => e.id === ambientLight.id).length <= 0) {
          placeablesLightings.push(ambientLight);
        }
      });
      return placeablesLightings ?? [];
    } else {
      const placeablesLightings: AmbientLightDocument[] = [];
      game.scenes?.get(sceneId)?.lights.contents.forEach((ambientLightDocument, key) => {
        placeablesLightings.push(ambientLightDocument);
      });
      return placeablesLightings ?? [];
    }
  }

  _getAmbientSounds(sceneId: string | undefined): AmbientSoundDocument[] {
    if (!sceneId) {
      const placeablesSounds: AmbientSoundDocument[] = [];
      if (canvas.sounds?.placeables && canvas.sounds?.placeables.length > 0) {
        canvas.sounds?.placeables.forEach((ambientSound, key) => {
          placeablesSounds.push(ambientSound.document);
        });
      }
      game.scenes?.current?.sounds.contents.forEach((ambientSound, key) => {
        if (placeablesSounds.filter((e) => e.id === ambientSound.id).length <= 0) {
          placeablesSounds.push(ambientSound);
        }
      });
      return placeablesSounds ?? [];
    } else {
      const placeablesSounds: AmbientSoundDocument[] = [];
      game.scenes?.get(sceneId)?.sounds.contents.forEach((ambientSound, key) => {
        placeablesSounds.push(ambientSound);
      });
      return placeablesSounds ?? [];
    }
  }

  _getTiles(sceneId: string | undefined): TileDocument[] {
    if (!sceneId) {
      const placeablesTiles: TileDocument[] = [];
      if (canvas.foreground?.placeables && canvas.foreground?.placeables.length > 0) {
        canvas.foreground?.placeables.forEach((tile, key) => {
          placeablesTiles.push(tile.document);
        });
      }
      game.scenes?.current?.tiles.contents.forEach((tile, key) => {
        if (placeablesTiles.filter((e) => e.id === tile.id).length <= 0) {
          placeablesTiles.push(tile);
        }
      });
      return placeablesTiles ?? [];
    } else {
      const placeablesTiles: TileDocument[] = [];
      game.scenes?.get(sceneId)?.tiles.contents.forEach((tile, key) => {
        placeablesTiles.push(tile);
      });
      return placeablesTiles ?? [];
    }
  }

  _getTables(): RollTable[] {
    const placeablesTables = game.tables?.contents;
    return placeablesTables ?? [];
  }

  _getPlaylistSounds(): PlaylistSound[] {
    // game.playlists.contents[0].data.sounds
    const placeablesSounds: PlaylistSound[] = [];
    game.playlists?.contents.forEach((playlist, key) => {
      placeablesSounds.push(...Object.values(playlist.sounds));
    });
    return placeablesSounds ?? [];
  }

  _getPlaylists(): Playlist[] {
    const placeablesPlaylists: Playlist[] = [];
    game.playlists?.contents.forEach((playlist, key) => {
      placeablesPlaylists.push(playlist);
    });
    return placeablesPlaylists ?? [];
  }
}
