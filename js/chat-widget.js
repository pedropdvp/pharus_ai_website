/* ============================================================
   CHAT WIDGET — Pharus AI Agency
   Assistente virtual com respostas reais do Google Gemini (via backend),
   memoria de conversa, streaming, historico de conversas, novo chat,
   FAQ como sugestoes, WhatsApp e Calendly.
   A chave da API vive SO no servidor — este ficheiro fala com /api/chat.
   ============================================================ */
(function () {
  var WA  = '351912484143';
  var CAL = 'https://calendar.google.com/calendar/u/0/r/day/2026/6/5?pli=1';

  // Base da API: em localhost usa o servidor Node em :3001; em producao usa o mesmo dominio (nginx /api).
  var API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : '';

  // --- Identidade da sessao e conversa (persistidas no navegador) ---
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function getSessionId() {
    var s = localStorage.getItem('pharus-session');
    if (!s) { s = uuid(); localStorage.setItem('pharus-session', s); }
    return s;
  }
  var sessionId = getSessionId();
  var conversationId = localStorage.getItem('pharus-conversation') || null;

  var LANG = {
    pt: {
      title: 'Assistente Pharus AI', sub: 'Respondo em segundos',
      greeting: 'Olá! Sou o assistente virtual da Pharus AI Agency. Em que posso ajudar?',
      suggestions: 'Sugestões:',
      faq: [
        'Quanto custa um Agente IA?',
        'Como funciona o processo de nacionalidade portuguesa?',
        'Que processos posso automatizar na minha empresa?',
        'Ajudam com direito migratório e vistos?',
        'Fazem apps web e mobile à medida?'
      ],
      btnWa: 'Falar com Especialista', btnCal: 'Agendar Reunião',
      close: 'Fechar', newChat: 'Nova conversa', history: 'Histórico',
      placeholder: 'Escreva a sua mensagem…', send: 'Enviar',
      copy: 'Copiar', copied: 'Copiado!', errored: 'Ocorreu um erro. Tente novamente.',
      convos: 'As suas conversas', noConvos: 'Ainda não tem conversas guardadas.',
      del: 'Apagar', delConfirm: 'Apagar esta conversa?', back: 'Voltar',
      stop: 'Parar', regenerate: 'Regenerar', tokensLabel: 'tokens',
      mic: 'Falar', listening: 'A ouvir…', speak: 'Ouvir', speaking: 'A ler…', srLang: 'pt-PT',
      attach: 'Anexar ficheiro', fileTooBig: 'Ficheiro demasiado grande (máx ~3 MB).', fileType: 'Só imagens ou PDF.',
      web: 'Pesquisar na Web'
    },
    en: {
      title: 'Pharus AI Assistant', sub: 'I reply in seconds',
      greeting: 'Hello! I\'m the virtual assistant of Pharus AI Agency. How can I help?',
      suggestions: 'Suggestions:',
      faq: [
        'How much does an AI Agent cost?',
        'How does the Portuguese nationality process work?',
        'What processes can I automate in my company?',
        'Do you help with immigration law and visas?',
        'Do you build custom web and mobile apps?'
      ],
      btnWa: 'Speak to a Specialist', btnCal: 'Schedule a Meeting',
      close: 'Close', newChat: 'New chat', history: 'History',
      placeholder: 'Type your message…', send: 'Send',
      copy: 'Copy', copied: 'Copied!', errored: 'Something went wrong. Please try again.',
      convos: 'Your conversations', noConvos: 'You have no saved conversations yet.',
      del: 'Delete', delConfirm: 'Delete this conversation?', back: 'Back',
      stop: 'Stop', regenerate: 'Regenerate', tokensLabel: 'tokens',
      mic: 'Speak', listening: 'Listening…', speak: 'Listen', speaking: 'Reading…', srLang: 'en-US',
      attach: 'Attach file', fileTooBig: 'File too large (max ~3 MB).', fileType: 'Images or PDF only.',
      web: 'Search the web'
    },
    fr: {
      title: 'Assistant Pharus AI', sub: 'Je réponds en quelques secondes',
      greeting: 'Bonjour ! Je suis l\'assistant virtuel de Pharus AI Agency. Comment puis-je vous aider ?',
      suggestions: 'Suggestions :',
      faq: [
        'Combien coûte un Agent IA ?',
        'Comment fonctionne la nationalité portugaise ?',
        'Quels processus puis-je automatiser dans mon entreprise ?',
        'Aidez-vous avec le droit de l\'immigration et les visas ?',
        'Créez-vous des applications web et mobiles sur mesure ?'
      ],
      btnWa: 'Parler à un spécialiste', btnCal: 'Planifier une réunion',
      close: 'Fermer', newChat: 'Nouvelle conversation', history: 'Historique',
      placeholder: 'Écrivez votre message…', send: 'Envoyer',
      copy: 'Copier', copied: 'Copié !', errored: 'Une erreur est survenue. Veuillez réessayer.',
      convos: 'Vos conversations', noConvos: 'Vous n\'avez pas encore de conversations.',
      del: 'Supprimer', delConfirm: 'Supprimer cette conversation ?', back: 'Retour',
      stop: 'Arrêter', regenerate: 'Régénérer', tokensLabel: 'jetons',
      mic: 'Parler', listening: 'Écoute…', speak: 'Écouter', speaking: 'Lecture…', srLang: 'fr-FR',
      attach: 'Joindre un fichier', fileTooBig: 'Fichier trop volumineux (max ~3 Mo).', fileType: 'Images ou PDF uniquement.',
      web: 'Recherche web'
    }
  };

  function curLang() { return localStorage.getItem('lang') || 'pt'; }
  function getLang() { return LANG[curLang()] || LANG.pt; }

  // --- Markdown seguro: usa marked + DOMPurify se disponiveis, senao escapa texto ---
  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
  }
  var mdReady = Promise.all([
    loadScript('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js'),
    loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js')
  ]);
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function renderMarkdown(text) {
    if (window.marked && window.DOMPurify) {
      try {
        return window.DOMPurify.sanitize(window.marked.parse(text, { breaks: true }));
      } catch (e) { /* fallback */ }
    }
    return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
  }

  // Icones do botao enviar / parar
  var SEND_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>';
  var STOP_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  // Elementos partilhados (preenchidos em build)
  var els = {};
  var currentAbort = null;      // AbortController do streaming em curso
  var lastUserMessage = null;   // ultima pergunta (para regenerar)
  var pendingFile = null;       // anexo por enviar { name, mimeType, data(base64) }
  var webSearchOn = false;      // modo "pesquisar na Web" (grounding Google Search)

  // --- Voz: reconhecimento (STT) e leitura (TTS) via Web Speech API ---
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recog = null, recognizing = false, currentUtter = null;

  function setupVoice() {
    var mic = document.getElementById('pcw-mic');
    if (!mic || !SR) return;            // sem suporte -> botao fica escondido
    mic.hidden = false;
    recog = new SR();
    recog.continuous = false;
    recog.interimResults = true;
    mic.addEventListener('click', function () {
      if (recognizing) { try { recog.stop(); } catch (e) {} return; }
      try { recog.lang = getLang().srLang || 'pt-PT'; recog.start(); } catch (e) {}
    });
    recog.onstart = function () { recognizing = true; mic.classList.add('pcw-mic-on'); if (els.text) els.text.placeholder = getLang().listening; };
    recog.onend = function () { recognizing = false; mic.classList.remove('pcw-mic-on'); if (els.text) els.text.placeholder = getLang().placeholder; };
    recog.onerror = recog.onend;
    recog.onresult = function (e) {
      var txt = '';
      for (var i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (els.text) { els.text.value = txt; els.text.dispatchEvent(new Event('input')); }
    };
  }

  function stripMd(s) {
    return String(s)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_`>~]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function speak(text, btn) {
    if (!('speechSynthesis' in window)) return;
    var synth = window.speechSynthesis;
    if (currentUtter) { synth.cancel(); currentUtter = null; if (btn) btn.classList.remove('pcw-ctrl-on'); return; }
    var u = new SpeechSynthesisUtterance(stripMd(text));
    u.lang = getLang().srLang || 'pt-PT';
    u.onend = u.onerror = function () { currentUtter = null; if (btn) btn.classList.remove('pcw-ctrl-on'); };
    currentUtter = u;
    if (btn) btn.classList.add('pcw-ctrl-on');
    synth.speak(u);
  }

  var OK_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
  function renderChip() {
    var chip = document.getElementById('pcw-chip');
    if (!chip) return;
    if (!pendingFile) { chip.hidden = true; chip.innerHTML = ''; return; }
    chip.hidden = false;
    chip.innerHTML = '<span class="pcw-chip-name">📎 ' + escapeHtml(pendingFile.name) + '</span>' +
      '<button type="button" class="pcw-chip-x" aria-label="x">✕</button>';
    chip.querySelector('.pcw-chip-x').addEventListener('click', function () { pendingFile = null; renderChip(); });
  }
  function chipError(msg) {
    var chip = document.getElementById('pcw-chip');
    if (!chip) return;
    chip.hidden = false;
    chip.innerHTML = '<span class="pcw-chip-err">' + escapeHtml(msg) + '</span>';
    setTimeout(function () { if (!pendingFile) { chip.hidden = true; chip.innerHTML = ''; } }, 2600);
  }
  function setupAttach() {
    var btn = document.getElementById('pcw-attach');
    var input = document.getElementById('pcw-file');
    if (!btn || !input) return;
    btn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.value = '';
      if (!f) return;
      if (OK_FILE_TYPES.indexOf(f.type) < 0) { chipError(getLang().fileType); return; }
      if (f.size > 3 * 1024 * 1024) { chipError(getLang().fileTooBig); return; }
      var reader = new FileReader();
      reader.onload = function () {
        pendingFile = { name: f.name, mimeType: f.type, data: String(reader.result).split(',')[1] || '' };
        renderChip();
      };
      reader.readAsDataURL(f);
    });
  }

  function build() {
    if (document.getElementById('pharus-chat')) return;
    var t = getLang();

    var html = '<div id="pharus-chat">'
      + '<button class="pcw-bubble" id="pcw-bubble" aria-label="' + t.title + '">'
      +   '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>'
      +   '<span class="pcw-dot" id="pcw-dot"></span>'
      + '</button>'
      + '<div class="pcw-panel" id="pcw-panel" aria-hidden="true">'
      +   '<div class="pcw-head">'
      +     '<div class="pcw-avatar">P</div>'
      +     '<div class="pcw-head-txt"><strong>' + t.title + '</strong><span>' + t.sub + '</span></div>'
      +     '<button class="pcw-icon-btn" id="pcw-new" title="' + t.newChat + '" aria-label="' + t.newChat + '">'
      +       '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
      +     '</button>'
      +     '<button class="pcw-icon-btn" id="pcw-hist" title="' + t.history + '" aria-label="' + t.history + '">'
      +       '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>'
      +     '</button>'
      +     '<button class="pcw-icon-btn pcw-x" id="pcw-x" title="' + t.close + '" aria-label="' + t.close + '">'
      +       '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>'
      +     '</button>'
      +   '</div>'
      +   '<div class="pcw-msgs" id="pcw-msgs"></div>'
      +   '<div class="pcw-convos" id="pcw-convos" hidden></div>'
      +   '<form class="pcw-input" id="pcw-input">'
      +     '<div class="pcw-chip" id="pcw-chip" hidden></div>'
      +     '<input type="file" id="pcw-file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden>'
      +     '<button type="button" class="pcw-mic pcw-attach" id="pcw-attach" title="' + t.attach + '" aria-label="' + t.attach + '">'
      +       '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>'
      +     '</button>'
      +     '<button type="button" class="pcw-mic" id="pcw-mic" title="' + t.mic + '" aria-label="' + t.mic + '" hidden>'
      +       '<svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>'
      +     '</button>'
      +     '<button type="button" class="pcw-mic pcw-web" id="pcw-web" title="' + t.web + '" aria-label="' + t.web + '">'
      +       '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>'
      +     '</button>'
      +     '<textarea id="pcw-text" rows="1" placeholder="' + t.placeholder + '" aria-label="' + t.placeholder + '"></textarea>'
      +     '<button type="submit" class="pcw-send" id="pcw-send" aria-label="' + t.send + '">'
      +       '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>'
      +     '</button>'
      +   '</form>'
      +   '<div class="pcw-foot">'
      +     '<a class="pcw-btn pcw-btn-wa" href="https://wa.me/' + WA + '?text=' + encodeURIComponent('Olá! Vim do website da Pharus AI Agency e gostaria de falar com um especialista.') + '" target="_blank" rel="noopener">'
      +       '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>'
      +       t.btnWa
      +     '</a>'
      +     '<a class="pcw-btn pcw-btn-cal" href="' + CAL + '" target="_blank" rel="noopener">'
      +       '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
      +       t.btnCal
      +     '</a>'
      +   '</div>'
      + '</div>'
      + '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);

    els.panel  = document.getElementById('pcw-panel');
    els.dot    = document.getElementById('pcw-dot');
    els.msgs   = document.getElementById('pcw-msgs');
    els.convos = document.getElementById('pcw-convos');
    els.form   = document.getElementById('pcw-input');
    els.text   = document.getElementById('pcw-text');
    els.send   = document.getElementById('pcw-send');

    document.getElementById('pcw-bubble').addEventListener('click', function () {
      var open = els.panel.classList.toggle('pcw-open');
      els.panel.setAttribute('aria-hidden', !open);
      els.dot.style.display = 'none';
      if (open) els.text.focus();
    });
    document.getElementById('pcw-x').addEventListener('click', function () {
      els.panel.classList.remove('pcw-open');
      els.panel.setAttribute('aria-hidden', 'true');
    });
    document.getElementById('pcw-new').addEventListener('click', newChat);
    document.getElementById('pcw-hist').addEventListener('click', openConvos);

    els.text.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); els.form.requestSubmit(); }
    });
    els.text.addEventListener('input', function () {
      els.text.style.height = 'auto';
      els.text.style.height = Math.min(els.text.scrollHeight, 120) + 'px';
    });
    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) { abortStream(); return; } // botao em modo "parar"
      var value = els.text.value.trim();
      if (!value && !pendingFile) return;
      els.text.value = ''; els.text.style.height = 'auto';
      sendMessage(value);
    });

    setupVoice(); // microfone (voz -> texto), se o browser suportar
    setupAttach(); // anexar imagem/PDF
    var webBtn = document.getElementById('pcw-web');
    if (webBtn) webBtn.addEventListener('click', function () {
      webSearchOn = !webSearchOn;
      webBtn.classList.toggle('pcw-web-on', webSearchOn);
    });

    // Estado inicial: se ha uma conversa guardada, carrega-a; senao mostra saudacao.
    if (conversationId) {
      loadConversation(conversationId, true);
    } else {
      resetToGreeting();
    }
  }

  // --- Renderizacao de mensagens ---
  function scrollDown() { els.msgs.scrollTop = els.msgs.scrollHeight; }

  function clearMsgs() { els.msgs.innerHTML = ''; }

  function appendGreeting() {
    var t = getLang();
    var d = document.createElement('div');
    d.className = 'pcw-bot-msg';
    var p = document.createElement('p'); p.textContent = t.greeting;
    d.appendChild(p);
    els.msgs.appendChild(d);
    var box = document.createElement('div');
    box.className = 'pcw-suggests'; box.id = 'pcw-suggests';
    els.msgs.appendChild(box);
    renderSuggestions();
  }

  function renderSuggestions() {
    var box = document.getElementById('pcw-suggests');
    if (!box) return;
    var l = getLang();
    box.innerHTML = '<span class="pcw-suggests-t">' + l.suggestions + '</span>'
      + l.faq.map(function (q) {
          return '<button type="button" class="pcw-faq" data-q="' + encodeURIComponent(q) + '">' + q + '</button>';
        }).join('');
    box.querySelectorAll('.pcw-faq').forEach(function (btn) {
      btn.addEventListener('click', function () {
        sendMessage(decodeURIComponent(btn.getAttribute('data-q')));
      });
    });
  }

  function resetToGreeting() {
    clearMsgs();
    appendGreeting();
    scrollDown();
  }

  function appendUser(textStr) {
    var d = document.createElement('div');
    d.className = 'pcw-user-msg';
    var p = document.createElement('p'); p.textContent = textStr;
    d.appendChild(p);
    els.msgs.appendChild(d);
    scrollDown();
  }

  function appendBot(markdownText, opts) {
    var d = document.createElement('div');
    d.className = 'pcw-bot-msg';
    var body = document.createElement('div');
    body.className = 'pcw-md';
    body.innerHTML = renderMarkdown(markdownText);
    d.appendChild(body);
    addControls(d, function () { return markdownText; }, opts);
    els.msgs.appendChild(d);
    scrollDown();
  }

  /** Linha de controlos por resposta: Copiar, (opcional) Regenerar, (opcional) tokens. */
  function addControls(botDiv, getText, opts) {
    opts = opts || {};
    var l = getLang();
    var old = botDiv.querySelector('.pcw-controls');
    if (old) old.remove();
    var row = document.createElement('div');
    row.className = 'pcw-controls';

    var copy = document.createElement('button');
    copy.className = 'pcw-ctrl'; copy.type = 'button'; copy.textContent = l.copy;
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(getText()).then(function () {
        copy.textContent = getLang().copied;
        setTimeout(function () { copy.textContent = getLang().copy; }, 1500);
      });
    });
    row.appendChild(copy);

    if ('speechSynthesis' in window) {
      var sp = document.createElement('button');
      sp.className = 'pcw-ctrl'; sp.type = 'button'; sp.title = l.speak;
      sp.innerHTML = '<svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg> ' + l.speak;
      sp.addEventListener('click', function () { speak(getText(), sp); });
      row.appendChild(sp);
    }

    if (opts.regen) {
      var regen = document.createElement('button');
      regen.className = 'pcw-ctrl'; regen.type = 'button'; regen.title = l.regenerate;
      regen.innerHTML = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> ' + l.regenerate;
      regen.addEventListener('click', function () {
        if (sending || !lastUserMessage) return;
        botDiv.remove();
        sendMessage(lastUserMessage, { regenerate: true });
      });
      row.appendChild(regen);
    }

    if (opts.tokens) {
      var tk = document.createElement('span');
      tk.className = 'pcw-tokens';
      tk.textContent = opts.tokens + ' ' + l.tokensLabel;
      row.appendChild(tk);
    }

    botDiv.appendChild(row);
  }

  function abortStream() { if (currentAbort) currentAbort.abort(); }

  function setSendMode(isSending) {
    if (!els.send) return;
    if (isSending) {
      els.send.innerHTML = STOP_SVG;
      els.send.classList.add('pcw-stop');
      els.send.setAttribute('aria-label', getLang().stop);
    } else {
      els.send.innerHTML = SEND_SVG;
      els.send.classList.remove('pcw-stop');
      els.send.setAttribute('aria-label', getLang().send);
    }
  }

  // --- Novo chat / carregar / historico ---
  function newChat() {
    conversationId = null;
    localStorage.removeItem('pharus-conversation');
    hideConvos();
    resetToGreeting();
    els.text.focus();
  }

  function loadConversation(id, silent) {
    fetch(API_BASE + '/api/conversation/' + encodeURIComponent(id) + '?sessionId=' + encodeURIComponent(sessionId))
      .then(function (r) { if (!r.ok) throw new Error('404'); return r.json(); })
      .then(function (data) {
        conversationId = id;
        localStorage.setItem('pharus-conversation', id);
        clearMsgs();
        var arr = data.messages || [];
        var lastAssistantIdx = -1;
        arr.forEach(function (m, i) {
          if (m.role === 'assistant') lastAssistantIdx = i;
          if (m.role === 'user') lastUserMessage = m.content;
        });
        arr.forEach(function (m, i) {
          if (m.role === 'user') appendUser(m.content);
          else if (m.role === 'assistant') appendBot(m.content, { regen: i === lastAssistantIdx });
        });
        if (!arr.length) appendGreeting();
        hideConvos();
        scrollDown();
      })
      .catch(function () {
        // conversa inexistente (ex.: apagada) — recomeca limpo
        conversationId = null;
        localStorage.removeItem('pharus-conversation');
        if (!silent) resetToGreeting();
        else resetToGreeting();
      });
  }

  function openConvos() {
    var l = getLang();
    els.convos.innerHTML = '<div class="pcw-convos-head">' + l.convos + '</div>'
      + '<div class="pcw-convos-list" id="pcw-convos-list"><div class="pcw-convos-loading">…</div></div>';
    els.convos.hidden = false;
    fetch(API_BASE + '/api/conversations?sessionId=' + encodeURIComponent(sessionId))
      .then(function (r) { return r.json(); })
      .then(function (data) { renderConvoList(data.conversations || []); })
      .catch(function () { renderConvoList([]); });
  }

  function hideConvos() { if (els.convos) els.convos.hidden = true; }

  function renderConvoList(list) {
    var l = getLang();
    var box = document.getElementById('pcw-convos-list');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<div class="pcw-convos-empty">' + l.noConvos + '</div>';
      return;
    }
    box.innerHTML = '';
    list.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'pcw-convo-item' + (c.id === conversationId ? ' pcw-convo-active' : '');

      var title = document.createElement('button');
      title.type = 'button';
      title.className = 'pcw-convo-title';
      title.textContent = c.title || 'Conversa';
      title.addEventListener('click', function () { loadConversation(c.id); });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'pcw-convo-del';
      del.setAttribute('aria-label', l.del);
      del.title = l.del;
      del.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm(getLang().delConfirm)) return;
        fetch(API_BASE + '/api/conversation/' + encodeURIComponent(c.id) + '?sessionId=' + encodeURIComponent(sessionId), { method: 'DELETE' })
          .then(function () {
            if (c.id === conversationId) { conversationId = null; localStorage.removeItem('pharus-conversation'); resetToGreeting(); }
            openConvos();
          });
      });

      item.appendChild(title);
      item.appendChild(del);
      box.appendChild(item);
    });
  }

  // --- Envio + streaming SSE ---
  var sending = false;
  async function sendMessage(message, opts) {
    if (sending) return;
    opts = opts || {};
    var regenerate = !!opts.regenerate;
    var fileToSend = regenerate ? null : pendingFile; // captura o anexo pendente
    pendingFile = null; renderChip();                 // limpa o chip
    sending = true;
    lastUserMessage = message;
    currentAbort = new AbortController();
    setSendMode(true);
    hideConvos();
    var suggests = document.getElementById('pcw-suggests');
    if (suggests) suggests.remove();

    if (!regenerate) appendUser((message || '') + (fileToSend ? (message ? '  ' : '') + '📎 ' + fileToSend.name : ''));

    var typing = document.createElement('div');
    typing.className = 'pcw-typing';
    typing.appendChild(document.createElement('span'));
    typing.appendChild(document.createElement('span'));
    typing.appendChild(document.createElement('span'));
    els.msgs.appendChild(typing);
    scrollDown();

    await mdReady;

    var botDiv = null, botBody = null, fullText = '', doneTokens = 0;
    function ensureBot() {
      if (botDiv) return;
      typing.remove();
      botDiv = document.createElement('div');
      botDiv.className = 'pcw-bot-msg';
      botBody = document.createElement('div');
      botBody.className = 'pcw-md';
      botDiv.appendChild(botBody);
      els.msgs.appendChild(botDiv);
    }

    try {
      var resp = await fetch(API_BASE + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: currentAbort.signal,
        body: JSON.stringify({ sessionId: sessionId, conversationId: conversationId, message: message, lang: curLang(), regenerate: regenerate, file: fileToSend || undefined, webSearch: webSearchOn })
      });
      if (!resp.ok || !resp.body) throw new Error('HTTP ' + resp.status);

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        var parts = buffer.split('\n\n');
        buffer = parts.pop();
        parts.forEach(function (block) {
          var ev = 'message', data = '';
          block.split('\n').forEach(function (line) {
            if (line.indexOf('event:') === 0) ev = line.slice(6).trim();
            else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
          });
          if (!data) return;
          var payload;
          try { payload = JSON.parse(data); } catch (e) { payload = data; }

          if (ev === 'meta' && payload && payload.conversationId) {
            conversationId = payload.conversationId;
            localStorage.setItem('pharus-conversation', conversationId);
          } else if (ev === 'token') {
            ensureBot();
            fullText += payload;
            botBody.innerHTML = renderMarkdown(fullText);
            scrollDown();
          } else if (ev === 'done') {
            if (payload && payload.tokens) doneTokens = payload.tokens;
            if (conversationId) localStorage.setItem('pharus-conversation', conversationId);
          } else if (ev === 'error') {
            ensureBot();
            botBody.innerHTML = renderMarkdown((payload && payload.message) || getLang().errored);
          }
        });
      }

      if (botDiv && fullText.trim()) {
        addControls(botDiv, function () { return fullText; }, { regen: true, tokens: doneTokens || 0 });
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // geracao interrompida pelo utilizador — mantem o texto parcial
        if (botDiv && fullText.trim()) addControls(botDiv, function () { return fullText; }, { regen: true });
      } else {
        ensureBot();
        botBody.innerHTML = '<p>' + escapeHtml(getLang().errored) + '</p>';
      }
    } finally {
      typing.remove();
      setSendMode(false);
      currentAbort = null;
      scrollDown();
      sending = false;
    }
  }

  /* --- Botão WhatsApp Flutuante permanente --- */
  function buildWaBtn() {
    if (document.getElementById('pharus-wa-float')) return;
    var msg = encodeURIComponent('Olá. Visitei o website da Pharus AI Agency e gostaria de saber como a Inteligência Artificial pode ajudar a minha empresa.');
    var a = document.createElement('a');
    a.id = 'pharus-wa-float';
    a.href = 'https://wa.me/' + WA + '?text=' + msg;
    a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'WhatsApp');
    a.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>';
    document.body.appendChild(a);
  }

  // Atualiza sugestoes/placeholder quando o utilizador muda de idioma (sem reload).
  function hookLanguageSwitch() {
    var _applyLang = window.applyLang;
    if (typeof _applyLang !== 'function' || _applyLang._pharusWrapped) return;
    var wrapped = function (lang) {
      var r = _applyLang.apply(this, arguments);
      try {
        renderSuggestions();
        if (els.text) els.text.placeholder = getLang().placeholder;
      } catch (e) {}
      return r;
    };
    wrapped._pharusWrapped = true;
    window.applyLang = wrapped;
  }

  function init() {
    build();
    buildWaBtn();
    hookLanguageSwitch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
