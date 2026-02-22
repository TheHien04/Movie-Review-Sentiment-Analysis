/**
 * Loading Spinner Utility
 * Professional loading states for Movie Review Sentiment Analysis
 */

class LoadingManager {
    constructor() {
        this.overlay = null;
        this.initialized = false;
    }

    /**
     * Initialize the loading overlay if not already present
     */
    init() {
        if (this.initialized) return;
        
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <div class="loading-text">Processing<span class="loading-dots"></span></div>
                <div class="loading-subtext">Please wait a moment</div>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.overlay = overlay;
        this.initialized = true;
    }

    /**
     * Show loading overlay with custom message
     * @param {string} message - Main loading message
     * @param {string} subtext - Optional subtitle
     */
    show(message = 'Processing', subtext = 'Please wait a moment') {
        this.init();
        
        const textElement = this.overlay.querySelector('.loading-text');
        const subtextElement = this.overlay.querySelector('.loading-subtext');
        
        if (textElement) {
            textElement.innerHTML = message + '<span class="loading-dots"></span>';
        }
        
        if (subtextElement && subtext) {
            subtextElement.textContent = subtext;
            subtextElement.style.display = 'block';
        } else if (subtextElement) {
            subtextElement.style.display = 'none';
        }
        
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    /**
     * Hide loading overlay
     */
    hide() {
        if (!this.overlay) return;
        
        this.overlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll
    }

    /**
     * Show loading for a specific duration
     * @param {number} duration - Duration in milliseconds
     * @param {string} message - Loading message
     */
    showFor(duration, message = 'Processing') {
        this.show(message);
        setTimeout(() => this.hide(), duration);
    }

    /**
     * Add loading state to a specific button
     * @param {HTMLElement} button - Button element
     * @param {string} originalText - Store original button text
     */
    buttonLoading(button, originalText = null) {
        if (!button) return;
        
        if (!originalText) {
            button.dataset.originalText = button.innerHTML;
        }
        button.classList.add('btn-loading');
        button.disabled = true;
        button.innerHTML = '<span style="visibility: hidden;">' + (originalText || button.textContent) + '</span>';
    }

    /**
     * Remove loading state from button
     * @param {HTMLElement} button - Button element
     */
    buttonReset(button) {
        if (!button) return;
        
        button.classList.remove('btn-loading');
        button.disabled = false;
        
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }

    /**
     * Create inline spinner for specific elements
     * @returns {HTMLElement} - Spinner element
     */
    createInlineSpinner() {
        const spinner = document.createElement('span');
        spinner.className = 'spinner-small';
        return spinner;
    }
}

// Global loading instance
window.loading = new LoadingManager();

/**
 * Wrapper for fetch with automatic loading
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {string} loadingMessage - Custom loading message
 */
window.fetchWithLoading = async function(url, options = {}, loadingMessage = 'Loading data') {
    try {
        window.loading.show(loadingMessage, 'Connecting to server...');
        const response = await fetch(url, options);
        window.loading.hide();
        return response;
    } catch (error) {
        window.loading.hide();
        throw error;
    }
};

/**
 * Enhanced form submission with loading
 * @param {HTMLFormElement} form - Form element
 * @param {Function} submitHandler - Async submit function
 */
window.submitFormWithLoading = async function(form, submitHandler) {
    const submitButton = form.querySelector('button[type="submit"]');
    
    try {
        if (submitButton) {
            window.loading.buttonLoading(submitButton);
        }
        
        await submitHandler();
        
        if (submitButton) {
            window.loading.buttonReset(submitButton);
        }
    } catch (error) {
        if (submitButton) {
            window.loading.buttonReset(submitButton);
        }
        throw error;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingManager;
}
