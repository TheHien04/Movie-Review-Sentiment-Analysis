/* ========================================
   SHARED JAVASCRIPT UTILITIES
   ======================================== */

/**
 * Initialize the navbar and set active link based on current page
 */
function initNavbar() {
  const currentPath = window.location.pathname;
  const currentFile = currentPath.split('/').pop() || 'index.html';
  
  const navLinks = document.querySelectorAll('.navbar-links a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentFile || (currentFile === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Show loading spinner on a button
 * @param {HTMLElement} button - The button element
 */
function setButtonLoading(button) {
  if (!button) return;
  button.disabled = true;
  button.classList.add('btn-loading');
  const originalHTML = button.innerHTML;
  button.dataset.originalHTML = originalHTML;
}

/**
 * Remove loading spinner from a button
 * @param {HTMLElement} button - The button element
 */
function setButtonIdle(button) {
  if (!button) return;
  button.disabled = false;
  button.classList.remove('btn-loading');
  if (button.dataset.originalHTML) {
    button.innerHTML = button.dataset.originalHTML;
  }
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `alert-toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slide-out 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Create a skeleton loader element
 * @param {string} type - Type: 'text', 'card', 'line', 'heading', 'row'
 * @param {number} count - Number of elements to create
 * @returns {HTMLElement}
 */
function createSkeletonLoader(type = 'text', count = 1) {
  const container = document.createElement('div');
  
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    
    switch (type) {
      case 'text':
        skeleton.className = 'skeleton skeleton-text';
        break;
      case 'heading':
        skeleton.className = 'skeleton skeleton-heading';
        break;
      case 'card':
        skeleton.className = 'skeleton skeleton-card';
        break;
      case 'line':
        skeleton.className = 'skeleton skeleton-line';
        break;
      case 'row':
        skeleton.className = 'skeleton skeleton-row';
        for (let j = 0; j < 4; j++) {
          const item = document.createElement('div');
          item.className = 'skeleton skeleton-row-item';
          skeleton.appendChild(item);
        }
        break;
      default:
        skeleton.className = 'skeleton skeleton-text';
    }
    
    container.appendChild(skeleton);
  }
  
  return container;
}

/**
 * Fetch data from API with error handling
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise}
 */
async function fetchAPI(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Format a number as percentage
 * @param {number} value - The value
 * @param {number} decimals - Decimal places
 * @returns {string}
 */
function formatPercent(value, decimals = 2) {
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format a number with thousand separators
 * @param {number} value - The value
 * @returns {string}
 */
function formatNumber(value) {
  return value.toLocaleString();
}

/**
 * Truncate text to a maximum length
 * @param {string} text - The text
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Check if it's a mobile device
 * @returns {boolean}
 */
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Add smooth scroll behavior
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Initialize tooltip (requires Bootstrap or custom tooltip)
 */
function initTooltips() {
  const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltips.forEach(tooltip => {
    new tooltip.constructor(tooltip);
  });
}

/**
 * Handle API errors gracefully
 * @param {Error} error - The error object
 */
function handleAPIError(error) {
  console.error('Error:', error);
  
  let message = 'An error occurred. Please try again.';
  
  if (error.message) {
    if (error.message.includes('HTTP')) {
      message = `Server error: ${error.message}`;
    } else if (error.message.includes('network')) {
      message = 'Network error. Please check your connection.';
    }
  }
  
  showToast(message, 'error');
}

/**
 * Initialize the page (call on page load)
 */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSmoothScroll();
});
