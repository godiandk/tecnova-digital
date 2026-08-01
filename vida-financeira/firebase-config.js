// ============================================================
// CONFIGURAÇÃO DO FIREBASE — VIDA FINANCEIRA
// ------------------------------------------------------------
// Isto é OPCIONAL. Sem preencher nada, a aplicação funciona à mesma:
// os movimentos ficam guardados no próprio dispositivo.
//
// Preencha só se quiser que a mesma pessoa veja os mesmos movimentos
// no telemóvel e no computador.
//
// 1. Vá a https://console.firebase.google.com/ e crie um projeto grátis
// 2. Active: Build > Authentication > Sign-in method > Email/Password
// 3. Active: Build > Firestore Database > Criar base de dados (modo produção)
// 4. Definições do projeto (engrenagem) > Os teus apps > Web (</>)
// 5. Copie o objecto "firebaseConfig" que o Firebase dá e cole aqui em baixo,
//    substituindo tudo o que está entre as aspas.
// 6. Publique as regras do ficheiro `firestore.rules` (ver INSTRUÇÕES.md)
// ============================================================

const firebaseConfig = {
  apiKey: "COLE-AQUI",
  authDomain: "COLE-AQUI",
  projectId: "COLE-AQUI",
  storageBucket: "COLE-AQUI",
  messagingSenderId: "COLE-AQUI",
  appId: "COLE-AQUI"
};

// ------------------------------------------------------------
// Daqui para baixo não é preciso mexer.
//
// Enquanto a configuração acima estiver por preencher, não chamamos o
// Firebase de todo: se chamássemos, cada página abria com um erro na
// consola e o ecrã da conta ficava a prometer algo que não funciona.
// As páginas testam `window.auth` para saber se há nuvem disponível.
// ------------------------------------------------------------
(function () {
  const porPreencher = Object.values(firebaseConfig)
    .some(v => !v || String(v).startsWith('COLE-AQUI'));

  if (porPreencher || typeof firebase === 'undefined') return;

  try {
    firebase.initializeApp(firebaseConfig);
    window.auth = firebase.auth();
    window.db = firebase.firestore();
  } catch (e) {
    // Configuração errada ou Firebase inacessível: seguimos sem nuvem.
    console.warn('Firebase não iniciado:', e.message);
  }
})();
