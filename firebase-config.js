// ============================================================
// CONFIGURAÇÃO DO FIREBASE — TECNOVA DIGITAL
// ============================================================
// 1. Vai a https://console.firebase.google.com/ e cria um projeto grátis
// 2. Ativa: Build > Authentication > Sign-in method > Email/Password
// 3. Ativa: Build > Firestore Database > Criar base de dados (modo produção)
// 4. Vai a Definições do projeto (ícone de engrenagem) > Os teus apps > Web (</>)
// 5. Copia o objeto "firebaseConfig" que o Firebase te dá e cola AQUI EMBAIXO,
//    substituindo tudo o que está entre as aspas.
// ============================================================

const firebaseConfig = {
  apiKey: "COLA_AQUI_A_TUA_API_KEY",
  authDomain: "COLA_AQUI.firebaseapp.com",
  projectId: "COLA_AQUI",
  storageBucket: "COLA_AQUI.appspot.com",
  messagingSenderId: "COLA_AQUI",
  appId: "COLA_AQUI"
};

// Lista de emails que têm acesso ao painel administrativo (admin.html).
// Coloca aqui o TEU email (o mesmo que vais usar para criar conta no site).
const ADMIN_EMAILS = [
  "wly.vianna@gmail.com"
];

// Não precisas mexer daqui para baixo.
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
