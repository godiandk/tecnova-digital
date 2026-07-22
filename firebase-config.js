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
  apiKey: "AIzaSyAK82iVEqwbA2KxDzDQQ8ZqIQ9gAvUEYzo",
  authDomain: "tecnova-digital-159e3.firebaseapp.com",
  projectId: "tecnova-digital-159e3",
  storageBucket: "tecnova-digital-159e3.firebasestorage.app",
  messagingSenderId: "880317651454",
  appId: "1:880317651454:web:21ca08b9e90d3bda3088af"
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
