// Animation utilities for Involex website
class AnimationManager {
    constructor() {
        this.animations = new Map();
        this.observers = new Map();
        this.init();
    }

    init() {
        this.setupIntersectionObservers();
        this.setupScrollAnimations();
        this.setupHoverAnimations();
        this.setupLoadAnimations();
    }

    // Intersection Observer for scroll-triggered animations
    setupIntersectionObservers() {
        const defaultOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        // Fade in animations
        this.createObserver('fadeIn', defaultOptions, (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateFadeIn(entry.target);
                }
            });
        });

        // Slide animations
        this.createObserver('slideIn', defaultOptions, (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateSlideIn(entry.target);
                }
            });
        });

        // Scale animations
        this.createObserver('scaleIn', defaultOptions, (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateScaleIn(entry.target);
                }
            });
        });

        // Counter animations
        this.createObserver('counter', defaultOptions, (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target);
                }
            });
        });
    }

    createObserver(name, options, callback) {
        const observer = new IntersectionObserver(callback, options);
        this.observers.set(name, observer);
        return observer;
    }

    // Scroll-based animations
    setupScrollAnimations() {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.updateScrollAnimations();
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
    }

    updateScrollAnimations() {
        const scrollY = window.pageYOffset;
        const windowHeight = window.innerHeight;

        // Parallax effects
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        parallaxElements.forEach(element => {
            const speed = element.dataset.parallax || 0.5;
            const yPos = -(scrollY * speed);
            element.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });

        // Progress indicators
        const progressBars = document.querySelectorAll('.progress-bar');
        progressBars.forEach(bar => {
            const rect = bar.getBoundingClientRect();
            if (rect.top < windowHeight && rect.bottom > 0) {
                const progress = Math.min(100, Math.max(0, 
                    ((windowHeight - rect.top) / (windowHeight + rect.height)) * 100
                ));
                bar.style.setProperty('--progress', `${progress}%`);
            }
        });
    }

    // Hover animations
    setupHoverAnimations() {
        // Card hover effects
        const cards = document.querySelectorAll('.feature-card, .pricing-card, .doc-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                this.animateCardHover(card, true);
            });
            
            card.addEventListener('mouseleave', () => {
                this.animateCardHover(card, false);
            });
        });

        // Button hover effects
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            this.setupButtonAnimation(button);
        });
    }

    // Load animations
    setupLoadAnimations() {
        // Stagger animations for grids
        this.staggerGridAnimations();
        
        // Hero animations
        this.animateHeroSection();
        
        // Navigation animations
        this.animateNavigation();
    }

    // Animation methods
    animateFadeIn(element, delay = 0) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, delay);
    }

    animateSlideIn(element, direction = 'left', delay = 0) {
        const translateX = direction === 'left' ? '-50px' : '50px';
        element.style.opacity = '0';
        element.style.transform = `translateX(${translateX})`;
        
        setTimeout(() => {
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
        }, delay);
    }

    animateScaleIn(element, delay = 0) {
        element.style.opacity = '0';
        element.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            element.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
        }, delay);
    }

    animateCounter(element) {
        const target = parseInt(element.textContent);
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += increment;
            if (current < target) {
                element.textContent = Math.floor(current);
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target;
            }
        };

        updateCounter();
    }

    animateCardHover(card, isHovering) {
        const scale = isHovering ? 1.05 : 1;
        const translateY = isHovering ? -10 : 0;
        const shadow = isHovering ? '0 20px 40px rgba(0,0,0,0.1)' : '0 4px 6px rgba(0,0,0,0.05)';
        
        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        card.style.transform = `scale(${scale}) translateY(${translateY}px)`;
        card.style.boxShadow = shadow;
    }

    setupButtonAnimation(button) {
        let ripple;
        
        button.addEventListener('click', (e) => {
            // Remove existing ripple
            if (ripple) {
                ripple.remove();
            }
            
            // Create ripple effect
            ripple = document.createElement('span');
            ripple.className = 'ripple';
            
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            button.appendChild(ripple);
            
            // Remove ripple after animation
            setTimeout(() => {
                if (ripple) {
                    ripple.remove();
                }
            }, 600);
        });
    }

    staggerGridAnimations() {
        const grids = [
            { selector: '.features-grid .feature-card', stagger: 100 },
            { selector: '.pricing-grid .pricing-card', stagger: 150 },
            { selector: '.docs-grid .doc-card', stagger: 80 }
        ];

        grids.forEach(({ selector, stagger }) => {
            const elements = document.querySelectorAll(selector);
            const observer = this.observers.get('fadeIn');
            
            elements.forEach((element, index) => {
                // Add animation delay
                element.style.animationDelay = `${index * stagger}ms`;
                observer.observe(element);
            });
        });
    }

    animateHeroSection() {
        const heroElements = {
            badge: document.querySelector('.hero-badge'),
            title: document.querySelector('.hero-title'),
            subtitle: document.querySelector('.hero-subtitle'),
            stats: document.querySelector('.hero-stats'),
            cta: document.querySelector('.hero-cta'),
            visual: document.querySelector('.hero-visual')
        };

        // Animate hero elements in sequence
        let delay = 0;
        Object.values(heroElements).forEach(element => {
            if (element) {
                this.animateFadeIn(element, delay);
                delay += 200;
            }
        });

        // Animate floating cards
        const floatingCards = document.querySelectorAll('.floating-card');
        floatingCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.animation = `float 3s ease-in-out infinite ${index}s`;
            }, 1000 + (index * 500));
        });
    }

    animateNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    // Utility methods
    observeElement(element, animationType, options = {}) {
        const observer = this.observers.get(animationType);
        if (observer) {
            observer.observe(element);
        }
    }

    unobserveElement(element, animationType) {
        const observer = this.observers.get(animationType);
        if (observer) {
            observer.unobserve(element);
        }
    }

    // Text animation effects
    animateText(element, effect = 'typewriter') {
        switch (effect) {
            case 'typewriter':
                this.typewriterEffect(element);
                break;
            case 'fadeWords':
                this.fadeWordsEffect(element);
                break;
            case 'slideWords':
                this.slideWordsEffect(element);
                break;
        }
    }

    typewriterEffect(element) {
        const text = element.textContent;
        element.textContent = '';
        element.style.borderRight = '2px solid';
        
        let i = 0;
        const timer = setInterval(() => {
            element.textContent += text.charAt(i);
            i++;
            
            if (i >= text.length) {
                clearInterval(timer);
                setTimeout(() => {
                    element.style.borderRight = 'none';
                }, 1000);
            }
        }, 50);
    }

    fadeWordsEffect(element) {
        const words = element.textContent.split(' ');
        element.innerHTML = words.map(word => 
            `<span class="word" style="opacity: 0;">${word}</span>`
        ).join(' ');
        
        const wordElements = element.querySelectorAll('.word');
        wordElements.forEach((word, index) => {
            setTimeout(() => {
                word.style.transition = 'opacity 0.4s ease';
                word.style.opacity = '1';
            }, index * 100);
        });
    }

    slideWordsEffect(element) {
        const words = element.textContent.split(' ');
        element.innerHTML = words.map(word => 
            `<span class="word" style="transform: translateY(20px); opacity: 0;">${word}</span>`
        ).join(' ');
        
        const wordElements = element.querySelectorAll('.word');
        wordElements.forEach((word, index) => {
            setTimeout(() => {
                word.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
                word.style.transform = 'translateY(0)';
                word.style.opacity = '1';
            }, index * 80);
        });
    }

    // Performance monitoring
    measurePerformance(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`Animation "${name}" took ${end - start} milliseconds`);
        return result;
    }

    // Clean up
    destroy() {
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
        this.animations.clear();
    }
}

// Initialize animation manager when DOM is ready
let animationManager;

document.addEventListener('DOMContentLoaded', function() {
    animationManager = new AnimationManager();
    
    // Add automatic animations to elements with data attributes
    document.querySelectorAll('[data-animate]').forEach(element => {
        const animationType = element.dataset.animate;
        const delay = parseInt(element.dataset.delay) || 0;
        const direction = element.dataset.direction || 'left';
        
        setTimeout(() => {
            switch (animationType) {
                case 'fadeIn':
                    animationManager.animateFadeIn(element);
                    break;
                case 'slideIn':
                    animationManager.animateSlideIn(element, direction);
                    break;
                case 'scaleIn':
                    animationManager.animateScaleIn(element);
                    break;
                case 'counter':
                    animationManager.animateCounter(element);
                    break;
            }
        }, delay);
    });
});

// Add CSS for animations
const animationCSS = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .word {
        display: inline-block;
        margin-right: 0.25rem;
    }
    
    .progress-bar {
        position: relative;
        overflow: hidden;
    }
    
    .progress-bar::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: var(--progress, 0%);
        background: var(--gradient-primary);
        transition: width 0.3s ease;
    }
    
    @media (prefers-reduced-motion: reduce) {
        * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }
`;

// Inject animation CSS
const styleElement = document.createElement('style');
styleElement.textContent = animationCSS;
document.head.appendChild(styleElement);

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnimationManager;
}
