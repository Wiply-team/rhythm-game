import { GenerationOptions } from '../types';

export function generateRandomChart(
  durationSeconds: number,
  bpm: number,
  split: number = 16,
  options: GenerationOptions = {}
): any[] {
  const {
    density = 0.1,
    useLongNotes = true,
    longNoteDensity = 0.05,
    minGap = 2,
    lanes = ["lane1", "lane2", "lane3", "lane4"],
    startDelay = 8,
    avoidSimultaneous = true,
    minCrosslaneGap = 4,
    regularInterval = 0,
    noteEvery = 0.125,
  } = options;

  // Рассчитываем количество позиций
  const beatsPerSecond = bpm / 60;
  const totalBeats = Math.ceil(durationSeconds * beatsPerSecond);
  const totalPositions = totalBeats * split + startDelay * split;

  // Создаем пустые дорожки
  const chart: { [key: string]: string } = {};
  const positions: { [key: string]: string[] } = {};
  lanes.forEach((lane) => {
    chart[lane] = "*".repeat(totalPositions);
    positions[lane] = chart[lane].split("");
  });

  // Массив для отслеживания занятых позиций на ВСЕХ дорожках
  const globalOccupiedPositions = new Set<number>();
  
  // Массив для отслеживания последней позиции ноты на каждой дорожке
  const lastNotePosition: { [key: string]: number } = {};
  lanes.forEach((lane) => {
    lastNotePosition[lane] = -999;
  });

  // РЕЖИМ РЕГУЛЯРНОЙ ГЕНЕРАЦИИ
  if (regularInterval > 0) {
    const intervalInPositions = Math.round(noteEvery * split);
    
    for (let i = startDelay * split; i < totalPositions; i += intervalInPositions) {
      // Фильтруем дорожки, где можно разместить ноту
      const availableLanes = lanes.filter((lane) => {
        // Проверка 1: достаточно ли времени прошло с последней ноты на ЭТОЙ дорожке
        if (minGap > 0 && i - lastNotePosition[lane] < minGap) {
          return false;
        }

        // Проверка 2: нет ли уже ноты на этой позиции
        if (positions[lane][i] !== "*") {
          return false;
        }

        // Проверка 3: если включен режим избегания одновременных нот
        if (avoidSimultaneous && minCrosslaneGap > 0) {
          for (
            let j = Math.max(0, i - minCrosslaneGap);
            j < Math.min(totalPositions, i + minCrosslaneGap);
            j++
          ) {
            if (globalOccupiedPositions.has(j)) {
              return false;
            }
          }
        }

        return true;
      });

      // Если есть доступные дорожки, выбираем случайную
      if (availableLanes.length > 0) {
        const selectedLane =
          availableLanes[Math.floor(Math.random() * availableLanes.length)];

        // Решаем, какой тип ноты (короткая или длинная)
        if (
          useLongNotes &&
          Math.random() < longNoteDensity &&
          i < totalPositions - split
        ) {
          // Длинная нота
          const longNoteLength = Math.min(
            Math.floor(Math.random() * split / 2) + split / 2,
            totalPositions - i
          );
          for (let j = 0; j < longNoteLength; j++) {
            positions[selectedLane][i + j] = "l";
            globalOccupiedPositions.add(i + j);
          }
          lastNotePosition[selectedLane] = i + longNoteLength;
        } else {
          // Короткая нота
          positions[selectedLane][i] = "s";
          globalOccupiedPositions.add(i);
          lastNotePosition[selectedLane] = i;
        }
      }
    }
  } 
  // РЕЖИМ СЛУЧАЙНОЙ ГЕНЕРАЦИИ
  else {
    for (let i = startDelay * split; i < totalPositions - minGap; i++) {
      // Решаем, ставить ли ноту на этой позиции
      if (Math.random() < density) {
        // Фильтруем дорожки, где можно разместить ноту
        const availableLanes = lanes.filter((lane) => {
          // Проверка 1: достаточно ли времени прошло с последней ноты на ЭТОЙ дорожке
          if (i - lastNotePosition[lane] < minGap) {
            return false;
          }

          // Проверка 2: нет ли уже ноты на этой позиции
          if (positions[lane][i] !== "*") {
            return false;
          }

          // Проверка 3: если включен режим избегания одновременных нот
          if (avoidSimultaneous) {
            for (
              let j = Math.max(0, i - minCrosslaneGap);
              j < Math.min(totalPositions, i + minCrosslaneGap);
              j++
            ) {
              if (globalOccupiedPositions.has(j)) {
                return false;
              }
            }
          }

          return true;
        });

        // Если есть доступные дорожки, выбираем случайную
        if (availableLanes.length > 0) {
          const selectedLane =
            availableLanes[Math.floor(Math.random() * availableLanes.length)];

          // Решаем, какой тип ноты
          if (
            useLongNotes &&
            Math.random() < longNoteDensity &&
            i < totalPositions - split
          ) {
            // Длинная нота
            const longNoteLength = Math.min(
              Math.floor(Math.random() * split / 2) + split / 2,
              totalPositions - i
            );
            for (let j = 0; j < longNoteLength; j++) {
              positions[selectedLane][i + j] = "l";
              globalOccupiedPositions.add(i + j);
            }
            lastNotePosition[selectedLane] = i + longNoteLength;
          } else {
            // Короткая нота
            positions[selectedLane][i] = "s";
            globalOccupiedPositions.add(i);
            lastNotePosition[selectedLane] = i;
          }
        }
      }
    }
  }

  // Собираем результаты
  lanes.forEach((lane) => {
    chart[lane] = positions[lane].join("");
  });

  // Форматируем chart с разделителями | для удобства
  const formattedChart: any[] = [];
  const sectionsCount = Math.ceil(totalPositions / (split * 16)); // 16 битов на секцию

  for (let section = 0; section < sectionsCount; section++) {
    const sectionData: { [key: string]: string } = {};
    const start = section * split * 16;
    const end = Math.min(start + split * 16, totalPositions);

    lanes.forEach((lane) => {
      let sectionString = chart[lane].substring(start, end);
      // Добавляем разделители каждые 4 символа (1 бит)
      let formatted = "";
      for (let i = 0; i < sectionString.length; i += split / 4) {
        formatted += "|" + sectionString.substring(i, i + split / 4);
      }
      formatted += "|";
      sectionData[lane] = formatted;
    });

    formattedChart.push(sectionData);
  }

  return formattedChart;
}
