export class CompendiumLink {
  packId;
  id;
  label;
  constructor(packId, id, label) {
    this.packId = packId;
    this.id = id;
    this.label = label;
  }
}

export class SoundLink {
  playlistName;
  soundName;
  label;
  constructor(playlistName, soundName, label) {
    this.playlistName = playlistName;
    this.soundName = soundName;
    this.label = label;
  }
}

export class ChatLink {
  chatMessage;
  type;
  whisper;
  constructor(chatMessage, type, whisper) {
    this.chatMessage = chatMessage;
    this.type = type;
    this.whisper = whisper;
  }
}

export class EffectLink {
  key;
  args;
  constructor(key, args) {
    this.key = key;
    this.args = args;
  }
}

export const TRIGGER_ENTITY_TYPES = {
  TRIGGER: 'trigger',
  CHAT_MESSAGE: 'chatmessage',
  ACTOR: 'actor',
  TOKEN: 'token',
  SCENE: 'scene',
  DRAWING: 'drawing',
  DOOR: 'door',
  COMPENDIUM: 'compendium',
  JOURNAL_ENTRY: 'journalentry',
  STAIRWAY: 'stairway',
  SOUND_LINK: 'sound', // not the ambient sound the one from the sound link module
  PLAYLIST: 'playlist',
  // New support key because i see people using these
  OOC: 'ooc',
  EMOTE: 'emote',
  WHISPER: 'whisper',
  SELF_WHISPER: 'selfwhisper',
};

export const EVENT_TRIGGER_ENTITY_TYPES = {
  OOC: `ooc`,
  EMOTE: `emote`,
  WHISPER: `whisper`,
  SELF_WHISPER: `selfwhisper`,
  PRELOAD: `preload`,
  CLICK: `click`,
  MOVE: `move`,
  STOP_MOVEMENT: `stopmovement`,
  CAPTURE: `capture`,
  DOOR_CLOSE: `doorclose`,
  DOOR_OPEN: `dooropen`,
  ONLY_IF_HIDDEN: `onlyifhidden`,
  ONLY_IF_UNHIDDEN: `onlyifunhidden`,
};

export class TriggerHappyJournal {
  trigger: any; // any document type
  effects: string[] | string;
  options: string[] | string;
}
