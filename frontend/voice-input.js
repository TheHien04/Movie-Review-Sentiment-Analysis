/**
 * Voice Input with Real-time Waveform Visualization
 * Uses Web Speech API for speech-to-text
 */

class VoiceInput {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.animationId = null;
        this.onResult = null;
        this.onError = null;
        this.onAutoStop = null;
        this.canvas = null;
        this.canvasCtx = null;
        this._startedAt = 0;
        this._restartTimer = null;
        this._silenceTimer = null;
        this._sessionFinal = '';
        this._currentInterim = '';
        this._benignErrors = new Set(['no-speech', 'aborted', 'network']);
        
        this.initRecognition();
    }

    _resolveRecognitionLang() {
        const lang = (navigator.language || 'en-US').toLowerCase();
        if (lang.startsWith('vi')) return 'vi-VN';
        if (lang.startsWith('en')) return 'en-US';
        return navigator.language || 'en-US';
    }

    getFullTranscript() {
        const parts = [this._sessionFinal, this._currentInterim].filter(Boolean);
        return parts.join(' ').trim();
    }

    flushTranscript() {
        if (this._currentInterim) {
            this._sessionFinal = (this._sessionFinal ? this._sessionFinal + ' ' : '') + this._currentInterim.trim();
            this._currentInterim = '';
        }
        const combined = this.getFullTranscript();
        if (combined && this.onResult) {
            this.onResult({
                final: this._sessionFinal,
                interim: '',
                combined: combined,
                flush: true,
            });
        }
        return combined;
    }

    _emitResult() {
        const combined = this.getFullTranscript();
        if (this.onResult && combined) {
            this.onResult({
                final: this._sessionFinal,
                interim: this._currentInterim,
                combined: combined,
            });
        }
    }

    _resetSilenceTimer() {
        if (this._silenceTimer) {
            clearTimeout(this._silenceTimer);
            this._silenceTimer = null;
        }
        if (!this.isRecording) return;
        this._silenceTimer = setTimeout(() => {
            if (!this.isRecording) return;
            if (this.getFullTranscript() && this.onAutoStop) {
                this.onAutoStop();
            }
        }, 2800);
    }

    /**
     * Browser supports Web Speech API
     */
    isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    /**
     * Initialize Speech Recognition
     */
    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported in this browser');
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this._resolveRecognitionLang();
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const piece = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    const chunk = piece.trim();
                    if (chunk) {
                        this._sessionFinal = this._sessionFinal
                            ? this._sessionFinal + ' ' + chunk
                            : chunk;
                    }
                    this._currentInterim = '';
                } else {
                    interim += piece;
                }
            }
            if (interim) {
                this._currentInterim = interim.trim();
            }
            this._emitResult();
            this._resetSilenceTimer();
        };

        this.recognition.onerror = (event) => {
            const code = event.error || 'unknown';
            // Chrome fires no-speech quickly if the user has not talked yet — keep listening
            if (this._benignErrors.has(code) && this.isRecording) {
                this._scheduleRecognitionRestart(120);
                return;
            }
            console.error('Speech recognition error:', code);
            if (this.onError) {
                this.onError(code);
            }
            this.stop();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                this._scheduleRecognitionRestart(80);
            }
        };

        return true;
    }

    /**
     * Initialize audio visualization
     */
    async initAudioVisualization(canvasElement) {
        this.canvas = canvasElement;
        this.canvasCtx = this.canvas.getContext('2d');

        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 256;
            this.microphone.connect(this.analyser);
            
            return true;
        } catch (error) {
            console.error('Microphone access denied:', error);
            return false;
        }
    }

    /**
     * Draw waveform visualization
     */
    drawWaveform() {
        if (!this.analyser || !this.canvas) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        this.canvasCtx.clearRect(0, 0, width, height);
        
        // Draw gradient background
        const gradient = this.canvasCtx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(201, 162, 39, 0.15)');
        gradient.addColorStop(1, 'rgba(201, 162, 39, 0.05)');
        this.canvasCtx.fillStyle = gradient;
        this.canvasCtx.fillRect(0, 0, width, height);

        // Draw bars
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height * 0.8;
            
            // Create gradient for each bar
            const barGradient = this.canvasCtx.createLinearGradient(0, height - barHeight, 0, height);
            barGradient.addColorStop(0, '#c9a227');
            barGradient.addColorStop(0.5, '#e8c547');
            barGradient.addColorStop(1, '#a8841a');
            
            this.canvasCtx.fillStyle = barGradient;
            this.canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.drawWaveform());
    }

    /**
     * Draw circular waveform (alternative visualization)
     */
    drawCircularWaveform() {
        if (!this.analyser || !this.canvas) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;
        
        // Clear canvas
        this.canvasCtx.clearRect(0, 0, width, height);
        
        // Draw background circle
        this.canvasCtx.beginPath();
        this.canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.canvasCtx.fillStyle = 'rgba(156, 39, 176, 0.1)';
        this.canvasCtx.fill();

        // Draw waveform bars in circle
        const sliceAngle = (2 * Math.PI) / bufferLength;
        
        for (let i = 0; i < bufferLength; i++) {
            const angle = sliceAngle * i;
            const barHeight = (dataArray[i] / 255) * (radius * 0.8);
            
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);
            
            const alpha = dataArray[i] / 255;
            this.canvasCtx.strokeStyle = `rgba(156, 39, 176, ${alpha})`;
            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(x1, y1);
            this.canvasCtx.lineTo(x2, y2);
            this.canvasCtx.stroke();
        }

        // Draw center pulse
        const avgAmplitude = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const pulseRadius = (avgAmplitude / 255) * 30 + 10;
        
        this.canvasCtx.beginPath();
        this.canvasCtx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
        this.canvasCtx.fillStyle = 'rgba(156, 39, 176, 0.6)';
        this.canvasCtx.fill();

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.drawCircularWaveform());
    }

    _scheduleRecognitionRestart(delayMs) {
        if (!this.isRecording || !this.recognition) return;
        if (this._restartTimer) clearTimeout(this._restartTimer);
        this._restartTimer = setTimeout(() => {
            this._restartTimer = null;
            if (!this.isRecording || !this.recognition) return;
            try {
                this.recognition.start();
            } catch (err) {
                if (String(err).indexOf('already started') === -1) {
                    this._scheduleRecognitionRestart(200);
                }
            }
        }, delayMs);
    }

    /**
     * Start voice recording
     */
    async start(canvasElement, visualizationType = 'bars', initialText = '') {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }

        if (!this.recognition) {
            return false;
        }

        if (this._restartTimer) {
            clearTimeout(this._restartTimer);
            this._restartTimer = null;
        }
        try {
            this.recognition.abort();
        } catch (_) { /* ignore */ }

        this._sessionFinal = String(initialText || '').trim();
        this._currentInterim = '';
        if (this._silenceTimer) {
            clearTimeout(this._silenceTimer);
            this._silenceTimer = null;
        }
        if (this._sessionFinal) {
            this._emitResult();
        }

        let vizReady = false;
        if (canvasElement) {
            this.canvas = canvasElement;
            this.canvasCtx = canvasElement.getContext('2d');
            if (!this.audioContext) {
                vizReady = await this.initAudioVisualization(canvasElement);
                if (!vizReady) {
                    if (this.onError) {
                        this.onError('not-allowed');
                    }
                    return false;
                }
            } else {
                vizReady = true;
            }
            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                } catch (_) { /* ignore */ }
            }
        }

        try {
            this.isRecording = true;
            this._startedAt = Date.now();
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.isRecording = false;
            var errMsg = String(error.message || error);
            if (errMsg.indexOf('already started') !== -1) {
                this._scheduleRecognitionRestart(300);
                return true;
            }
            if (this.onError) {
                this.onError(errMsg || 'Failed to start recording');
            }
            return false;
        }

        if (vizReady && this.canvas && this.analyser) {
            if (visualizationType === 'circular') {
                this.drawCircularWaveform();
            } else {
                this.drawWaveform();
            }
        }

        return true;
    }

    /**
     * Stop voice recording
     */
    stop() {
        if (!this.isRecording) return;

        this.flushTranscript();
        this.isRecording = false;
        if (this._restartTimer) {
            clearTimeout(this._restartTimer);
            this._restartTimer = null;
        }
        if (this._silenceTimer) {
            clearTimeout(this._silenceTimer);
            this._silenceTimer = null;
        }

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }

        // Stop visualization
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Clear canvas
        if (this.canvas && this.canvasCtx) {
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * Check if recording is active
     */
    isActive() {
        return this.isRecording;
    }

    /**
     * Set result callback
     */
    setOnResult(callback) {
        this.onResult = callback;
    }

    /**
     * Set error callback
     */
    setOnError(callback) {
        this.onError = callback;
    }

    setOnAutoStop(callback) {
        this.onAutoStop = callback;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stop();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        this.analyser = null;
        this.recognition = null;
    }
}

// Create global instance
window.voiceInput = new VoiceInput();
