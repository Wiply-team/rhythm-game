export interface SongConfig {
  music: string;
  title: string;
  artist: string;
  volume: number;
  bpm: number;
  split: number;
  delay: number;
  durationSeconds: number;
}

export interface GenerationOptions {
  density?: number;
  useLongNotes?: boolean;
  longNoteDensity?: number;
  minGap?: number;
  lanes?: string[];
  startDelay?: number;
  avoidSimultaneous?: boolean;
  minCrosslaneGap?: number;
  regularInterval?: number;
  noteEvery?: number;
}

export interface SpeedSettings {
  sizePerBeat: string;
  laneSizeRatio: number;
}

export interface Judgement {
  name: string;
  score: number;
  multiplier: number;
  isHit: boolean;
}

export interface RhythmGameProps {
  songConfig: SongConfig;
  generationOptions?: GenerationOptions;
  speedSettings?: SpeedSettings;
  judgements?: Judgement[];
  onScoreUpdate?: (score: number) => void;
  onComboUpdate?: (combo: number) => void;
  onJudgementUpdate?: (judgement: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface Note {
  type: 'tap' | 'hold';
  lane: number;
  time: number;
  duration?: number;
}

export interface Chart {
  [lane: string]: string;
}
