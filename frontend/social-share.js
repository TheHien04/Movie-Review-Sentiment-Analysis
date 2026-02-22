/**
 * Social Share Component
 * Share sentiment analysis results on social media
 */

class SocialShare {
    constructor() {
        this.currentResult = null;
        this.shareUrl = window.location.origin;
    }

    /**
     * Set the current analysis result
     */
    setResult(text, sentiment, confidence, label) {
        this.currentResult = {
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            sentiment: sentiment,
            confidence: (confidence * 100).toFixed(1),
            label: label
        };
    }

    /**
     * Generate share text
     */
    getShareText() {
        if (!this.currentResult) return '';
        
        const emoji = this.currentResult.sentiment === 1 ? '😊' : '😔';
        return `I analyzed a movie review and found it ${this.currentResult.sentiment === 1 ? 'POSITIVE' : 'NEGATIVE'} ` +
               `${emoji} with ${this.currentResult.confidence}% confidence! ` +
               `Try it yourself at ${this.shareUrl}`;
    }

    /**
     * Share on Twitter
     */
    shareTwitter() {
        const text = this.getShareText();
        const hashtags = 'SentimentAnalysis,MovieReview,AI,MachineLearning';
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${hashtags}`;
        window.open(url, '_blank', 'width=550,height=420');
    }

    /**
     * Share on Facebook
     */
    shareFacebook() {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareUrl)}`;
        window.open(url, '_blank', 'width=550,height=420');
    }

    /**
     * Share on LinkedIn
     */
    shareLinkedIn() {
        const title = 'Movie Review Sentiment Analysis';
        const summary = this.getShareText();
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.shareUrl)}`;
        window.open(url, '_blank', 'width=550,height=420');
    }

    /**
     * Share via Email
     */
    shareEmail() {
        const subject = 'Check out this Sentiment Analysis!';
        const body = this.getShareText();
        const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = url;
    }

    /**
     * Copy link to clipboard
     */
    async copyLink() {
        try {
            await navigator.clipboard.writeText(this.shareUrl + '/batch.html');
            return true;
        } catch (error) {
            console.error('Failed to copy:', error);
            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = this.shareUrl + '/batch.html';
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (err) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    }

    /**
     * Create share buttons HTML
     */
    createShareButtons() {
        return `
            <div class="social-share-container" style="margin-top: 20px;">
                <div style="text-align: center; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #6a1b9a; font-size: 16px;">
                        Share this Analysis
                    </h4>
                    <p style="margin: 0; font-size: 13px; color: #666;">
                        Let others know about this amazing tool!
                    </p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="socialShare.shareTwitter()" class="share-btn share-twitter" title="Share on Twitter">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                        </svg>
                        Twitter
                    </button>
                    <button onclick="socialShare.shareFacebook()" class="share-btn share-facebook" title="Share on Facebook">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                        </svg>
                        Facebook
                    </button>
                    <button onclick="socialShare.shareLinkedIn()" class="share-btn share-linkedin" title="Share on LinkedIn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                            <circle cx="4" cy="4" r="2"/>
                        </svg>
                        LinkedIn
                    </button>
                    <button onclick="socialShare.shareEmail()" class="share-btn share-email" title="Share via Email">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        Email
                    </button>
                    <button onclick="socialShare.copyLinkWithToast()" class="share-btn share-copy" title="Copy Link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Copy Link
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Copy link with toast notification
     */
    async copyLinkWithToast() {
        const success = await this.copyLink();
        if (success && window.toast) {
            window.toast.success('Link copied to clipboard!');
        } else if (success) {
            alert('Link copied to clipboard!');
        } else {
            if (window.toast) {
                window.toast.error('Failed to copy link');
            } else {
                alert('Failed to copy link');
            }
        }
    }

    /**
     * Generate Open Graph meta tags
     */
    static generateOGTags(title, description, imageUrl) {
        const tags = [
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:image', content: imageUrl },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: window.location.href },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: title },
            { name: 'twitter:description', content: description },
            { name: 'twitter:image', content: imageUrl }
        ];

        // Remove existing OG tags
        document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(el => el.remove());

        // Add new tags
        tags.forEach(tag => {
            const meta = document.createElement('meta');
            if (tag.property) meta.setAttribute('property', tag.property);
            if (tag.name) meta.setAttribute('name', tag.name);
            meta.setAttribute('content', tag.content);
            document.head.appendChild(meta);
        });
    }
}

// Create global instance
window.socialShare = new SocialShare();

// Add share button styles
const shareStyles = document.createElement('style');
shareStyles.textContent = `
    .share-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .share-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    .share-btn:active {
        transform: translateY(0);
    }
    
    .share-twitter {
        background: linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%);
    }
    
    .share-facebook {
        background: linear-gradient(135deg, #1877F2 0%, #0e5fc7 100%);
    }
    
    .share-linkedin {
        background: linear-gradient(135deg, #0A66C2 0%, #004182 100%);
    }
    
    .share-email {
        background: linear-gradient(135deg, #EA4335 0%, #c1321c 100%);
    }
    
    .share-copy {
        background: linear-gradient(135deg, #6a1b9a 0%, #4a148c 100%);
    }
    
    @media (max-width: 600px) {
        .share-btn {
            padding: 8px 12px;
            font-size: 13px;
        }
        
        .share-btn svg {
            width: 16px;
            height: 16px;
        }
    }
`;
document.head.appendChild(shareStyles);
