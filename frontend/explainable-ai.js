/**
 * Explainable AI - Word Importance Heatmap
 * Visualizes which words contribute most to sentiment prediction
 */

class ExplainableAI {
    constructor() {
        this.container = null;
        this.currentText = '';
        this.currentScores = [];
        this.colorScale = {
            positive: ['#e8f5e9', '#81c784', '#4caf50', '#2e7d32'],
            negative: ['#ffebee', '#e57373', '#f44336', '#c62828'],
            neutral: ['#f5f5f5', '#e0e0e0', '#bdbdbd', '#757575']
        };
    }

    /**
     * Initialize the explainer in a container
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container not found:', containerId);
            return false;
        }
        return true;
    }

    /**
     * Calculate word importance scores (simple heuristic-based approach)
     * In production, this would come from model attention weights
     */
    calculateWordImportance(text, sentiment, confidence) {
        const words = text.toLowerCase().split(/\s+/);
        
        // Positive sentiment words
        const positiveWords = new Set([
            'excellent', 'amazing', 'wonderful', 'fantastic', 'great', 'love',
            'perfect', 'best', 'brilliant', 'outstanding', 'superb', 'incredible',
            'awesome', 'magnificent', 'spectacular', 'marvelous', 'terrific',
            'good', 'nice', 'beautiful', 'enjoyed', 'loved', 'fun', 'entertaining'
        ]);
        
        // Negative sentiment words
        const negativeWords = new Set([
            'terrible', 'awful', 'horrible', 'bad', 'worst', 'hate',
            'boring', 'disappointing', 'waste', 'poor', 'mediocre', 'dull',
            'weak', 'failed', 'disaster', 'mess', 'ruined', 'pointless',
            'painful', 'tedious', 'stupid', 'garbage', 'trash', 'worthless'
        ]);
        
        // Intensifiers
        const intensifiers = new Set([
            'very', 'extremely', 'absolutely', 'completely', 'totally',
            'really', 'quite', 'pretty', 'highly', 'incredibly', 'so'
        ]);
        
        // Negations
        const negations = new Set([
            'not', 'never', 'no', 'nothing', 'nowhere', "n't", 'neither', 'nobody'
        ]);

        const scores = [];
        let previousIsNegation = false;
        let previousIsIntensifier = false;

        words.forEach((word, index) => {
            let score = 0;
            let importance = 0;
            
            // Clean word
            const cleanWord = word.replace(/[^\w]/g, '');
            
            // Check if word is sentiment-bearing
            if (positiveWords.has(cleanWord)) {
                score = previousIsNegation ? -0.8 : 0.8;
                importance = 0.9;
            } else if (negativeWords.has(cleanWord)) {
                score = previousIsNegation ? 0.8 : -0.8;
                importance = 0.9;
            } else if (intensifiers.has(cleanWord)) {
                score = 0;
                importance = 0.5;
                previousIsIntensifier = true;
            } else if (negations.has(cleanWord)) {
                score = 0;
                importance = 0.7;
                previousIsNegation = true;
            } else {
                score = 0;
                importance = 0.1;
            }
            
            // Amplify if previous word was intensifier
            if (previousIsIntensifier && importance > 0.5) {
                importance = Math.min(1.0, importance * 1.3);
                score *= 1.2;
            }
            
            scores.push({
                word: word,
                score: score,
                importance: importance,
                index: index
            });
            
            // Reset flags
            if (!intensifiers.has(cleanWord)) {
                previousIsIntensifier = false;
            }
            if (!negations.has(cleanWord)) {
                previousIsNegation = false;
            }
        });

        return scores;
    }

    /**
     * Get color based on sentiment score and importance
     */
    getWordColor(score, importance, sentiment) {
        if (importance < 0.3) {
            return this.colorScale.neutral[0];
        }
        
        const colorArray = score > 0 ? this.colorScale.positive : this.colorScale.negative;
        const intensityLevel = Math.min(3, Math.floor(importance * 4));
        return colorArray[intensityLevel];
    }

    /**
     * Render word importance heatmap
     */
    render(text, sentiment, confidence) {
        if (!this.container) {
            console.error('Container not initialized');
            return;
        }

        this.currentText = text;
        this.currentScores = this.calculateWordImportance(text, sentiment, confidence);

        // Create explanation header
        const header = document.createElement('div');
        header.className = 'explainer-header';
        header.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #6a1b9a; display: flex; align-items: center; gap: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                Word Importance Analysis
            </h4>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                Words are colored by their contribution to the ${sentiment === 1 ? 'positive' : 'negative'} sentiment.
                Darker colors indicate stronger influence.
            </p>
        `;

        // Create legend
        const legend = document.createElement('div');
        legend.className = 'explainer-legend';
        legend.innerHTML = `
            <div style="display: flex; gap: 20px; margin-bottom: 15px; font-size: 13px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; background: ${this.colorScale.positive[2]}; border-radius: 4px;"></div>
                    <span>Positive</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; background: ${this.colorScale.negative[2]}; border-radius: 4px;"></div>
                    <span>Negative</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; background: ${this.colorScale.neutral[1]}; border-radius: 4px;"></div>
                    <span>Neutral</span>
                </div>
            </div>
        `;

        // Create word heatmap
        const heatmap = document.createElement('div');
        heatmap.className = 'word-heatmap';
        heatmap.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 12px;
            border: 2px solid #e1bee7;
            line-height: 2.2;
            font-size: 16px;
            word-wrap: break-word;
        `;

        this.currentScores.forEach((wordData, index) => {
            const span = document.createElement('span');
            span.className = 'word-item';
            span.textContent = wordData.word;
            span.style.cssText = `
                background-color: ${this.getWordColor(wordData.score, wordData.importance, sentiment)};
                padding: 4px 8px;
                margin: 3px;
                border-radius: 6px;
                display: inline-block;
                transition: all 0.3s ease;
                cursor: pointer;
                font-weight: ${wordData.importance > 0.7 ? '600' : '400'};
                border: ${wordData.importance > 0.8 ? '2px solid #6a1b9a' : 'none'};
            `;
            
            // Add tooltip on hover
            span.title = `Importance: ${(wordData.importance * 100).toFixed(0)}%\nContribution: ${wordData.score > 0 ? 'Positive' : wordData.score < 0 ? 'Negative' : 'Neutral'}`;
            
            // Add hover effect
            span.addEventListener('mouseenter', () => {
                span.style.transform = 'scale(1.1)';
                span.style.boxShadow = '0 4px 12px rgba(106, 27, 154, 0.3)';
                span.style.zIndex = '10';
            });
            
            span.addEventListener('mouseleave', () => {
                span.style.transform = 'scale(1)';
                span.style.boxShadow = 'none';
                span.style.zIndex = '1';
            });
            
            heatmap.appendChild(span);
        });

        // Create insights section
        const insights = this.generateInsights(sentiment, confidence);
        const insightsDiv = document.createElement('div');
        insightsDiv.className = 'explainer-insights';
        insightsDiv.innerHTML = `
            <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border-radius: 10px;">
                <h5 style="margin: 0 0 10px 0; color: #6a1b9a; display: flex; align-items: center; gap: 6px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    Key Insights
                </h5>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #4a148c; font-size: 14px; line-height: 1.6;">
                    ${insights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            </div>
        `;

        // Clear and append all elements
        this.container.innerHTML = '';
        this.container.appendChild(header);
        this.container.appendChild(legend);
        this.container.appendChild(heatmap);
        this.container.appendChild(insightsDiv);

        // Animate container
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateY(20px)';
        setTimeout(() => {
            this.container.style.transition = 'all 0.5s ease';
            this.container.style.opacity = '1';
            this.container.style.transform = 'translateY(0)';
        }, 50);
    }

    /**
     * Generate insights from word analysis
     */
    generateInsights(sentiment, confidence) {
        const insights = [];
        const highImportanceWords = this.currentScores.filter(w => w.importance > 0.7);
        const positiveWords = highImportanceWords.filter(w => w.score > 0);
        const negativeWords = highImportanceWords.filter(w => w.score < 0);

        if (sentiment === 1) {
            insights.push(`The model detected ${positiveWords.length} strong positive indicators.`);
            if (negativeWords.length > 0) {
                insights.push(`Despite ${negativeWords.length} negative word(s), positive sentiment dominates.`);
            }
        } else {
            insights.push(`The model detected ${negativeWords.length} strong negative indicators.`);
            if (positiveWords.length > 0) {
                insights.push(`Even with ${positiveWords.length} positive word(s), negative sentiment prevails.`);
            }
        }

        insights.push(`Prediction confidence: ${(confidence * 100).toFixed(1)}%`);
        
        if (confidence > 0.9) {
            insights.push('The model is very confident about this prediction.');
        } else if (confidence < 0.6) {
            insights.push('The sentiment is mixed or ambiguous.');
        }

        return insights;
    }

    /**
     * Clear the explainer display
     */
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Create global instance
window.explainableAI = new ExplainableAI();
