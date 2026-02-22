# Advanced Features v4.0 - Complete Guide

This document provides comprehensive documentation for all advanced features added in version 4.0 of the Movie Review Sentiment Analysis platform.

## 🧠 Explainable AI - Word Importance Heatmap

### Overview
The Explainable AI feature provides transparency into how the model makes predictions by visualizing which words contribute most to the sentiment classification.

### Features
- **Color-Coded Words**: Words are highlighted with colors indicating their contribution
  - **Green**: Positive sentiment words
  - **Red**: Negative sentiment words
  - **Gray**: Neutral words
- **Importance Scoring**: Each word gets an importance score (0-100%)
- **Interactive Hover**: Hover over words to see detailed contribution info
- **AI Insights**: Automatically generated explanations of the prediction
- **Visual Weight**: More important words have bolder text and borders

### Technical Implementation
- **File**: `frontend/explainable-ai.js`
- **Algorithm**: Heuristic-based word importance (configurable for model attention weights)
- **Visualization**: Dynamic HTML/CSS rendering with gradient backgrounds
- **Integration**: Automatically shown after sentiment analysis

### How to Use
1. Enter a movie review and click "Analyze Sentiment"
2. Scroll down to see the "Word Importance Analysis" section
3. Observe color-coded words:
   - Darker colors = higher importance
   - Bordered words = critical for prediction
4. Read the "Key Insights" section for explanation

### Example
Input: "This movie was absolutely amazing but the ending was terrible"

Output:
- "amazing" → Strong green (positive contributor)
- "terrible" → Strong red (negative contributor)
- "absolutely" → Medium importance (intensifier)
- Insight: "Model detected 1 strong positive and 1 strong negative indicator"

### API
```javascript
// Initialize
window.explainableAI.init('container-id');

// Render explanation
window.explainableAI.render(text, sentiment, confidence);

// Clear
window.explainableAI.clear();
```

---

## 🎤 Real-time Voice Input

### Overview
Speech-to-text functionality with real-time audio waveform visualization, allowing hands-free review input.

### Features
- **Web Speech API**: Browser-native speech recognition
- **Real-time Transcription**: See text as you speak
- **Waveform Visualization**: Beautiful animated audio visualization
- **Multiple Styles**: Bar chart or circular waveform options
- **Continuous Recording**: Keeps listening until you stop
- **Error Handling**: Graceful fallbacks and user notifications

### Technical Implementation
- **File**: `frontend/voice-input.js`
- **Technologies**: 
  - Web Speech API (SpeechRecognition)
  - Web Audio API (AudioContext)
  - HTML5 Canvas for visualization
- **Browser Support**: Chrome, Edge, Safari (iOS 15+)
- **Visualization**: 60fps canvas animation with gradient colors

### How to Use
1. Click the **🎤 Voice** button next to the textarea
2. Grant microphone permission when prompted
3. Start speaking your movie review
4. Watch the waveform animate as you speak
5. Your speech appears as text in real-time
6. Click "Stop Recording" when done
7. Edit the text if needed, then analyze

### Keyboard Shortcut
- Click voice button again to stop (or use Stop button)

### API
```javascript
// Initialize
const voiceInput = new VoiceInput();

// Set callbacks
voiceInput.setOnResult((result) => {
    console.log('Final:', result.final);
    console.log('Interim:', result.interim);
});

voiceInput.setOnError((error) => {
    console.error('Error:', error);
});

// Start recording with visualization
await voiceInput.start(canvasElement, 'bars'); // or 'circular'

// Stop recording
voiceInput.stop();

// Check status
const isActive = voiceInput.isActive();

// Cleanup
voiceInput.destroy();
```

### Troubleshooting
- **No microphone access**: Check browser permissions
- **Not working**: Use Chrome/Edge (best support)
- **Poor recognition**: Speak clearly, reduce background noise
- **Language**: Currently supports English (en-US)

---

## 📱 Social Share Integration

### Overview
Share sentiment analysis results on social media platforms with beautiful pre-formatted messages and Open Graph cards.

### Features
- **Multiple Platforms**: Twitter, Facebook, LinkedIn, Email
- **Copy Link**: One-click URL copying with toast confirmation
- **Custom Messages**: Generated messages with sentiment and confidence
- **Open Graph Tags**: Beautiful preview cards when sharing
- **Responsive Design**: Works on all screen sizes
- **Visual Feedback**: Success toasts and hover animations

### Technical Implementation
- **File**: `frontend/social-share.js`
- **Open Graph**: Meta tags dynamically injected
- **Clipboard API**: Modern copy-to-clipboard
- **Fallback**: textarea method for older browsers

### How to Use
1. After analyzing a review, scroll to bottom
2. Find "Share this Analysis" section
3. Click your preferred platform:
   - **Twitter**: Opens tweet composer with custom hashtags
   - **Facebook**: Opens Facebook share dialog
   - **LinkedIn**: Professional sharing interface
   - **Email**: Opens email client with pre-filled subject/body
   - **Copy Link**: Copies URL to clipboard

### Share Message Format
```
I analyzed a movie review and found it POSITIVE 😊 with 87.3% confidence! 
Try it yourself at [URL]
#SentimentAnalysis #MovieReview #AI #MachineLearning
```

### API
```javascript
// Set result
window.socialShare.setResult(text, sentiment, confidence, label);

// Share on platforms
window.socialShare.shareTwitter();
window.socialShare.shareFacebook();
window.socialShare.shareLinkedIn();
window.socialShare.shareEmail();

// Copy link
const success = await window.socialShare.copyLink();

// Generate share buttons HTML
const html = window.socialShare.createShareButtons();

// Update Open Graph tags
SocialShare.generateOGTags(title, description, imageUrl);
```

### Customization
Edit `social-share.js` to customize:
- Share messages
- Hashtags
- Button styles
- Open Graph tags

---

## ✨ Premium Particle Effects

### Overview
Celebratory particle animations that trigger on analysis completion, providing delightful visual feedback.

### Features
- **Multiple Effects**:
  - Success confetti (green particles)
  - Error particles (red circles)
  - Star burst (purple stars)
  - Hearts (pink hearts)
- **Physics Simulation**: Gravity, friction, velocity
- **Smooth Animation**: 60fps canvas rendering
- **Auto-cleanup**: Particles fade and自动remove
- **Performance Optimized**: RequestAnimationFrame
- **No Dependencies**: Pure JavaScript

### Technical Implementation
- **File**: `frontend/particle-effects.js`
- **Canvas Rendering**: HTML5 Canvas API
- **Particle System**: Custom Particle class with physics
- **Shapes**: Square, circle, star, heart
- **Lifecycle**: Update → Draw → Check death → Remove

### Particle Types

#### Success Confetti
```javascript
window.particles.success(x, y);
```
- **Colors**: Green spectrum (#4caf50 to #ffc107)
- **Count**: 100 particles
- **Behavior**: Shoots upward, falls with gravity
- **Use**: Positive sentiment results

#### Error Particles
```javascript
window.particles.error(x, y);
```
- **Colors**: Red spectrum (#f44336 to #c62828)
- **Count**: 80 particles
- **Behavior**: Explodes outward in all directions
- **Use**: Errors or negative results

#### Star Burst
```javascript
window.particles.starBurst(x, y);
```
- **Colors**: Purple spectrum (#9c27b0 to #e1bee7)
- **Count**: 50 star-shaped particles
- **Behavior**: Radiates outward in circular pattern
- **Use**: Special events

#### Hearts
```javascript
window.particles.hearts(x, y);
```
- **Color**: Pink (#e91e63)
- **Count**: 30 heart-shaped particles
- **Behavior**: Floats upward romantically
- **Use**: Love/positive feedback

### API
```javascript
// Success confetti
window.particles.success(x, y);

// Error effect
window.particles.error(x, y);

// Star burst
window.particles.starBurst(x, y);

// Hearts
window.particles.hearts(x, y);

// Clear all particles
window.particles.clear();
```

### Configuration
Each particle has properties:
- `x, y` - Position
- `vx, vy` - Velocity
- `gravity` - Downward acceleration (0.5)
- `friction` - Air resistance (0.98)
- `life` - Lifespan (100 frames)
- `alpha` - Opacity (fades over time)
- `color` - RGB color
- `size` - Pixel size
- `shape` - 'square', 'circle', 'star', 'heart'

---

## 📊 Enhanced Integration

### integrate-utils.js Enhancements

The `integrate-utils.js` file now orchestrates all features together:

#### Auto-Integration
- Explainable AI shows automatically after analysis
- Social share buttons appear with results
- Particle effects trigger on success/error
- Voice input button added to textarea
- All features work seamlessly together

#### Enhanced Result Rendering
```javascript
renderEnhancedResult(data, text, containerId)
```
- Renders sentiment card
- Shows explainable AI visualization
- Displays social share buttons
- Triggers particle effects
- All in one function call

#### Keyboard Shortcuts
- `Ctrl/Cmd + Enter` - Analyze review
- `Ctrl/Cmd + K` - Focus textarea
- Works globally across the page

---

## 🎯 Usage Examples

### Complete Workflow
```javascript
// 1. User enters review (or uses voice input)
document.getElementById('single-review').value = "Amazing movie!";

// 2. Click analyze button
document.getElementById('analyze-btn').click();

// 3. Enhanced integration automatically:
//    - Shows loading spinner
//    - Calls API
//    - Renders result card
//    - Shows explainable AI
//    - Displays social share buttons
//    - Triggers particle effects
//    - Adds to history
//    - Shows toast notification

// 4. User can:
//    - Read word importance analysis
//    - Share on social media
//    - Copy link
//    - View history
//    - Analyze another review
```

---

## 🔧 Technical Specifications

### Browser Compatibility
| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Explainable AI | ✅ | ✅ | ✅ | ✅ |
| Voice Input | ✅ | ✅ | ✅ (iOS 15+) | ❌ |
| Social Share | ✅ | ✅ | ✅ | ✅ |
| Particle Effects | ✅ | ✅ | ✅ | ✅ |

### Performance Impact
- **Explainable AI**: <10ms render time
- **Voice Input**: ~5-10% CPU during recording
- **Social Share**: Negligible
- **Particle Effects**: 60fps, <5% CPU for 100 particles

### File Sizes
- `explainable-ai.js`: ~10KB (minified: ~4KB)
- `voice-input.js`: ~8KB (minified: ~3KB)
- `social-share.js`: ~7KB (minified: ~3KB)
- `particle-effects.js`: ~9KB (minified: ~3.5KB)
- **Total**: ~34KB raw, ~13.5KB minified

---

## 🚀 Future Enhancements

### Planned Features
1. **Model Attention Weights**: Real attention scores from BERT
2. **Multi-language Voice Input**: Support for 50+ languages
3. **Custom Particle Effects**: User-configurable animations
4. **Social Analytics**: Track share performance
5. **Voice Commands**: "Analyze this review"
6. **Explainability API**: Backend endpoint for attention weights

### Contribution
To contribute new features:
1. Fork the repository
2. Create feature branch
3. Follow existing code patterns
4. Add documentation
5. Submit pull request

---

## 📄 License & Attribution

All advanced features are part of the Movie Review Sentiment Analysis project.
Licensed under MIT License.

Built with ❤️ using:
- Web Speech API
- Web Audio API
- HTML5 Canvas
- Modern JavaScript (ES6+)
- No external dependencies (except Chart.js for main app)

---

**Version**: 4.0  
**Last Updated**: February 2026  
**Author**: TheHien04  
**Repository**: https://github.com/TheHien04/Movie-Review-Sentiment-Analysis
