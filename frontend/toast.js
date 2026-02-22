/**
 * Toast Notification System
 * Beautiful notifications with success, error, warning, and info types
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 5000;
        this.init();
    }

    /**
     * Initialize toast container
     */
    init() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    /**
     * Show a toast notification
     * @param {object} options - Toast configuration
     * @returns {string} - Toast ID
     */
    show(options = {}) {
        const {
            type = 'info',
            title = '',
            message = '',
            duration = this.defaultDuration,
            closable = true,
            action = null
        } = options;

        // Remove oldest toast if max reached
        if (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0].id);
        }

        const toast = this.createToast(type, title, message, closable, action);
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        toast.id = id;
        this.container.appendChild(toast);
        this.toasts.push({ id, element: toast });

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }

        return id;
    }

    /**
     * Create toast element
     */
    createToast(type, title, message, closable, action) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : ''}
                ${message ? `<div class="toast-message">${this.escapeHtml(message)}</div>` : ''}
                ${action ? `
                    <div class="toast-action">
                        <button class="toast-action-btn" data-action="${action.id}">${action.label}</button>
                    </div>
                ` : ''}
            </div>
            ${closable ? '<button class="toast-close" aria-label="Close">×</button>' : ''}
            <div class="toast-progress"></div>
        `;

        // Close button handler
        if (closable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.remove(toast.id);
            });
        }

        // Action button handler
        if (action) {
            const actionBtn = toast.querySelector('.toast-action-btn');
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (action.onClick) {
                    action.onClick();
                }
                this.remove(toast.id);
            });
        }

        // Click to dismiss
        toast.addEventListener('click', () => {
            if (closable && !action) {
                this.remove(toast.id);
            }
        });

        return toast;
    }

    /**
     * Remove toast by ID
     * @param {string} id - Toast ID
     */
    remove(id) {
        const toastObj = this.toasts.find(t => t.id === id);
        if (!toastObj) return;

        toastObj.element.classList.remove('show');
        toastObj.element.classList.add('hide');

        setTimeout(() => {
            if (toastObj.element.parentNode) {
                toastObj.element.parentNode.removeChild(toastObj.element);
            }
            this.toasts = this.toasts.filter(t => t.id !== id);
        }, 400);
    }

    /**
     * Remove all toasts
     */
    clear() {
        this.toasts.forEach(toast => this.remove(toast.id));
    }

    /**
     * Success toast shorthand
     */
    success(title, message = '', duration) {
        return this.show({ type: 'success', title, message, duration });
    }

    /**
     * Error toast shorthand
     */
    error(title, message = '', duration) {
        return this.show({ type: 'error', title, message, duration });
    }

    /**
     * Warning toast shorthand
     */
    warning(title, message = '', duration) {
        return this.show({ type: 'warning', title, message, duration });
    }

    /**
     * Info toast shorthand
     */
    info(title, message = '', duration) {
        return this.show({ type: 'info', title, message, duration });
    }

    /**
     * Promise-based toast (for async operations)
     * @param {Promise} promise - Promise to track
     * @param {object} messages - Success, error, and pending messages
     */
    async promise(promise, messages = {}) {
        const {
            pending = 'Loading...',
            success = 'Success!',
            error = 'Error occurred'
        } = messages;

        const pendingId = this.info(pending, '', 0);

        try {
            const result = await promise;
            this.remove(pendingId);
            this.success(success);
            return result;
        } catch (err) {
            this.remove(pendingId);
            this.error(error, err.message);
            throw err;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global toast instance
window.toast = new ToastManager();

// Backward compatibility with console methods
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

// Optional: Toast console overrides (commented out by default)
/*
console.toastLog = function(...args) {
    originalConsole.log.apply(console, args);
    window.toast.info('Log', args.join(' '));
};

console.toastError = function(...args) {
    originalConsole.error.apply(console, args);
    window.toast.error('Error', args.join(' '));
};

console.toastWarn = function(...args) {
    originalConsole.warn.apply(console, args);
    window.toast.warning('Warning', args.join(' '));
};
*/

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastManager;
}
