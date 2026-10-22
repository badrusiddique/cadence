import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  Filler,
);

const charts = new Map<string, Chart>();

const PALETTE = ['#f59e0b', '#519eec', '#33cc94', '#eb6847', '#b675d7', '#3cb4dd', '#e06ca6', '#d5da2f'];

function cssVar(name: string, fallback: string) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

export function destroyChart(id: string) {
  const existing = charts.get(id);
  if (existing) {
    existing.destroy();
    charts.delete(id);
  }
}

export function destroyAllCharts() {
  for (const id of [...charts.keys()]) destroyChart(id);
}

function baseOptions() {
  const muted = cssVar('--text-muted', '#666660');
  const grid = cssVar('--border-subtle', '#2a2a2a');
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: muted, boxWidth: 10, font: { size: 11 } },
      },
      tooltip: { mode: 'index' as const, intersect: false },
    },
    scales: {
      x: {
        ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } },
        grid: { color: grid },
      },
      y: {
        ticks: { color: muted, font: { size: 10 } },
        grid: { color: grid },
        beginAtZero: true,
      },
    },
  };
}

export function renderBarChart(
  canvasId: string,
  labels: string[],
  datasets: Array<{ label: string; data: number[]; color?: string }>,
  opts?: { stacked?: boolean },
) {
  destroyChart(canvasId);
  const el = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!el) return;
  const chart = new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.color || PALETTE[i % PALETTE.length],
        borderRadius: 2,
        maxBarThickness: 28,
      })),
    },
    options: {
      ...baseOptions(),
      scales: {
        ...baseOptions().scales,
        x: { ...baseOptions().scales!.x, stacked: opts?.stacked },
        y: { ...baseOptions().scales!.y, stacked: opts?.stacked },
      },
    },
  });
  charts.set(canvasId, chart);
}

export function renderDoughnut(canvasId: string, labels: string[], values: number[]) {
  destroyChart(canvasId);
  const el = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!el) return;
  const chart = new Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: values.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: cssVar('--text-muted', '#666660'), boxWidth: 10, font: { size: 11 } },
        },
      },
    },
  });
  charts.set(canvasId, chart);
}

export function renderLineChart(
  canvasId: string,
  labels: string[],
  datasets: Array<{ label: string; data: number[]; color?: string }>,
) {
  destroyChart(canvasId);
  const el = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!el) return;
  const chart = new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        borderColor: d.color || PALETTE[i % PALETTE.length],
        backgroundColor: `${d.color || PALETTE[i % PALETTE.length]}33`,
        fill: true,
        tension: 0.25,
        pointRadius: 0,
      })),
    },
    options: baseOptions(),
  });
  charts.set(canvasId, chart);
}

export { PALETTE };
