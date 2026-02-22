/*================================================
  🎪 LANGUAGE SCHOOL - VINTAGE ANIMATIONS
  JavaScript para efectos parallax y animaciones
================================================*/

// ===== VARIABLES GLOBALES =====
let lastScrollTop = 0;
const parallaxElements = [];

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
  initPageLoader();
  initScrollReveal();
  initParallax();
  initSmoothScroll();
  initHeaderScroll();
  initActiveNav();
  initCursorEffect();
  initHoverAnimations();
  initTypingEffect();
});

// ===== PAGE LOADER =====
function initPageLoader() {
  const loader = document.createElement('div');
  loader.className = 'page-loader';
  loader.innerHTML = `
    <div class="loader-content">
      <div class="spinner"></div>
      <p style="margin-top: 1rem; font-family: Georgia; color: var(--vintage-brown);">Cargando experiencia vintage...</p>
    </div>
  `;
  document.body.prepend(loader);
  
  window.addEventListener('load', function() {
    setTimeout(() => {
      loader.classList.add('hide');
      setTimeout(() => loader.remove(), 500);
    }, 800);
  });
}

// ===== SCROLL REVEAL ANIMATIONS =====
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  });
  
  revealElements.forEach(el => revealObserver.observe(el));
}

// ===== PARALLAX EFFECT =====
function initParallax() {
  // Detectar elementos con parallax
  const parallaxItems = document.querySelectorAll('.hero, .miniCard, .card, .feature');
  
  parallaxItems.forEach((item, index) => {
    parallaxElements.push({
      element: item,
      speed: 0.3 + (index % 3) * 0.2
    });
  });
  
  // Evento de scroll para parallax
  window.addEventListener('scroll', () => {
    requestAnimationFrame(updateParallax);
  });
}

function updateParallax() {
  const scrolled = window.pageYOffset;
  
  parallaxElements.forEach(item => {
    const rect = item.element.getBoundingClientRect();
    const elementTop = rect.top + scrolled;
    const elementHeight = rect.height;
    
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const distance = (scrolled - elementTop) * item.speed;
      
      if (item.element.classList.contains('hero')) {
        item.element.style.transform = `translateY(${distance * 0.5}px)`;
      } else if (item.element.classList.contains('miniCard')) {
        const rotation = distance * 0.02;
        item.element.style.transform = `translateY(${distance * 0.3}px) rotate(${rotation}deg)`;
      } else {
        item.element.style.transform = `translateY(${distance * 0.2}px)`;
      }
    }
  });
}

// ===== SMOOTH SCROLL =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '#form') {
        e.preventDefault();
        const target = href === '#' ? document.body : document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });
}

// ===== HEADER SCROLL EFFECT =====
function initHeaderScroll() {
  const header = document.querySelector('header');
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      header.style.background = 'linear-gradient(135deg, rgba(232, 220, 196, 0.95) 0%, rgba(245, 230, 211, 0.95) 100%)';
      header.style.backdropFilter = 'blur(15px)';
      header.style.boxShadow = '0 5px 20px rgba(62, 39, 35, 0.3)';
    } else {
      header.style.background = 'linear-gradient(135deg, var(--vintage-paper) 0%, var(--vintage-cream) 100%)';
      header.style.backdropFilter = 'blur(10px)';
      header.style.boxShadow = 'var(--shadow-medium)';
    }
    
    // Hide/show header on scroll
    if (currentScroll > lastScroll && currentScroll > 300) {
      header.style.transform = 'translateY(-100%)';
    } else {
      header.style.transform = 'translateY(0)';
    }
    
    lastScroll = currentScroll;
  });
  
  header.style.transition = 'transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease';
}

// ===== ACTIVE NAV INDICATOR =====
function initActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('nav a[data-page]');
  
  navLinks.forEach(link => {
    if (link.getAttribute('data-page') === currentPage) {
      link.style.color = 'var(--vintage-gold)';
      link.style.fontWeight = '700';
      const afterWidth = link.querySelector('::after');
      if (afterWidth) {
        afterWidth.style.width = '100%';
      }
    }
  });
}

// ===== CURSOR TRAIL EFFECT =====
function initCursorEffect() {
  const trailCount = 8;
  const trails = [];
  
  // Crear elementos de trail
  for (let i = 0; i < trailCount; i++) {
    const trail = document.createElement('div');
    trail.style.cssText = `
      position: fixed;
      width: ${12 - i}px;
      height: ${12 - i}px;
      border-radius: 50%;
      background: rgba(212, 175, 55, ${0.6 - i * 0.06});
      pointer-events: none;
      z-index: 9999;
      transition: transform 0.1s ease;
    `;
    document.body.appendChild(trail);
    trails.push({
      element: trail,
      x: 0,
      y: 0
    });
  }
  
  // Actualizar posición del trail
  let mouseX = 0;
  let mouseY = 0;
  
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  
  function animateTrail() {
    trails.forEach((trail, index) => {
      const targetX = index === 0 ? mouseX : trails[index - 1].x;
      const targetY = index === 0 ? mouseY : trails[index - 1].y;
      
      trail.x += (targetX - trail.x) * 0.3;
      trail.y += (targetY - trail.y) * 0.3;
      
      trail.element.style.transform = `translate(${trail.x}px, ${trail.y}px)`;
    });
    
    requestAnimationFrame(animateTrail);
  }
  
  animateTrail();
}

// ===== HOVER ANIMATIONS =====
function initHoverAnimations() {
  // Botones con efecto de ondas
  const buttons = document.querySelectorAll('.btn');
  
  buttons.forEach(btn => {
    btn.innerHTML = `<span>${btn.textContent}</span>`;
    
    btn.addEventListener('mouseenter', function(e) {
      createRipple(e, this);
    });
  });
}

function createRipple(e, element) {
  const ripple = document.createElement('span');
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;
  
  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    transform: scale(0);
    animation: ripple 0.6s ease-out;
    pointer-events: none;
  `;
  
  element.appendChild(ripple);
  
  setTimeout(() => ripple.remove(), 600);
}

// Añadir animación de ripple al CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  
  .btn {
    overflow: hidden;
  }
`;
document.head.appendChild(style);

// ===== TYPING EFFECT =====
function initTypingEffect() {
  const typingElements = document.querySelectorAll('.heroEm');
  
  typingElements.forEach(el => {
    const text = el.textContent;
    el.textContent = '';
    el.style.borderRight = '2px solid var(--vintage-gold)';
    
    let i = 0;
    const typing = setInterval(() => {
      if (i < text.length) {
        el.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(typing);
        setTimeout(() => {
          el.style.borderRight = 'none';
        }, 500);
      }
    }, 100);
  });
}

// ===== MOUSE PARALLAX ON CARDS =====
document.querySelectorAll('.card, .feature, .miniCard').forEach(card => {
  card.addEventListener('mousemove', function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    
    this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
  });
  
  card.addEventListener('mouseleave', function() {
    this.style.transform = '';
  });
});

// ===== SCROLL PROGRESS INDICATOR =====
function initScrollProgress() {
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--vintage-gold), var(--vintage-copper));
    z-index: 10000;
    transition: width 0.1s ease;
    box-shadow: 0 2px 5px rgba(212, 175, 55, 0.5);
  `;
  document.body.appendChild(progressBar);
  
  window.addEventListener('scroll', () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    progressBar.style.width = scrolled + '%';
  });
}

initScrollProgress();

// ===== INTERSECTION OBSERVER PARA ANIMACIONES =====
const animateOnScroll = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // Añadir animaciones específicas según el elemento
      if (entry.target.classList.contains('icon')) {
        entry.target.style.animation = 'bounce 2s ease-in-out infinite';
      }
      
      if (entry.target.classList.contains('money')) {
        animateNumber(entry.target);
      }
    }
  });
}, {
  threshold: 0.5
});

// Observar elementos específicos
document.querySelectorAll('.icon, .money').forEach(el => {
  animateOnScroll.observe(el);
});

// ===== ANIMAR NÚMEROS =====
function animateNumber(element) {
  const text = element.textContent;
  const number = parseInt(text.match(/\d+/)?.[0] || 0);
  
  if (number > 0) {
    let current = 0;
    const increment = number / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= number) {
        current = number;
        clearInterval(timer);
      }
      element.textContent = text.replace(/\d+/, Math.floor(current));
    }, 20);
  }
}

// ===== PARTICLES EFFECT (OPCIONAL) =====
function createParticles() {
  const particlesContainer = document.createElement('div');
  particlesContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  `;
  document.body.appendChild(particlesContainer);
  
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      width: ${Math.random() * 4 + 2}px;
      height: ${Math.random() * 4 + 2}px;
      background: var(--vintage-gold);
      opacity: ${Math.random() * 0.3 + 0.1};
      border-radius: 50%;
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      animation: float ${Math.random() * 10 + 10}s ease-in-out infinite;
      animation-delay: ${Math.random() * 5}s;
    `;
    particlesContainer.appendChild(particle);
  }
}

// Activar partículas (comentado por defecto, descomentar si se desea)
// createParticles();

// ===== LAZY LOADING PARA IMÁGENES =====
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.add('loaded');
        imageObserver.unobserve(img);
      }
    });
  });
  
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// ===== CONSOLE MESSAGE =====
console.log('%c🎨 Language School - Vintage Edition', 'font-size: 20px; font-weight: bold; color: #D4AF37;');
console.log('%cDiseñado con amor y estilo vintage ✨', 'font-size: 14px; color: #8B6F47;');

// ===== EASTER EGG =====
let konamiCode = [];
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', (e) => {
  konamiCode.push(e.key);
  konamiCode = konamiCode.slice(-10);
  
  if (konamiCode.join('') === konamiSequence.join('')) {
    document.body.style.animation = 'rainbow 2s ease infinite';
    setTimeout(() => {
      document.body.style.animation = '';
    }, 5000);
  }
});

const rainbowStyle = document.createElement('style');
rainbowStyle.textContent = `
  @keyframes rainbow {
    0%, 100% { filter: hue-rotate(0deg); }
    50% { filter: hue-rotate(360deg); }
  }
`;
document.head.appendChild(rainbowStyle);

// ===== PERFORMANCE OPTIMIZATION =====
// Usar requestAnimationFrame para animaciones suaves
let ticking = false;

window.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      // Todas las funciones de scroll aquí
      ticking = false;
    });
    ticking = true;
  }
});

// ===== ACCESSIBILITY =====
// Respetar prefers-reduced-motion
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('*').forEach(el => {
    el.style.animation = 'none';
    el.style.transition = 'none';
  });
}
