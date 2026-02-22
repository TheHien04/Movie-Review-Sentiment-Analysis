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
        this.canvas = null;
        this.canvasCtx = null;
        
        this.initRecognition();
    }

    /**
     * Initialize Speech Recognition
     */
    initRecognition() {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported in this browser');
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        // Event handlers
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            if (this.onResult) {
                this.onResult({
                    final: finalTranscript.trim(),
                    interim: interimTranscript.trim(),
                    isFinal: finalTranscript.length > 0
                });
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (this.onError) {
                this.onError(event.error);
            }
            this.stop();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                // Restart if it stops unexpectedly
                this.recognition.start();
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
            if (this.onError) {
                this.onError('Microphone access denied');
            }
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
        gradient.addColorStop(0, 'rgba(106, 27, 154, 0.1)');
        gradient.addColorStop(1, 'rgba(156, 39, 176, 0.05)');
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
            barGradient.addColorStop(0, '#9c27b0');
            barGradient.addColorStop(0.5, '#ba68c8');
            barGradient.addColorStop(1, '#ce93d8');
            
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

    /**
     * Start voice recording
     */
    async start(canvasElement, visualizationType = 'bars') {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }

        if (!this.recognition) {
            if (this.onError) {
                this.onError('Speech recognition not supported');
            }
            return false;
        }

        // Initialize audio visualization
        if (canvasElement && !this.audioContext) {
            const success = await this.initAudioVisualization(canvasElement);
            if (!success) return false;
        }

        try {
            this.isRecording = true;
            this.recognition.start();
            
            // Start visualization
            if (this.canvas && this.analyser) {
                if (visualizationType === 'circular') {
                    this.drawCircularWaveform();
                } else {
                    this.drawWaveform();
                }
            }
            
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.isRecording = false;
            if (this.onError) {
                this.onError('Failed to start recording');
            }
            return false;
        }
    }

    /**
     * Stop voice recording
     */
    stop() {
        if (!this.isRecording) return;

        this.isRecording = false;
        
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
