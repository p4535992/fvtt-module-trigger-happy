import CONSTANTS from './constants';
import { HTMLEnricherTriggers } from './HTMLEnricherTriggers';
import { log } from './lib/lib';
import { registerSettings } from './settings';
import { registerSocket } from './socket';
import { TriggerHappy } from './trigger';
import { EVENT_TRIGGER_ENTITY_TYPES } from './trigger-happy-models';

export const initHooks = (): void => {
  log(`Initializing ${CONSTANTS.MODULE_NAME}`);
  // Register settings

  registerSettings();
  //  registerLibwrappers();
  Hooks.once('socketlib.ready', registerSocket);
  //@ts-ignore
  game.triggers = new TriggerHappy();
  if (game.settings.get(CONSTANTS.MODULE_NAME, 'enableEnrichHtml')) {
    HTMLEnricherTriggers.patchEnrich();
  }
};

export const setupHooks = (): void => {
  //@ts-ignore
  game.triggers.init();

  //@ts-ignore
  setApi(API);

  Hooks.on('getSceneControlButtons', TriggerHappy.getSceneControlButtons);
};

export const readyHooks = (): void => {
  // checkSystem();
  // registerHotkeys();

  Hooks.on('renderJournalSheet', (app, html, options) => {
    if (game.settings.get(CONSTANTS.MODULE_NAME, 'enableEnrichHtml')) {
      //@ts-ignore
      if (game.triggers?.journals?.filter((e) => e.id === options.document.id).length > 0) {
        const htmlString = HTMLEnricherTriggers.enrichAll(html.find('.editor-content').html());
        html.find('.editor-content').html(htmlString);
        //HTMLEnricherTriggers.bindRichTextLinks(html);
      }
    }
  });

  Hooks.on('PreStairwayTeleport', (data) => {
    const { sourceSceneId, sourceData, selectedTokenIds, targetSceneId, targetData, userId } = data;
    // const event = {
    //   x: sourceData.x,
    //   y: sourceData.y,
    //   sceneId: sourceSceneId,
    //   id: sourceData.name,
    //   name: sourceData.label
    // };
    try {
      // const position = (event.x && event.y) ? {x:event.x, y:event.y} : game.triggers._getMousePosition(event);
      const upStairways:any[] = [];
      if (sourceSceneId) {
        //@ts-ignore
        const clickStairway = game.triggers._retrieveFromIdOrName(
          //@ts-ignore
          game.triggers._getStairways(sourceSceneId),
          sourceData.name,
        );
        if (!clickStairway){
          //@ts-ignore
          game.triggers._retrieveFromIdOrName(game.triggers._getStairways(sourceSceneId), sourceData.label);
        }
        upStairways.push(clickStairway);
      }
      if (upStairways.length === 0) {
        return;
      }
      //@ts-ignore
      const triggers = game.triggers._getTriggersFromStairways(
        //@ts-ignore
        game.triggers.triggers,
        upStairways,
        EVENT_TRIGGER_ENTITY_TYPES.CLICK,
      );
      //@ts-ignore
      game.triggers._executeTriggers(triggers);
    } finally {
      //@ts-ignore
      if (game.triggers.enableRelease) {
        // Needed this for module compatibility and the release on click left option active
        //@ts-ignore
        game.settings.set('core', 'leftClickRelease', game.triggers.release);
      }
    }
  });
};

const module = {
  // TODO
};
