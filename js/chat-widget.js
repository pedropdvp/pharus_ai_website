/* ============================================================
   CHAT WIDGET — Pharus AI Agency
   Assistente virtual flutuante com FAQ, WhatsApp e Calendly
   ============================================================ */
(function () {
  var WA  = '351912484143';
  var CAL = 'https://calendly.com/pedropdvp/reuniao-pharus-ai';

  var LANG = {
    pt: {
      title:    'Assistente Pharus AI',
      sub:      'Respondo em segundos',
      greeting: 'Olá! Sou o assistente virtual da Pharus AI Agency. Em que posso ajudar?',
      faq: [
        { q: 'Quanto custa um Agente IA?',
          a: 'Os nossos pacotes partem de €1.500 para soluções básicas. O valor final depende da complexidade e dos processos a automatizar. Preparamos uma proposta personalizada sem compromisso.' },
        { q: 'Quanto tempo demora a implementação?',
          a: 'Uma implementação simples fica pronta em 2 a 4 semanas. Projetos mais complexos levam entre 1 a 3 meses, conforme o âmbito e os sistemas existentes.' },
        { q: 'Que processos posso automatizar?',
          a: 'Atendimento a clientes, geração de relatórios, envio de emails, qualificação de leads, gestão de agendamentos, análise de dados e criação de conteúdos, entre outros.' },
        { q: 'Trabalham com pequenas empresas?',
          a: 'Sim! Trabalhamos com empresas de todos os tamanhos. Temos soluções adaptadas a PMEs com resultados rápidos e retorno mensurável.' },
        { q: 'Fazem formação em IA?',
          a: 'Sim. Oferecemos formações práticas para equipas, desde introdução à IA até uso avançado de copilotos e agentes. Disponíveis em formato presencial ou online.' }
      ],
      transfer:  'Prefere falar diretamente com a nossa equipa?',
      btnWa:     'Falar com Especialista',
      btnCal:    'Agendar Reunião',
      close:     'Fechar'
    },
    en: {
      title:    'Pharus AI Assistant',
      sub:      'I reply in seconds',
      greeting: 'Hello! I\'m the virtual assistant of Pharus AI Agency. How can I help?',
      faq: [
        { q: 'How much does an AI Agent cost?',
          a: 'Our packages start from €1,500 for basic solutions. The final value depends on the complexity and processes to be automated. We prepare a personalised proposal with no commitment.' },
        { q: 'How long does implementation take?',
          a: 'A simple implementation can be ready in 2 to 4 weeks. More complex projects take 1 to 3 months depending on scope and existing systems.' },
        { q: 'What processes can I automate?',
          a: 'Customer service, report generation, email sending, lead qualification, appointment management, data analysis and content creation, among others.' },
        { q: 'Do you work with small companies?',
          a: 'Yes! We work with companies of all sizes. We have solutions tailored to SMEs with quick results and measurable returns.' },
        { q: 'Do you offer AI training?',
          a: 'Yes. We offer practical training for teams, from AI introduction to advanced use of copilots and agents. Available in-person or online.' }
      ],
      transfer:  'Would you prefer to speak directly with our team?',
      btnWa:     'Speak to a Specialist',
      btnCal:    'Schedule a Meeting',
      close:     'Close'
    },
    fr: {
      title:    'Assistant Pharus AI',
      sub:      'Je réponds en quelques secondes',
      greeting: 'Bonjour ! Je suis l\'assistant virtuel de Pharus AI Agency. Comment puis-je vous aider ?',
      faq: [
        { q: 'Combien coûte un Agent IA ?',
          a: 'Nos forfaits commencent à partir de 1 500 € pour des solutions de base. La valeur finale dépend de la complexité et des processus à automatiser. Nous préparons une proposition personnalisée sans engagement.' },
        { q: 'Combien de temps dure l\'implémentation ?',
          a: 'Une implémentation simple est prête en 2 à 4 semaines. Les projets plus complexes prennent 1 à 3 mois selon le périmètre et les systèmes existants.' },
        { q: 'Quels processus puis-je automatiser ?',
          a: 'Service client, génération de rapports, envoi d\'emails, qualification de leads, gestion des rendez-vous, analyse de données et création de contenus, entre autres.' },
        { q: 'Travaillez-vous avec les petites entreprises ?',
          a: 'Oui ! Nous travaillons avec des entreprises de toutes tailles. Nous avons des solutions adaptées aux PME avec des résultats rapides et un retour mesurable.' },
        { q: 'Proposez-vous des formations en IA ?',
          a: 'Oui. Nous proposons des formations pratiques pour les équipes, de l\'introduction à l\'IA à l\'utilisation avancée des copilotos et agents. Disponibles en présentiel ou en ligne.' }
      ],
      transfer:  'Vous préférez parler directement avec notre équipe ?',
      btnWa:     'Parler à un spécialiste',
      btnCal:    'Planifier une réunion',
      close:     'Fermer'
    }
  };

  function getLang() {
    var l = localStorage.getItem('lang') || 'pt';
    return LANG[l] || LANG.pt;
  }

  function build() {
    if (document.getElementById('pharus-chat')) return;
    var t = getLang();

    var faqHTML = t.faq.map(function(item, i) {
      return '<button class="pcw-faq" data-i="' + i + '">' + item.q + '</button>';
    }).join('');

    var html = '<div id="pharus-chat">'
      + '<button class="pcw-bubble" id="pcw-bubble" aria-label="' + t.title + '">'
      +   '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>'
      +   '<span class="pcw-dot" id="pcw-dot"></span>'
      + '</button>'
      + '<div class="pcw-panel" id="pcw-panel" aria-hidden="true">'
      +   '<div class="pcw-head">'
      +     '<div class="pcw-avatar">P</div>'
      +     '<div class="pcw-head-txt"><strong>' + t.title + '</strong><span>' + t.sub + '</span></div>'
      +     '<button class="pcw-x" id="pcw-x" aria-label="' + t.close + '">'
      +       '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>'
      +     '</button>'
      +   '</div>'
      +   '<div class="pcw-msgs" id="pcw-msgs">'
      +     '<div class="pcw-bot-msg"><p>' + t.greeting + '</p>'
      +       '<div class="pcw-faq-list">' + faqHTML + '</div>'
      +     '</div>'
      +   '</div>'
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

    var bubble = document.getElementById('pcw-bubble');
    var panel  = document.getElementById('pcw-panel');
    var dot    = document.getElementById('pcw-dot');
    var msgs   = document.getElementById('pcw-msgs');

    bubble.addEventListener('click', function () {
      var open = panel.classList.toggle('pcw-open');
      panel.setAttribute('aria-hidden', !open);
      dot.style.display = 'none';
    });

    document.getElementById('pcw-x').addEventListener('click', function () {
      panel.classList.remove('pcw-open');
      panel.setAttribute('aria-hidden', 'true');
    });

    document.querySelectorAll('.pcw-faq').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx  = parseInt(btn.getAttribute('data-i'));
        var item = getLang().faq[idx];

        var userDiv = document.createElement('div');
        userDiv.className = 'pcw-user-msg';
        userDiv.innerHTML = '<p>' + item.q + '</p>';
        msgs.appendChild(userDiv);

        var typingDiv = document.createElement('div');
        typingDiv.className = 'pcw-typing';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        msgs.appendChild(typingDiv);
        msgs.scrollTop = msgs.scrollHeight;

        setTimeout(function () {
          typingDiv.remove();
          var botDiv = document.createElement('div');
          botDiv.className = 'pcw-bot-msg';
          botDiv.innerHTML = '<p>' + item.a + '</p>'
            + '<p class="pcw-transfer">' + getLang().transfer + '</p>';
          msgs.appendChild(botDiv);
          msgs.scrollTop = msgs.scrollHeight;
        }, 900);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
