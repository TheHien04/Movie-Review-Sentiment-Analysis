/**
 * Enhanced Input Validation
 * Real-time validation with character counter, word counter, and feedback
 */

class ValidationManager {
    constructor() {
        this.validators = new Map();
        this.rules = {
            minLength: 10,
            maxLength: 1000,
            minWords: 3,
            pattern: null // optional regex
        };
    }

    /**
     * Initialize validation for an input element
     * @param {string|HTMLElement} input - Input element or selector
     * @param {object} options - Validation options
     */
    init(input, options = {}) {
        const element = typeof input === 'string' 
            ? document.querySelector(input)
            : input;

        if (!element) {
            console.error('Input element not found');
            return;
        }

        const config = {
            ...this.rules,
            ...options,
            showCharCounter: options.showCharCounter !== false,
            showWordCounter: options.showWordCounter !== false,
            showStrength: options.showStrength || false,
            realtime: options.realtime !== false,
            suggestions: options.suggestions || []
        };

        this.validators.set(element, config);
        this.setupElement(element, config);
        this.attachEvents(element, config);
    }

    /**
     * Setup validation UI elements
     */
    setupElement(element, config) {
        const wrapper = element.parentElement;
        if (!wrapper.classList.contains('input-wrapper')) {
            const newWrapper = document.createElement('div');
            newWrapper.className = 'input-wrapper';
            element.parentNode.insertBefore(newWrapper, element);
            newWrapper.appendChild(element);
        }

        const parent = element.closest('.input-wrapper') || element.parentElement;

        // Character counter
        if (config.showCharCounter && !parent.querySelector('.char-counter')) {
            const counter = document.createElement('div');
            counter.className = 'char-counter';
            counter.textContent = `0 / ${config.maxLength}`;
            parent.appendChild(counter);
        }

        // Word counter
        if (config.showWordCounter && !parent.querySelector('.word-counter')) {
            const wordCounter = document.createElement('div');
            wordCounter.className = 'word-counter';
            wordCounter.innerHTML = '📝 <span class="word-count">0</span> words';
            element.parentNode.insertBefore(wordCounter, element.nextSibling);
        }

        // Validation message
        if (!parent.querySelector('.validation-message')) {
            const message = document.createElement('div');
            message.className = 'validation-message';
            parent.appendChild(message);
        }

        // Input strength
        if (config.showStrength && !parent.querySelector('.input-strength')) {
            const strength = document.createElement('div');
            strength.className = 'input-strength';
            strength.innerHTML = '<div class="input-strength-bar"></div>';
            parent.appendChild(strength);
        }

        // Suggestions dropdown
        if (config.suggestions.length > 0 && !parent.querySelector('.suggestions-dropdown')) {
            const dropdown = document.createElement('div');
            dropdown.className = 'suggestions-dropdown';
            parent.appendChild(dropdown);
        }
    }

    /**
     * Attach event listeners
     */
    attachEvents(element, config) {
        // Real-time validation
        if (config.realtime) {
            element.addEventListener('input', () => this.validateElement(element));
            element.addEventListener('blur', () => this.validateElement(element, true));
        }

        // Update counters
        element.addEventListener('input', () => this.updateCounters(element));

        // Suggestions
        if (config.suggestions.length > 0) {
            element.addEventListener('focus', () => this.showSuggestions(element));
            element.addEventListener('input', () => this.filterSuggestions(element));
            document.addEventListener('click', (e) => {
                if (!element.contains(e.target)) {
                    this.hideSuggestions(element);
                }
            });
        }
    }

    /**
     * Validate element
     * @param {HTMLElement} element - Input element
     * @param {boolean} showAll - Show all validation messages
     */
    validateElement(element, showAll = false) {
        const config = this.validators.get(element);
        if (!config) return true;

        const value = element.value.trim();
        const errors = [];
        const warnings = [];

        // Empty check
        if (!value) {
            if (showAll) {
                this.showMessage(element, 'Please enter some text', 'error');
            }
            element.classList.remove('valid', 'warning');
            element.classList.add('invalid');
            return false;
        }

        // Length validation
        if (value.length < config.minLength) {
            errors.push(`Minimum ${config.minLength} characters required`);
        }

        if (value.length > config.maxLength) {
            errors.push(`Maximum ${config.maxLength} characters exceeded`);
        }

        // Word count validation
        const words = this.countWords(value);
        if (words < config.minWords) {
            errors.push(`Minimum ${config.minWords} words required`);
        }

        // Pattern validation
        if (config.pattern && !config.pattern.test(value)) {
            errors.push('Invalid format');
        }

        // Quality checks (warnings)
        if (value.length < 50) {
            warnings.push('Consider adding more detail for better analysis');
        }

        if (words < 10) {
            warnings.push('Short reviews may have lower accuracy');
        }

        // Display results
        if (errors.length > 0) {
            this.showMessage(element, errors[0], 'error');
            element.classList.remove('valid', 'warning');
            element.classList.add('invalid');
            return false;
        } else if (warnings.length > 0 && showAll) {
            this.showMessage(element, warnings[0], 'warning');
            element.classList.remove('valid', 'invalid');
            element.classList.add('warning');
            return true;
        } else {
            if (showAll || value.length >= config.minLength) {
                this.showMessage(element, 'Looks good!', 'success');
            }
            element.classList.remove('invalid', 'warning');
            element.classList.add('valid');
            return true;
        }
    }

    /**
     * Update character and word counters
     */
    updateCounters(element) {
        const config = this.validators.get(element);
        if (!config) return;

        const parent = element.closest('.input-wrapper') || element.parentElement;
        const value = element.value;
        const length = value.length;

        // Update character counter
        if (config.showCharCounter) {
            const counter = parent.querySelector('.char-counter');
            if (counter) {
                counter.textContent = `${length} / ${config.maxLength}`;
                
                counter.classList.remove('warning', 'error');
                if (length > config.maxLength * 0.9) {
                    counter.classList.add('warning');
                }
                if (length >= config.maxLength) {
                    counter.classList.add('error');
                }
            }
        }

        // Update word counter
        if (config.showWordCounter) {
            const wordCounter = parent.querySelector('.word-count');
            if (wordCounter) {
                wordCounter.textContent = this.countWords(value);
            }
        }

        // Update strength indicator
        if (config.showStrength) {
            this.updateStrength(element, value);
        }
    }

    /**
     * Update input strength indicator
     */
    updateStrength(element, value) {
        const parent = element.closest('.input-wrapper') || element.parentElement;
        const strengthBar = parent.querySelector('.input-strength-bar');
        if (!strengthBar) return;

        const length = value.length;
        const words = this.countWords(value);
        
        let strength = 0;
        if (length >= 100 && words >= 10) strength = 3; // strong
        else if (length >= 50 && words >= 5) strength = 2; // medium
        else if (length >= 20) strength = 1; // weak

        strengthBar.className = 'input-strength-bar';
        if (strength === 1) strengthBar.classList.add('weak');
        else if (strength === 2) strengthBar.classList.add('medium');
        else if (strength === 3) strengthBar.classList.add('strong');
    }

    /**
     * Show validation message
     */
    showMessage(element, message, type = 'info') {
        const parent = element.closest('.input-wrapper') || element.parentElement;
        const messageEl = parent.querySelector('.validation-message');
        if (!messageEl) return;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        messageEl.className = `validation-message ${type} show`;
        messageEl.innerHTML = `
            <span class="validation-icon">${icons[type]}</span>
            <span>${message}</span>
        `;

        // Auto hide success messages
        if (type === 'success') {
            setTimeout(() => {
                messageEl.classList.remove('show');
            }, 3000);
        }
    }

    /**
     * Hide validation message
     */
    hideMessage(element) {
        const parent = element.closest('.input-wrapper') || element.parentElement;
        const messageEl = parent.querySelector('.validation-message');
        if (messageEl) {
            messageEl.classList.remove('show');
        }
    }

    /**
     * Show suggestions dropdown
     */
    showSuggestions(element) {
        const config = this.validators.get(element);
        if (!config || !config.suggestions.length) return;

        const parent = element.closest('.input-wrapper') || element.parentElement;
        const dropdown = parent.querySelector('.suggestions-dropdown');
        if (!dropdown) return;

        dropdown.innerHTML = config.suggestions
            .map(s => `<div class="suggestion-item">${s}</div>`)
            .join('');

        dropdown.classList.add('show');

        // Handle clicks
        dropdown.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                element.value = item.textContent;
                this.hideSuggestions(element);
                this.validateElement(element);
                this.updateCounters(element);
            });
        });
    }

    /**
     * Filter suggestions based on input
     */
    filterSuggestions(element) {
        const config = this.validators.get(element);
        if (!config || !config.suggestions.length) return;

        const parent = element.closest('.input-wrapper') || element.parentElement;
        const dropdown = parent.querySelector('.suggestions-dropdown');
        if (!dropdown) return;

        const value = element.value.toLowerCase();
        const filtered = config.suggestions.filter(s => 
            s.toLowerCase().includes(value)
        );

        if (filtered.length === 0 || value.length < 2) {
            this.hideSuggestions(element);
            return;
        }

        dropdown.innerHTML = filtered
            .map(s => `<div class="suggestion-item">${s}</div>`)
            .join('');

        dropdown.classList.add('show');
    }

    /**
     * Hide suggestions dropdown
     */
    hideSuggestions(element) {
        const parent = element.closest('.input-wrapper') || element.parentElement;
        const dropdown = parent.querySelector('.suggestions-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    /**
     * Count words in text
     */
    countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Get validation status
     * @param {HTMLElement} element - Input element
     */
    isValid(element) {
        return this.validateElement(element, true);
    }

    /**
     * Clear validation
     */
    clear(element) {
        element.classList.remove('valid', 'invalid', 'warning');
        this.hideMessage(element);
        
        const parent = element.closest('.input-wrapper') || element.parentElement;
        const counter = parent.querySelector('.char-counter');
        if (counter) {
            const config = this.validators.get(element);
            counter.textContent = `0 / ${config.maxLength}`;
            counter.classList.remove('warning', 'error');
        }
    }
}

// Global validation manager
window.validationManager = new ValidationManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationManager;
}
