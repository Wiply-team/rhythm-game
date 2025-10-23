"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./RhythmGame.module.css";
import confetti from "canvas-confetti";
import { analyze, guess } from "web-audio-beat-detector";

function getLaneHeight(isMobile: boolean, isSmall: boolean) {
  return isSmall ? 350 : isMobile ? 400 : 550;
}
function getHitZoneMetrics(isMobile: boolean, isSmall: boolean) {
  const laneH = getLaneHeight(isMobile, isSmall);
  const hitZoneHeightPx = Math.round(laneH * 0.15); // 🍀 как в CSS: .hitZone {height: 15%}
  const zoneTop = laneH - hitZoneHeightPx; // зона у дна лейна
  return { zoneTop, hitZoneHeightPx, laneH };
}
function rectsOverlap(
  noteTop: number,
  noteHeight: number,
  zoneTop: number,
  zoneHeight: number
) {
  const noteBottom = noteTop + noteHeight;
  const zoneBottom = zoneTop + zoneHeight;
  return noteBottom >= zoneTop && noteTop <= zoneBottom;
}

export default function SimpleRhythmGame() {
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  useEffect(() => {
    if (isIOS) document.body.classList.add("ios");
  }, [isIOS]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notes, setNotes] = useState<
    Array<{
      id: number;
      lane: number;
      top: number;
      type: "short" | "long";
      length?: number;
      originalLength?: number;
      isBeingHeld?: boolean;
      isMissed?: boolean;
      armed?: boolean; // <— добавлено
      armedUntil?: number; // <— добавлено (время до которого считаем «во времени»)
    }>
  >([]);
  const lanesRef = useRef<NodeListOf<HTMLElement>>();
  

  useEffect(() => {
    lanesRef.current = document.querySelectorAll(
      `.${styles.lane}`
    ) as NodeListOf<HTMLElement>;
    const onResize = () => {
      lanesRef.current = document.querySelectorAll(
        `.${styles.lane}`
      ) as NodeListOf<HTMLElement>;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioSource, setAudioSource] =
    useState<MediaElementAudioSourceNode | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);
  const [distortionNode, setDistortionNode] = useState<WaveShaperNode | null>(
    null
  );
  const [lowpassNode, setLowpassNode] = useState<BiquadFilterNode | null>(null);
  const [highpassNode, setHighpassNode] = useState<BiquadFilterNode | null>(
    null
  );
  const [detectedBPM, setDetectedBPM] = useState<number | null>(null);
  const [beatDetector, setBeatDetector] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [comboProgress, setComboProgress] = useState(0);
  const [lastNoteTime, setLastNoteTime] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [scorePulse, setScorePulse] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [noteId, setNoteId] = useState(0);
  const [isPressed, setIsPressed] = useState<{ [key: number]: boolean }>({});
  const [lastLane, setLastLane] = useState<number | null>(null);
  const [buttonPressed, setButtonPressed] = useState<{
    [key: number]: boolean;
  }>({});
  const [judgement, setJudgement] = useState<{
    text: string;
    show: boolean;
    type: "hit" | "early" | "miss";
  }>({ text: "", show: false, type: "hit" });
  const [gameTime, setGameTime] = useState(60);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameResult, setGameResult] = useState<"win" | "lose">("win");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">(
    "MEDIUM"
  );
  const [selectedSong, setSelectedSong] = useState<"RATATATA" | "NOVOCAINE" | "SLTS">("NOVOCAINE");
  const [lives, setLives] = useState(10);
  const [lastMissTime, setLastMissTime] = useState(0);

  const [particles, setParticles] = useState<
    Array<{
      id: number;
      tx: number;
      ty: number;
      rot: number;
      dur: number;
      delay: number;
      size: number;
      shape: "circle" | "diamond" | "square";
    }>
  >([]);

  // полноcценный темп
  // NOTE: Removed 'await' and usage of undefined 'audioBuffer' to fix errors.
  // Add this logic inside an async function and define audioBuffer if needed.

  // Example placeholder values (replace with real analysis logic in context)
  const tempo = 128.3; // число, напр. 128.3

  // или темп + смещение первого удара
  // Real analyze/guess functions should be called within an async block with correct audioBuffer
  const roundedBpm = 128;
  const offset = 0;
  const rawTempo = 128.3;


  // Функция для создания искажения звука с шипением и приглушенностью
  const createDistortionCurve = (amount: number) => {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Более агрессивное искажение с шипением
      const distortion =
        ((5 + amount) * x * 30 * deg) / (Math.PI + amount * Math.abs(x));
      // Добавляем шум для шипения
      const noise = (Math.random() - 0.5) * 0.1;
      curve[i] = Math.tanh(distortion + noise);
    }

    return curve;
  };

  // Функция для применения звукового эффекта
  const applyAudioEffect = (type: "hit" | "miss") => {
    if (!audioContext || !gainNode || !distortionNode) return;

    if (type === "hit") {
      // Увеличиваем громкость при попадании (более заметный эффект)
      gainNode.gain.setValueAtTime(1.35, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.5,
        audioContext.currentTime + 0.3
      );

      // Убираем искажение
      distortionNode.curve = null;
    } else if (type === "miss") {
      // Применяем сильное искажение при промахе
      distortionNode.curve = createDistortionCurve(80);
      distortionNode.oversample = "4x";

      // Применяем фильтры для приглушенности
      if (lowpassNode) {
        lowpassNode.frequency.setValueAtTime(800, audioContext.currentTime);
        lowpassNode.Q.setValueAtTime(1, audioContext.currentTime);
      }
      if (highpassNode) {
        highpassNode.frequency.setValueAtTime(200, audioContext.currentTime);
        highpassNode.Q.setValueAtTime(0.5, audioContext.currentTime);
      }

      // Сильно уменьшаем громкость для драматического эффекта
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.5,
        audioContext.currentTime + 0.4
      );

      // Убираем все эффекты через некоторое время
      setTimeout(() => {
        if (distortionNode) {
          distortionNode.curve = null;
        }
        if (lowpassNode) {
          lowpassNode.frequency.setValueAtTime(20000, audioContext.currentTime);
        }
        if (highpassNode) {
          highpassNode.frequency.setValueAtTime(20, audioContext.currentTime);
        }
      }, 700);
    }
  };

  

  // Функция для сброса комбо (вызывается только при потере жизней)
  const resetCombo = () => {
    setCombo(0);
    setComboMultiplier(1);
    setComboProgress(0);
  };

  // Функция для запуска анимации пульсации счётчика
  const triggerScorePulse = () => {
    setScorePulse(true);
    setTimeout(() => setScorePulse(false), 300); // Длительность анимации
  };

  // Отслеживаем изменения счёта и запускаем анимацию
  useEffect(() => {
    if (score > 0) {
      // Только если счёт больше 0 (не при инициализации)
      triggerScorePulse();
    }
  }, [score]);

  // Функция для показа суждения
  const showJudgement = (text: string, type: "hit" | "early" | "miss") => {
    setJudgement({ text, show: true, type });

    // Применяем звуковой эффект
    applyAudioEffect(type === "hit" ? "hit" : "miss");

    // Применяем эффект пульсации экрана при промахе
    if (type === "miss") {
      console.log("Miss detected, calling flashScreen"); // Отладочная информация
      flashScreen();

      // Уменьшаем жизни при промахе (защита от повторного снятия)
      const now = Date.now();
      if (now - lastMissTime > 100) {
        // Минимум 100мс между снятием жизней
        console.log("Life lost! Time since last miss:", now - lastMissTime);
        setLastMissTime(now);
        setLives((prevLives) => {
          const newLives = prevLives - 1;
          console.log(
            "Lives remaining:",
            newLives,
            "(Hearts:",
            Math.ceil(newLives / 2),
            ")"
          );

          // Сбрасываем комбо при потере жизни
          resetCombo();

          if (newLives <= 0) {
            // Игра окончена - нет жизней
            console.log("Game over - no lives left!");
            setIsPlaying(false);
            setGameEnded(true);
            setGameResult("lose");
            if (audio) {
              audio.pause();
            }
          }
          return newLives;
        });
      } else {
        console.log(
          "Life loss blocked - too soon since last miss:",
          now - lastMissTime
        );
      }
    }

    // Сгенерировать россыпь частиц вокруг надписи
    const count = isIOS ? 20 : 80; // можно 12–24
    const next = Array.from({ length: count }, (_, i) => {
      const angle = Math.random() * Math.PI - Math.PI / 2; // ~полукруг вниз
      const radius = 60 + Math.random() * 90; // дальность пролёта
      const tx = Math.cos(angle) * radius * (0.6 + Math.random() * 0.8);
      const ty = Math.sin(angle) * radius + 80; // усиливаем падение
      return {
        id: Date.now() + i,
        tx,
        ty,
        rot: Math.random() * 180 - 90,
        dur: 450 + Math.random() * 450, // 450–900ms
        delay: Math.random() * 120, // лёгкая рассинхронизация
        size: 6 + Math.random() * 8, // 6–14px
        shape: (["circle", "diamond", "square"] as const)[
          Math.floor(Math.random() * 3)
        ],
      };
    });
    setParticles(next);

    // Спрятать оверлей и очистить частицы
    setTimeout(() => {
      setJudgement((prev) => ({ ...prev, show: false }));
    }, 800);
    setTimeout(() => {
      setParticles([]);
    }, 950);
  };

  function flashLane(laneEl: HTMLElement) {
    laneEl.classList.add("laneFlash", "tinyShake");
    setTimeout(() => laneEl.classList.remove("laneFlash", "tinyShake"), 220);
  }

  function flashScreen() {
    console.log("Flash screen called!"); // Отладочная информация
    const gameContainer = document.querySelector(
      `.${styles.gameContainer}`
    ) as HTMLElement;
    if (gameContainer) {
      console.log("Game container found, adding flash class"); // Отладочная информация
      gameContainer.classList.add(styles.screenFlash);
      setTimeout(() => {
        gameContainer.classList.remove(styles.screenFlash);
        console.log("Flash class removed"); // Отладочная информация
      }, 100);
    } else {
      console.log("Game container not found!"); // Отладочная информация
    }
  }

  const lastConfettiAt = useRef(0);

  function fireNoteConfettiAt(
    noteId: number,
    laneIndex: number,
    noteTopPx?: number,
    noteHeightPx?: number
  ) {
    // iOS: дешёвый режим, без поиска элемента и без измерений
    if (isIOS) {
      const now = performance.now();
      if (now - lastConfettiAt.current < 120) return; // не чаще раза/120мс
      lastConfettiAt.current = now;

      const laneWidth =
        (typeof window !== "undefined" ? window.innerWidth : 360) / 4;
      const x = ((laneIndex + 0.5) * laneWidth) / window.innerWidth; // центр лейна
      // Если передали геометрию ноты — считаем Y точнее, иначе примерно 60% высоты
      const y =
        noteTopPx != null && noteHeightPx != null
          ? Math.min(
              0.95,
              Math.max(
                0.05,
                (noteTopPx + noteHeightPx * 0.5) / window.innerHeight
              )
            )
          : 0.6;

      confettiRef.current?.({
        particleCount: 8, // мало частиц
        startVelocity: 24,
        spread: 40,
        origin: { x, y },
        scalar: 0.8,
      });
      return;
    }

    // Десктоп/андроид — как раньше с точным позиционированием
    const el = document.querySelector(
      `[data-note-id="${noteId}"]`
    ) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (rect.left + rect.width / 2) / window.innerWidth;
    const cy = (rect.top + rect.height / 2) / window.innerHeight;
    confettiRef.current?.({
      particleCount: 18,
      startVelocity: 28,
      spread: 50,
      origin: { x: cx, y: cy },
    });
  }

  // Определяем размер экрана при загрузке и изменении размера окна
  useEffect(() => {
    const updateScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsSmallScreen(window.innerWidth <= 480);
    };

    updateScreenSize();
    window.addEventListener("resize", updateScreenSize);

    return () => window.removeEventListener("resize", updateScreenSize);
  }, []);

  // Функция для анализа аудио и определения BPM
  const analyzeAudio = async (audioElement: HTMLAudioElement, audioCtx: AudioContext) => {
    try {
      setIsAnalyzing(true);
      
      // Создаем копию аудио для анализа
      const response = await fetch(audioElement.src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      // Анализируем аудио для определения BPM
      const bpm = await analyze(audioBuffer);
      console.log('Audio analysis result:', bpm);
      
      if (bpm && bpm > 0) {
        setDetectedBPM(bpm);
        console.log(`Detected BPM: ${bpm}`);
      }
      
    } catch (error) {
      console.error('Error analyzing audio:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Функция для создания beat detector (упрощенная версия)
  const createBeatDetector = (audioCtx: AudioContext, source: MediaElementAudioSourceNode) => {
    try {
      // Создаем простой анализатор для мониторинга аудио
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      
      // Подключаем анализатор ПАРАЛЛЕЛЬНО к основной цепи (не нарушая её)
      // source -> analyser (для анализа)
      // source -> highpass -> lowpass -> distortion -> gain -> destination (для воспроизведения)
      source.connect(analyser);
      
      // Создаем массив для данных частот
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Функция для анализа аудио в реальном времени
      const analyzeRealtime = () => {
        if (!isPlaying) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        // Простой алгоритм обнаружения битов на основе низких частот
        const lowFreqSum = dataArray.slice(0, 10).reduce((a, b) => a + b, 0);
        const threshold = 100; // Порог для обнаружения бита
        
        if (lowFreqSum > threshold) {
          console.log('Beat detected in real-time!');
          // Здесь можно добавить логику для синхронизации с битами
        }
        
        requestAnimationFrame(analyzeRealtime);
      };
      
      // Запускаем анализ
      analyzeRealtime();
      
      setBeatDetector(analyser);
      return analyser;
    } catch (error) {
      console.error('Error creating beat detector:', error);
      return null;
    }
  };

  const startGame = async () => {
    setIsPlaying(true);
    setScore(0);
    setCombo(0);
    setComboMultiplier(1);
    setComboProgress(0);
    setNotes([]);
    setLastNoteTime(Date.now());
    setNoteId(0);
    setLastLane(null); // Сбрасываем последнюю колонку
    setButtonPressed({}); // Сбрасываем состояние кнопок
    setGameTime(60); // Сбрасываем таймер
    setGameEnded(false); // Сбрасываем состояние завершения игры
    setGameResult("win"); // Сбрасываем результат игры
    setLives(10); // Сбрасываем жизни
    setLastMissTime(0); // Сбрасываем время последнего промаха

    // Запускаем музыку
    const audioElement = new Audio(getSongPath());
    audioElement.volume = 0.5;

    try {
      await audioElement.play();
      console.log('Audio started playing');
      console.log('Audio element volume:', audioElement.volume);
      console.log('Audio element paused:', audioElement.paused);

      // Временно отключаем все эффекты для отладки
      setAudio(audioElement);
      
      // Создаем аудио контекст и узлы для эффектов
      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(audioElement);
      const gain = audioCtx.createGain();
      const distortion = audioCtx.createWaveShaper();
      const lowpass = audioCtx.createBiquadFilter();
      const highpass = audioCtx.createBiquadFilter();

      // Настраиваем фильтры
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(20000, audioCtx.currentTime);
      lowpass.Q.setValueAtTime(1, audioCtx.currentTime);

      highpass.type = "highpass";
      highpass.frequency.setValueAtTime(20, audioCtx.currentTime);
      highpass.Q.setValueAtTime(0.5, audioCtx.currentTime);

      // Подключаем узлы: source -> highpass -> lowpass -> distortion -> gain -> destination
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(distortion);
      distortion.connect(gain);
      gain.connect(audioCtx.destination);

      // Устанавливаем начальные значения
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      
      console.log('Audio chain connected successfully');
      console.log('Audio context state:', audioCtx.state);

      setAudioContext(audioCtx);
      setAudioSource(source);
      setGainNode(gain);
      setDistortionNode(distortion);
      setLowpassNode(lowpass);
      setHighpassNode(highpass);

      // Анализируем аудио для определения BPM
      await analyzeAudio(audioElement, audioCtx);
      
      // Создаем beat detector для синхронизации с битами (временно отключено для отладки)
      // createBeatDetector(audioCtx, source);
      
      // Проверяем, что аудио все еще играет
      console.log('Audio playing after setup:', !audioElement.paused);
      console.log('Audio current time:', audioElement.currentTime);
      
    } catch (error) {
      console.error("Error starting audio:", error);
      // Если не удалось создать аудио контекст, просто играем без эффектов
      audioElement.play().catch(console.error);
      setAudio(audioElement);
    }
  };

  const handleButtonDown = (laneIndex: number) => {
    if (!isPlaying || buttonPressed[laneIndex]) return;

    setButtonPressed((prev) => ({ ...prev, [laneIndex]: true }));

    // Определяем зону попадания в зависимости от размера экрана
    const hitZoneTop = isSmallScreen ? 312 : isMobile ? 362 : 550; // Адаптивная позиция зоны попадания для новых размеров
    const hitZoneHeight = 50; // Высота зоны попадания

    // Проверяем, есть ли длинная нота в зоне для удержания
    setNotes((prevNotes) => {
      const { zoneTop, hitZoneHeightPx } = getHitZoneMetrics(
        isMobile,
        isSmallScreen
      );
      const shortNotesInZone = prevNotes.filter(
        (note) =>
          note.lane === laneIndex &&
          note.type === "short" &&
          note.top >= zoneTop - hitZoneHeightPx &&
          note.top <= zoneTop + hitZoneHeightPx &&
          !note.isMissed
      );

      const targetLong = prevNotes.find(
        (note) =>
          note.lane === laneIndex &&
          note.type === "long" &&
          !note.isBeingHeld &&
          (rectsOverlap(
            note.top,
            (note.length || 2) * 20,
            zoneTop,
            hitZoneHeightPx
          ) ||
            (note.armed && (note.armedUntil ?? 0) >= Date.now()))
      );

      if (targetLong) {
        return prevNotes.map((n) =>
          n.id === targetLong.id
            ? { ...n, isBeingHeld: true, armed: false, armedUntil: undefined }
            : n
        );
      }
      return prevNotes;
    });

    // Обрабатываем короткие ноты
    setNotes((prevNotes) => {
      const { zoneTop, hitZoneHeightPx } = getHitZoneMetrics(
        isMobile,
        isSmallScreen
      );

      const shortNotesInZone = prevNotes.filter(
        (note) =>
          note.lane === laneIndex &&
          note.type === "short" &&
          note.top >= zoneTop - hitZoneHeightPx &&
          note.top <= zoneTop + hitZoneHeightPx &&
          !note.isMissed
      );

      if (shortNotesInZone.length > 0) {
        // Короткая нота - обычное попадание
        const hitNote = shortNotesInZone[0];
          const baseScore = 25;
        
        // Обновляем комбо и получаем новый множитель
        setCombo((prevCombo) => {
          const newCombo = prevCombo + 1;
          const newMultiplier = Math.floor(newCombo / 10) + 1;
          const finalMultiplier = Math.min(newMultiplier, 5);
          
          const finalScore = baseScore * finalMultiplier;
          console.log(`Combo: ${prevCombo} -> ${newCombo}, Multiplier: ${finalMultiplier}, Score: ${baseScore} * ${finalMultiplier} = ${finalScore}`);
          setScore((prev) => prev + finalScore);
          
          // Обновляем прогресс и множитель
          setComboProgress(newCombo % 10);
          setComboMultiplier(finalMultiplier);
          
          return newCombo;
        });
        showJudgement("HIT!", "hit");

        requestAnimationFrame(() => {
          const lanes =
            lanesRef.current ||
            (document.querySelectorAll(
              `.${styles.lane}`
            ) as NodeListOf<HTMLElement>);
          const laneEl = lanes[laneIndex] as HTMLElement;
          if (laneEl) flashLane(laneEl);
          fireNoteConfettiAt(hitNote.id, laneIndex, hitNote.top, 20);
        });
        return prevNotes.filter((note) => note.id !== hitNote.id);
      } else {
        // Если нет нот в зоне, проверяем раннее нажатие (до зоны попадания)
        const earlyNotes = prevNotes.filter(
          (note) =>
            note.lane === laneIndex &&
            note.type === "short" &&
            note.top < zoneTop - hitZoneHeightPx &&
            !note.isMissed
        );

        if (earlyNotes.length > 0) {
          // Раннее нажатие - делаем ноту серой и блокируем повторное нажатие
          const earlyNote = earlyNotes[0];
          console.log("EARLY HIT! Making note gray:", earlyNote.id);
          showJudgement("TOO EARLY", "early");
          return prevNotes.map((note) =>
            note.id === earlyNote.id ? { ...note, isMissed: true } : note
          );
        }

        // Промах
        console.log("MISS! No notes in hit zone");
        return prevNotes;
      }
    });
  };

  const handleButtonUp = (laneIndex: number) => {
    if (!isPlaying) return;

    setButtonPressed((prev) => ({ ...prev, [laneIndex]: false }));

    // Останавливаем удержание длинной ноты
    setNotes((prevNotes) => {
      return prevNotes.map((note) => {
        if (
          note.lane === laneIndex &&
          note.type === "long" &&
          note.isBeingHeld
        ) {
          console.log("HOLD STOPPED! Note:", note.id);
          return { ...note, isBeingHeld: false };
        }
        return note;
      });
    });
  };

  // Анимация падающих нот
  useEffect(() => {
    if (!isPlaying) return;

    const currentBPM = getBPM(); // Получаем BPM в зависимости от сложности
    const BEAT_INTERVAL = (60 / currentBPM) * 1000; // Интервал между битами в мс
    const NOTE_INTERVAL = BEAT_INTERVAL * 2; // Одна нота каждые 2 бита

    const interval = setInterval(() => {
      const now = Date.now();

      setNotes((prevNotes) => {
        // Двигаем существующие ноты быстрее
        const laneHeight = isSmallScreen ? 350 : isMobile ? 400 : 550; // Адаптивная высота колонок (соответствует CSS)

        const movedNotes = prevNotes
          .map((note) => {
            const updated = {
              ...note,
              top: note.isBeingHeld ? note.top : note.top + 5,
            };

            // (как у тебя было) армирование длинных нот возле зоны
            if (updated.type === "long" && !updated.isBeingHeld) {
              const { zoneTop, hitZoneHeightPx } = getHitZoneMetrics(
                isMobile,
                isSmallScreen
              );
              const noteHeight = (updated.length || 2) * 20;
              const overlaps = rectsOverlap(
                updated.top,
                noteHeight,
                zoneTop,
                hitZoneHeightPx
              );

              if (overlaps && !updated.armed) {
                updated.armed = true;
                updated.armedUntil = Date.now() + 150;
              }
              if (
                updated.armed &&
                updated.armedUntil &&
                Date.now() > updated.armedUntil &&
                !overlaps
              ) {
                updated.armed = false;
                updated.armedUntil = undefined;
              }
            }
            return updated;
          })
          .filter((note) => {
            const { laneH } = getHitZoneMetrics(isMobile, isSmallScreen);

            if (note.type === "long") {
              const noteHeight = (note.length || 2) * 20;

              // Пока держим — НИКОГДА не удаляем по геометрии.
              // Нота исчезнет только в "интервале удержания", когда length <= 0.
              if (note.isBeingHeld) {
                return true;
              }

              // Длинная нота не удерживалась и начала скрываться за нижней границей — MISS
              // Проверяем, когда нижняя часть ноты (note.top + noteHeight) достигает нижней границы колонки
              if (note.top + noteHeight >= laneH) {
                setCombo(0);
                showJudgement("MISS", "miss");
                return false;
              }
              return true;
            }

            // Короткая нота ушла вниз — MISS
            if (note.top >= laneH) {
              setCombo(0);
              showJudgement("MISS", "miss");
              return false;
            }
            return true;
          });

        // Добавляем новую ноту каждые 2 бита
        if (now - lastNoteTime >= NOTE_INTERVAL) {
          // Выбираем колонку, отличную от предыдущей
          let lane;
          do {
            lane = Math.floor(Math.random() * 4);
          } while (lane === lastLane);

          setLastLane(lane);
          const isLongNote = Math.random() < 0.07; // 15% шанс длинной ноты

          if (isLongNote) {
            // Длинная нота - ОЧЕНЬ длинная!
            const longNoteLength = Math.floor(Math.random() * 8) + 12; // 12-20 единиц длины (240-400px)
            const noteHeight = longNoteLength * 20;
            const newLongNote = {
              id: noteId,
              lane: lane,
              top: -noteHeight, // Начинаем полностью выше экрана
              type: "long" as const,
              length: longNoteLength,
              originalLength: longNoteLength, // Сохраняем оригинальную длину
              isBeingHeld: false, // Отслеживаем удержание
            };
            setLastNoteTime(now);
            setNoteId((prev) => prev + 1);
            return [...movedNotes, newLongNote];
          } else {
            // Короткая нота
            const newNote = {
              id: noteId,
              lane: lane,
              top: -20,
              type: "short" as const,
            };
            setLastNoteTime(now);
            setNoteId((prev) => prev + 1);
            return [...movedNotes, newNote];
          }
        }

        return movedNotes;
      });
    }, 16); // 60 FPS для плавной анимации

    return () => clearInterval(interval);
  }, [isPlaying, lastNoteTime, noteId, isMobile, isSmallScreen, difficulty]);

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;

      const key = e.key.toLowerCase();
      let laneIndex = -1;

      switch (key) {
        case "d":
          laneIndex = 0;
          break;
        case "f":
          laneIndex = 1;
          break;
        case "j":
          laneIndex = 2;
          break;
        case "k":
          laneIndex = 3;
          break;
        default:
          return;
      }

      // Определяем зону попадания в зависимости от размера экрана
      const hitZoneTop = isSmallScreen ? 312 : isMobile ? 362 : 550; // Адаптивная позиция зоны попадания
      const hitZoneHeight = 50; // Высота зоны попадания

      // Проверяем, есть ли длинная нота в зоне для удержания
      setNotes((prevNotes) => {
        const { zoneTop, hitZoneHeightPx } = getHitZoneMetrics(
          isMobile,
          isSmallScreen
        );

        const targetLong = prevNotes.find(
          (note) =>
            note.lane === laneIndex &&
            note.type === "long" &&
            !note.isBeingHeld &&
            (rectsOverlap(
              note.top,
              (note.length || 2) * 20,
              zoneTop,
              hitZoneHeightPx
            ) ||
              (note.armed && (note.armedUntil ?? 0) >= Date.now()))
        );

        if (targetLong) {
          return prevNotes.map((n) =>
            n.id === targetLong.id
              ? { ...n, isBeingHeld: true, armed: false, armedUntil: undefined }
              : n
          );
        }
        return prevNotes;
      });

      // Обрабатываем короткие ноты
      setNotes((prevNotes) => {
        // Сначала проверяем попадания в зону
        const { zoneTop, hitZoneHeightPx } = getHitZoneMetrics(
          isMobile,
          isSmallScreen
        );

        const shortNotesInZone = prevNotes.filter(
          (note) =>
            note.lane === laneIndex &&
            note.type === "short" &&
            note.top >= zoneTop - hitZoneHeightPx &&
            note.top <= zoneTop + hitZoneHeightPx &&
            !note.isMissed
        );

        if (shortNotesInZone.length > 0) {
          const hitNote = shortNotesInZone[0];
          const baseScore = 25;
          
          // Обновляем комбо и получаем новый множитель
          setCombo((prevCombo) => {
            const newCombo = prevCombo + 1;
            const newMultiplier = Math.floor(newCombo / 10) + 1;
            const finalMultiplier = Math.min(newMultiplier, 5);
            
            const finalScore = baseScore * finalMultiplier;
            console.log(`Keyboard Combo: ${prevCombo} -> ${newCombo}, Multiplier: ${finalMultiplier}, Score: ${baseScore} * ${finalMultiplier} = ${finalScore}`);
            setScore((prev) => prev + finalScore);
            
            // Обновляем прогресс и множитель
            setComboProgress(newCombo % 10);
            setComboMultiplier(finalMultiplier);
            
            return newCombo;
          });
          showJudgement("HIT!", "hit");

          // фейерверк в точке исчезнувшей короткой ноты + вспышка дорожки
          fireNoteConfettiAt(hitNote.id, laneIndex);
          const lanes = document.querySelectorAll(`.${styles.lane}`);
          const laneEl = lanes[laneIndex] as HTMLElement;
          if (laneEl) flashLane(laneEl);

          return prevNotes.filter((note) => note.id !== hitNote.id);
        } else {
          // Если нет нот в зоне, проверяем раннее нажатие (до зоны попадания)
          const earlyNotes = prevNotes.filter(
            (note) =>
              note.lane === laneIndex &&
              note.type === "short" &&
              note.top < zoneTop - hitZoneHeightPx &&
              !note.isMissed
          );

          if (earlyNotes.length > 0) {
            // Раннее нажатие - делаем ноту серой и блокируем повторное нажатие
            const earlyNote = earlyNotes[0];
            showJudgement("TOO EARLY", "early");
            return prevNotes.map((note) =>
              note.id === earlyNote.id ? { ...note, isMissed: true } : note
            );
          }

          // Промах
          return prevNotes;
        }
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isPlaying) return;

      const key = e.key.toLowerCase();
      let laneIndex = -1;

      switch (key) {
        case "d":
          laneIndex = 0;
          break;
        case "f":
          laneIndex = 1;
          break;
        case "j":
          laneIndex = 2;
          break;
        case "k":
          laneIndex = 3;
          break;
        default:
          return;
      }

      // Останавливаем удержание длинной ноты
      setNotes((prevNotes) => {
        return prevNotes.map((note) => {
          if (
            note.lane === laneIndex &&
            note.type === "long" &&
            note.isBeingHeld
          ) {
            const stillHasLength = (note.length ?? 0) > 0;
            if (stillHasLength) {
              // Раннее отпускание — MISS
              setCombo(0);
              showJudgement("MISS", "miss");
              return { ...note, isBeingHeld: false, isMissed: true };
            }
            // если длины уже нет — считаем, что HIT уже засчитан/вот-вот будет,
            // просто снимаем удержание без наказания
            return { ...note, isBeingHeld: false };
          }
          return note;
        });
      });
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPlaying, isMobile, isSmallScreen, isPressed]);

  const confettiRef = React.useRef<ReturnType<typeof confetti.create>>();
  useEffect(() => {
    // Try to find an existing canvas, or create one dynamically if needed
    let canvas = document.getElementById(
      "confetti-canvas"
    ) as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "confetti-canvas";
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);
    }
    confettiRef.current = confetti.create(canvas, {
      resize: true,
      useWorker: true,
    });
    return () => {
      // Optionally remove canvas on unmount
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, []);
  // Обработка удержания длинных нот
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setNotes((prevNotes) => {
        const hitZoneTop = isSmallScreen ? 312 : isMobile ? 362 : 550;
        const hitZoneHeight = 50;

        return prevNotes
          .map((note) => {
            if (note.type === "long" && note.isBeingHeld) {
              const speedMultiplier = isSmallScreen
                ? 0.3
                : isMobile
                ? 0.4
                : 0.5;

              const oldLen = note.length || 0;
              const newLength = Math.max(0, oldLen - speedMultiplier);

              // сколько «юнитов» длины мы съели на этом тике
              const deltaUnits = oldLen - newLength;
              const deltaPx = deltaUnits * 20; // 1 unit = 20px, см. высоту long: length * 20

              if (newLength <= 0) {
                const baseScore = 50;
                
                // Обновляем комбо и получаем новый множитель
                setCombo((prevCombo) => {
                  const newCombo = prevCombo + 1;
                  const newMultiplier = Math.floor(newCombo / 10) + 1;
                  const finalMultiplier = Math.min(newMultiplier, 5);
                  
                  const finalScore = baseScore * finalMultiplier;
                  console.log(`Long Note Combo: ${prevCombo} -> ${newCombo}, Multiplier: ${finalMultiplier}, Score: ${baseScore} * ${finalMultiplier} = ${finalScore}`);
                  setScore((prev) => prev + finalScore);
                  
                  // Обновляем прогресс и множитель
                  setComboProgress(newCombo % 10);
                  setComboMultiplier(finalMultiplier);
                  
                  return newCombo;
                });
                showJudgement("HIT!", "hit");
                return null; // удалить ноту
              }

              // Укорачиваем СВЕРХУ: сдвигаем top вниз на deltaPx и уменьшаем высоту
              return {
                ...note,
                length: newLength,
                top: note.top + deltaPx,
              };
            }

            return note;
          })
          .filter((note) => note !== null) as typeof prevNotes;
      });
    }, 50); // Обновляем каждые 50мс для плавности

    return () => clearInterval(interval);
  }, [isPlaying, isMobile, isSmallScreen]);

  // Таймер игры
  useEffect(() => {
    if (!isPlaying || gameEnded) return;

    const timer = setInterval(() => {
      setGameTime((prevTime) => {
        if (prevTime <= 1) {
          // Время вышло - завершаем игру с победой
          setIsPlaying(false);
          setGameEnded(true);
          setGameResult("win");
          if (audio) {
            audio.pause();
          }
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, gameEnded, audio]);

  // Очистка аудио при размонтировании
  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      if (audioContext) {
        audioContext.close();
      }
      if (beatDetector) {
        beatDetector.disconnect();
      }
    };
  }, [audio, audioContext, beatDetector]);

  // Функция для получения пути к выбранной песне
  const getSongPath = () => {
    switch (selectedSong) {
      case "RATATATA":
        return "/music/FOROMER.mp3";
      case "NOVOCAINE":
        return "/music/Novocaine.mp3";
      case "SLTS":
        return "/music/SLTS.mp3";
      default:
        return "/music/Novocaine.mp3";
    }
  };

  // Функция для вычисления BPM в зависимости от сложности
  const getBPM = () => {
    // Используем обнаруженный BPM, если доступен, иначе используем базовый
    const baseBPM = detectedBPM || 40; // базовый BPM песни или обнаруженный
    switch (difficulty) {
      case "EASY":
        return baseBPM / 2; // 68 BPM
      case "MEDIUM":
        return baseBPM; // 136 BPM
      case "HARD":
        return baseBPM * 2; // 272 BPM
      default:
        return baseBPM;
    }
  };

  const BPM = getBPM();
  const beatSeconds = 60 / BPM;
  return (
    <div
      className={styles.gameContainer}
      style={{ ["--bpm-period" as any]: `${beatSeconds}s` }}
    >
      <div className={styles.judgementData}>
        <div className={styles.scoreContainer}>
          <span
            id="score"
            className={`${score >= 9999 ? styles.scoreLarge : ""} ${
              scorePulse ? styles.scorePulse : ""
            }`}
          >
            {score}
          </span>
        </div>
        {isPlaying && (
          <div className={styles.timerContainer}>
            <span
              className={
                gameTime <= 10 ? styles.timerWarning : styles.timerNormal
              }
            >
              {gameTime}s
            </span>
          </div>
        )}

        {isPlaying && (
          <div className={styles.livesContainer}>
            {Array.from({ length: 5 }, (_, index) => {
              // Каждое сердечко представляет 2 жизни
              // Сердечко теряется, когда у нас меньше чем (index + 1) * 2 жизней
              const heartThreshold = (index + 1) * 2;
              const isLost = lives < heartThreshold;

              return (
                <span
                  key={index}
                  className={`${styles.heart} ${isLost ? styles.lost : ""}`}
                >
                  ❤️
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.gameField}>
        <div className={styles.lanesContainer}>
          {[0, 1, 2, 3].map((laneIndex) => {
            const hitZoneTop = isSmallScreen ? 312 : isMobile ? 362 : 550;

            return (
              <div key={laneIndex} className={styles.lane}>
                {/* Прогресс-заполнение комбо */}
                {isPlaying && comboMultiplier < 5 && (
                  <div
                    className={styles.laneComboProgress}
                    style={{
                      height: `${(comboProgress / 10) * 100}%`,
                      opacity: comboProgress > 0 ? 0.3 : 0,
                    }}
                  />
                )}
                <div
                  className={`${styles.hitZone} ${styles.hitZonePulse}`}
                ></div>
                {/* Рендерим ноты для этой колонки */}
                {notes
                  .filter((note) => note.lane === laneIndex)
                  .map((note) => (
                    <div
                      key={note.id}
                      data-note-id={note.id}
                      className={`${styles.note} ${
                        note.type === "long" ? styles.longNote : ""
                      } ${styles.noteTail}`}
                      style={{
                        top: "0px", // фикс
                        transform: `translateY(${note.top}px) ${
                          note.type === "long" && note.isBeingHeld
                            ? "scaleY(0.95)"
                            : "scaleY(1)"
                        }`,
                        willChange: "transform",
                        left: isMobile ? "0.25px" : "0.25px",
                        width: isMobile ? "79.5px" : "99.5px",
                        height:
                          note.type === "long"
                            ? `${(note.length || 2) * 20}px`
                            : "20px",
                        opacity:
                          note.type === "long" && note.isBeingHeld ? 0.7 : 1,
                        transition: "opacity 0.1s ease",
                        position: "absolute",
                        backgroundColor: note.isMissed
                          ? "#808080" // Серый цвет для промахнутых нот
                          : note.type === "long"
                          ? laneIndex === 0
                            ? "#ff6b6b"
                            : laneIndex === 1
                            ? "#5352ed"
                            : laneIndex === 2
                            ? "#2ed573"
                            : "#a0522d"
                          : laneIndex === 0
                          ? "#ff4757"
                          : laneIndex === 1
                          ? "#3742fa"
                          : laneIndex === 2
                          ? "#20bf6b"
                          : "#8b4513",
                        border:
                          note.type === "long"
                            ? "2px solid rgba(255, 255, 255, 0.3)"
                            : "none",
                        borderRadius: "8px",
                        boxShadow:
                          note.type === "long"
                            ? "0 4px 12px rgba(0, 0, 0, 0.4)"
                            : "0 2px 6px rgba(0, 0, 0, 0.3)",
                      }}
                    />
                  ))}
              </div>
            );
          })}
        </div>

        <div className={styles.buttonsContainer}>
          <button
            className={`${styles.gameButton} ${styles.imageButton} ${styles.gameButtonPulse}`}
            onMouseDown={() => handleButtonDown(0)}
            onMouseUp={() => handleButtonUp(0)}
            onMouseLeave={() => handleButtonUp(0)}
            onTouchStart={(e) => {
              e.preventDefault();
              handleButtonDown(0);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleButtonUp(0);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <img
              src="/red.png"
              alt="Red button"
              className={styles.buttonImage}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
            <span className={styles.buttonLetter}>D</span>
          </button>
          <button
            className={`${styles.gameButton} ${styles.imageButton} ${styles.gameButtonPulse}`}
            onMouseDown={() => handleButtonDown(1)}
            onMouseUp={() => handleButtonUp(1)}
            onMouseLeave={() => handleButtonUp(1)}
            onTouchStart={(e) => {
              e.preventDefault();
              handleButtonDown(1);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleButtonUp(1);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <img
              src="/blue.png"
              alt="Blue button"
              className={styles.buttonImage}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
            <span className={styles.buttonLetter}>F</span>
          </button>
          <button
            className={`${styles.gameButton} ${styles.imageButton} ${styles.gameButtonPulse}`}
            onMouseDown={() => handleButtonDown(2)}
            onMouseUp={() => handleButtonUp(2)}
            onMouseLeave={() => handleButtonUp(2)}
            onTouchStart={(e) => {
              e.preventDefault();
              handleButtonDown(2);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleButtonUp(2);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <img
              src="/green.png"
              alt="Green button"
              className={styles.buttonImage}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
            <span className={styles.buttonLetter}>J</span>
          </button>
          <button
            className={`${styles.gameButton} ${styles.imageButton} ${styles.gameButtonPulse}`}
            onMouseDown={() => handleButtonDown(3)}
            onMouseUp={() => handleButtonUp(3)}
            onMouseLeave={() => handleButtonUp(3)}
            onTouchStart={(e) => {
              e.preventDefault();
              handleButtonDown(3);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleButtonUp(3);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <img
              src="/brown.png"
              alt="Brown button"
              className={styles.buttonImage}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
            <span className={styles.buttonLetter}>K</span>
          </button>
        </div>
      </div>

      {/* Комбо-счетчик в центре */}
      {isPlaying && (
        <div key={comboMultiplier} className={styles.comboDisplay}>
          x{comboMultiplier}
        </div>
      )}

      {/* Всплывающее уведомление о суждении */}
      {judgement.show && (
        <div
          className={`${styles.judgementOverlay} ${
            judgement.type === "hit"
              ? styles.judgementHit
              : judgement.type === "early"
              ? styles.judgementEarly
              : styles.judgementMiss
          }`}
          style={{
            fontSize: isSmallScreen ? "20px" : isMobile ? "24px" : "42px",
          }}
        >
          {judgement.text}
          <div className={styles.judgementParticles}>
            {particles.map((p) => (
              <span
                key={p.id}
                className={`${styles.judgementParticle} ${
                  p.shape === "circle"
                    ? styles.circle
                    : p.shape === "diamond"
                    ? styles.diamond
                    : ""
                }`}
                style={
                  {
                    // CSS-переменные для анимации
                    // @ts-ignore - CSS variables
                    "--tx": `${p.tx}px`,
                    "--ty": `${p.ty}px`,
                    "--rot": `${p.rot}deg`,
                    animationDuration: `${p.dur}ms`,
                    animationDelay: `${p.delay}ms`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      )}

      {!isPlaying && !gameEnded && (
        <div
          className={styles.startMessage}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: isSmallScreen ? "16px" : isMobile ? "18px" : "24px",
            textAlign: "center",
            zIndex: 1000,
          }}
        >
          <p>Select difficulty and song, then start the game</p>

          <div className={styles.difficultyContainer}>
            <label
              className={`${styles.difficultyLabel} ${
                difficulty === "EASY" ? styles.selected : ""
              }`}
              onClick={() => setDifficulty("EASY")}
            >
              <input
                type="radio"
                name="difficulty"
                value="EASY"
                checked={difficulty === "EASY"}
                onChange={() => setDifficulty("EASY")}
                className={styles.difficultyCheckbox}
              />
              EASY (quarter speed) (may be boring)
            </label>

            <label
              className={`${styles.difficultyLabel} ${
                difficulty === "MEDIUM" ? styles.selected : ""
              }`}
              onClick={() => setDifficulty("MEDIUM")}
            >
              <input
                type="radio"
                name="difficulty"
                value="MEDIUM"
                checked={difficulty === "MEDIUM"}
                onChange={() => setDifficulty("MEDIUM")}
                className={styles.difficultyCheckbox}
              />
              MEDIUM (half speed) (may be challenging)
            </label>

            <label
              className={`${styles.difficultyLabel} ${
                difficulty === "HARD" ? styles.selected : ""
              }`}
              onClick={() => setDifficulty("HARD")}
            >
              <input
                type="radio"
                name="difficulty"
                value="HARD"
                checked={difficulty === "HARD"}
                onChange={() => setDifficulty("HARD")}
                className={styles.difficultyCheckbox}
              />
              HARD (original speed) (God help you get through this)
            </label>
          </div>

          <div className={styles.songContainer}>
            <h3>Select Song:</h3>
            <label
              className={`${styles.songLabel} ${
                selectedSong === "RATATATA" ? styles.selected : ""
              }`}
              onClick={() => setSelectedSong("RATATATA")}
            >
              <input
                type="radio"
                name="song"
                value="RATATATA"
                checked={selectedSong === "RATATATA"}
                onChange={() => setSelectedSong("RATATATA")}
                className={styles.songCheckbox}
              />
              Ratatata
            </label>

            <label
              className={`${styles.songLabel} ${
                selectedSong === "NOVOCAINE" ? styles.selected : ""
              }`}
              onClick={() => setSelectedSong("NOVOCAINE")}
            >
              <input
                type="radio"
                name="song"
                value="NOVOCAINE"
                checked={selectedSong === "NOVOCAINE"}
                onChange={() => setSelectedSong("NOVOCAINE")}
                className={styles.songCheckbox}
              />
              Novocaine
            </label>

            <label
              className={`${styles.songLabel} ${
                selectedSong === "SLTS" ? styles.selected : ""
              }`}
              onClick={() => setSelectedSong("SLTS")}
            >
              <input
                type="radio"
                name="song"
                value="SLTS"
                checked={selectedSong === "SLTS"}
                onChange={() => setSelectedSong("SLTS")}
                className={styles.songCheckbox}
              />
              Smells Like Teen Spirit
            </label>
          </div>

          <button onClick={startGame}>Start the game</button>
        </div>
      )}

      {gameEnded && (
        <div
          className={styles.endMessage}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "48px",
            fontWeight: "bold",
            textAlign: "center",
            zIndex: 1000,
            textShadow: "3px 3px 6px rgba(0,0,0,0.8)",
            animation: "pulse 1s infinite alternate",
          }}
        >
          <div style={{ color: gameResult === "win" ? "#2ed573" : "#ff4757" }}>
            {gameResult === "win" ? "YOU WIN!" : "GAME OVER!"}
          </div>
          <div
            style={{
              fontSize: isSmallScreen ? "16px" : isMobile ? "18px" : "24px",
              marginTop: "20px",
            }}
          >
            Final Score: {score}
          </div>
          {gameResult === "lose" && (
            <div
              style={{
                fontSize: isSmallScreen ? "12px" : isMobile ? "14px" : "18px",
                marginTop: "10px",
                color: "#666",
              }}
            >
              You ran out of lives!
            </div>
          )}
          <button onClick={startGame}>Play Again</button>
        </div>
      )}
    </div>
  );
}
