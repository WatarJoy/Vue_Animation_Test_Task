<template>
  <!-- viewBox розширено, щоб у фінальному стані усі полігони були видимі -->
  <svg :width="svgSize" :height="svgSize" viewBox="-400 -400 1600 1600">
    <polygon
      v-for="(cell, index) in computedPolygons"
      :key="index"
      :points="cell.pointsStr"
      :fill="cell.color"
      stroke="#000"
      stroke-width="3"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
} from "vue";

interface Point {
  x: number;
  y: number;
}

interface PolygonCell {
  points: Point[]; // Вершини полігона (у порядку обходу)
  centroid: Point; // Центроїд полігона
  color: string; // Випадковий колір полігона
  // Флаг, що вказує, чи має полігон хоча б одну вершину на межах початкового квадрата
  isOuter: boolean;
}

interface SplitChoice {
  index: number; // Індекс ребра (ребро між poly[index] та poly[(index+1)%n])
  t: number; // Параметр [0,1] для визначення точки на ребрі
}

function getRandomColor(): string {
  const color = Math.floor(Math.random() * 0xffffff).toString(16);
  return "#" + color.padStart(6, "0");
}

function computeCentroid(points: Point[]): Point {
  let area = 0,
    cx = 0,
    cy = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    const a = p0.x * p1.y - p1.x * p0.y;
    area += a;
    cx += (p0.x + p1.x) * a;
    cy += (p0.y + p1.y) * a;
  }
  area *= 0.5;
  if (area === 0) return points[0];
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function splitPolygon(
  poly: Point[],
  s1: SplitChoice,
  s2: SplitChoice
): [Point[], Point[]] {
  const n = poly.length;
  if (s1.index > s2.index) [s1, s2] = [s2, s1];

  const p1: Point = {
    x:
      poly[s1.index].x + s1.t * (poly[(s1.index + 1) % n].x - poly[s1.index].x),
    y:
      poly[s1.index].y + s1.t * (poly[(s1.index + 1) % n].y - poly[s1.index].y),
  };
  const p2: Point = {
    x:
      poly[s2.index].x + s2.t * (poly[(s2.index + 1) % n].x - poly[s2.index].x),
    y:
      poly[s2.index].y + s2.t * (poly[(s2.index + 1) % n].y - poly[s2.index].y),
  };

  const poly1: Point[] = [];
  poly1.push(p1);
  let i = (s1.index + 1) % n;
  while (true) {
    poly1.push(poly[i]);
    if (i === s2.index) break;
    i = (i + 1) % n;
  }
  poly1.push(p2);

  const poly2: Point[] = [];
  poly2.push(p2);
  i = (s2.index + 1) % n;
  while (true) {
    poly2.push(poly[i]);
    if (i === s1.index) break;
    i = (i + 1) % n;
  }
  poly2.push(p1);

  return [poly1, poly2];
}
function generateSplitPolygons(numSplits: number, size: number): PolygonCell[] {
  const polygons: PolygonCell[] = [];
  // Початковий квадрат від (0,0) до (size,size)
  const initial: Point[] = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  // Перевірка, чи містить квадрат вершину на межі (очевидно, так)
  const isOuter = initial.some(
    (pt) =>
      pt.x <= 0.001 ||
      Math.abs(pt.x - size) <= 0.001 ||
      pt.y <= 0.001 ||
      Math.abs(pt.y - size) <= 0.001
  );
  polygons.push({
    points: initial,
    centroid: computeCentroid(initial),
    color: getRandomColor(),
    isOuter,
  });

  for (let s = 0; s < numSplits; s++) {
    const candidatePolys = polygons.filter((p) => p.points.length >= 3);
    if (candidatePolys.length === 0) break;
    const randIdx = Math.floor(Math.random() * candidatePolys.length);
    const polyCell = candidatePolys[randIdx];
    const globalIdx = polygons.indexOf(polyCell);
    polygons.splice(globalIdx, 1);
    const poly = polyCell.points;
    const n = poly.length;

    let e1: number, e2: number;
    do {
      e1 = Math.floor(Math.random() * n);
      e2 = Math.floor(Math.random() * n);
    } while (e1 === e2 || (e1 + 1) % n === e2 || (e2 + 1) % n === e1);

    if (e1 > e2) [e1, e2] = [e2, e1];

    const t1 = Math.random();
    const t2 = Math.random();
    const split1: SplitChoice = { index: e1, t: t1 };
    const split2: SplitChoice = { index: e2, t: t2 };

    const [poly1, poly2] = splitPolygon(poly, split1, split2);

    // Для кожного нового полігона обчислюємо центроїд та прапорець outer
    const computeOuter = (points: Point[]) =>
      points.some(
        (pt) =>
          pt.x <= 0.001 ||
          Math.abs(pt.x - size) <= 0.001 ||
          pt.y <= 0.001 ||
          Math.abs(pt.y - size) <= 0.001
      );
    const cell1: PolygonCell = {
      points: poly1,
      centroid: computeCentroid(poly1),
      color: getRandomColor(),
      isOuter: computeOuter(poly1),
    };
    const cell2: PolygonCell = {
      points: poly2,
      centroid: computeCentroid(poly2),
      color: getRandomColor(),
      isOuter: computeOuter(poly2),
    };

    polygons.push(cell1, cell2);
  }
  return polygons;
}

export default defineComponent({
  name: "SeparatedPolygonAnimation",
  setup() {
    const svgSize = 800;
    const center = { x: svgSize / 2, y: svgSize / 2 };
    const staticDuration = 1000; // 1 секунда – статичне відображення
    const separationDuration = 4000; // 4 секунди – анімація віддалення
    const totalCycle = staticDuration + separationDuration;
    const maxSeparation = 400; // Базовий зсув для полігонів, що лежать по ребру

    const polygonCells = ref<PolygonCell[]>(generateSplitPolygons(15, svgSize));
    // currentSeparation змінюється від 0 до maxSeparation (анімуємо за допомогою sin)
    const currentSeparation = ref(0);

    /*
      Для кожного полігона:
      - Якщо полігон внутрішній, застосовуємо зсув, обчислений за його центроїдом.
      - Якщо полігон зовнішній (має хоча б одну вершину на краю початкового квадрата),
        обчислюємо додатковий множник, щоб крайня вершина в напрямку руху досягла своєї цільової позиції (center + 2*(v - center)).
    */
    const computedPolygons = computed(() => {
      return polygonCells.value.map((cell) => {
        // Обчислюємо напрямок зсуву – від центру до центроїда
        const dx = cell.centroid.x - center.x;
        const dy = cell.centroid.y - center.y;
        const dLen = Math.hypot(dx, dy) || 1;
        const dUnit = { x: dx / dLen, y: dy / dLen };

        // Обчислюємо максимальне значення (v - center)·dUnit для всіх вершин
        let R_max = 0;
        cell.points.forEach((v) => {
          const dot = (v.x - center.x) * dUnit.x + (v.y - center.y) * dUnit.y;
          if (dot > R_max) R_max = dot;
        });

        // Зсув пропорційний: коли currentSeparation == maxSeparation, зсув дорівнює R_max.
        const translationMagnitude =
          R_max * (currentSeparation.value / maxSeparation);
        const translation = {
          x: dUnit.x * translationMagnitude,
          y: dUnit.y * translationMagnitude,
        };

        // Зсуваємо кожну вершину полігона
        const transformedPoints = cell.points.map((v) => ({
          x: v.x + translation.x,
          y: v.y + translation.y,
        }));
        const pointsStr = transformedPoints
          .map((pt) => `${pt.x},${pt.y}`)
          .join(" ");

        return { pointsStr, color: cell.color, isOuter: cell.isOuter };
      });
    });

    let animationFrameId: number;
    let startTime: number | null = null;
    function animate(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      if (elapsed > staticDuration) {
        let progress = (elapsed - staticDuration) / separationDuration;
        if (progress > 1) progress = 1;
        // Використовуємо синусоїдальне згладжування
        currentSeparation.value = maxSeparation * Math.sin(Math.PI * progress);
      } else {
        currentSeparation.value = 0;
      }
      if (elapsed >= totalCycle) {
        // Після завершення циклу генеруємо нове розділення полігонів
        polygonCells.value = generateSplitPolygons(15, svgSize);
        startTime = timestamp;
      }
      animationFrameId = requestAnimationFrame(animate);
    }

    onMounted(() => {
      animationFrameId = requestAnimationFrame(animate);
    });

    onBeforeUnmount(() => {
      cancelAnimationFrame(animationFrameId);
    });

    return { svgSize, computedPolygons };
  },
});
</script>

<style scoped>
svg {
  display: block;
  margin: 0 auto;
  overflow: visible;
}
</style>
