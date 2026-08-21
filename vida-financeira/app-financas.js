/* ============================================================
   Vida Financeira — lógica do painel

   Onde ficam os dados
   -------------------
   Sem conta iniciada, tudo fica no `localStorage` deste navegador —
   funciona offline e sem configurar nada. Com conta iniciada (Firebase),
   os mesmos movimentos são gravados também em
   `utilizadores/{uid}/movimentos`, para aparecerem noutro telemóvel.

   O localStorage é sempre a cópia de trabalho: se o Firebase estiver em
   baixo, ou não estiver configurado, a app continua a funcionar na mesma.
   ============================================================ */

const CHAVE = 'vf:movimentos';
const MOEDA_CHAVE = 'vf:moeda';

const CATEGORIAS = {
  saida: [
    { id: 'casa',      nome: 'Casa e rendas',   emoji: '🏠' },
    { id: 'mercado',   nome: 'Mercado',         emoji: '🛒' },
    { id: 'transporte',nome: 'Transporte',      emoji: '🚗' },
    { id: 'saude',     nome: 'Saúde',           emoji: '💊' },
    { id: 'educacao',  nome: 'Educação',        emoji: '📚' },
    { id: 'lazer',     nome: 'Lazer',           emoji: '🎬' },
    { id: 'contas',    nome: 'Contas e serviços',emoji: '🧾' },
    { id: 'dividas',   nome: 'Dívidas',         emoji: '💳' },
    { id: 'outros-s',  nome: 'Outros',          emoji: '📦' }
  ],
  entrada: [
    { id: 'salario',   nome: 'Salário',         emoji: '💼' },
    { id: 'extra',     nome: 'Trabalho extra',  emoji: '🛠️' },
    { id: 'vendas',    nome: 'Vendas',          emoji: '🏷️' },
    { id: 'juros',     nome: 'Juros e rendimentos', emoji: '📈' },
    { id: 'presente',  nome: 'Presente',        emoji: '🎁' },
    { id: 'outros-e',  nome: 'Outros',          emoji: '📦' }
  ]
};

const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];

/* ---------- estado ---------- */
let movimentos = [];
let tipoActual = 'saida';
let filtro = 'todos';
let moeda = localStorage.getItem(MOEDA_CHAVE) || 'EUR';
const hoje = new Date();
let mesVisto = { ano: hoje.getFullYear(), mes: hoje.getMonth() };
let utilizador = null;   // preenchido pelo Firebase, se houver conta

/* ---------- utilitários ---------- */
function dinheiro(v) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency', currency: moeda, minimumFractionDigits: 2
  }).format(v || 0);
}

function catInfo(tipo, id) {
  const lista = CATEGORIAS[tipo] || [];
  return lista.find(c => c.id === id) || { nome: 'Outros', emoji: '📦' };
}

function idNovo() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Guarda no navegador e, se houver conta iniciada, também na nuvem. */
function guardar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(movimentos));
  } catch (e) {
    // Modo privado do Safari pode recusar a escrita. Não vale perder o
    // ecrã por causa disso — avisamos e seguimos só em memória.
    mostrarAviso('Não foi possível guardar neste navegador. Os movimentos ficam só até fechar a página.', 'erro');
  }
  if (utilizador && window.db) {
    db.collection('utilizadores').doc(utilizador.uid)
      .set({ movimentos, actualizado: new Date().toISOString() }, { merge: true })
      .catch(() => mostrarAviso('Gravado neste telemóvel, mas ainda não na nuvem.', 'info'));
  }
}

function carregarLocal() {
  try {
    movimentos = JSON.parse(localStorage.getItem(CHAVE) || '[]');
  } catch (e) {
    movimentos = [];
  }
  if (!Array.isArray(movimentos)) movimentos = [];
}

function mostrarAviso(texto, tipo) {
  const el = document.getElementById('aviso');
  if (!el) return;
  el.textContent = texto;
  el.className = 'aviso ' + (tipo || 'info');
  el.hidden = false;
  clearTimeout(mostrarAviso._t);
  mostrarAviso._t = setTimeout(() => { el.hidden = true; }, 5000);
}

/* ---------- filtro do mês visto ---------- */
function doMes(m) {
  const d = new Date(m.data + 'T00:00:00');
  return d.getFullYear() === mesVisto.ano && d.getMonth() === mesVisto.mes;
}

/* ---------- desenhar ---------- */
function desenharMes() {
  document.getElementById('mes-nome').textContent =
    MESES[mesVisto.mes] + ' ' + mesVisto.ano;
}

function desenharResumo(doMesActual) {
  const entradas = doMesActual.filter(m => m.tipo === 'entrada')
                              .reduce((s, m) => s + m.valor, 0);
  const saidas = doMesActual.filter(m => m.tipo === 'saida')
                            .reduce((s, m) => s + m.valor, 0);
  const saldo = entradas - saidas;

  document.getElementById('v-entradas').textContent = dinheiro(entradas);
  document.getElementById('v-saidas').textContent = dinheiro(saidas);
  const elSaldo = document.getElementById('v-saldo');
  elSaldo.textContent = dinheiro(saldo);
  elSaldo.classList.toggle('neg', saldo < 0);
}

function desenharLista(doMesActual) {
  const ul = document.getElementById('lista');
  const vazio = document.getElementById('vazio');

  let visiveis = doMesActual;
  if (filtro !== 'todos') visiveis = visiveis.filter(m => m.tipo === filtro);
  visiveis = visiveis.slice().sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));

  ul.innerHTML = '';
  vazio.hidden = visiveis.length > 0;

  visiveis.forEach(m => {
    const info = catInfo(m.tipo, m.categoria);
    const li = document.createElement('li');

    const ic = document.createElement('div');
    ic.className = 'mv-ic';
    ic.textContent = info.emoji;

    const txt = document.createElement('div');
    txt.className = 'mv-txt';
    const b = document.createElement('b');
    b.textContent = m.descricao || info.nome;
    const sp = document.createElement('span');
    const d = new Date(m.data + 'T00:00:00');
    sp.textContent = info.nome + ' · ' + d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
    txt.append(b, sp);

    const val = document.createElement('div');
    val.className = 'mv-val ' + m.tipo;
    val.textContent = (m.tipo === 'saida' ? '−' : '+') + ' ' + dinheiro(m.valor);

    const del = document.createElement('button');
    del.className = 'mv-del';
    del.type = 'button';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Apagar ' + (m.descricao || info.nome));
    del.addEventListener('click', () => apagar(m.id));

    li.append(ic, txt, val, del);
    ul.appendChild(li);
  });
}

function desenharCategorias(doMesActual) {
  const ul = document.getElementById('cats');
  const nada = document.getElementById('cats-vazio');
  const saidas = doMesActual.filter(m => m.tipo === 'saida');
  const total = saidas.reduce((s, m) => s + m.valor, 0);

  ul.innerHTML = '';
  nada.hidden = saidas.length > 0;
  if (!saidas.length) return;

  const porCat = {};
  saidas.forEach(m => { porCat[m.categoria] = (porCat[m.categoria] || 0) + m.valor; });

  Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, soma]) => {
      const info = catInfo('saida', id);
      const pct = total ? Math.round(soma / total * 100) : 0;

      const li = document.createElement('li');
      const linha = document.createElement('div');
      linha.className = 'cat-linha';
      const b = document.createElement('b');
      b.textContent = info.emoji + ' ' + info.nome;
      const sp = document.createElement('span');
      sp.textContent = dinheiro(soma) + ' · ' + pct + '%';
      linha.append(b, sp);

      const barra = document.createElement('div');
      barra.className = 'barra';
      const i = document.createElement('i');
      i.style.width = pct + '%';
      barra.appendChild(i);

      li.append(linha, barra);
      ul.appendChild(li);
    });
}

function desenhar() {
  const doMesActual = movimentos.filter(doMes);
  desenharMes();
  desenharResumo(doMesActual);
  desenharLista(doMesActual);
  desenharCategorias(doMesActual);
}

/* ---------- acções ---------- */
function preencherCategorias() {
  const sel = document.getElementById('f-categoria');
  sel.innerHTML = '';
  CATEGORIAS[tipoActual].forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.emoji + '  ' + c.nome;
    sel.appendChild(o);
  });
}

function trocarTipo(tipo) {
  tipoActual = tipo;
  document.querySelectorAll('.tipo-sel button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo));
  });
  preencherCategorias();
}

function adicionar(ev) {
  ev.preventDefault();
  const valorBruto = document.getElementById('f-valor').value.replace(',', '.');
  const valor = parseFloat(valorBruto);

  if (!isFinite(valor) || valor <= 0) {
    mostrarAviso('Escreva um valor maior do que zero.', 'erro');
    return;
  }

  movimentos.push({
    id: idNovo(),
    tipo: tipoActual,
    valor: Math.round(valor * 100) / 100,
    categoria: document.getElementById('f-categoria').value,
    descricao: document.getElementById('f-descricao').value.trim().slice(0, 120),
    data: document.getElementById('f-data').value
  });

  guardar();

  // Saltar para o mês do movimento que acabou de ser lançado, senão ele
  // é gravado mas não aparece — e parece que se perdeu.
  const d = new Date(document.getElementById('f-data').value + 'T00:00:00');
  mesVisto = { ano: d.getFullYear(), mes: d.getMonth() };

  document.getElementById('f-valor').value = '';
  document.getElementById('f-descricao').value = '';
  desenhar();
  mostrarAviso('Movimento lançado.', 'ok');
}

function apagar(id) {
  const m = movimentos.find(x => x.id === id);
  if (!m) return;
  if (!confirm('Apagar "' + (m.descricao || catInfo(m.tipo, m.categoria).nome) + '"?')) return;
  movimentos = movimentos.filter(x => x.id !== id);
  guardar();
  desenhar();
}

function mudarMes(passo) {
  let mes = mesVisto.mes + passo;
  let ano = mesVisto.ano;
  if (mes < 0) { mes = 11; ano--; }
  if (mes > 11) { mes = 0; ano++; }
  mesVisto = { ano, mes };
  desenhar();
}

function exportarCSV() {
  const linhas = [['data', 'tipo', 'categoria', 'descricao', 'valor']];
  movimentos.slice()
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach(m => {
      linhas.push([
        m.data,
        m.tipo,
        catInfo(m.tipo, m.categoria).nome,
        (m.descricao || '').replace(/"/g, '""'),
        String(m.valor).replace('.', ',')
      ]);
    });

  const csv = linhas.map(l => l.map(c => '"' + c + '"').join(';')).join('\r\n');
  // O BOM faz o Excel abrir os acentos correctamente.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vida-financeira.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function apagarTudo() {
  if (!confirm('Isto apaga TODOS os movimentos, de todos os meses. Tem a certeza?')) return;
  if (!confirm('Última confirmação: apagar tudo?')) return;
  movimentos = [];
  guardar();
  desenhar();
  mostrarAviso('Todos os movimentos foram apagados.', 'info');
}

/* ---------- nuvem (opcional) ---------- */
function ligarNuvem() {
  if (typeof firebase === 'undefined' || !window.auth) return;

  auth.onAuthStateChanged(u => {
    utilizador = u;
    const nota = document.getElementById('nota-nuvem');
    if (!u) {
      if (nota) nota.textContent = 'Os movimentos estão guardados só neste dispositivo. Inicie sessão para os ter em qualquer telemóvel.';
      return;
    }
    if (nota) nota.textContent = 'Sessão iniciada como ' + (u.email || 'utilizador') + ' — os movimentos são sincronizados.';

    db.collection('utilizadores').doc(u.uid).get()
      .then(doc => {
        const naNuvem = (doc.exists && Array.isArray(doc.data().movimentos)) ? doc.data().movimentos : [];
        if (!naNuvem.length) {
          // Primeira vez nesta conta: enviamos o que já existe no telemóvel.
          if (movimentos.length) guardar();
          return;
        }
        // Junta os dois lados pelo id, sem apagar nada de nenhum.
        const porId = {};
        naNuvem.concat(movimentos).forEach(m => { if (m && m.id) porId[m.id] = m; });
        movimentos = Object.values(porId);
        guardar();
        desenhar();
      })
      .catch(() => mostrarAviso('Não foi possível ler os movimentos da nuvem. A usar a cópia deste dispositivo.', 'info'));
  });
}

/* ---------- arranque ---------- */
document.addEventListener('DOMContentLoaded', () => {
  carregarLocal();

  document.getElementById('f-data').value = new Date().toISOString().slice(0, 10);
  document.getElementById('f-moeda').value = moeda;

  trocarTipo('saida');

  document.querySelectorAll('.tipo-sel button').forEach(b => {
    b.addEventListener('click', () => trocarTipo(b.dataset.tipo));
  });
  document.querySelectorAll('.filtro button').forEach(b => {
    b.addEventListener('click', () => {
      filtro = b.dataset.filtro;
      document.querySelectorAll('.filtro button').forEach(x => {
        x.setAttribute('aria-pressed', String(x.dataset.filtro === filtro));
      });
      desenhar();
    });
  });

  document.getElementById('form').addEventListener('submit', adicionar);
  document.getElementById('mes-antes').addEventListener('click', () => mudarMes(-1));
  document.getElementById('mes-depois').addEventListener('click', () => mudarMes(1));
  document.getElementById('exportar').addEventListener('click', exportarCSV);
  document.getElementById('apagar-tudo').addEventListener('click', apagarTudo);
  document.getElementById('f-moeda').addEventListener('change', e => {
    moeda = e.target.value;
    localStorage.setItem(MOEDA_CHAVE, moeda);
    desenhar();
  });

  desenhar();
  ligarNuvem();
});
