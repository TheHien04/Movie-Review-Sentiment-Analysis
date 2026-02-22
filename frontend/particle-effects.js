/**
 * Premium Particle Effects
 * Beautiful particle animations for success/error states
 */

class ParticleSystem {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
        this.isAnimating = false;
    }

    /**
     * Initialize particle system
     */
    init() {
        // Create canvas if not exists
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'particleCanvas';
            this.canvas.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 9999;
            `;
            document.body.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');
            this.updateCanvasSize();
            
            // Handle window resize
            window.addEventListener('resize', () => this.updateCanvasSize());
        }
    }

    /**
     * Update canvas size
     */
    updateCanvasSize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * Create success confetti
     */
    success(x = window.innerWidth / 2, y = window.innerHeight / 2) {
        this.init();
        const colors = ['#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107'];
        
        for (let i = 0; i < 100; i++) {
            this.particles.push(new Particle(
                x,
                y,
                Math.random() * 6 - 3,
                Math.random() * -15 - 5,
                colors[Math.floor(Math.random() * colors.length)],
                Math.random() * 8 + 4
            ));
        }
        
        if (!this.isAnimating) {
            this.animate();
        }
    }

    /**
     * Create error particles
     */
    error(x = window.innerWidth / 2, y = window.innerHeight / 2) {
        this.init();
        const colors = ['#f44336', '#e53935', '#d32f2f', '#c62828'];
        
        for (let i = 0; i < 80; i++) {
            this.particles.push(new Particle(
                x,
                y,
                Math.random() * 8 - 4,
                Math.random() * 8 - 4,
                colors[Math.floor(Math.random() * colors.length)],
                Math.random() * 6 + 3,
                'circle'
            ));
        }
        
        if (!this.isAnimating) {
            this.animate();
        }
    }

    /**
     * Create star burst effect
     */
    starBurst(x = window.innerWidth / 2, y = window.innerHeight / 2) {
        this.init();
        const colors = ['#9c27b0', '#ba68c8', '#ce93d8', '#e1bee7'];
        
        for (let i = 0; i < 50; i++) {
            const angle = (Math.PI * 2 * i) / 50;
            const velocity = Math.random() * 5 + 3;
            
            this.particles.push(new Particle(
                x,
                y,
                Math.cos(angle) * velocity,
                Math.sin(angle) * velocity,
                colors[Math.floor(Math.random() * colors.length)],
                Math.random() * 4 + 2,
                'star'
            ));
        }
        
        if (!this.isAnimating) {
            this.animate();
        }
    }

    /**
     * Create heart particles
     */
    hearts(x = window.innerWidth / 2, y = window.innerHeight / 2) {
        this.init();
        const color = '#e91e63';
        
        for (let i = 0; i < 30; i++) {
            this.particles.push(new Particle(
                x + Math.random() * 100 - 50,
                y,
                Math.random() * 2 - 1,
                Math.random() * -3 - 2,
                color,
                Math.random() * 15 + 10,
                'heart'
            ));
        }
        
        if (!this.isAnimating) {
            this.animate();
        }
    }

    /**
     * Animate particles
     */
    animate() {
        if (!this.ctx || !this.canvas) return;
        
        this.isAnimating = true;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update();
            particle.draw(this.ctx);
            
            // Remove dead particles
            if (particle.isDead()) {
                this.particles.splice(i, 1);
            }
        }
        
        // Continue animation if particles exist
        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            this.isAnimating = false;
            // Remove canvas if no particles
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
                this.canvas = null;
                this.ctx = null;
            }
        }
    }

    /**
     * Clear all particles
     */
    clear() {
        this.particles = [];
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isAnimating = false;
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
            this.canvas = null;
            this.ctx = null;
        }
    }
}

/**
 * Particle class
 */
class Particle {
    constructor(x, y, vx, vy, color, size, shape = 'square') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.shape = shape;
        this.alpha = 1;
        this.gravity = 0.5;
        this.friction = 0.98;
        this.life = 100;
    }

    /**
     * Update particle position
     */
    update() {
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        this.x += this.vx;
        this.y += this.vy;
        
        this.life--;
        this.alpha = this.life / 100;
    }

    /**
     * Draw particle
     */
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        
        switch (this.shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'star':
                this.drawStar(ctx);
                break;
                
            case 'heart':
                this.drawHeart(ctx);
                break;
                
            default: // square
                ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
                break;
        }
        
        ctx.restore();
    }

    /**
     * Draw star shape
     */
    drawStar(ctx) {
        const spikes = 5;
        const outerRadius = this.size;
        const innerRadius = this.size / 2;
        
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / spikes;
            const x = this.x + Math.cos(angle) * radius;
            const y = this.y + Math.sin(angle) * radius;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Draw heart shape
     */
    drawHeart(ctx) {
        const size = this.size;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + size / 4);
        
        ctx.bezierCurveTo(
            this.x, this.y,
            this.x - size / 2, this.y - size / 2,
            this.x, this.y - size / 4
        );
        
        ctx.bezierCurveTo(
            this.x + size / 2, this.y - size / 2,
            this.x, this.y,
            this.x, this.y + size / 4
        );
        
        ctx.fill();
    }

    /**
     * Check if particle is dead
     */
    isDead() {
        return this.life <= 0 || this.alpha <= 0;
    }
}

// Create global instance
window.particles = new ParticleSystem();
