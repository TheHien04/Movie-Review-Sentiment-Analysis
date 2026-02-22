/**
 * Integration script - Enhances existing functionality with new utilities
 * Wraps batch.html functions with loading, toast, validation, and history
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize validation for review textarea if exists
    const reviewTextarea = document.getElementById('single-review');
    if (reviewTextarea && window.validationManager) {
        window.validationManager.init(reviewTextarea, {
            minLength: 10,
            maxLength: 1000,
            minWords: 3,
            showCharCounter: true,
            showWordCounter: true,
            showStrength: true
        });
    }

    // Enhance analyze button with loading and history
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn && window.loading && window.toast && window.historyManager) {
        // Remove existing event listener by cloning
        const newAnalyzeBtn = analyzeBtn.cloneNode(true);
        analyzeBtn.parentNode.replaceChild(newAnalyzeBtn, analyzeBtn);

        newAnalyzeBtn.addEventListener('click', async function() {
            const ta = document.getElementById('single-review');
            const review = (ta?.value || '').trim();
            
            // Validate input
            if (!review) {
                window.toast.warning('Empty Input', 'Please enter a movie review to analyze');
                ta?.focus();
                return;
            }

            if (!window.validationManager.isValid(ta)) {
                window.toast.error('Validation Failed', 'Please fix the input errors');
                return;
            }

            // Show loading
            window.loading.show('Analyzing Sentiment', 'AI is processing your review...');
            window.loading.buttonLoading(newAnalyzeBtn);

            try {
                const res = await fetch('http://localhost:8000/api/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: review })
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();
                
                // Hide loading
                window.loading.hide();
                window.loading.buttonReset(newAnalyzeBtn);

                // Render result
                renderSingleResult(data, 'single-result');

                // Add to history
                window.historyManager.add({
                    text: review,
                    sentiment: data.sentiment,
                    confidence: data.confidence,
                    scores: data.scores,
                    type: 'single'
                });

                // Show success toast
                const sentimentLabel = data.sentiment === 1 || data.sentiment === 'positive' 
                    ? 'Positive' 
                    : 'Negative';
                const confidence = ((data.confidence || 0) * 100).toFixed(1);
                
                window.toast.success(
                    'Analysis Complete!',
                    `Sentiment: ${sentimentLabel} (${confidence}% confidence)`
                );

                // Clear input if user wants
                // ta.value = '';
            } catch (error) {
                console.error('Analysis error:', error);
                window.loading.hide();
                window.loading.buttonReset(newAnalyzeBtn);
                window.toast.error(
                    'Analysis Failed',
                    error.message || 'Unable to connect to the server. Please try again.'
                );
                document.getElementById('single-result').innerHTML = 
                    '<div class="alert alert-danger">❌ Error occurred. Please try again.</div>';
            }
        });
    }

    // Enhance batch analyze button
    const batchBtn = document.getElementById('batch-analyze-btn');
    if (batchBtn && window.loading && window.toast) {
        const newBatchBtn = batchBtn.cloneNode(true);
        batchBtn.parentNode.replaceChild(newBatchBtn, batchBtn);

        newBatchBtn.addEventListener('click', async function() {
            const fileInput = document.getElementById('file-input');
            const file = fileInput?.files?.[0];
            
            if (!file) {
                window.toast.warning('No File Selected', 'Please choose a CSV file to analyze');
                return;
            }

            if (!file.name.endsWith('.csv')) {
                window.toast.error('Invalid File Type', 'Please upload a CSV file');
                return;
            }

            // Show loading
            window.loading.show('Processing CSV', `Analyzing ${file.name}...`);

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('http://localhost:8000/api/predict', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();
                
                window.loading.hide();

                // Check if batch results
                if (Array.isArray(data.predictions) || Array.isArray(data)) {
                    const predictions = data.predictions || data;
                    
                    // Add to history
                    window.historyManager.addBatch(predictions, file.name);

                    // Render results (assuming renderBatchResults exists)
                    if (typeof renderBatchResults === 'function') {
                        renderBatchResults(predictions);
                    }

                    // Show success toast
                    window.toast.success(
                        'Batch Analysis Complete!',
                        `Processed ${predictions.length} reviews successfully`
                    );

                    // Add export button functionality
                    addExportButton(predictions);
                } else {
                    throw new Error('Invalid response format');
                }
            } catch (error) {
                console.error('Batch analysis error:', error);
                window.loading.hide();
                window.toast.error(
                    'Batch Analysis Failed',
                    error.message || 'Failed to process CSV file'
                );
            }
        });
    }

    // Add Excel export to download button
    const downloadBtn = document.getElementById('download-csv-btn');
    if (downloadBtn && window.excelExporter) {
        downloadBtn.addEventListener('click', function() {
            const history = window.historyManager.getRecent(1);
            if (history.length > 0 && history[0].type === 'batch') {
                const batchData = history[0];
                window.excelExporter.exportBatchPredictions(
                    batchData.predictions,
                    `batch_analysis_${Date.now()}.xlsx`
                );
            } else {
                window.toast.info('No Data', 'Perform a batch analysis first to export results');
            }
        });

        // Also add Excel export option
        const newExcelBtn = document.createElement('button');
        newExcelBtn.id = 'download-excel-btn';
        newExcelBtn.className = 'btn btn-outline-primary btn-sm ms-2';
        newExcelBtn.innerHTML = '📊 Export Excel';
        newExcelBtn.onclick = function() {
            const history = window.historyManager.getRecent(1);
            if (history.length > 0 && history[0].type === 'batch') {
                window.excelExporter.exportBatchPredictions(
                    history[0].predictions,
                    `sentiment_analysis_${Date.now()}.xlsx`
                );
            } else {
                window.toast.info('No Data', 'No batch data available to export');
            }
        };

        if (downloadBtn.parentNode && !document.getElementById('download-excel-btn')) {
            downloadBtn.parentNode.insertBefore(newExcelBtn, downloadBtn.nextSibling);
        }
    }

    // Add history modal functionality
    window.showHistoryModal = function() {
        if (!window.historyManager) return;

        const history = window.historyManager.getAll();
        if (history.length === 0) {
            window.toast.info('No History', 'Your prediction history is empty');
            return;
        }

        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="historyModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">📜 Analysis History</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <strong>Total Items:</strong> ${history.length} | 
                                <button class="btn btn-sm btn-outline-danger" onclick="clearHistory()">Clear All</button>
                                <button class="btn btn-sm btn-outline-primary ms-2" onclick="exportHistory()">Export JSON</button>
                            </div>
                            <div class="list-group">
                                ${history.map(item => `
                                    <div class="list-group-item">
                                        <div class="d-flex justify-content-between">
                                            <strong>${item.type === 'batch' ? '📁 ' + item.name : '📝 Single Analysis'}</strong>
                                            <small class="text-muted">${new Date(item.timestamp).toLocaleString()}</small>
                                        </div>
                                        ${item.type === 'batch' ? `
                                            <p class="mb-1"><small>
                                                ${item.count} reviews | 
                                                ${item.summary.positive} positive (${item.summary.positivePercent}%) | 
                                                ${item.summary.negative} negative (${item.summary.negativePercent}%)
                                            </small></p>
                                        ` : `
                                            <p class="mb-1 text-truncate">${item.text}</p>
                                            <small>
                                                <span class="badge ${item.sentiment === 1 || item.sentiment === 'positive' ? 'bg-success' : 'bg-danger'}">
                                                    ${item.sentiment === 1 || item.sentiment === 'positive' ? 'Positive' : 'Negative'}
                                                </span>
                                                Confidence: ${((item.confidence || 0) * 100).toFixed(1)}%
                                            </small>
                                        `}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('historyModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('historyModal'));
        modal.show();
    };

    // Clear history function
    window.clearHistory = function() {
        if (confirm('Are you sure you want to clear all history?')) {
            window.historyManager.clear();
            const modal = bootstrap.Modal.getInstance(document.getElementById('historyModal'));
            if (modal) modal.hide();
            window.toast.info('History Cleared', 'All analysis history has been removed');
        }
    };

    // Export history function
    window.exportHistory = function() {
        window.historyManager.exportToJSON();
    };

    // Helper function to add export button
    function addExportButton(predictions) {
        window.currentBatchPredictions = predictions;
    }
});

// Welcome toast on page load (only on home page)
if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    window.addEventListener('load', function() {
        if (window.toast) {
            setTimeout(() => {
                window.toast.info(
                    'Welcome to Movie Sentiment AI! 🎬',
                    'Analyze movie reviews with our advanced AI model',
                    8000
                );
            }, 1000);
        }
    });
}

// Show helpful tips after load
if (window.location.pathname.includes('batch.html')) {
    window.addEventListener('load', function() {
        if (window.toast) {
            setTimeout(() => {
                window.toast.info(
                    '💡 Pro Tip',
                    'Try voice input or see word importance analysis!',
                    6000
                );
            }, 2000);
        }
    });
}

// ============================================
// NEW FEATURES INTEGRATION
// ============================================

// Voice Input Integration
document.addEventListener('DOMContentLoaded', function() {
    const voiceBtn = document.getElementById('voice-btn');
    const stopVoiceBtn = document.getElementById('stop-voice-btn');
    const voiceContainer = document.getElementById('voice-container');
    const voiceCanvas = document.getElementById('voice-waveform');
    const reviewTextarea = document.getElementById('single-review');

    if (voiceBtn && window.voiceInput) {
        voiceBtn.addEventListener('click', async function() {
            if (!window.voiceInput.isActive()) {
                // Start recording
                const started = await window.voiceInput.start(voiceCanvas, 'bars');
                if (started) {
                    voiceContainer.style.display = 'block';
                    voiceBtn.style.background = 'linear-gradient(135deg, #f44336, #e57373)';
                    voiceBtn.textContent = '⏹️ Stop';
                    
                    // Set up result callback
                    window.voiceInput.setOnResult((result) => {
                        if (reviewTextarea) {
                            reviewTextarea.value = result.final || result.interim;
                            // Trigger validation
                            const event = new Event('input', { bubbles: true });
                            reviewTextarea.dispatchEvent(event);
                        }
                    });

                    // Set up error callback
                    window.voiceInput.setOnError((error) => {
                        if (window.toast) {
                            window.toast.error('Voice Input Error', error);
                        }
                        voiceContainer.style.display = 'none';
                        voiceBtn.style.background = 'linear-gradient(135deg, #9c27b0, #ba68c8)';
                        voiceBtn.textContent = '🎤 Voice';
                    });

                    if (window.toast) {
                        window.toast.info('Voice Input Active', 'Start speaking your review!');
                    }
                } else {
                    if (window.toast) {
                        window.toast.error('Voice Input Failed', 'Microphone access denied or not supported');
                    }
                }
            } else {
                // Stop recording
                window.voiceInput.stop();
                voiceContainer.style.display = 'none';
                voiceBtn.style.background = 'linear-gradient(135deg, #9c27b0, #ba68c8)';
                voiceBtn.textContent = '🎤 Voice';
            }
        });

        if (stopVoiceBtn) {
            stopVoiceBtn.addEventListener('click', function() {
                window.voiceInput.stop();
                voiceContainer.style.display = 'none';
                voiceBtn.style.background = 'linear-gradient(135deg, #9c27b0, #ba68c8)';
                voiceBtn.textContent = '🎤 Voice';
            });
        }
    }
});

// Enhanced Result Rendering with Explainable AI and Social Share
function renderEnhancedResult(data, text, containerId = 'single-result') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sentiment = data.sentiment === 1 || data.sentiment === 'positive' ? 1 : 0;
    const confidence = data.confidence || data.probability || 0;
    const label = sentiment === 1 ? 'Positive' : 'Negative';
    const emoji = sentiment === 1 ? '😊' : '😔';
    const color = sentiment === 1 ? '#4caf50' : '#f44336';
    const bgColor = sentiment === 1 ? '#e8f5e9' : '#ffebee';

    // Render result card
    container.innerHTML = `
        <div class="alert" style="background: ${bgColor}; border-left: 5px solid ${color}; border-radius: 12px; padding: 20px; animation: fadeIn 0.5s ease;">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="font-size: 48px;">${emoji}</div>
                <div style="flex: 1;">
                    <h4 style="margin: 0; color: ${color}; font-weight: 700;">${label} Sentiment</h4>
                    <p style="margin: 5px 0 0 0; color: #666;">Confidence: ${(confidence * 100).toFixed(1)}%</p>
                </div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 8px; font-style: italic; color: #555;">
                "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"
            </div>
        </div>
    `;

    // Show Explainable AI
    const explainableContainer = document.getElementById('explainable-ai-container');
    if (explainableContainer && window.explainableAI) {
        explainableContainer.style.display = 'block';
        window.explainableAI.init('explainable-ai-container');
        window.explainableAI.render(text, sentiment, confidence);
    }

    // Show Social Share
    const socialContainer = document.getElementById('social-share-container');
    if (socialContainer && window.socialShare) {
        socialContainer.style.display = 'block';
        window.socialShare.setResult(text, sentiment, confidence, label);
        socialContainer.innerHTML = window.socialShare.createShareButtons();
    }

    // Trigger particle effect
    if (window.particles) {
        if (sentiment === 1) {
            window.particles.success(window.innerWidth / 2, 200);
        } else {
            // Use star burst for negative results
            window.particles.starBurst(window.innerWidth / 2, 200);
        }
    }
}

// Override the original renderSingleResult to use enhanced version
const originalRenderSingleResult = window.renderSingleResult || function() {};
window.renderSingleResult = function(data, containerId) {
    const textarea = document.getElementById('single-review');
    const text = textarea ? textarea.value : '';
    
    if (text && window.explainableAI) {
        renderEnhancedResult(data, text, containerId);
    } else {
        // Fallback to original
        originalRenderSingleResult(data, containerId);
    }
};

// Keyboard Shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter to analyze
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn && !analyzeBtn.disabled) {
            e.preventDefault();
            analyzeBtn.click();
        }
    }
    
    // Ctrl/Cmd + K to focus on textarea
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        const textarea = document.getElementById('single-review');
        if (textarea) {
            e.preventDefault();
            textarea.focus();
        }
    }
});

console.log('✨ Enhanced features loaded: Voice Input, Explainable AI, Social Share, Particle Effects');

