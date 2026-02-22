/**
 * Excel Export Utility using SheetJS
 * Export predictions, metrics, and dataset information to Excel
 */

class ExcelExporter {
    constructor() {
        this.scriptLoaded = false;
        this.loadSheetJS();
    }

    /**
     * Load SheetJS library dynamically
     */
    async loadSheetJS() {
        if (this.scriptLoaded || window.XLSX) {
            this.scriptLoaded = true;
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            script.onload = () => {
                this.scriptLoaded = true;
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load SheetJS library'));
            document.head.appendChild(script);
        });
    }

    /**
     * Ensure library is loaded before export
     */
    async ensureLoaded() {
        if (!this.scriptLoaded || !window.XLSX) {
            await this.loadSheetJS();
        }
    }

    /**
     * Export single prediction result
     * @param {object} data - Prediction result
     * @param {string} filename - Output filename
     */
    async exportPrediction(data, filename = 'prediction_result.xlsx') {
        await this.ensureLoaded();

        const rows = [{
            'Review Text': data.text || '',
            'Predicted Sentiment': this.formatSentiment(data.sentiment),
            'Confidence': this.formatPercentage(data.confidence),
            'Positive Score': this.formatPercentage(data.scores?.positive),
            'Negative Score': this.formatPercentage(data.scores?.negative),
            'Timestamp': new Date().toLocaleString()
        }];

        this.exportToExcel(rows, filename, 'Prediction Result');
    }

    /**
     * Export batch prediction results
     * @param {array} results - Array of predictions
     * @param {string} filename - Output filename
     */
    async exportBatchPredictions(results, filename = 'batch_predictions.xlsx') {
        await this.ensureLoaded();

        const rows = results.map((item, index) => ({
            'Row #': index + 1,
            'Review Text': item.text || item.review || '',
            'Predicted Sentiment': this.formatSentiment(item.sentiment || item.predicted_sentiment),
            'Confidence': this.formatPercentage(item.confidence),
            'Positive Score': this.formatPercentage(item.scores?.positive || item.positive_score),
            'Negative Score': this.formatPercentage(item.scores?.negative || item.negative_score),
            'Original Label': item.label !== undefined ? this.formatSentiment(item.label) : 'N/A'
        }));

        this.exportToExcel(rows, filename, 'Batch Predictions');
    }

    /**
     * Export model metrics
     * @param {object} metrics - Metrics data
     * @param {string} filename - Output filename
     */
    async exportMetrics(metrics, filename = 'model_metrics.xlsx') {
        await this.ensureLoaded();

        const workbook = window.XLSX.utils.book_new();

        // Overall Metrics Sheet
        const overallData = [
            ['Metric', 'Value'],
            ['Accuracy', this.formatPercentage(metrics.accuracy)],
            ['Precision', this.formatPercentage(metrics.precision)],
            ['Recall', this.formatPercentage(metrics.recall)],
            ['F1 Score', this.formatPercentage(metrics.f1_score)],
            ['Total Samples', metrics.total_samples || 'N/A'],
            ['Generated At', new Date().toLocaleString()]
        ];
        const overallSheet = window.XLSX.utils.aoa_to_sheet(overallData);
        window.XLSX.utils.book_append_sheet(workbook, overallSheet, 'Overall Metrics');

        // Confusion Matrix Sheet
        if (metrics.confusion_matrix) {
            const cm = metrics.confusion_matrix;
            const confusionData = [
                ['', 'Predicted Negative', 'Predicted Positive'],
                ['Actual Negative', cm.true_negatives || cm.tn || 0, cm.false_positives || cm.fp || 0],
                ['Actual Positive', cm.false_negatives || cm.fn || 0, cm.true_positives || cm.tp || 0]
            ];
            const confusionSheet = window.XLSX.utils.aoa_to_sheet(confusionData);
            window.XLSX.utils.book_append_sheet(workbook, confusionSheet, 'Confusion Matrix');
        }

        // Class-specific metrics
        if (metrics.per_class_metrics) {
            const classData = [
                ['Class', 'Precision', 'Recall', 'F1-Score', 'Support']
            ];
            
            Object.entries(metrics.per_class_metrics).forEach(([className, classMetrics]) => {
                classData.push([
                    this.formatSentiment(className),
                    this.formatPercentage(classMetrics.precision),
                    this.formatPercentage(classMetrics.recall),
                    this.formatPercentage(classMetrics.f1_score),
                    classMetrics.support || 'N/A'
                ]);
            });

            const classSheet = window.XLSX.utils.aoa_to_sheet(classData);
            window.XLSX.utils.book_append_sheet(workbook, classSheet, 'Per-Class Metrics');
        }

        window.XLSX.writeFile(workbook, filename);
        
        if (window.toast) {
            window.toast.success('Export Successful', `Metrics saved to ${filename}`);
        }
    }

    /**
     * Export dataset information
     * @param {object} datasetInfo - Dataset statistics
     * @param {string} filename - Output filename
     */
    async exportDatasetInfo(datasetInfo, filename = 'dataset_info.xlsx') {
        await this.ensureLoaded();

        const workbook = window.XLSX.utils.book_new();

        // Dataset Overview
        const overview = [
            ['Dataset Statistics', ''],
            ['Total Samples', datasetInfo.total_samples || 'N/A'],
            ['Training Set', datasetInfo.train_size || 'N/A'],
            ['Validation Set', datasetInfo.val_size || 'N/A'],
            ['Test Set', datasetInfo.test_size || 'N/A'],
            ['Positive Samples', datasetInfo.positive_samples || 'N/A'],
            ['Negative Samples', datasetInfo.negative_samples || 'N/A'],
            ['Average Review Length', datasetInfo.avg_length || 'N/A'],
            ['Generated At', new Date().toLocaleString()]
        ];
        const overviewSheet = window.XLSX.utils.aoa_to_sheet(overview);
        window.XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

        // Sample previews if available
        if (datasetInfo.samples && Array.isArray(datasetInfo.samples)) {
            const sampleData = [['Row #', 'Review Text', 'Sentiment']];
            
            datasetInfo.samples.forEach((sample, index) => {
                sampleData.push([
                    index + 1,
                    sample.text || sample.review || '',
                    this.formatSentiment(sample.sentiment || sample.label)
                ]);
            });

            const sampleSheet = window.XLSX.utils.aoa_to_sheet(sampleData);
            window.XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample Data');
        }

        window.XLSX.writeFile(workbook, filename);
        
        if (window.toast) {
            window.toast.success('Export Successful', `Dataset info saved to ${filename}`);
        }
    }

    /**
     * Generic export to Excel
     * @param {array} data - Array of objects
     * @param {string} filename - Output filename
     * @param {string} sheetName - Sheet name
     */
    async exportToExcel(data, filename = 'export.xlsx', sheetName = 'Sheet1') {
        await this.ensureLoaded();

        const worksheet = window.XLSX.utils.json_to_sheet(data);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Auto-size columns
        const maxWidth = 50;
        const columnWidths = [];
        
        data.forEach(row => {
            Object.keys(row).forEach((key, i) => {
                const value = String(row[key] || '');
                const width = Math.min(Math.max(value.length, key.length), maxWidth);
                columnWidths[i] = Math.max(columnWidths[i] || 0, width);
            });
        });

        worksheet['!cols'] = columnWidths.map(w => ({ wch: w + 2 }));

        window.XLSX.writeFile(workbook, filename);
        
        if (window.toast) {
            window.toast.success('Export Successful', `Data saved to ${filename}`);
        }
    }

    /**
     * Export table from HTML element
     * @param {string|HTMLElement} tableSelector - Table element or CSS selector
     * @param {string} filename - Output filename
     */
    async exportTableToExcel(tableSelector, filename = 'table_export.xlsx') {
        await this.ensureLoaded();

        const table = typeof tableSelector === 'string' 
            ? document.querySelector(tableSelector)
            : tableSelector;

        if (!table) {
            throw new Error('Table not found');
        }

        const workbook = window.XLSX.utils.table_to_book(table, { sheet: 'Data' });
        window.XLSX.writeFile(workbook, filename);
        
        if (window.toast) {
            window.toast.success('Export Successful', `Table saved to ${filename}`);
        }
    }

    /**
     * Format sentiment label
     */
    formatSentiment(value) {
        if (value === undefined || value === null) return 'N/A';
        if (value === 1 || value === '1' || value.toString().toLowerCase() === 'positive') return 'Positive';
        if (value === 0 || value === '0' || value.toString().toLowerCase() === 'negative') return 'Negative';
        return String(value);
    }

    /**
     * Format percentage
     */
    formatPercentage(value) {
        if (value === undefined || value === null) return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return 'N/A';
        return `${(num * 100).toFixed(2)}%`;
    }

    /**
     * Download data as CSV (fallback)
     * @param {array} data - Array of objects
     * @param {string} filename - Output filename
     */
    exportToCSV(data, filename = 'export.csv') {
        if (!data || data.length === 0) {
            throw new Error('No data to export');
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header] || '';
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);

        if (window.toast) {
            window.toast.success('Export Successful', `Data saved to ${filename}`);
        }
    }
}

// Global Excel exporter instance
window.excelExporter = new ExcelExporter();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExcelExporter;
}
