'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RhythmGameProps, SongConfig, GenerationOptions, SpeedSettings, Judgement } from '../types';
import { Game, Song, Tap, Hold, Judgement as JudgementClass } from '../game/classes';
import { generateRandomChart } from '../game/generator';
import styles from './RhythmGame.module.css';

const defaultSpeedSettings: SpeedSettings = {
  sizePerBeat: "6vh",
  laneSizeRatio: 12
};

const defaultJudgements: Judgement[] = [
  { name: 'HIT', score: 100, multiplier: 1, isHit: true },
  { name: 'TOO EARLY', score: 2000, multiplier: 0, isHit: false }
];

const defaultGenerationOptions: GenerationOptions = {
  useLongNotes: true,
  longNoteDensity: 0.15,
  lanes: ["lane1", "lane2", "lane3", "lane4"],
  startDelay: 1,
  regularInterval: 1,
  noteEvery: 0.5,
  minGap: 0,
  avoidSimultaneous: false,
  minCrosslaneGap: 0,
};

export default function RhythmGame({
  songConfig,
  generationOptions = defaultGenerationOptions,
  speedSettings = defaultSpeedSettings,
  judgements = defaultJudgements,
  onScoreUpdate,
  onComboUpdate,
  onJudgementUpdate,
  className = '',
  style = {},
}: RhythmGameProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Game | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [judgement, setJudgement] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Создаем экземпляры классов для игры
  const tapNote = useCallback((expectedTime: number) => new Tap(expectedTime), []);
  const holdNote = useCallback((expectedTime: number, additionalData?: any) => 
    new Hold(expectedTime, additionalData), []);

  const judgementClasses = judgements.map(j => 
    new JudgementClass(j.name, j.score, j.multiplier, j.isHit)
  );

  // Инициализация игры
  useEffect(() => {
    if (!gameRef.current) return;

    const game = new Game({
      DOM: {
        lane1: gameRef.current.querySelector(`.${styles.lane}:nth-child(1)`) as HTMLElement,
        lane2: gameRef.current.querySelector(`.${styles.lane}:nth-child(2)`) as HTMLElement,
        lane3: gameRef.current.querySelector(`.${styles.lane}:nth-child(3)`) as HTMLElement,
        lane4: gameRef.current.querySelector(`.${styles.lane}:nth-child(4)`) as HTMLElement,
        score: gameRef.current.querySelector(`.${styles.judgementData} #score`) as HTMLElement,
        combo: gameRef.current.querySelector(`.${styles.judgementData} #combo`) as HTMLElement,
        judgement: gameRef.current.querySelector(`.${styles.judgementData} #judgement`) as HTMLElement,
      },
      keybind: {
        d: "lane1",
        f: "lane2",
        j: "lane3",
        k: "lane4",
      },
      notes: {
        s: tapNote,
        l: holdNote,
      },
      judgements: judgementClasses,
      sizePerBeat: speedSettings.sizePerBeat,
      laneSizeRatio: speedSettings.laneSizeRatio,
      judgementPosition: 0.075,
      event: {
        input: {
          keydown: (game: Game, laneName: string) => {
            const laneElement = game.DOM[laneName];
            if (laneElement) {
              laneElement.classList.add('active');
            }
            game.isPressed[laneName] = true;
          },
          keyup: (game: Game, laneName: string) => {
            const laneElement = game.DOM[laneName];
            if (laneElement) {
              laneElement.classList.remove('active');
            }
            game.isPressed[laneName] = false;
          }
        },
        judge: (game: Game, judgementData: any, judgedNote: any) => {
          game.sendJudgeToDOM();
          
          if (judgedNote && judgedNote.constructor.name === 'Hold') {
            const laneName = judgedNote.laneName || 'unknown';
            const isPressed = game.isPressed[laneName];
            
            if (judgementData.lastJudgement === 'HIT' && !isPressed) {
              const judgeElement = gameRef.current?.querySelector('.judge');
              if (judgeElement) {
                judgeElement.textContent = 'HOLD MISS!';
                (judgeElement as HTMLElement).style.color = '#ff4757';
                (judgeElement as HTMLElement).style.fontSize = '24px';
                
                setTimeout(() => {
                  judgeElement.textContent = judgementData.lastJudgement;
                  (judgeElement as HTMLElement).style.color = '';
                  (judgeElement as HTMLElement).style.fontSize = '';
                }, 1000);
              }
            }
          }
        }
      }
    });

    gameInstanceRef.current = game;

    // Обработчики клавиатуры
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (game.keybind[key]) {
        game.judgeLane(game.keybind[key], 'keydown');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (game.keybind[key]) {
        game.judgeLane(game.keybind[key], 'keyup');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [tapNote, holdNote, judgementClasses, speedSettings]);

  // Создание песни
  const createSong = useCallback(() => {
    const chart = generateRandomChart(
      songConfig.durationSeconds,
      songConfig.bpm,
      songConfig.split,
      generationOptions
    );

    return new Song({
      info: {
        music: songConfig.music,
        title: songConfig.title,
        artist: songConfig.artist,
        volume: songConfig.volume,
        bpm: songConfig.bpm,
        split: songConfig.split,
        delay: songConfig.delay,
      },
      chart: {
        normal: chart,
      },
    });
  }, [songConfig, generationOptions]);

  // Запуск игры
  const startGame = useCallback(() => {
    if (!gameInstanceRef.current) return;
    
    const song = createSong();
    gameInstanceRef.current.play(song, "normal");
    setIsPlaying(true);
  }, [createSong]);

  // Обработчики кнопок мыши
  const handleButtonMouseDown = useCallback((laneName: string) => {
    if (!gameInstanceRef.current) return;
    gameInstanceRef.current.judgeLane(laneName, 'keydown');
  }, []);

  const handleButtonMouseUp = useCallback((laneName: string) => {
    if (!gameInstanceRef.current) return;
    gameInstanceRef.current.judgeLane(laneName, 'keyup');
  }, []);

  // Обработчики touch событий
  const handleTouchStart = useCallback((e: React.TouchEvent, laneName: string) => {
    e.preventDefault();
    handleButtonMouseDown(laneName);
  }, [handleButtonMouseDown]);

  const handleTouchEnd = useCallback((e: React.TouchEvent, laneName: string) => {
    e.preventDefault();
    handleButtonMouseUp(laneName);
  }, [handleButtonMouseUp]);

  return (
    <div 
      ref={gameRef}
      className={`${styles.gameContainer} ${className}`}
      style={style}
    >
      <div className={styles.judgementData}>
        <div>score: <span id="score">{score}</span></div>
        <div>combo: <span id="combo">{combo}</span></div>
        <div id="judgement">{judgement}</div>
      </div>

      <div className={styles.gameField}>
        <div className={styles.lanesContainer}>
          <div className={styles.lane}>
            <div className={styles.hitZone}></div>
          </div>
          <div className={styles.lane}>
            <div className={styles.hitZone}></div>
          </div>
          <div className={styles.lane}>
            <div className={styles.hitZone}></div>
          </div>
          <div className={styles.lane}>
            <div className={styles.hitZone}></div>
          </div>
        </div>
        
        <div className={styles.buttonsContainer}>
          <button 
            className={`${styles.gameButton} ${styles.redButton}`}
            data-lane="lane1"
            onMouseDown={() => handleButtonMouseDown('lane1')}
            onMouseUp={() => handleButtonMouseUp('lane1')}
            onMouseLeave={() => handleButtonMouseUp('lane1')}
            onTouchStart={(e) => handleTouchStart(e, 'lane1')}
            onTouchEnd={(e) => handleTouchEnd(e, 'lane1')}
            onTouchCancel={(e) => handleTouchEnd(e, 'lane1')}
          ></button>
          <button 
            className={`${styles.gameButton} ${styles.blueButton}`}
            data-lane="lane2"
            onMouseDown={() => handleButtonMouseDown('lane2')}
            onMouseUp={() => handleButtonMouseUp('lane2')}
            onMouseLeave={() => handleButtonMouseUp('lane2')}
            onTouchStart={(e) => handleTouchStart(e, 'lane2')}
            onTouchEnd={(e) => handleTouchEnd(e, 'lane2')}
            onTouchCancel={(e) => handleTouchEnd(e, 'lane2')}
          ></button>
          <button 
            className={`${styles.gameButton} ${styles.greenButton}`}
            data-lane="lane3"
            onMouseDown={() => handleButtonMouseDown('lane3')}
            onMouseUp={() => handleButtonMouseUp('lane3')}
            onMouseLeave={() => handleButtonMouseUp('lane3')}
            onTouchStart={(e) => handleTouchStart(e, 'lane3')}
            onTouchEnd={(e) => handleTouchEnd(e, 'lane3')}
            onTouchCancel={(e) => handleTouchEnd(e, 'lane3')}
          ></button>
          <button 
            className={`${styles.gameButton} ${styles.brownButton}`}
            data-lane="lane4"
            onMouseDown={() => handleButtonMouseDown('lane4')}
            onMouseUp={() => handleButtonMouseUp('lane4')}
            onMouseLeave={() => handleButtonMouseUp('lane4')}
            onTouchStart={(e) => handleTouchStart(e, 'lane4')}
            onTouchEnd={(e) => handleTouchEnd(e, 'lane4')}
            onTouchCancel={(e) => handleTouchEnd(e, 'lane4')}
          ></button>
        </div>
      </div>

      {!isPlaying && (
        <div style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '24px',
          textAlign: 'center',
          zIndex: 1000
        }}>
          <p>Нажмите любую клавишу или тапните по экрану для начала игры</p>
          <button 
            onClick={startGame}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              fontSize: '18px',
              backgroundColor: '#ff4757',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Начать игру
          </button>
        </div>
      )}
    </div>
  );
}
