export class Tap {
  public laneName: string;
  public expectedTime: number;
  public isJudged: boolean = false;

  constructor(expectedTime: number, laneName?: string) {
    this.expectedTime = expectedTime;
    this.laneName = laneName || '';
  }
}

export class Hold {
  public laneName: string;
  public expectedTime: number;
  public duration: number;
  public isJudged: boolean = false;
  public isHeld: boolean = false;

  constructor(expectedTime: number, additionalData?: { duration?: number; laneName?: string }) {
    this.expectedTime = expectedTime;
    this.duration = additionalData?.duration || 1000;
    this.laneName = additionalData?.laneName || '';
  }
}

export class JudgementClass {
  public name: string;
  public score: number;
  public multiplier: number;
  public isHit: boolean;

  constructor(name: string, score: number, multiplier: number, isHit: boolean) {
    this.name = name;
    this.score = score;
    this.multiplier = multiplier;
    this.isHit = isHit;
  }
}

export class Song {
  public info: {
    music: string;
    title: string;
    artist: string;
    volume: number;
    bpm: number;
    split: number;
    delay: number;
  };
  public chart: {
    normal: any[];
  };

  constructor(config: {
    info: {
      music: string;
      title: string;
      artist: string;
      volume: number;
      bpm: number;
      split: number;
      delay: number;
    };
    chart: {
      normal: any[];
    };
  }) {
    this.info = config.info;
    this.chart = config.chart;
  }
}

export class Game {
  public DOM: { [key: string]: HTMLElement };
  public keybind: { [key: string]: string };
  public notes: { [key: string]: (expectedTime: number, additionalData?: any) => Tap | Hold };
  public judgements: JudgementClass[];
  public sizePerBeat: string;
  public laneSizeRatio: number;
  public judgementPosition: number;
  public event: any;
  public isPressed: { [key: string]: boolean } = {};
  public score: number = 0;
  public combo: number = 0;
  public lastJudgement: string = '';

  constructor(config: {
    DOM: { [key: string]: HTMLElement };
    keybind: { [key: string]: string };
    notes: { [key: string]: (expectedTime: number, additionalData?: any) => Tap | Hold };
    judgements: JudgementClass[];
    sizePerBeat: string;
    laneSizeRatio: number;
    judgementPosition: number;
    event: any;
  }) {
    this.DOM = config.DOM;
    this.keybind = config.keybind;
    this.notes = config.notes;
    this.judgements = config.judgements;
    this.sizePerBeat = config.sizePerBeat;
    this.laneSizeRatio = config.laneSizeRatio;
    this.judgementPosition = config.judgementPosition;
    this.event = config.event;
  }

  public play(song: Song, difficulty: string): void {
    // Implementation will be added
    console.log('Playing song:', song.info.title);
  }

  public judgeLane(laneName: string, eventType: string): void {
    // Implementation will be added
    console.log('Judging lane:', laneName, 'Event:', eventType);
  }

  public sendJudgeToDOM(): void {
    // Implementation will be added
    console.log('Sending judgement to DOM');
  }
}
