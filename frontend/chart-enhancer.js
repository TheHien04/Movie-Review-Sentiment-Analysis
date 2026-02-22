/**
 * Chart.js Enhancements
 * Animated charts with smooth transitions and beautiful styling
 */

class ChartEnhancer {
    constructor() {
        this.charts = new Map();
        this.defaultOptions = {
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 13,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(138, 43, 226, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {}
                }
            }
        };

        this.colorSchemes = {
            purple: {
                primary: '#8a2be2',
                secondary: '#9333ea',
                gradient: ['#8a2be2', '#9333ea', '#a855f7'],
                positive: '#10b981',
                negative: '#ef4444'
            },
            ocean: {
                primary: '#3b82f6',
                secondary: '#06b6d4',
                gradient: ['#3b82f6', '#06b6d4', '#8b5cf6']
            },
            sunset: {
                primary: '#f59e0b',
                secondary: '#ef4444',
                gradient: ['#f59e0b', '#ef4444', '#ec4899']
            }
        };
    }

    /**
     * Create animated bar chart
     * @param {string|HTMLCanvasElement} canvas - Canvas element or selector
     * @param {object} data - Chart data
     * @param {object} options - Chart options
     */
    createBarChart(canvas, data, options = {}) {
        const ctx = this.getContext(canvas);
        if (!ctx) return null;

        const chartData = {
            labels: data.labels || [],
            datasets: data.datasets.map((dataset, index) => ({
                label: dataset.label,
                data: dataset.data,
                backgroundColor: this.createGradient(ctx, 'vertical', dataset.color || 'purple'),
                borderColor: dataset.borderColor || this.colorSchemes.purple.primary,
                borderWidth: 2,
                borderRadius: 8,
                barThickness: dataset.barThickness || 'flex',
                maxBarThickness: 60
            }))
        };

        const chartOptions = this.mergeOptions(options, {
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 12 },
                        callback: function(value) {
                            return typeof value === 'number' && value < 1 && value > 0
                                ? (value * 100).toFixed(0) + '%'
                                : value;
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 12 }
                    }
                }
            }
        });

        const chart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: chartOptions
        });

        this.charts.set(canvas, chart);
        this.addChartAnimations(chart);
        return chart;
    }

    /**
     * Create animated doughnut chart
     * @param {string|HTMLCanvasElement} canvas - Canvas element or selector
     * @param {object} data - Chart data
     * @param {object} options - Chart options
     */
    createDoughnutChart(canvas, data, options = {}) {
        const ctx = this.getContext(canvas);
        if (!ctx) return null;

        const colors = data.colors || [
            this.colorSchemes.purple.positive,
            this.colorSchemes.purple.negative
        ];

        const chartData = {
            labels: data.labels || ['Positive', 'Negative'],
            datasets: [{
                data: data.values || [],
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 15
            }]
        };

        const chartOptions = this.mergeOptions(options, {
            cutout: '70%',
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        });

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: chartOptions
        });

        this.charts.set(canvas, chart);
        this.addDoughnutCenter(chart);
        return chart;
    }

    /**
     * Create animated line chart
     * @param {string|HTMLCanvasElement} canvas - Canvas element or selector
     * @param {object} data - Chart data
     * @param {object} options - Chart options
     */
    createLineChart(canvas, data, options = {}) {
        const ctx = this.getContext(canvas);
        if (!ctx) return null;

        const chartData = {
            labels: data.labels || [],
            datasets: data.datasets.map((dataset, index) => ({
                label: dataset.label,
                data: dataset.data,
                borderColor: dataset.color || this.colorSchemes.purple.primary,
                backgroundColor: this.createGradient(ctx, 'vertical', dataset.color || 'purple', 0.1),
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#fff',
                pointBorderWidth: 2,
                pointHoverBorderWidth: 3
            }))
        };

        const chartOptions = this.mergeOptions(options, {
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        });

        const chart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: chartOptions
        });

        this.charts.set(canvas, chart);
        return chart;
    }

    /**
     * Create animated radar chart
     * @param {string|HTMLCanvasElement} canvas - Canvas element or selector
     * @param {object} data - Chart data
     * @param {object} options - Chart options
     */
    createRadarChart(canvas, data, options = {}) {
        const ctx = this.getContext(canvas);
        if (!ctx) return null;

        const chartData = {
            labels: data.labels || [],
            datasets: data.datasets.map((dataset, index) => ({
                label: dataset.label,
                data: dataset.data,
                backgroundColor: dataset.bgColor || 'rgba(138, 43, 226, 0.2)',
                borderColor: dataset.color || this.colorSchemes.purple.primary,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }))
        };

        const chartOptions = this.mergeOptions(options, {
            scales: {
                r: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    angleLines: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    pointLabels: {
                        font: { size: 12 }
                    }
                }
            }
        });

        const chart = new Chart(ctx, {
            type: 'radar',
            data: chartData,
            options: chartOptions
        });

        this.charts.set(canvas, chart);
        return chart;
    }

    /**
     * Update chart data with animation
     * @param {Chart} chart - Chart instance
     * @param {object} newData - New data
     */
    updateChart(chart, newData) {
        if (!chart) return;

        if (newData.labels) {
            chart.data.labels = newData.labels;
        }

        if (newData.datasets) {
            newData.datasets.forEach((dataset, index) => {
                if (chart.data.datasets[index]) {
                    chart.data.datasets[index].data = dataset.data;
                    if (dataset.label) {
                        chart.data.datasets[index].label = dataset.label;
                    }
                }
            });
        }

        chart.update('active');
    }

    /**
     * Create gradient
     */
    createGradient(ctx, direction = 'vertical', colorScheme = 'purple', alpha = 1) {
        const colors = this.colorSchemes[colorScheme] || this.colorSchemes.purple;
        
        let gradient;
        if (direction === 'vertical') {
            gradient = ctx.createLinearGradient(0, 0, 0, 400);
        } else {
            gradient = ctx.createLinearGradient(0, 0, 400, 0);
        }

        if (Array.isArray(colors.gradient)) {
            colors.gradient.forEach((color, index) => {
                const position = index / (colors.gradient.length - 1);
                gradient.addColorStop(position, this.hexToRgba(color, alpha));
            });
        } else {
            gradient.addColorStop(0, this.hexToRgba(colors.primary, alpha));
            gradient.addColorStop(1, this.hexToRgba(colors.secondary, alpha));
        }

        return gradient;
    }

    /**
     * Add custom animations to chart
     */
    addChartAnimations(chart) {
        const originalDraw = chart.draw.bind(chart);
        let animationProgress = 0;

        chart.draw = function() {
            if (animationProgress < 1) {
                animationProgress += 0.02;
                requestAnimationFrame(() => chart.draw());
            }
            originalDraw();
        };
    }

    /**
     * Add center text to doughnut chart
     */
    addDoughnutCenter(chart) {
        const originalDraw = Chart.overrides.doughnut.plugins.legend.onClick;
        
        Chart.register({
            id: 'doughnutCenterText',
            beforeDraw: function(chart) {
                if (chart.config.type === 'doughnut') {
                    const ctx = chart.ctx;
                    const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                    const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    
                    ctx.font = 'bold 28px sans-serif';
                    ctx.fillStyle = '#1f2937';
                    ctx.fillText(total.toString(), centerX, centerY - 10);
                    
                    ctx.font = '14px sans-serif';
                    ctx.fillStyle = '#6b7280';
                    ctx.fillText('Total', centerX, centerY + 15);
                    
                    ctx.restore();
                }
            }
        });
    }

    /**
     * Get canvas context
     */
    getContext(canvas) {
        const element = typeof canvas === 'string'
            ? document.querySelector(canvas)
            : canvas;

        if (!element) {
            console.error('Canvas element not found');
            return null;
        }

        return element.getContext('2d');
    }

    /**
     * Merge options
     */
    mergeOptions(custom, additional) {
        return {
            ...this.defaultOptions,
            ...custom,
            ...additional,
            plugins: {
                ...this.defaultOptions.plugins,
                ...(custom.plugins || {}),
                ...(additional.plugins || {})
            }
        };
    }

    /**
     * Convert hex to rgba
     */
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Destroy chart
     */
    destroyChart(canvas) {
        const chart = this.charts.get(canvas);
        if (chart) {
            chart.destroy();
            this.charts.delete(canvas);
        }
    }

    /**
     * Destroy all charts
     */
    destroyAll() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}

// Global chart enhancer instance
window.chartEnhancer = new ChartEnhancer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartEnhancer;
}
