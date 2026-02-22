/* ========================================
   PREMIUM UI UTILITIES
   Toast, Particles, Counters, Loaders
======================================== */

// Toast Notification System
const Toast = {
  container: null,
  
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  
  show(message, type = 'info', duration = 3000) {
    this.init();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} fade-in`;
    
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    };
    
    const titles = {
      success: 'Success',
      error: 'Error',
      info: 'Info',
      warning: 'Warning'
    };
    
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <div class="toast-title">${titles[type] || titles.info}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="Toast.remove(this.parentElement)">×</button>
    `;
    
    this.container.appendChild(toast);
    
    if (duration > 0) {
      setTimeout(() => this.remove(toast), duration);
    }
    
    return toast;
  },
  
  remove(toast) {
    if (!toast) return;
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  },
  
  success(message, duration) {
    return this.show(message, 'success', duration);
  },
  
  error(message, duration) {
    return this.show(message, 'error', duration);
  },
  
  info(message, duration) {
    return this.show(message, 'info', duration);
  },
  
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }
};

// Particle System
const Particles = {
  create(count = 50) {
    const container = document.createElement('div');
    container.className = 'particles';
    
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Random size
      const size = Math.random() * 4 + 2;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      // Random starting position
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.bottom = `-${size}px`;
      
      // Random animation delay
      particle.style.animationDelay = `${Math.random() * 15}s`;
      particle.style.animationDuration = `${Math.random() * 10 + 10}s`;
      
      // Random opacity
      particle.style.opacity = Math.random() * 0.3 + 0.2;
      
      container.appendChild(particle);
    }
    
    document.body.insertBefore(container, document.body.firstChild);
    return container;
  }
};

// Animated Counter
function animateCounter(element, target, duration = 2000) {
  const start = parseFloat(element.textContent) || 0;
  const increment = (target - start) / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
      element.textContent = target.toFixed(target % 1 === 0 ? 0 : 2);
      clearInterval(timer);
    } else {
      element.textContent = current.toFixed(target % 1 === 0 ? 0 : 2);
    }
  }, 16);
}

// Loading Skeleton
function showSkeleton(container, type = 'text', count = 3) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton-${type}`;
    container.appendChild(skeleton);
  }
}

// Loading Spinner
function createSpinner(size = 'normal') {
  const spinner = document.createElement('div');
  spinner.className = `spinner ${size === 'small' ? 'spinner-small' : ''}`;
  return spinner;
}

// Smooth Scroll
function smoothScroll(target, duration = 800) {
  const targetElement = typeof target === 'string' ? document.querySelector(target) : target;
  if (!targetElement) return;
  
  const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;
  
  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }
  
  function ease(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  }
  
  requestAnimationFrame(animation);
}

// Debounce function
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    Toast.success('Copied to clipboard!');
  } catch (err) {
    Toast.error('Failed to copy');
  }
}

// Export data as JSON
function exportJSON(data, filename = 'data.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  Toast.success(`Exported ${filename}`);
}

// Export data as CSV
function exportCSV(data, filename = 'data.csv') {
  if (!data || !data.length) {
    Toast.error('No data to export');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  Toast.success(`Exported ${filename}`);
}

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Truncate text
function truncate(text, length = 100) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

// Initialize premium effects on page load
document.addEventListener('DOMContentLoaded', () => {
  // Create particles
  Particles.create(40);
  
  // Initialize scroll buttons
  ScrollButtons.init();
  
  // Add fade-in to main sections
  document.querySelectorAll('section, .card').forEach((el, i) => {
    el.style.opacity = '0';
    setTimeout(() => {
      el.classList.add('fade-in');
      el.style.opacity = '1';
    }, i * 100);
  });
  
  // Add tooltips to elements with data-tooltip attribute
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.classList.add('tooltip');
  });
});

// Global error handler
window.addEventListener('error', (e) => {
  console.error('Global error:', e);
});

// Scroll Buttons System
const ScrollButtons = {
  buttons: null,
  scrollTopBtn: null,
  scrollBottomBtn: null,
  throttleTimer: null,
  
  init() {
    if (this.buttons) return; // Already initialized
    
    // Create buttons container
    this.buttons = document.createElement('div');
    this.buttons.className = 'scroll-buttons';
    
    // Create scroll to top button
    this.scrollTopBtn = document.createElement('button');
    this.scrollTopBtn.className = 'scroll-btn scroll-top-btn';
    this.scrollTopBtn.innerHTML = '↑';
    this.scrollTopBtn.setAttribute('aria-label', 'Scroll to top');
    this.scrollTopBtn.setAttribute('title', 'Lên đầu trang');
    this.scrollTopBtn.onclick = () => this.scrollToTop();
    
    // Create scroll to bottom button
    this.scrollBottomBtn = document.createElement('button');
    this.scrollBottomBtn.className = 'scroll-btn scroll-bottom-btn';
    this.scrollBottomBtn.innerHTML = '↓';
    this.scrollBottomBtn.setAttribute('aria-label', 'Scroll to bottom');
    this.scrollBottomBtn.setAttribute('title', 'Xuống cuối trang');
    this.scrollBottomBtn.onclick = () => this.scrollToBottom();
    
    this.buttons.appendChild(this.scrollTopBtn);
    this.buttons.appendChild(this.scrollBottomBtn);
    document.body.appendChild(this.buttons);
    
    // Show/hide on scroll with throttle
    window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    
    // Initial check
    this.handleScroll();
  },
  
  handleScroll() {
    // Throttle scroll event
    if (this.throttleTimer) return;
    
    this.throttleTimer = setTimeout(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;
      
      // Show scroll-to-top if scrolled down more than 300px
      if (scrollTop > 300) {
        this.scrollTopBtn.classList.add('visible');
      } else {
        this.scrollTopBtn.classList.remove('visible');
      }
      
      // Show scroll-to-bottom if not at bottom (more than 300px from bottom)
      if (scrollBottom > 300) {
        this.scrollBottomBtn.classList.add('visible');
      } else {
        this.scrollBottomBtn.classList.remove('visible');
      }
      
      this.throttleTimer = null;
    }, 100);
  },
  
  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  },
  
  scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  },
  
  destroy() {
    if (this.buttons && this.buttons.parentNode) {
      this.buttons.parentNode.removeChild(this.buttons);
      this.buttons = null;
      this.scrollTopBtn = null;
      this.scrollBottomBtn = null;
    }
  }
};

// Export utilities
window.Toast = Toast;
window.Particles = Particles;
window.ScrollButtons = ScrollButtons;
window.animateCounter = animateCounter;
window.showSkeleton = showSkeleton;
window.createSpinner = createSpinner;
window.smoothScroll = smoothScroll;
window.debounce = debounce;
window.copyToClipboard = copyToClipboard;
window.exportJSON = exportJSON;
window.exportCSV = exportCSV;
window.formatNumber = formatNumber;
window.truncate = truncate;
