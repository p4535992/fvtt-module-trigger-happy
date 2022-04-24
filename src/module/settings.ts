import API from './api';
import CONSTANTS from './constants';
import { dialogWarning, i18n, warn } from './lib/lib';

export const registerSettings = function (): void {
  game.settings.registerMenu(CONSTANTS.MODULE_NAME, 'resetAllSettings', {
    name: `${CONSTANTS.MODULE_NAME}.setting.reset.name`,
    hint: `${CONSTANTS.MODULE_NAME}.setting.reset.hint`,
    icon: 'fas fa-coins',
    type: ResetSettingsDialog,
    restricted: true,
  });

  // =====================================================================

  game.settings.register(CONSTANTS.MODULE_NAME, 'folderJournalName', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.folderJournalName.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.folderJournalName.hint`),
    scope: 'world',
    config: true,
    default: CONSTANTS.FOLDER_JOURNAL_DEFAULT,
    type: String,
    onChange: () => {
      //@ts-ignore
      if (game.triggers) {
        //@ts-ignore
        game.triggers._parseJournals.bind(game.triggers)();
      }
    },
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'journalName', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.journalName.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.journalName.hint`),
    scope: 'world',
    config: true,
    default: CONSTANTS.FOLDER_JOURNAL_DEFAULT,
    type: String,
    onChange: () => {
      //@ts-ignore
      if (game.triggers) {
        //@ts-ignore
        game.triggers._parseJournals.bind(game.triggers)();
      }
    },
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'enableTriggers', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTriggers.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTriggers.hint`),
    scope: 'client',
    config: false,
    default: true,
    type: Boolean,
    onChange: () => {
      //@ts-ignore
      if (game.triggers) {
        //@ts-ignore
        game.triggers._parseJournals.bind(game.triggers)();
      }
    },
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'edgeCollision', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.edgeCollision.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.edgeCollision.hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'enableTriggerButton', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTriggerButton.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTriggerButton.hint`),
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      if (!game.settings.get(CONSTANTS.MODULE_NAME, 'enableTriggerButton')) {
        game.settings.set(CONSTANTS.MODULE_NAME, 'enableTriggers', true);
      }
    },
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'enableTaggerIntegration', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTaggerIntegration.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTaggerIntegration.hint`),
    scope: 'world',
    config: true,
    default: '',
    type: String,
    onChange: () => {
      //@ts-ignore
      if (game.triggers) {
        //@ts-ignore
        game.triggers._parseJournals.bind(game.triggers)();
      }
    },
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'enableJournalForSceneIntegration', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableJournalForSceneIntegration.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableJournalForSceneIntegration.hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      //@ts-ignore
      if (game.triggers) {
        //@ts-ignore
        game.triggers._updateJournals.bind(game.triggers)();
        //@ts-ignore
        game.triggers._parseJournals.bind(game.triggers)();
      }
    },
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'onlyUseJournalForSceneIntegration', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.onlyUseJournalForSceneIntegration.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.onlyUseJournalForSceneIntegration.hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      //@ts-ignore
      if (game.triggers) {
        //@ts-ignore
        game.triggers._updateJournals.bind(game.triggers)();
        //@ts-ignore
        game.triggers._parseJournals.bind(game.triggers)();
      }
    },
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'enableAvoidDeselectOnTriggerEvent', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableAvoidDeselectOnTriggerEvent.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableAvoidDeselectOnTriggerEvent.hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'ifNoTokenIsFoundTryToUseActor', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.ifNoTokenIsFoundTryToUseActor.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.ifNoTokenIsFoundTryToUseActor.hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'disableWarningMessages', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.disableWarningMessages.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.disableWarningMessages.hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'enableMultipleTriggerSearch', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableMultipleTriggerSearch.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableMultipleTriggerSearch.hint`),
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'enableEnrichHtml', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableEnrichHtml.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableEnrichHtml.hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register(CONSTANTS.MODULE_NAME, 'disableAllHidden', {
    name: i18n(`${CONSTANTS.MODULE_NAME}.settings.disableAllHidden.name`),
    hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.disableAllHidden.hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  // ========================================================================

  game.settings.register(CONSTANTS.MODULE_NAME, 'debug', {
    name: `${CONSTANTS.MODULE_NAME}.setting.debug.name`,
    hint: `${CONSTANTS.MODULE_NAME}.setting.debug.hint`,
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
  });

  // const settings = defaultSettings();
  // for (const [name, data] of Object.entries(settings)) {
  //   game.settings.register(CONSTANTS.MODULE_NAME, name, <any>data);
  // }

  // for (const [name, data] of Object.entries(otherSettings)) {
  //     game.settings.register(CONSTANTS.MODULE_NAME, name, data);
  // }
};

class ResetSettingsDialog extends FormApplication<FormApplicationOptions, object, any> {
  constructor(...args) {
    //@ts-ignore
    super(...args);
    //@ts-ignore
    return new Dialog({
      title: game.i18n.localize(`${CONSTANTS.MODULE_NAME}.dialogs.resetsettings.title`),
      content:
        '<p style="margin-bottom:1rem;">' +
        game.i18n.localize(`${CONSTANTS.MODULE_NAME}.dialogs.resetsettings.content`) +
        '</p>',
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize(`${CONSTANTS.MODULE_NAME}.dialogs.resetsettings.confirm`),
          callback: async () => {
            await applyDefaultSettings();
            window.location.reload();
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize(`${CONSTANTS.MODULE_NAME}.dialogs.resetsettings.cancel`),
        },
      },
      default: 'cancel',
    });
  }

  async _updateObject(event: Event, formData?: object): Promise<any> {
    // do nothing
  }
}

async function applyDefaultSettings() {
  // const settings = defaultSettings(true);
  // for (const [name, data] of Object.entries(settings)) {
  //   await game.settings.set(CONSTANTS.MODULE_NAME, name, data.default);
  // }
  const settings2 = otherSettings(true);
  for (const [name, data] of Object.entries(settings2)) {
    //@ts-ignore
    await game.settings.set(CONSTANTS.MODULE_NAME, name, data.default);
  }
}

// function defaultSettings(apply = false) {
//   return {
//     // TODO
//   };
// }

function otherSettings(apply = false) {
  return {
    debug: {
      name: `${CONSTANTS.MODULE_NAME}.setting.debug.name`,
      hint: `${CONSTANTS.MODULE_NAME}.setting.debug.hint`,
      scope: 'client',
      config: true,
      default: false,
      type: Boolean,
    },

    debugHooks: {
      name: `${CONSTANTS.MODULE_NAME}.setting.debugHooks.name`,
      hint: `${CONSTANTS.MODULE_NAME}.setting.debugHooks.hint`,
      scope: 'world',
      config: false,
      default: false,
      type: Boolean,
    },

    // =======================================
    folderJournalName: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.folderJournalName.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.folderJournalName.hint`),
      scope: 'world',
      config: true,
      default: CONSTANTS.FOLDER_JOURNAL_DEFAULT,
      type: String,
      onChange: () => {
        //@ts-ignore
        if (game.triggers) {
          //@ts-ignore
          game.triggers._parseJournals.bind(game.triggers)();
        }
      },
    },

    journalName: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.journalName.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.journalName.hint`),
      scope: 'world',
      config: true,
      default: CONSTANTS.FOLDER_JOURNAL_DEFAULT,
      type: String,
      onChange: () => {
        //@ts-ignore
        if (game.triggers) {
          //@ts-ignore
          game.triggers._parseJournals.bind(game.triggers)();
        }
      },
    },

    enableTriggers: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTriggers.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTriggers.hint`),
      scope: 'client',
      config: false,
      default: true,
      type: Boolean,
      onChange: () => {
        //@ts-ignore
        if (game.triggers) {
          //@ts-ignore
          game.triggers._parseJournals.bind(game.triggers)();
        }
      },
    },

    edgeCollision: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.edgeCollision.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.edgeCollision.hint`),
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },

    enableTriggerButton: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTriggerButton.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTriggerButton.hint`),
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
      onChange: () => {
        if (!game.settings.get(CONSTANTS.MODULE_NAME, 'enableTriggerButton')) {
          game.settings.set(CONSTANTS.MODULE_NAME, 'enableTriggers', true);
        }
      },
    },

    enableTaggerIntegration: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTaggerIntegration.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableTaggerIntegration.hint`),
      scope: 'world',
      config: true,
      default: '',
      type: String,
      onChange: () => {
        //@ts-ignore
        if (game.triggers) {
          //@ts-ignore
          game.triggers._parseJournals.bind(game.triggers)();
        }
      },
    },

    enableJournalForSceneIntegration: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableJournalForSceneIntegration.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableJournalForSceneIntegration.hint`),
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
      onChange: () => {
        //@ts-ignore
        if (game.triggers) {
          //@ts-ignore
          game.triggers._updateJournals.bind(game.triggers)();
          //@ts-ignore
          game.triggers._parseJournals.bind(game.triggers)();
        }
      },
    },

    onlyUseJournalForSceneIntegration: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.onlyUseJournalForSceneIntegration.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.onlyUseJournalForSceneIntegration.hint`),
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
      onChange: () => {
        //@ts-ignore
        if (game.triggers) {
          //@ts-ignore
          game.triggers._updateJournals.bind(game.triggers)();
          //@ts-ignore
          game.triggers._parseJournals.bind(game.triggers)();
        }
      },
    },

    enableAvoidDeselectOnTriggerEvent: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableAvoidDeselectOnTriggerEvent.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableAvoidDeselectOnTriggerEvent.hint`),
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },

    ifNoTokenIsFoundTryToUseActor: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.ifNoTokenIsFoundTryToUseActor.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.ifNoTokenIsFoundTryToUseActor.hint`),
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },

    disableWarningMessages: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.disableWarningMessages.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.disableWarningMessages.hint`),
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },

    enableMultipleTriggerSearch: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableMultipleTriggerSearch.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableMultipleTriggerSearch.hint`),
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },

    enableEnrichHtml: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableEnrichHtml.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.enableEnrichHtml.hint`),
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },

    disableAllHidden: {
      name: i18n(`${CONSTANTS.MODULE_NAME}.settings.disableAllHidden.name`),
      hint: i18n(`${CONSTANTS.MODULE_NAME}.settings.disableAllHidden.hint`),
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
  };
}
