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

            if (window.usageMeter && !window.usageMeter.canUse(1)) {
                window.toast.warning(
                    'Daily limit reached',
                    'Free plan allows 50 analyses per day. See Pricing to upgrade.'
                );
                return;
            }

            // Show loading
            window.loading.show('Analyzing Sentiment', 'AI is processing your review...');
            window.loading.buttonLoading(newAnalyzeBtn);

            try {
                const res = await fetch(window.apiUrl('/api/analyze'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: review, explain: true, arc: true, aspects: true })
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
                    sentiment: resolveSentiment(data),
                    confidence: data.confidence ?? data.probability,
                    scores: data.scores,
                    type: 'single'
                });

                // Show success toast
                if (window.usageMeter) window.usageMeter.record(1);
                const sentimentLabel = resolveSentiment(data) === 1 ? 'Fresh' : 'Rotten';
                const confidence = ((data.confidence ?? data.probability ?? 0) * 100).toFixed(1);
                
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

            if (window.usageMeter && !window.usageMeter.canUse(1)) {
                window.toast.warning(
                    'Daily limit reached',
                    'Free plan allows 50 analyses per day. See Pricing to upgrade.'
                );
                return;
            }

            // Show loading
            window.loading.show('Processing CSV', `Analyzing ${file.name}...`);

            const useStream = document.getElementById('batch-stream-toggle')?.checked !== false
                && window.BatchStream;
            const streamStatus = document.getElementById('batch-stream-status');

            try {
                let predictions = null;

                async function runClassicBatch() {
                    if (window.BatchStream && window.BatchStream.uploadCsvClassic) {
                        return window.BatchStream.uploadCsvClassic(file);
                    }
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await fetch(window.apiUrl('/api/predict'), {
                        method: 'POST',
                        body: formData
                    });
                    if (!res.ok) {
                        throw new Error('HTTP ' + res.status + ': ' + res.statusText);
                    }
                    const data = await res.json();
                    return data.results || data.predictions || (Array.isArray(data) ? data : []);
                }

                if (useStream) {
                    if (streamStatus) {
                        streamStatus.style.display = 'block';
                        streamStatus.textContent = 'Starting stream…';
                    }
                    try {
                        predictions = await window.BatchStream.uploadCsvStream(file, {
                            onProgress: function (ev) {
                                if (streamStatus) {
                                    streamStatus.textContent = 'Processed ' + ev.done + ' reviews…';
                                }
                            },
                            onComplete: function (ev) {
                                if (streamStatus) {
                                    streamStatus.textContent = 'Complete — ' + ev.total + ' reviews.';
                                }
                            },
                        });
                    } catch (streamErr) {
                        var sm = String(streamErr.message || '');
                        if (/HTTP 404|HTTP 405|endpoint not found/i.test(sm)) {
                            if (streamStatus) {
                                streamStatus.textContent = 'Stream not available — using standard upload…';
                            }
                            if (window.toast) {
                                window.toast.info(
                                    'Standard batch mode',
                                    'Restart server (make serve) for stream. Analyzing file now…'
                                );
                            }
                            predictions = await runClassicBatch();
                        } else {
                            throw streamErr;
                        }
                    }
                } else {
                    predictions = await runClassicBatch();
                }

                window.loading.hide();

                if (!predictions || !predictions.length) {
                    throw new Error('No results returned — check your CSV has a text column');
                }

                if (window.historyManager) {
                    window.historyManager.addBatch(predictions, file.name);
                }
                if (window.usageMeter) {
                    window.usageMeter.record(predictions.length);
                }

                if (typeof window.renderBatchResult === 'function') {
                    window.renderBatchResult({ results: predictions }, 'batch-table-wrap');
                } else if (typeof renderBatchResult === 'function') {
                    renderBatchResult({ results: predictions }, 'batch-table-wrap');
                }

                const fresh = predictions.filter(function (r) {
                    return r.label === 1 || r.sentiment === 'positive';
                }).length;
                const rotten = predictions.length - fresh;
                window.toast.success(
                    'Batch complete',
                    fresh + ' Fresh · ' + rotten + ' Rotten · ' + predictions.length + ' total'
                );
                addExportButton(predictions);
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
                                                    ${item.sentiment === 1 || item.sentiment === 'positive' ? 'Fresh' : 'Rotten'}
                                                </span>
                                                Confidence: ${((item.confidence || 0) * 100).toFixed(1)}%
                                            </small>
                                            <button type="button" class="btn btn-sm btn-outline-light history-replay-btn" data-replay-text="${(item.text || '').replace(/"/g, '&quot;')}">Replay analysis</button>
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

        document.querySelectorAll('[data-replay-text]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const ta = document.getElementById('single-review');
                const raw = btn.getAttribute('data-replay-text') || '';
                if (ta) {
                    ta.value = raw;
                    ta.focus();
                }
                modal.hide();
                const analyzeBtn = document.getElementById('analyze-btn');
                if (analyzeBtn) analyzeBtn.click();
            });
        });
    };

    // Deep link: batch.html?text=... or ?q=...
    (function applyDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const shared = params.get('text') || params.get('q');
        if (!shared) return;
        const ta = document.getElementById('single-review');
        if (ta) {
            ta.value = shared;
            if (window.toast) {
                window.toast.info('Shared review loaded', 'Click Rate this review or wait for live preview.');
            }
        }
    })();

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

// ============================================
// NEW FEATURES INTEGRATION
// ============================================

// Voice Input Integration (Analyze page)
function initVoiceInputIntegration() {
    const voiceBtn = document.getElementById('voice-btn');
    const stopVoiceBtn = document.getElementById('stop-voice-btn');
    const voiceContainer = document.getElementById('voice-container');
    const voiceCanvas = document.getElementById('voice-waveform');
    const reviewTextarea = document.getElementById('single-review');

    if (!voiceBtn || !window.voiceInput) {
        return;
    }

    if (voiceBtn.dataset.voiceBound) {
        return;
    }
    voiceBtn.dataset.voiceBound = '1';

    var voiceStatusEl = voiceContainer ? voiceContainer.querySelector('p') : null;

    function stopVoiceUi() {
        if (window.voiceInput.isActive()) {
            window.voiceInput.flushTranscript();
            window.voiceInput.stop();
        }
        if (voiceContainer) voiceContainer.classList.remove('is-active');
        voiceBtn.textContent = 'Voice';
        voiceBtn.classList.remove('is-recording');
        voiceBtn.setAttribute('aria-pressed', 'false');
        voiceBtn.disabled = false;
    }

    function setVoiceStatus(msg) {
        if (voiceStatusEl) voiceStatusEl.textContent = msg;
    }

    function applyVoiceText(text) {
        if (!reviewTextarea || !text) return;
        reviewTextarea.value = text.trim();
        reviewTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    window.voiceInput.setOnResult(function (result) {
        var text = result.combined || result.final || '';
        if (!text && result.interim) {
            text = (result.final ? result.final + ' ' : '') + result.interim;
        }
        applyVoiceText(text);
        if (text) {
            setVoiceStatus('Heard: “' + text.substring(0, 60) + (text.length > 60 ? '…' : '') + '”');
        }
    });

    window.voiceInput.setOnAutoStop(function () {
        var text = window.voiceInput.getFullTranscript();
        applyVoiceText(text);
        stopVoiceUi();
        if (text && window.toast) {
            window.toast.success('Voice captured', 'Review added — tap Rate this review or edit.');
        } else if (window.toast) {
            window.toast.info('No speech detected', 'Try again or type your review.');
        }
    });

    window.voiceInput.setOnError(function (error) {
        var msg = String(error || 'Voice input error');
        if (msg === 'no-speech' || msg === 'aborted') {
            return;
        }
        if (msg === 'not-allowed') {
            msg = 'Microphone blocked — allow mic in browser settings, then try again.';
        } else if (msg === 'service-not-allowed') {
            msg = 'Speech recognition unavailable. Use Chrome/Edge on http://127.0.0.1:8000';
        }
        if (window.toast) {
            window.toast.error('Voice input', msg);
        }
        stopVoiceUi();
    });

    voiceBtn.addEventListener('click', async function () {
        if (window.voiceInput.isActive()) {
            return;
        }

        if (!window.voiceInput.isSupported()) {
            if (window.toast) {
                window.toast.warning(
                    'Not supported',
                    'Voice input needs Chrome or Edge. Safari/Firefox: type or paste your review.'
                );
            }
            return;
        }

        if (!window.isSecureContext) {
            if (window.toast) {
                window.toast.warning(
                    'Secure connection required',
                    'Open http://127.0.0.1:8000 (not file://) for voice input.'
                );
            }
            return;
        }

        var existingText = reviewTextarea ? reviewTextarea.value.trim() : '';

        if (voiceContainer) voiceContainer.classList.add('is-active');
        voiceBtn.textContent = 'Listening…';
        voiceBtn.classList.add('is-recording');
        voiceBtn.setAttribute('aria-pressed', 'true');
        var recLang = window.voiceInput.recognition
            ? window.voiceInput.recognition.lang
            : 'en-US';
        setVoiceStatus(
            'Listening (' + recLang + ')… speak now. Auto-stops after a pause, or tap Stop recording.'
        );

        if (window.toast) {
            window.toast.info('Microphone on', 'Take your time — tap Stop recording when finished.');
        }

        voiceBtn.disabled = true;
        var started = await window.voiceInput.start(voiceCanvas, 'bars', existingText);
        voiceBtn.disabled = false;
        if (!started) {
            if (!window.voiceInput.isActive()) {
                stopVoiceUi();
                if (window.toast) {
                    window.toast.error(
                        'Could not start',
                        'Allow microphone when prompted. Use Chrome/Edge at http://127.0.0.1:8000'
                    );
                }
            }
        }
    });

    if (stopVoiceBtn) {
        stopVoiceBtn.addEventListener('click', function () {
            var text = window.voiceInput.getFullTranscript();
            applyVoiceText(text);
            stopVoiceUi();
            if (text && window.toast) {
                window.toast.success('Voice captured', text.length + ' characters — tap Rate this review.');
            } else if (window.toast) {
                window.toast.info('Voice stopped', 'No speech heard — try again or type manually.');
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoiceInputIntegration);
} else {
    initVoiceInputIntegration();
}

// Enhanced Result Rendering with Explainable AI and Social Share
function resolveSentiment(data) {
    if (!data) return 0;
    if (data.label === 1 || data.label === '1') return 1;
    if (data.label === 0 || data.label === '0') return 0;
    if (data.sentiment === 1 || data.sentiment === 'positive') return 1;
    if (data.sentiment === 0 || data.sentiment === 'negative') return 0;
    return data.probability >= 0.5 ? 1 : 0;
}

function renderEnhancedResult(data, text, containerId = 'single-result') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.classList.remove('result-empty-hint');
    const sentiment = resolveSentiment(data);
    const confidence = data.confidence ?? data.probability ?? 0;
    const verdict = sentiment === 1 ? 'Fresh' : 'Rotten';
    const icon = sentiment === 1 ? '★' : '✕';
    const cls = sentiment === 1 ? 'pos sentiment-positive' : 'neg sentiment-negative';
    const uncertainty = data.uncertainty
        ? '<div class="uncertainty-callout" role="note">' + data.uncertainty.message + '</div>'
        : '';

    container.innerHTML =
        '<div class="result-card" style="animation:pop .18s ease;">' +
        '<h3>Verdict</h3>' +
        '<div id="rottenmeter-slot"></div>' +
        '<p><strong>Rating:</strong> <span class="' + cls + '">' + icon + ' ' + verdict + '</span></p>' +
        '<p><strong>Confidence:</strong> ' + (confidence * 100).toFixed(1) + '%</p>' +
        uncertainty +
        (data.language
            ? '<p class="chart-note"><span class="lang-badge">Lang: ' +
              data.language +
              (data.language_confidence != null
                  ? ' (' + Math.round(data.language_confidence * 100) + '%)'
                  : '') +
              '</span></p>'
            : '') +
        (text
            ? '<p class="chart-note mt-2">“' +
              text.substring(0, 180).replace(/</g, '&lt;') +
              (text.length > 180 ? '…' : '') +
              '”</p>'
            : '') +
        '</div>';

    if (window.Rottenmeter) {
        const slot = document.getElementById('rottenmeter-slot');
        window.Rottenmeter.render(slot, sentiment, confidence, data.probability);
    }

    if (window.ReviewArc && data.arc) {
        window.ReviewArc.render('review-arc-container', data.arc, data.arc_summary);
    }

    if (window.AspectViz && data.aspects) {
        window.AspectViz.render('aspect-viz-container', data.aspects);
    }

    // Show Explainable AI (reuse bundled explanation when available)
    const explainableContainer = document.getElementById('explainable-ai-container');
    if (explainableContainer && window.explainableAI) {
        explainableContainer.style.display = 'block';
        window.explainableAI.init('explainable-ai-container');
        if (data.explanation && data.explanation.tokens) {
            explainableContainer.innerHTML = '';
            window.explainableAI.renderModelExplanation(explainableContainer, data.explanation);
        } else {
            window.explainableAI.render(text, sentiment, confidence);
        }
    }

    // Show Social Share
    const socialContainer = document.getElementById('social-share-container');
    if (socialContainer && window.socialShare) {
        socialContainer.style.display = 'block';
        window.socialShare.setResult(text, sentiment, confidence, verdict);
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


