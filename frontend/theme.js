/* ============================================
   THEME SYSTEM - Dark Mode & Visual Enhancements
   ============================================ */

class ThemeManager {
  constructor() {
    this.currentTheme = this.getSavedTheme();
    this.initTheme();
    this.createToggleButton();
  }

  // Get saved theme from localStorage
  getSavedTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
      return saved;
    }
    // Auto-detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  // Initialize theme
  initTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
  }

  // Toggle between light and dark
  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
    this.updateToggleButton();
    this.animateTransition();
  }

  // Create floating toggle button
  createToggleButton() {
    const button = document.createElement('button');
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Toggle dark mode');
    button.innerHTML = `
      <span class="icon">${this.currentTheme === 'light' ? '🌙' : '☀️'}</span>
      <span class="text">${this.currentTheme === 'light' ? 'Dark' : 'Light'}</span>
    `;
    button.onclick = () => this.toggleTheme();
    document.body.appendChild(button);
  }

  // Update toggle button appearance
  updateToggleButton() {
    const button = document.querySelector('.theme-toggle');
    if (button) {
      button.innerHTML = `
        <span class="icon">${this.currentTheme === 'light' ? '🌙' : '☀️'}</span>
        <span class="text">${this.currentTheme === 'light' ? 'Dark' : 'Light'}</span>
      `;
    }
  }

  // Smooth transition animation
  animateTransition() {
    document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
      document.documentElement.style.transition = '';
    }, 300);
  }
}

/* ============================================
   CONFIDENCE GRADIENT VISUALIZER
   ============================================ */

class ConfidenceVisualizer {
  constructor() {
    this.colors = {
      negative: { r: 239, g: 68, b: 68 },      // Red
      neutral: { r: 148, g: 163, b: 184 },     // Gray
      positive: { r: 123, g: 92, b: 255 }      // Purple
    };
  }

  // Create gradient bar with indicator
  createGradient(containerId, confidence, sentiment) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Create gradient bar
    const gradientBar = document.createElement('div');
    gradientBar.className = 'confidence-gradient';

    // Create indicator
    const indicator = document.createElement('div');
    indicator.className = 'confidence-indicator';
    
    // Calculate position (0-100%)
    const position = confidence * 100;
    indicator.style.left = `calc(${position}% - 7px)`;

    // Get color based on sentiment and confidence
    const color = this.getColorForConfidence(confidence, sentiment);
    indicator.style.borderColor = color;

    gradientBar.appendChild(indicator);

    // Create labels
    const labels = document.createElement('div');
    labels.className = 'confidence-label';
    labels.innerHTML = `
      <span>😢 Negative</span>
      <span>😐 Neutral</span>
      <span>😊 Positive</span>
    `;

    // Clear and append
    container.innerHTML = '';
    container.appendChild(gradientBar);
    container.appendChild(labels);

    // Animate indicator
    setTimeout(() => {
      indicator.style.transform = 'scale(1.2)';
      setTimeout(() => {
        indicator.style.transform = 'scale(1)';
      }, 300);
    }, 100);
  }

  // Get interpolated color
  getColorForConfidence(confidence, sentiment) {
    let color;
    
    if (confidence < 0.5) {
      // Interpolate between negative and neutral
      const t = confidence * 2; // 0 to 1
      color = this.interpolateColor(this.colors.negative, this.colors.neutral, t);
    } else {
      // Interpolate between neutral and positive
      const t = (confidence - 0.5) * 2; // 0 to 1
      color = this.interpolateColor(this.colors.neutral, this.colors.positive, t);
    }

    return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
  }

  // Linear interpolation between two colors
  interpolateColor(color1, color2, t) {
    return {
      r: color1.r + (color2.r - color1.r) * t,
      g: color1.g + (color2.g - color1.g) * t,
      b: color1.b + (color2.b - color1.b) * t
    };
  }

  // Get sentiment class name
  getSentimentClass(confidence, sentiment) {
    if (confidence < 0.4) return 'sentiment-negative';
    if (confidence < 0.6) return 'sentiment-neutral';
    return 'sentiment-positive';
  }

  // Format confidence percentage with color
  formatConfidence(confidence, sentiment) {
    const percentage = (confidence * 100).toFixed(1);
    const className = this.getSentimentClass(confidence, sentiment);
    return `<span class="${className}">${percentage}%</span>`;
  }
}

/* ============================================
   KEYBOARD SHORTCUTS SYSTEM
   ============================================ */

class KeyboardShortcuts {
  constructor() {
    this.shortcuts = {
      'ctrl+enter': { action: 'analyze', description: 'Analyze review' },
      'ctrl+k': { action: 'clear', description: 'Clear input' },
      'ctrl+e': { action: 'export', description: 'Export results' },
      'ctrl+h': { action: 'history', description: 'View history' },
      'ctrl+/': { action: 'help', description: 'Show shortcuts' },
      'escape': { action: 'close', description: 'Close modal' }
    };
    this.handlers = {};
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    this.createHelpButton();
  }

  // Handle key press events
  handleKeyPress(e) {
    const key = this.getKeyCombo(e);
    const shortcut = this.shortcuts[key];

    if (shortcut && this.handlers[shortcut.action]) {
      e.preventDefault();
      this.handlers[shortcut.action]();
    }
  }

  // Get key combination string
  getKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    
    const key = e.key.toLowerCase();
    if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
      parts.push(key);
    }

    return parts.join('+');
  }

  // Register action handler
  register(action, handler) {
    this.handlers[action] = handler;
  }

  // Create help button
  createHelpButton() {
    const button = document.createElement('button');
    button.className = 'btn btn-sm btn-soft position-fixed';
    button.style.cssText = 'bottom: 20px; right: 20px; z-index: 999; border-radius: 50%; width: 40px; height: 40px;';
    button.innerHTML = '?';
    button.setAttribute('aria-label', 'Keyboard shortcuts');
    button.onclick = () => this.showHelp();
    document.body.appendChild(button);
  }

  // Show shortcuts help modal
  showHelp() {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="background: var(--bg-card); color: var(--text-primary);">
          <div class="modal-header" style="border-color: var(--border-color);">
            <h5 class="modal-title">⚡ Keyboard Shortcuts</h5>
            <button type="button" class="btn-close" onclick="this.closest('.modal').remove()"></button>
          </div>
          <div class="modal-body">
            <table class="table table-sm">
              <tbody>
                ${Object.entries(this.shortcuts).map(([key, data]) => `
                  <tr>
                    <td><kbd>${key.replace('ctrl', '⌘/Ctrl')}</kbd></td>
                    <td>${data.description}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    // Close on click outside
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
  }
}

/* ============================================
   SENTIMENT HISTORY TRACKER
   ============================================ */

class SentimentHistory {
  constructor(maxItems = 50) {
    this.maxItems = maxItems;
    this.storageKey = 'sentiment_history';
  }

  // Add item to history
  add(text, sentiment, confidence) {
    const history = this.getAll();
    const item = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      fullText: text,
      sentiment: sentiment,
      confidence: confidence
    };

    history.unshift(item); // Add to beginning
    
    // Keep only max items
    if (history.length > this.maxItems) {
      history.splice(this.maxItems);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(history));
    return item;
  }

  // Get all history
  getAll() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  // Get statistics
  getStats() {
    const history = this.getAll();
    const total = history.length;
    const positive = history.filter(h => h.sentiment === 1).length;
    const negative = total - positive;
    const avgConfidence = total > 0 
      ? history.reduce((sum, h) => sum + h.confidence, 0) / total 
      : 0;

    return { total, positive, negative, avgConfidence };
  }

  // Delete item
  delete(id) {
    const history = this.getAll().filter(item => item.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(history));
  }

  // Clear all
  clear() {
    localStorage.removeItem(this.storageKey);
  }

  // Export to CSV
  exportCSV() {
    const history = this.getAll();
    if (history.length === 0) {
      alert('No history to export!');
      return;
    }

    const csv = [
      ['Timestamp', 'Text', 'Sentiment', 'Confidence'],
      ...history.map(h => [
        h.timestamp,
        `"${h.fullText.replace(/"/g, '""')}"`,
        h.sentiment === 1 ? 'Positive' : 'Negative',
        h.confidence.toFixed(4)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentiment-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/* ============================================
   INITIALIZE ON PAGE LOAD
   ============================================ */

// Global instances
let themeManager;
let confidenceVisualizer;
let keyboardShortcuts;
let sentimentHistory;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme system
  themeManager = new ThemeManager();
  
  // Initialize other systems
  confidenceVisualizer = new ConfidenceVisualizer();
  keyboardShortcuts = new KeyboardShortcuts();
  sentimentHistory = new SentimentHistory();

  console.log('✨ Enhanced features loaded: Dark Mode, Confidence Gradient, Shortcuts, History');
});
