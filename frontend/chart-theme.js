/**
 * Professional DS / statistics chart theme (CineSentiment brand)
 *
 * Rules applied:
 * - Same scale, same unit (e.g. % metrics) → one hue, not rainbow bars
 * - Ordered splits (train → val → test) → sequential palette (light → dark)
 * - Class labels (Rotten/Fresh) → fixed semantic colors only on class charts
 * - Confusion matrix → sequential heatmap (low → high count)
 */
(function (global) {
  const colors = {
    cream: '#f5f0e6',
    muted: '#9ca3af',
    legend: '#b8b4a8',
    grid: 'rgba(148, 163, 184, 0.18)',
    tick: '#9ca3af',

    /** Semantic class colors (Rotten Tomatoes–style, colorblind-safe pair) */
    rotten: '#c0392b',
    fresh: '#2d8a5e',
    labelBorder: 'rgba(245, 240, 230, 0.9)',

    /** Train / val / test — sequential gold (dark = train, largest) */
    split: ['#5c4a1f', '#9a7b2a', '#d4b44a'],
    splitBorder: ['#3d3215', '#7a6424', '#b89a3a'],

    /** Performance metrics — single hue (comparing % on same axis) */
    metricBar: 'rgba(201, 162, 39, 0.88)',
    metricBarBorder: '#9a7b2a',
    metricBarHover: 'rgba(232, 197, 71, 0.95)',

    compareBar: ['rgba(201, 162, 39, 0.85)', 'rgba(154, 123, 42, 0.85)'],
    compareDoughnut: ['#c9a227', '#9a7b2a'],
    compareBorder: ['#9a7b2a', '#7a6424'],
  };

  function labelColors(filter) {
    if (filter === 'negative') return [colors.rotten];
    if (filter === 'positive') return [colors.fresh];
    return [colors.rotten, colors.fresh];
  }

  function labelDataset(data, filter) {
    let labels = ['Rotten (negative)', 'Fresh (positive)'];
    if (filter === 'negative') labels = ['Rotten (negative)'];
    if (filter === 'positive') labels = ['Fresh (positive)'];
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: labelColors(filter),
        borderColor: colors.labelBorder,
        borderWidth: 2,
      }],
    };
  }

  function splitBarDataset(train, val, test) {
    return {
      labels: ['Training', 'Validation', 'Test'],
      datasets: [{
        label: 'Sample count',
        data: [train, val, test],
        backgroundColor: colors.split.slice(),
        borderColor: colors.splitBorder.slice(),
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    };
  }

  /** One color per bar — standard for multi-metric same-scale comparison */
  function metricsBarDataset(acc, f1, prec, rec, roc) {
    const labels = ['Accuracy', 'F1', 'Precision', 'Recall'];
    const data = [acc, f1, prec, rec];
    if (typeof roc === 'number') {
      labels.push('ROC-AUC');
      data.push(roc);
    }
    const n = data.length;
    const bg = Array(n).fill(colors.metricBar);
    const border = Array(n).fill(colors.metricBarBorder);
    return {
      labels,
      datasets: [{
        label: 'Score (%)',
        data,
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 1.5,
        borderRadius: 4,
        hoverBackgroundColor: Array(n).fill(colors.metricBarHover),
      }],
    };
  }

  /** Sequential heatmap for confusion matrix (not diverging — counts are ≥ 0) */
  function confusionCellStyle(value, max) {
    const t = max > 0 ? Math.min(1, value / max) : 0;
    const r = Math.round(18 + t * (201 - 18));
    const g = Math.round(18 + t * (162 - 18));
    const b = Math.round(26 + t * (39 - 26));
    const text = t > 0.55 ? '#f5f0e6' : '#e8e6e3';
    return 'background:rgb(' + r + ',' + g + ',' + b + ');color:' + text + ';font-weight:600;';
  }

  function barScales(yMax) {
    const y = {
      beginAtZero: true,
      grid: { color: colors.grid, drawBorder: false },
      ticks: {
        color: colors.tick,
        font: { size: 11 },
      },
      title: {
        display: false,
      },
    };
    if (yMax != null) y.max = yMax;
    return {
      y,
      x: {
        grid: { display: false },
        ticks: { color: colors.tick, font: { size: 11 } },
      },
    };
  }

  function legendBottom() {
    return {
      position: 'bottom',
      labels: {
        color: colors.legend,
        padding: 16,
        usePointStyle: true,
        pointStyle: 'circle',
        font: { size: 12, weight: '500' },
      },
    };
  }

  function baseOptions(type, extra) {
    const opts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: type === 'pie' || type === 'doughnut' ? legendBottom() : { display: false },
        tooltip: tooltipOptions(),
      },
    };
    if (type === 'bar') {
      opts.scales = barScales();
      opts.plugins.tooltip.callbacks = {
        label: function (ctx) {
          const v = ctx.parsed.y;
          return (typeof v === 'number' ? v.toFixed(2) : v) + (ctx.chart.data.datasets[0].label === 'Score (%)' ? '%' : '');
        },
      };
    }
    if (type === 'pie' || type === 'doughnut') {
      opts.layout = { padding: { top: 8, bottom: 8, left: 8, right: 8 } };
    }
    return Object.assign({}, opts, extra || {});
  }

  function tooltipOptions() {
    return {
      backgroundColor: 'rgba(12, 12, 18, 0.96)',
      titleColor: colors.cream,
      bodyColor: colors.muted,
      borderColor: 'rgba(201, 162, 39, 0.35)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 6,
      displayColors: true,
    };
  }

  function applyChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = colors.legend;
    Chart.defaults.borderColor = colors.grid;
    Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    if (Chart.defaults.plugins?.legend?.labels) {
      Chart.defaults.plugins.legend.labels.color = colors.legend;
    }
    Object.assign(Chart.defaults.plugins.tooltip || {}, tooltipOptions());
  }

  function boot() {
    applyChartDefaults();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  global.CinemaChart = {
    colors,
    labelColors,
    labelDataset,
    splitBarDataset,
    metricsBarDataset,
    confusionCellStyle,
    barScales,
    legendBottom,
    baseOptions,
    tooltipOptions,
    applyChartDefaults,
  };
})(typeof window !== 'undefined' ? window : global);
