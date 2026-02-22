/**
 * Search History Manager
 * Store and manage prediction history using localStorage
 */

class HistoryManager {
    constructor() {
        this.storageKey = 'sentiment_analysis_history';
        this.maxHistory = 50; // Maximum items to store
    }

    /**
     * Add new prediction to history
     * @param {object} prediction - Prediction result
     */
    add(prediction) {
        const history = this.getAll();
        
        const historyItem = {
            id: Date.now(),
            text: prediction.text || prediction.review,
            sentiment: prediction.sentiment || prediction.predicted_sentiment,
            confidence: prediction.confidence,
            scores: prediction.scores,
            timestamp: new Date().toISOString(),
            type: prediction.type || 'single' // single, batch, csv
        };

        // Add to beginning
        history.unshift(historyItem);

        // Limit size
        if (history.length > this.maxHistory) {
            history.splice(this.maxHistory);
        }

        this.save(history);
        return historyItem;
    }

    /**
     * Add batch predictions to history
     * @param {array} predictions - Array of predictions
     */
    addBatch(predictions, batchName = '') {
        const history = this.getAll();
        
        const batchItem = {
            id: Date.now(),
            type: 'batch',
            name: batchName || `Batch ${new Date().toLocaleString()}`,
            count: predictions.length,
            predictions: predictions.slice(0, 10), // Store first 10 for preview
            summary: this.calculateBatchSummary(predictions),
            timestamp: new Date().toISOString()
        };

        history.unshift(batchItem);

        if (history.length > this.maxHistory) {
            history.splice(this.maxHistory);
        }

        this.save(history);
        return batchItem;
    }

    /**
     * Calculate batch summary statistics
     */
    calculateBatchSummary(predictions) {
        const positive = predictions.filter(p => 
            p.sentiment === 1 || p.sentiment === 'positive'
        ).length;
        const negative = predictions.length - positive;
        const avgConfidence = predictions.reduce((sum, p) => 
            sum + (p.confidence || 0), 0
        ) / predictions.length;

        return {
            total: predictions.length,
            positive,
            negative,
            avgConfidence: avgConfidence.toFixed(4),
            positivePercent: ((positive / predictions.length) * 100).toFixed(1),
            negativePercent: ((negative / predictions.length) * 100).toFixed(1)
        };
    }

    /**
     * Get all history items
     * @returns {array} - History array
     */
    getAll() {
        try {
            const history = localStorage.getItem(this.storageKey);
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error loading history:', error);
            return [];
        }
    }

    /**
     * Get history item by ID
     * @param {number} id - Item ID
     */
    getById(id) {
        const history = this.getAll();
        return history.find(item => item.id === id);
    }

    /**
     * Get recent history (last N items)
     * @param {number} count - Number of items
     */
    getRecent(count = 10) {
        return this.getAll().slice(0, count);
    }

    /**
     * Search history
     * @param {string} query - Search query
     */
    search(query) {
        const history = this.getAll();
        const lowerQuery = query.toLowerCase();
        
        return history.filter(item => {
            if (item.type === 'batch') {
                return item.name.toLowerCase().includes(lowerQuery);
            }
            return item.text && item.text.toLowerCase().includes(lowerQuery);
        });
    }

    /**
     * Filter history by sentiment
     * @param {string} sentiment - 'positive' or 'negative'
     */
    filterBySentiment(sentiment) {
        const history = this.getAll();
        const targetSentiment = sentiment === 'positive' ? 1 : 0;
        
        return history.filter(item => {
            if (item.type === 'batch') return true; // Keep batch items
            return item.sentiment === targetSentiment || 
                   item.sentiment === sentiment;
        });
    }

    /**
     * Filter history by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     */
    filterByDateRange(startDate, endDate) {
        const history = this.getAll();
        const start = startDate.getTime();
        const end = endDate.getTime();
        
        return history.filter(item => {
            const itemDate = new Date(item.timestamp).getTime();
            return itemDate >= start && itemDate <= end;
        });
    }

    /**
     * Get history statistics
     */
    getStats() {
        const history = this.getAll();
        const singlePredictions = history.filter(item => item.type !== 'batch');
        
        const positive = singlePredictions.filter(item => 
            item.sentiment === 1 || item.sentiment === 'positive'
        ).length;
        const negative = singlePredictions.length - positive;
        
        return {
            total: history.length,
            singlePredictions: singlePredictions.length,
            batchPredictions: history.filter(item => item.type === 'batch').length,
            positive,
            negative,
            positivePercent: singlePredictions.length > 0 
                ? ((positive / singlePredictions.length) * 100).toFixed(1)
                : 0,
            negativePercent: singlePredictions.length > 0
                ? ((negative / singlePredictions.length) * 100).toFixed(1)
                : 0,
            oldestDate: history.length > 0 
                ? new Date(history[history.length - 1].timestamp).toLocaleDateString()
                : 'N/A',
            newestDate: history.length > 0
                ? new Date(history[0].timestamp).toLocaleDateString()
                : 'N/A'
        };
    }

    /**
     * Remove item by ID
     * @param {number} id - Item ID
     */
    remove(id) {
        const history = this.getAll();
        const filtered = history.filter(item => item.id !== id);
        this.save(filtered);
        return filtered;
    }

    /**
     * Clear all history
     */
    clear() {
        localStorage.removeItem(this.storageKey);
        if (window.toast) {
            window.toast.info('History Cleared', 'All prediction history has been removed');
        }
    }

    /**
     * Save history to localStorage
     * @param {array} history - History array
     */
    save(history) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(history));
        } catch (error) {
            console.error('Error saving history:', error);
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                // Remove oldest items and try again
                history.splice(Math.floor(this.maxHistory / 2));
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify(history));
                } catch (e) {
                    console.error('Cannot save history even after cleanup');
                }
            }
        }
    }

    /**
     * Export history to JSON
     */
    exportToJSON() {
        const history = this.getAll();
        const dataStr = JSON.stringify(history, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sentiment_history_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        if (window.toast) {
            window.toast.success('Export Successful', 'History exported as JSON');
        }
    }

    /**
     * Import history from JSON
     * @param {File} file - JSON file
     */
    async importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (!Array.isArray(imported)) {
                        throw new Error('Invalid history format');
                    }
                    
                    const current = this.getAll();
                    const merged = [...imported, ...current];
                    
                    // Remove duplicates and limit
                    const unique = merged.filter((item, index, self) =>
                        index === self.findIndex(t => t.id === item.id)
                    ).slice(0, this.maxHistory);
                    
                    this.save(unique);
                    
                    if (window.toast) {
                        window.toast.success('Import Successful', `Imported ${imported.length} items`);
                    }
                    
                    resolve(unique);
                } catch (error) {
                    if (window.toast) {
                        window.toast.error('Import Failed', error.message);
                    }
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('File read error'));
            reader.readAsText(file);
        });
    }

    /**
     * Get storage usage info
     */
    getStorageInfo() {
        const history = JSON.stringify(this.getAll());
        const bytes = new Blob([history]).size;
        const kb = (bytes / 1024).toFixed(2);
        const mb = (bytes / (1024 * 1024)).toFixed(2);
        
        return {
            bytes,
            kb: `${kb} KB`,
            mb: `${mb} MB`,
            items: this.getAll().length,
            maxItems: this.maxHistory,
            percentageFull: ((this.getAll().length / this.maxHistory) * 100).toFixed(1) + '%'
        };
    }
}

// Global history manager instance
window.historyManager = new HistoryManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryManager;
}
