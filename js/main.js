// Navbar elevation on scroll
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('elevated', window.scrollY > 20);
  }, { passive: true });
}

// Mobile menu
const hamburger = document.querySelector('.hamburger');
const mobileNav = document.querySelector('.mobile-nav');
const mobileOverlay = document.querySelector('.mobile-overlay');
const closeBtn = document.querySelector('.close-btn');

function openMenu() {
  mobileNav?.classList.add('open');
  mobileOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  mobileNav?.classList.remove('open');
  mobileOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

hamburger?.addEventListener('click', openMenu);
closeBtn?.addEventListener('click', closeMenu);
mobileOverlay?.addEventListener('click', closeMenu);

// Active nav link
const page = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
  if (a.getAttribute('href') === page) a.classList.add('active');
});

// Intersection Observer — fade-up animations
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-up').forEach(el => io.observe(el));

// Animated counters
function runCounter(el) {
  const target = +el.dataset.target;
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const step = target / (duration / 16);
  let val = 0;
  const t = setInterval(() => {
    val = Math.min(val + step, target);
    el.textContent = Math.floor(val) + suffix;
    if (val >= target) clearInterval(t);
  }, 16);
}

const counterIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && !e.target.dataset.done) {
      e.target.dataset.done = '1';
      runCounter(e.target);
    }
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-target]').forEach(el => counterIO.observe(el));

// ===== i18n — MOTOR DE TRADUÇÃO =====
(function () {
  const T = window.TRANSLATIONS || {};
  const FI = { pt: 'fi-pt', en: 'fi-gb', fr: 'fi-fr' };
  const CODE = { pt: 'PT', en: 'EN', fr: 'FR' };

  function translate(lang) {
    // Texto simples
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (T[key] && T[key][lang]) el.textContent = T[key][lang];
    });
    // HTML (conteúdo com tags)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.dataset.i18nHtml;
      if (T[key] && T[key][lang]) el.innerHTML = T[key][lang];
    });
    // Atributos (placeholder, title, aria-label)
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const parts = el.dataset.i18nAttr.split(':');
      const attr = parts[0], key = parts[1];
      if (T[key] && T[key][lang]) el.setAttribute(attr, T[key][lang]);
    });
  }

  function applyLang(lang) {
    lang = ['pt','en','fr'].includes(lang) ? lang : 'pt';

    // Traduzir conteúdo
    translate(lang);

    // Actualizar botão do selector
    const btn = document.getElementById('lang-btn');
    if (btn) {
      const flagEl = btn.querySelector('.lang-flag-icon');
      if (flagEl) flagEl.className = `fi ${FI[lang]} lang-flag-icon`;
      const codeEl = btn.querySelector('.lang-code');
      if (codeEl) codeEl.textContent = CODE[lang];
    }

    // Marcar opção activa no dropdown
    document.querySelectorAll('.lang-option').forEach(o => {
      o.classList.toggle('active', o.dataset.lang === lang);
    });

    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang === 'pt' ? 'pt-PT' : lang === 'en' ? 'en-GB' : 'fr-FR';
  }

  // Inicializar com idioma guardado — espera DOM completo
  const saved = localStorage.getItem('lang') || 'pt';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyLang(saved));
  } else {
    applyLang(saved);
  }

  // Botão toggle
  const btn = document.getElementById('lang-btn');
  const dropdown = document.getElementById('lang-dropdown');
  if (btn && dropdown) {
    const open  = () => { dropdown.classList.add('open');    btn.setAttribute('aria-expanded','true'); };
    const close = () => { dropdown.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };
    btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.contains('open') ? close() : open(); });
    document.addEventListener('click', close);
    dropdown.addEventListener('click', e => e.stopPropagation());
    dropdown.querySelectorAll('.lang-option').forEach(opt => {
      opt.addEventListener('click', () => { applyLang(opt.dataset.lang); close(); });
    });
  }

  // Expor globalmente para uso noutros scripts
  window.applyLang = applyLang;
})();

// ===== CARROCEL DE ÁREAS =====
(function () {
  const track   = document.getElementById('carousel-track');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  const dots    = document.querySelectorAll('.carousel-dot');

  if (!track) return;

  const slides = track.querySelectorAll('.carousel-slide');
  const total  = slides.length;
  let current  = 0;

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;

    dots.forEach((d, i) => d.classList.toggle('active', i === current));

    prevBtn.disabled = false;
    nextBtn.disabled = false;
  }

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));

  dots.forEach(dot => {
    dot.addEventListener('click', () => goTo(+dot.dataset.index));
  });

  // Suporte a swipe em touch
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) goTo(dx < 0 ? current + 1 : current - 1);
  });

  // Mapeamento hash → índice do slide
  const hashMap = {
    'direito-imobiliario':    0,
    'sociedades-comerciais':  1,
    'direito-migratorio':     2,
    'nacionalidade-portuguesa': 3
  };

  // Ler hash da URL sem deixar o browser fazer scroll automático
  const urlHash = window.location.hash.replace('#', '');
  const startSlide = hashMap[urlHash] ?? 0;
  goTo(startSlide);

  // Se veio com hash, fazer scroll suave até ao carrocel (não ao slide)
  if (urlHash && hashMap[urlHash] !== undefined) {
    setTimeout(() => {
      const section = document.getElementById('areas-carousel-section');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }
})();

// "Saber mais" — bio expandível na página Sobre
const btnSaber = document.getElementById('btn-saber-mais');
const bioExpand = document.getElementById('bio-expand');
if (btnSaber && bioExpand) {
  btnSaber.addEventListener('click', () => {
    const isOpen = bioExpand.classList.toggle('open');
    btnSaber.setAttribute('aria-expanded', isOpen);
    bioExpand.setAttribute('aria-hidden', !isOpen);
    const lang = localStorage.getItem('lang') || 'pt';
    const T = window.TRANSLATIONS || {};
    const labelEl = btnSaber.querySelector('.btn-saber-mais-label');
    const maisKey = 'sobre.saberMais', menosKey = 'sobre.saberMenos';
    labelEl.textContent = isOpen
      ? (T[menosKey]?.[lang] || 'Saber menos...')
      : (T[maisKey]?.[lang]  || 'Saber mais...');
    if (isOpen) labelEl.setAttribute('data-i18n', menosKey);
    else        labelEl.setAttribute('data-i18n', maisKey);
    if (isOpen) {
      setTimeout(() => bioExpand.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  });
}

// Contact form — envia email via mailto:
const form = document.getElementById('contact-form') || document.querySelector('.contact-form');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();

    const get = id => (document.getElementById(id)?.value || '').trim();
    const nome      = get('nome');
    const apelido   = get('apelido');
    const email     = get('email');
    const telefone  = get('telefone');
    const area      = get('area');
    const mensagem  = get('mensagem');

    // Validação básica
    if (!nome || !email || !mensagem) {
      alert('Por favor preencha os campos obrigatórios: Nome, Email e Mensagem.');
      return;
    }

    const subject = `Contacto Website — ${nome} ${apelido}`.trim();
    const body =
      `Nome: ${nome} ${apelido}\n` +
      `Email: ${email}\n` +
      (telefone ? `Telefone: ${telefone}\n` : '') +
      (area     ? `Área de interesse: ${area}\n` : '') +
      `\nMensagem:\n${mensagem}`;

    const mailto = `mailto:pedropdvp@gmail.com` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  });
}

