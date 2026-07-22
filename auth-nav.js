// Mostra avatar + primeiro nome no menu quando o visitante já tem sessão
// iniciada. Requer firebase-config.js carregado antes deste ficheiro.
(function () {
  var link = document.getElementById('navAccount');
  if (!link || typeof auth === 'undefined') return;
  var defaultHTML = link.innerHTML;

  function avatarHTML(dados) {
    if (dados && dados.foto) {
      return '<span class="nav-avatar"><img src="' + dados.foto + '" alt=""></span>';
    }
    var icon = dados && dados.sexo === 'feminino' ? '👩' : dados && dados.sexo === 'masculino' ? '👨' : '👤';
    return '<span class="nav-avatar">' + icon + '</span>';
  }

  auth.onAuthStateChanged(async function (user) {
    if (!user) {
      link.classList.remove('nav-account');
      link.innerHTML = defaultHTML;
      return;
    }
    var dados = {};
    try {
      var doc = await db.collection('clientes').doc(user.uid).get();
      if (doc.exists) dados = doc.data();
    } catch (e) {}
    var nome = (dados.nome || user.displayName || user.email || '').split(' ')[0];
    link.classList.add('nav-account');
    link.innerHTML = avatarHTML(dados) + '<span>' + nome + '</span>';
  });
})();
