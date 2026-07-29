/* ============================================================
   TECNOVA Digital — conversa direta entre o cliente e o Wesley
   ------------------------------------------------------------
   Estrutura no Firestore:
     conversas/{uid}              → dados da conversa
     conversas/{uid}/mensagens/*  → cada mensagem

   Usado em dois sítios:
     conta.html  → TecnovaChat.cliente('#idDoContentor', user)
     admin.html  → TecnovaChat.admin('#idDoContentor')
   ============================================================ */
window.TecnovaChat = (function () {
  'use strict';

  var BOAS_VINDAS =
    'Olá! 👋 Sou o Wesley, da TECNOVA Digital. Esta conversa é direta comigo — ' +
    'não é um robô nem um call center. Escreva aqui sempre que precisar de alguma ' +
    'coisa sobre o seu site: uma alteração, uma dúvida ou uma ideia nova. ' +
    'Respondo no mesmo dia útil.';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function quando(iso) {
    if (!iso) return '';
    var d = new Date(iso), h = new Date();
    var hoje = d.toDateString() === h.toDateString();
    var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (hoje) return hh;
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) + ' ' + hh;
  }

  /* ---------- criar a conversa se ainda não existir ---------- */
  function garantir(uid, dados) {
    var ref = db.collection('conversas').doc(uid);
    return ref.get().then(function (doc) {
      if (doc.exists) return ref;
      var agora = new Date().toISOString();
      return ref.set({
        uid: uid,
        nome: dados.nome || '',
        email: dados.email || '',
        telefone: dados.telefone || '',
        criado: agora,
        ultimaMsg: BOAS_VINDAS,
        ultimaData: agora,
        deQuem: 'admin',
        naoLidasCliente: 1,
        naoLidasAdmin: 0
      }).then(function () {
        return ref.collection('mensagens').add({
          de: 'admin', texto: BOAS_VINDAS, data: agora
        });
      }).then(function () { return ref; });
    });
  }

  /* ---------- enviar uma mensagem ---------- */
  function enviar(uid, de, texto) {
    texto = String(texto || '').trim();
    if (!texto) return Promise.resolve();
    var agora = new Date().toISOString();
    var ref = db.collection('conversas').doc(uid);
    var campo = (de === 'cliente') ? 'naoLidasAdmin' : 'naoLidasCliente';
    var patch = { ultimaMsg: texto, ultimaData: agora, deQuem: de };
    patch[campo] = firebase.firestore.FieldValue.increment(1);
    return ref.collection('mensagens').add({ de: de, texto: texto, data: agora })
      .then(function () { return ref.set(patch, { merge: true }); });
  }

  function marcarLidas(uid, quem) {
    var patch = {};
    patch[quem === 'cliente' ? 'naoLidasCliente' : 'naoLidasAdmin'] = 0;
    return db.collection('conversas').doc(uid).set(patch, { merge: true }).catch(function () {});
  }

  /* ---------- desenhar as bolhas ---------- */
  function pintaMensagens(caixa, msgs, euSou) {
    caixa.innerHTML = msgs.map(function (m) {
      var meu = (m.de === euSou);
      return '<div class="ch-msg ' + (meu ? 'meu' : 'dele') + '">' +
        '<div class="ch-bolha">' + esc(m.texto).replace(/\n/g, '<br>') +
        '<span class="ch-hora">' + quando(m.data) + '</span></div></div>';
    }).join('');
    caixa.scrollTop = caixa.scrollHeight;
  }

  /* ================= LADO DO CLIENTE ================= */
  function cliente(seletor, user, dados) {
    var box = document.querySelector(seletor);
    if (!box || typeof db === 'undefined' || !user) return;

    box.innerHTML =
      '<div class="ch">' +
        '<div class="ch-topo">' +
          '<span class="ch-av">W</span>' +
          '<div><b>Wesley Vianna</b><span>TECNOVA Digital · responde no mesmo dia útil</span></div>' +
        '</div>' +
        '<div class="ch-corpo" id="chCorpo"><p class="ch-vazio">A abrir a conversa…</p></div>' +
        '<form class="ch-envio" id="chForm">' +
          '<textarea id="chTexto" rows="1" placeholder="Escreva aqui…"></textarea>' +
          '<button class="btn btn-gold" type="submit" aria-label="Enviar">Enviar</button>' +
        '</form>' +
      '</div>';

    var corpo = box.querySelector('#chCorpo');
    var form = box.querySelector('#chForm');
    var campo = box.querySelector('#chTexto');

    campo.addEventListener('input', function () {
      campo.style.height = 'auto';
      campo.style.height = Math.min(campo.scrollHeight, 130) + 'px';
    });

    garantir(user.uid, dados || { nome: user.displayName, email: user.email })
      .then(function (ref) {
        ref.collection('mensagens').orderBy('data').onSnapshot(function (snap) {
          var msgs = snap.docs.map(function (d) { return d.data(); });
          if (!msgs.length) { corpo.innerHTML = '<p class="ch-vazio">Ainda não há mensagens.</p>'; return; }
          pintaMensagens(corpo, msgs, 'cliente');
          marcarLidas(user.uid, 'cliente');
        }, function () {
          corpo.innerHTML = '<p class="ch-vazio">Não foi possível abrir a conversa. Verifique a ligação.</p>';
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var t = campo.value.trim(); if (!t) return;
          campo.value = ''; campo.style.height = 'auto';
          enviar(user.uid, 'cliente', t);
        });
        campo.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
        });
      })
      .catch(function () {
        corpo.innerHTML = '<p class="ch-vazio">Não foi possível abrir a conversa neste momento.</p>';
      });
  }

  /* ================= LADO DO ADMIN ================= */
  function admin(seletor, aoContar) {
    var box = document.querySelector(seletor);
    if (!box || typeof db === 'undefined') return;

    box.innerHTML =
      '<div class="ch-admin">' +
        '<div class="ch-lista" id="chLista"><p class="empty">A carregar…</p></div>' +
        '<div class="ch-painel" id="chPainel">' +
          '<p class="empty">Escolha uma conversa à esquerda.</p>' +
        '</div>' +
      '</div>';

    var lista = box.querySelector('#chLista');
    var painel = box.querySelector('#chPainel');
    var aberta = null, unsub = null;

    db.collection('conversas').orderBy('ultimaData', 'desc').onSnapshot(function (snap) {
      var cs = snap.docs.map(function (d) { return { id: d.id, ...d.data() }; });
      var porResponder = cs.filter(function (c) { return (c.naoLidasAdmin || 0) > 0; }).length;
      if (typeof aoContar === 'function') aoContar(porResponder, cs.length);

      if (!cs.length) { lista.innerHTML = '<p class="empty">Ainda não há conversas.</p>'; return; }
      lista.innerHTML = cs.map(function (c) {
        var n = c.naoLidasAdmin || 0;
        return '<button class="ch-item' + (c.id === aberta ? ' on' : '') + '" data-uid="' + esc(c.id) + '">' +
          '<span class="ch-av sm">' + esc((c.nome || '?').charAt(0).toUpperCase()) + '</span>' +
          '<span class="ch-item-txt"><b>' + esc(c.nome || c.email || 'Cliente') + '</b>' +
          '<span>' + esc((c.ultimaMsg || '').slice(0, 52)) + '</span></span>' +
          '<span class="ch-item-dir"><i>' + quando(c.ultimaData) + '</i>' +
          (n ? '<em class="ch-badge">' + n + '</em>' : '') + '</span></button>';
      }).join('');
    }, function () {
      lista.innerHTML = '<p class="empty">Não foi possível carregar as conversas. Confirme as regras do Firestore.</p>';
    });

    lista.addEventListener('click', function (e) {
      var b = e.target.closest('.ch-item'); if (!b) return;
      abrir(b.dataset.uid);
    });

    function abrir(uid) {
      aberta = uid;
      lista.querySelectorAll('.ch-item').forEach(function (x) {
        x.classList.toggle('on', x.dataset.uid === uid);
      });
      db.collection('conversas').doc(uid).get().then(function (doc) {
        var c = doc.data() || {};
        painel.innerHTML =
          '<div class="ch-topo">' +
            '<span class="ch-av">' + esc((c.nome || '?').charAt(0).toUpperCase()) + '</span>' +
            '<div><b>' + esc(c.nome || 'Cliente') + '</b><span>' + esc(c.email || '') +
            (c.telefone ? ' · ' + esc(c.telefone) : '') + '</span></div>' +
          '</div>' +
          '<div class="ch-corpo" id="chACorpo"></div>' +
          '<form class="ch-envio" id="chAForm">' +
            '<textarea id="chATexto" rows="1" placeholder="Responder…"></textarea>' +
            '<button class="btn" type="submit">Responder</button>' +
          '</form>';

        var corpo = painel.querySelector('#chACorpo');
        var form = painel.querySelector('#chAForm');
        var campo = painel.querySelector('#chATexto');

        campo.addEventListener('input', function () {
          campo.style.height = 'auto';
          campo.style.height = Math.min(campo.scrollHeight, 130) + 'px';
        });

        if (unsub) unsub();
        unsub = db.collection('conversas').doc(uid).collection('mensagens').orderBy('data')
          .onSnapshot(function (snap) {
            pintaMensagens(corpo, snap.docs.map(function (d) { return d.data(); }), 'admin');
            marcarLidas(uid, 'admin');
          });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var t = campo.value.trim(); if (!t) return;
          campo.value = ''; campo.style.height = 'auto';
          enviar(uid, 'admin', t);
        });
        campo.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
        });
      });
    }
  }

  return { cliente: cliente, admin: admin, enviar: enviar, garantir: garantir };
})();
