// ===== CONFIGURAÇÃO (mesmos valores do script.js) =====
const URL_LISTAR = "https://defaultb61d49822acd47e681e86b2c66e20b.13.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/23/workflows/3fbf1a2a119441dabcb8c284dcae4cfe/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=OdpmDoJPfT2zixNtGYBbnkZJkWrhs2pyVKgk1oPtOUI";
const EMAIL_ADMIN = 'ronady.santos@totalexpress.com.br';
const MAPA_REGIONAIS = {
  'igor.pinheiro@totalexpress.com.br': 'NE',
  'robson.santos@totalexpress.com.br': 'MG/RJ/ES',
  'adriele.costa@totalexpress.com.br': 'SUL',
  'debora.medici@totalexpress.com.br': 'SP',
  'giovanna.gomes@totalexpress.com.br': 'CO/N'
};

// ===== SESSÃO =====
const emailLogado = (sessionStorage.getItem('usuarioAutenticado') || '').toLowerCase();
if (!emailLogado) window.location.href = 'index.html';

const isAdmin = emailLogado === EMAIL_ADMIN;
const regionalDoUsuario = isAdmin ? 'TODAS' : (MAPA_REGIONAIS[emailLogado] || '');
if (!isAdmin && !regionalDoUsuario) window.location.href = 'index.html';

document.getElementById('usuarioLogado').textContent = emailLogado;

// ===== AUXILIARES =====
const $ = (id) => document.getElementById(id);
const criar = (tag, classe, texto) => {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
};
const norm = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, '');

function pegar(item, nomes) {
  for (const n of nomes) if (item[n] !== undefined && item[n] !== null && String(item[n]).trim() !== '') return item[n];
  for (const c of Object.keys(item)) if (nomes.some(n => c.toLowerCase().includes(n.toLowerCase()))) {
    if (item[c] !== undefined && item[c] !== null && String(item[c]).trim() !== '') return item[c];
  }
  return '';
}
const texto = (v) => (v && typeof v === 'object') ? (v.Value || '') : String(v || '');
const soData = (v) => { const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; };
const brData = (iso) => iso ? iso.split('-').reverse().join('/') : '—';
const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const diasEntre = (aISO, bISO) => Math.round((new Date(bISO + 'T00:00:00') - new Date(aISO + 'T00:00:00')) / 86400000);

async function chamarFluxo(payload, url) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(await r.text());
  const t = await r.text();
  return t ? JSON.parse(t) : {};
}

// ===== NORMALIZAÇÃO DOS ITENS =====
function normalizar(item) {
  const sit = String(texto(pegar(item, ['Situacao', 'situacao', 'Status', 'status']))).trim().toLowerCase();
  let grupo = 'pend';
  if (sit === 'finalizado' || sit === 'concluído' || sit === 'concluido') grupo = 'fim';
  else if (sit === 'em andamento') grupo = 'and';

  const criado = String(pegar(item, ['criadoEm', 'CriadoEm', 'Data', 'Created', 'Criado']));
  const d = new Date(criado);
  return {
    id: String(pegar(item, ['idFormulario', 'IDFormulario']) || pegar(item, ['ID', 'id']) || ''),
    problema: texto(pegar(item, ['Problema', 'problema'])),
    regional: texto(pegar(item, ['Regional', 'regional'])),
    area: texto(pegar(item, ['Area', 'area', 'Área'])),
    responsavel: texto(pegar(item, ['Responsavel', 'responsavel', 'Responsável'])),
    grupo,
    mes: isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
    prevFim: soData(pegar(item, ['DataPrevisaoConclusao', 'dataPrevisaoConclusao', 'PrevisaoConclusao', 'Prazo', 'prazo']))
  };
}

// ===== ESTADO =====
let todos = [];
const CORES = { pend: '#e0a100', and: '#2563eb', fim: '#17703a' };
const ROTULOS = { pend: 'Pendente de preenchimento', and: 'Em andamento', fim: 'Concluído' };

// ===== CARGA =====
async function carregar() {
  $('dashMsg').hidden = false;
  $('dashMsg').textContent = 'Carregando...';
  $('dashConteudo').hidden = true;
  try {
    const res = await chamarFluxo({ acao: 'listar', emailLogado }, URL_LISTAR);
    const brutos = res.value || res.itens || res;
    const validos = (Array.isArray(brutos) ? brutos : []).filter(i => i && /problema/i.test(JSON.stringify(i)));
    todos = validos.map(normalizar);

    // Não-admin: só enxerga a própria regional (igual ao formulário)
    if (!isAdmin) todos = todos.filter(i => !i.regional || norm(i.regional) === norm(regionalDoUsuario));

    montarFiltros();
    desenhar();
    $('dashMsg').hidden = true;
    $('dashConteudo').hidden = false;
  } catch (e) {
    console.error(e);
    $('dashMsg').textContent = 'Não foi possível carregar os dados.';
  }
}

function montarFiltros() {
  const preencher = (sel, valores) => {
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todas</option>';
    [...new Set(valores.filter(Boolean))].sort().forEach(v => sel.append(new Option(v, v)));
    sel.value = atual;
  };
  preencher($('fRegional'), todos.map(i => i.regional));
  preencher($('fArea'), todos.map(i => i.area));
  $('boxRegional').style.display = isAdmin ? '' : 'none';
}

function filtrados() {
  const r = $('fRegional').value, a = $('fArea').value, q = $('fBusca').value.trim().toLowerCase();
  return todos.filter(i =>
    (!r || i.regional === r) && (!a || i.area === a) &&
    (!q || (i.problema + ' ' + i.responsavel + ' ' + i.id).toLowerCase().includes(q)));
}

// ===== DESENHO =====
function desenhar() {
  const itens = filtrados();
  const hoje = hojeISO();
  const atrasado = (i) => i.grupo !== 'fim' && i.prevFim && i.prevFim < hoje;
  const contar = (g) => itens.filter(i => i.grupo === g).length;
  const total = itens.length, pend = contar('pend'), and = contar('and'), fim = contar('fim');
  const atrasados = itens.filter(atrasado).length;
  const taxa = total ? Math.round(fim / total * 100) : 0;

  // KPIs
  const kpis = $('kpis');
  kpis.innerHTML = '';
  [['total', 'Total de ocorrências', total], ['pend', 'Pendentes de preenchimento', pend],
   ['and', 'Em andamento', and], ['fim', 'Concluídas (' + taxa + '%)', fim], ['atr', 'Atrasadas', atrasados]]
    .forEach(([cls, rot, n]) => {
      const k = criar('div', 'kpi ' + cls);
      k.append(criar('small', '', rot), criar('strong', '', String(n)));
      kpis.append(k);
    });

  // Donut + legenda
  const partes = [['pend', pend], ['and', and], ['fim', fim]];
  let acc = 0;
  const fatias = total ? partes.map(([g, n]) => {
    const ini = acc; acc += n / total * 100;
    return CORES[g] + ' ' + ini + '% ' + acc + '%';
  }).join(', ') : 'var(--borda) 0 100%';
  $('donut').style.background = 'conic-gradient(' + fatias + ')';
  $('donutTxt').textContent = taxa + '%';
  const leg = $('legendaDonut');
  leg.innerHTML = '';
  partes.forEach(([g, n]) => {
    const li = criar('li');
    const cor = criar('i'); cor.style.background = CORES[g];
    li.append(cor, ROTULOS[g] + ': ' + n);
    leg.append(li);
  });

  // Barras
  barras($('graficoRegional'), itens, 'regional');
  barras($('graficoArea'), itens, 'area');

  // Colunas por mês (últimos 6 meses com dados)
  const porMes = {};
  itens.forEach(i => { if (i.mes) porMes[i.mes] = (porMes[i.mes] || 0) + 1; });
  const meses = Object.keys(porMes).sort().slice(-6);
  const max = Math.max(1, ...meses.map(m => porMes[m]));
  const gm = $('graficoMes');
  gm.innerHTML = '';
  if (!meses.length) gm.append(criar('p', 'vazio', 'Sem dados de data de abertura.'));
  meses.forEach(m => {
    const col = criar('div', 'coluna');
    const pilar = criar('div', 'pilar');
    pilar.style.height = (porMes[m] / max * 100) + '%';
    col.append(criar('b', '', String(porMes[m])), pilar, criar('em', '', m.slice(5) + '/' + m.slice(2, 4)));
    gm.append(col);
  });

  // Tabela de atenção: atrasados + vencendo em até 7 dias
  const atencao = itens
    .filter(i => i.grupo !== 'fim' && i.prevFim && diasEntre(hoje, i.prevFim) <= 7)
    .sort((a, b) => a.prevFim.localeCompare(b.prevFim));
  const tb = $('tabelaAtencao');
  tb.innerHTML = '';
  if (!atencao.length) {
    const tr = criar('tr'); const td = criar('td', 'vazio-td', 'Nenhum plano atrasado ou com prazo próximo.');
    td.colSpan = 7; tr.append(td); tb.append(tr);
  }
  atencao.forEach(i => {
    const tr = criar('tr');
    const dias = diasEntre(hoje, i.prevFim);
    const badge = criar('span', 'badge ' + (dias < 0 ? 'atrasado' : 'pendente'),
      dias < 0 ? 'Atrasado ' + Math.abs(dias) + 'd' : (dias === 0 ? 'Vence hoje' : 'Vence em ' + dias + 'd'));
    const tdSit = criar('td'); tdSit.append(badge);
    tr.append(criar('td', '', i.id.length > 10 ? i.id.slice(0, 8) + '...' : i.id), criar('td', '', i.regional),
      criar('td', '', i.area), criar('td', 'prob', i.problema), criar('td', '', i.responsavel || '—'),
      criar('td', '', brData(i.prevFim)), tdSit);
    tb.append(tr);
  });
}

function barras(el, itens, campo) {
  el.innerHTML = '';
  const grupos = {};
  itens.forEach(i => {
    const k = i[campo] || 'N/D';
    (grupos[k] = grupos[k] || { pend: 0, and: 0, fim: 0, t: 0 });
    grupos[k][i.grupo]++; grupos[k].t++;
  });
  const chaves = Object.keys(grupos).sort((a, b) => grupos[b].t - grupos[a].t);
  if (!chaves.length) { el.append(criar('p', 'vazio', 'Sem dados.')); return; }
  const max = Math.max(...chaves.map(k => grupos[k].t));
  chaves.forEach(k => {
    const g = grupos[k];
    const linha = criar('div', 'barra-linha');
    const trilho = criar('div', 'barra-trilho');
    trilho.style.width = (g.t / max * 100) + '%';
    ['pend', 'and', 'fim'].forEach(s => {
      if (!g[s]) return;
      const seg = criar('span', 'leg-' + s);
      seg.style.width = (g[s] / g.t * 100) + '%';
      seg.title = ROTULOS[s] + ': ' + g[s];
      trilho.append(seg);
    });
    const nome = criar('div', 'nome', k); nome.title = k;
    const caixa = criar('div'); caixa.append(trilho);
    linha.append(nome, caixa, criar('div', 'num', String(g.t)));
    el.append(linha);
  });
}

// ===== EVENTOS =====
['fRegional', 'fArea'].forEach(id => $(id).addEventListener('change', desenhar));
$('fBusca').addEventListener('input', desenhar);
$('btnAtualizar').addEventListener('click', carregar);

carregar();
