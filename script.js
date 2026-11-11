//VARIÁVEIS GLOBAIS
const URL_SALVAR = 'https://defaultb61d49822acd47e681e86b2c66e20b.13.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/13/workflows/348016b3bde54a47b4159b6b45544cba/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=NlhP96NiVsK85m-VTk7gLW9qbFpsnTqMR-YP6R5ZO60';
const URL_LISTAR = 'https://defaultb61d49822acd47e681e86b2c66e20b.13.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/23/workflows/3fbf1a2a119441dabcb8c284dcae4cfe/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=OdpmDoJPfT2zixNtGYBbnkZJkWrhs2pyVKgk1oPtOUI';
const URL_VALIDAR_USUARIO = 'https://defaultb61d49822acd47e681e86b2c66e20b.13.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/08/workflows/b299d152bc6b4bc2a1865e21ab01b5fb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=5z2scHhFAcu_y4_t8jARTGu4cZNyH5dqPuiR_oV69XQ';
const DOMINIO_PERMITIDO = '@totalexpress.com.br';

const form = document.getElementById('formPlano');
const ICONE_CALENDARIO = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>';

let idEmEdicao = null;
let todosOsItens = [];
let filtroAtual = 'todos';
const POR_PAGINA = 5;
let paginaAtual = 1;
let idFormulario = '';
let isTelaCriacao = true;

// VARIÁVEIS DE ACESSO
let emailLogado = "";
let isAdmin = false;
let regionalDoUsuario = "";

// MAPEAMENTO DE ACESSOS
const MAPA_REGIONAIS = {
  'igor.pinheiro@totalexpress.com.br': 'NE',
  'robson.santos@totalexpress.com.br': 'MG/RJ/ES',
  'adriele.costa@totalexpress.com.br': 'SUL',
  'debora.medici@totalexpress.com.br': 'SP',
  'giovanna.gomes@totalexpress.com.br': 'CO/N'
};
const EMAIL_ADMIN = 'ronady.santos@totalexpress.com.br';

// LOGIN
const telaLogin = document.getElementById('telaLogin');
const formLogin = document.getElementById('formLogin');
const loginEmail = document.getElementById('loginEmail');
const loginErro = document.getElementById('loginErro');

// Se já existe sessão ativa, libera o acesso direto (sem pedir login novamente)
if (sessionStorage.getItem('usuarioAutenticado')) {
  liberarAcesso(sessionStorage.getItem('usuarioAutenticado'));
}

//valida domínio + chama API de validação
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim().toLowerCase();
  
//Verifica se pertence ao domínio permitido
  if (!email.endsWith(DOMINIO_PERMITIDO)) {
    mostrarErroLogin('Use seu e-mail corporativo ' + DOMINIO_PERMITIDO);
    return;
  }
  
 // Desabilita o botão e mostra spinner durante a verificação
  const botao = formLogin.querySelector('button');
  const textoOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = '<svg class="ic" viewBox="0 0 24 24" style="animation: girar 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Verificando...';
  loginErro.hidden = true;
  
  // Cria timeout de 15s para evitar travamento caso o servidor não responda
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(URL_VALIDAR_USUARIO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const dados = await resp.json();
    
// Se válido, salva na sessão e libera o acesso
    if (dados.valido) {
      sessionStorage.setItem('usuarioAutenticado', email); 
      liberarAcesso(email); 
    } else {
      mostrarErroLogin(dados.mensagem || 'E-mail não encontrado ou conta inativa.');
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      mostrarErroLogin('O servidor demorou muito para responder. Tente novamente.');
    } else {
      mostrarErroLogin('E-mail não corporativo ou conta inativa.');
    }
  } finally {
    
    // Restaura o botão ao estado original
    clearTimeout(timeoutId);
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
  }
});

// Libera o acesso à aplicação após login validado
function liberarAcesso(nomeUsuario) {
  telaLogin.hidden = true;
  telaLogin.style.display = 'none';
  
  emailLogado = nomeUsuario.toLowerCase();
  
  if (emailLogado === EMAIL_ADMIN) {
    
     // Caso ADMIN: vê tudo, começa na tela de criação
    isAdmin = true;
    regionalDoUsuario = "TODAS";
    mostrarTelaCriacao();
  } else if (MAPA_REGIONAIS[emailLogado]) {
    
     // Trava o select de regional para esta pessoa
    isAdmin = false;
    regionalDoUsuario = MAPA_REGIONAIS[emailLogado];
    

    const selectRegional = form.elements['regional'];
    selectRegional.innerHTML = `<option>${regionalDoUsuario}</option>`;
    selectRegional.classList.add('bloqueado');
    
    // Se veio com ?id= na URL, abre direto aquele formulário; senão vai pra lista
    const urlParams = new URLSearchParams(window.location.search);
    const idDaUrl = urlParams.get('id');
    
    if (idDaUrl) {
      carregarFormularios(idDaUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      mostrarTelaLista();
    }
  } else {
    
     // E-mail existe no domínio, mas não tem permissão mapeada
    alert('Acesso negado. Seu e-mail não possui permissão de acesso.\nContate o administrador.');
    sessionStorage.removeItem('usuarioAutenticado');
    window.location.reload();
  }
}

// Exibe uma mensagem de erro na tela de login
function mostrarErroLogin(msg) {
  loginErro.textContent = msg;
  loginErro.hidden = false;
}

// FUNÇÕES AUXILIARES 

// Wrapper de fetch para chamar os fluxos do Power Automate
async function chamarFluxo(payload, url) {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resposta.ok) throw new Error(await resposta.text());
  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : {};
}

// Lê todos os campos do formulário como objeto {name: value}
function lerCampos() {
  const dados = {};
  [...form.elements].forEach(el => { if (el.name) dados[el.name] = el.value; });
  return dados;
}

// Atualiza os contadores de caracteres das textareas
function atualizarContadores() {
  form.querySelectorAll('textarea').forEach(t => {
    t.parentElement.querySelector('.contador').textContent = t.value.length + '/' + t.maxLength;
  });
}

// Cria um elemento DOM de forma enxuta
function criar(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

// Gera um ID numérico de 6 dígitos único para o formulário
function gerarIdFormulario() {
  let id;
  do {
    id = String(Math.floor(100000 + Math.random() * 900000));
  } while (todosOsItens.some(item => lerIdFormulario(item) === id));
  return id;
}

// Extrai o ID do formulário de um item 
function lerIdFormulario(item) {
  for (const chave of Object.keys(item)) {
    if (chave.toLowerCase().replace(/[^a-z]/g, '') === 'idformulario' && item[chave]) {
      return String(item[chave]);
    }
  }
  return '';
}

// Exibe o ID do formulário atual no cabeçalho
function mostrarId() {
  document.getElementById('idForm').textContent = idFormulario;
}

// Formata data/hora completa no padrão brasileiro
function formatarData(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (isNaN(d)) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

// Formata apenas data
function formatarDataSimples(valor) {
  if (!valor) return '';
  const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;       // não passa por fuso horário
  const d = new Date(valor);
  return isNaN(d) ? '' : d.toLocaleDateString('pt-BR');
}

//FILTRO DE PERMISSÃO

// Normaliza o nome da regional para comparação
function normalizarRegional(v) {
  return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
}

// Extrai o valor de "regional" de um item, aceitando variações do nome da chave
function lerRegionalItem(item) {
  const chaves = Object.keys(item);
  const chave = chaves.find(c => c.toLowerCase() === 'regional') ||
                chaves.find(c => c.toLowerCase().includes('regional'));
  if (!chave) return null;
  const v = item[chave];
  return (v && typeof v === 'object') ? (v.Value || '') : v;
}

// Filtra a lista de itens conforme a permissão do usuário
// - Admin: vê tudo
// - Regional: vê apenas os da sua regional (e itens sem regional definida)
function filtrarPorPermissao(itens) {
  if (isAdmin) return itens;
  const minha = normalizarRegional(regionalDoUsuario);
  if (!minha) return [];
  return itens.filter(i => {
    const reg = lerRegionalItem(i);
    if (reg === null) return true;
    return normalizarRegional(reg) === minha;
  });
}

//  CONTROLE DE TELAS

// Exibe a tela de criação de nova ocorrência (somente admin)
function mostrarTelaCriacao() {
  if (!isAdmin) return;
  
  isTelaCriacao = true;
  form.reset();
  idEmEdicao = null;
  idFormulario = gerarIdFormulario();
  mostrarId();
  atualizarContadores();
  
  // Desbloqueia todos os campos
  form.querySelectorAll('.bloqueado').forEach(c => c.classList.remove('bloqueado'));
  form.querySelectorAll('input, select, textarea').forEach(c => { c.readOnly = false; c.disabled = false; });

  document.getElementById('tituloFormulario').textContent = 'Nova Ocorrência';
  document.getElementById('camposExtras').style.display = 'none';
  
  // Esconde o painel da lista e ajusta o layout
  document.getElementById('painelLista').style.display = 'none';
  document.querySelector('.layout').classList.add('sem-lista');
  
 // Ajusta botões visíveis
  document.getElementById('btnVerLista').style.display = 'inline-flex';
  document.getElementById('btnEnviarOcorrencia').style.display = 'inline-flex';
  document.getElementById('btnVoltarLista').style.display = 'none';
  document.getElementById('btnConcluir').style.display = 'none';
  document.getElementById('btnSalvarProgresso').style.display = 'none';
  
  document.getElementById('avisoEdicao').hidden = true;
}

// Exibe a tela de listagem de ocorrências
function mostrarTelaLista() {
  isTelaCriacao = false;
  document.getElementById('painelLista').style.display = 'block'; 
  document.querySelector('.layout').classList.remove('sem-lista');
  
  document.getElementById('tituloFormulario').textContent = 'Detalhes da Ocorrência';
  document.getElementById('camposExtras').style.display = 'block';
  
 // Ajusta botões visíveis
  document.getElementById('btnVerLista').style.display = 'none';
  document.getElementById('btnEnviarOcorrencia').style.display = 'none';
  document.getElementById('btnSalvarProgresso').style.display = 'none';
  document.getElementById('btnConcluir').style.display = 'none';
  
  if (isAdmin) {
    document.getElementById('btnVoltarLista').style.display = 'inline-flex';
  } else {
    document.getElementById('btnVoltarLista').style.display = 'none';
  }
  
  carregarFormularios();
}

//  LISTAGEM 

// Configura os botões de filtro (Todos / Pendente / Finalizado)
document.querySelectorAll('.filtros button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filtros button').forEach(b => b.classList.remove('ativo'));
    e.target.classList.add('ativo');
    filtroAtual = e.target.dataset.filtro;
    paginaAtual = 1;
    desenharLista();
  });
});

// Carrega os formulários
async function carregarFormularios(idParaAbrir = null) {
  const lista = document.getElementById('listaFormularios');
  lista.innerHTML = '<p class="vazio">Carregando...</p>';
  try {
    const res = await chamarFluxo({ acao: 'listar', emailLogado: emailLogado }, URL_LISTAR);
    const dadosBrutos = res.value || res.itens || res;
    const validos = dadosBrutos.filter(item => item && (JSON.stringify(item).includes('problema') || JSON.stringify(item).includes('Problema')));

    todosOsItens = filtrarPorPermissao(validos);
    
    // Mantém apenas itens que tenham campos de "problema"
    todosOsItens.sort((a, b) => Number(b.ID || b.id || 0) - Number(a.ID || a.id || 0));

    if (idParaAbrir) {
      const item = todosOsItens.find(i => lerIdFormulario(i) === idParaAbrir);
      if (item) {
        abrirFormulario(item);
      } else {
        alert('Ocorrência não encontrada ou você não tem permissão para acessá-la.');
        mostrarTelaLista();
      }
    } else {
      desenharLista();
    }
  } catch (erro) {
    console.error(erro);
    lista.innerHTML = '<p class="vazio">Não foi possível carregar a lista.</p>';
  }
}

// Renderiza a lista de ocorrências com filtro e paginação
function desenharLista() {
  const lista = document.getElementById('listaFormularios');
  lista.innerHTML = '';

  const pegarValor = (item, nomes) => {
    for (let n of nomes) if (item[n] !== undefined && item[n] !== null && String(item[n]).trim() !== '') return item[n];
    for (let chave of Object.keys(item)) if (nomes.some(n => chave.toLowerCase().includes(n.toLowerCase()))) return item[chave];
    return null;
  };

  const base = filtrarPorPermissao(todosOsItens);
  
   // Helper: verifica se o status é "finalizado/concluído"
    const ehFinalizado = (v) => {
    const s = String(v || '').trim().toLowerCase();
    return s === 'finalizado' || s === 'concluído' || s === 'concluido';
  };
  
  // Aplica o filtro atual
  let itensFiltrados = base;
  if (filtroAtual === 'pendente') {
    itensFiltrados = base.filter(i => !ehFinalizado(pegarValor(i, ['Situacao', 'situacao', 'Status', 'status'])));
  } else if (filtroAtual === 'finalizado') {
    itensFiltrados = base.filter(i => ehFinalizado(pegarValor(i, ['Situacao', 'situacao', 'Status', 'status'])));
  }

  if (itensFiltrados.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhuma ocorrência encontrada.</p>';
    return;
  }
  
  // Paginação
  const totalPaginas = Math.ceil(itensFiltrados.length / POR_PAGINA);
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
  const itensDaPagina = itensFiltrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  
// Monta cada cartão
  itensDaPagina.forEach(item => {
    const idItem = pegarValor(item, ['ID', 'id', 'Id']) || 'N/A';
    const statusItem = pegarValor(item, ['Situacao', 'situacao', 'Status', 'status']) || 'Pendente';
    const problemaItem = pegarValor(item, ['Problema', 'problema']) || 'Sem problema';
    const regionalItem = pegarValor(item, ['Regional', 'regional']) || 'N/D';
    const areaItem = pegarValor(item, ['Area', 'area']) || 'N/D';

    const cartao = criar('div', 'item' + (String(idItem) === String(idEmEdicao) ? ' ativo' : ''));
    const info = criar('div');
    const isFinalizado = String(statusItem).toLowerCase() === 'finalizado' || String(statusItem).toLowerCase() === 'concluído';

    let idExibicao = lerIdFormulario(item) || idItem;
    
    // Se ainda vier "guid()" por algum motivo, esconde
    if (idExibicao === 'guid()' || idExibicao === 'guid') {
        idExibicao = 'N/D'; 
    } 
    // Se for um GUID válido (maior que 10 caracteres), mostra só o começo
    else if (idExibicao.length > 10) {
        idExibicao = idExibicao.substring(0, 8) + '...';
    }
// Badge de status + descrição do problema + linha resumida
    info.append(
      criar('span', 'badge ' + (isFinalizado ? 'finalizado' : 'pendente'), isFinalizado ? 'Concluído' : 'Pendente'),
      criar('strong', '', String(problemaItem).length > 45 ? String(problemaItem).slice(0, 45) + '...' : String(problemaItem)),
      criar('p', '', 'Reg: ' + regionalItem + ' • Área: ' + areaItem + ' • ID: ' + idExibicao)
    );
    
  // Linha de data de abertura
    const data = formatarData(pegarValor(item, ['criadoEm', 'CriadoEm', 'Data', 'Created', 'Criado']));
    if (data) {
      const linhaData = criar('p', 'data');
      linhaData.insertAdjacentHTML('beforeend', ICONE_CALENDARIO);
      linhaData.append('Aberto em: ' + data);
      info.append(linhaData);
    }

    // LINHA DE DATAS DO PLANO
    const dPrevIni  = pegarValor(item, ['DataPrevisaoInicio',    'dataPrevisaoInicio',    'PrevisaoInicio']);
    const dIniReal  = pegarValor(item, ['DataInicioReal',        'dataInicioReal',        'InicioReal']);
    const dPrevFim  = pegarValor(item, ['DataPrevisaoConclusao', 'dataPrevisaoConclusao', 'PrevisaoConclusao', 'Prazo', 'prazo']);
    const dFimReal  = pegarValor(item, ['DataConclusaoReal',     'dataConclusaoReal',     'ConclusaoReal',     'DataConclusao', 'dataConclusao']);

    const pedacos = [];
    if (dPrevIni) pedacos.push('Prev. início: ' + formatarDataSimples(dPrevIni));
    if (dIniReal) pedacos.push('Início real: ' + formatarDataSimples(dIniReal));
    if (dPrevFim) pedacos.push('Prev. fim: '    + formatarDataSimples(dPrevFim));
    if (dFimReal) pedacos.push('Fim real: '     + formatarDataSimples(dFimReal));

    if (pedacos.length) {
      const linhaPlano = criar('p', 'data plano');
      linhaPlano.insertAdjacentHTML('beforeend', ICONE_CALENDARIO);
      linhaPlano.append(pedacos.join(' • '));
      info.append(linhaPlano);
    }
    
    // Botão de ação do cartão
    const botao = criar('button', 'b-azul', isFinalizado ? 'Visualizar' : 'Continuar');
    botao.type = 'button';
    botao.addEventListener('click', () => abrirFormulario(item));

    cartao.append(info, botao);
    lista.appendChild(cartao);
  });
  
 // Paginação (só aparece se houver mais de uma página)
  if (totalPaginas > 1) {
    const nav = criar('div', 'paginacao');
    const ant = criar('button', '', '← Anterior'); ant.type = 'button'; ant.disabled = paginaAtual === 1; ant.addEventListener('click', () => { paginaAtual--; desenharLista(); });
    const txt = criar('span', '', 'Página ' + paginaAtual + ' de ' + totalPaginas);
    const prox = criar('button', '', 'Próxima →'); prox.type = 'button'; prox.disabled = paginaAtual === totalPaginas; prox.addEventListener('click', () => { paginaAtual++; desenharLista(); });
    nav.append(ant, txt, prox);
    lista.appendChild(nav);
  }
}

//ABRIR E PREENCHER FORMULÁRIO

// Abre um item específico no formulário, aplica bloqueios e ajusta botões
function abrirFormulario(item) {
   isTelaCriacao = false;
  
  // Helper local: busca valor por nome de chave (mesmo padrão dos outros)
  const pegarValor = (nomes) => {
    for (let n of nomes) if (item[n] !== undefined && item[n] !== null && String(item[n]).trim() !== '') return item[n];
    for (let c of Object.keys(item)) if (nomes.some(n => c.toLowerCase().includes(n.toLowerCase()))) return item[c];
    return '';
  };

  form.reset();
  idEmEdicao = pegarValor(['ID', 'id', 'Id']);
  idFormulario = lerIdFormulario(item) || (idEmEdicao ? String(idEmEdicao) : gerarIdFormulario());
  mostrarId();
  atualizarContadores();

  // Carrega dados de texto
  form.elements['regional'].value = pegarValor(['Regional', 'regional']);
  form.elements['area'].value = pegarValor(['Area', 'area', 'Área']);
  form.elements['problema'].value = pegarValor(['Problema', 'problema']);
  form.elements['causa'].value = pegarValor(['Causa', 'causa', 'Causa Raiz']);
  form.elements['plano'].value = pegarValor(['Plano', 'plano']);
  form.elements['responsavel'].value = pegarValor(['Responsavel', 'responsavel', 'Responsável']);
  form.elements['status'].value = pegarValor(['Status', 'status']) || 'Pendente de preenchimento';
  form.elements['comentario'].value = pegarValor(['Comentario', 'comentario', 'Comentário']);
  
  // Carrega as 4 datas (com fallback para os nomes antigos)
  const mapaDatas = {
    dataPrevisaoInicio:    ['DataPrevisaoInicio',    'dataPrevisaoInicio',    'PrevisaoInicio'],
    dataInicioReal:        ['DataInicioReal',        'dataInicioReal',        'InicioReal'],
    dataPrevisaoConclusao: ['DataPrevisaoConclusao', 'dataPrevisaoConclusao', 'PrevisaoConclusao', 'Prazo', 'prazo'],
    dataConclusaoReal:     ['DataConclusaoReal',     'dataConclusaoReal',     'ConclusaoReal',     'DataConclusao', 'dataConclusao']
  };

  Object.keys(mapaDatas).forEach(campo => {
    const valor = pegarValor(mapaDatas[campo]);
    if (valor && form.elements[campo]) form.elements[campo].value = String(valor).slice(0, 10);
  });

  // Muda layout para a tela de tratativa
  document.getElementById('tituloFormulario').textContent = 'Tratativa da Ocorrência';
  document.getElementById('camposExtras').style.display = 'block';
  document.getElementById('painelLista').style.display = 'none';
  document.querySelector('.layout').classList.add('sem-lista');
  
   // Ajuste de botões na tela de tratativa
  document.getElementById('btnVerLista').style.display = 'none';
  document.getElementById('btnEnviarOcorrencia').style.display = 'none';
  
  if (isAdmin) {
    document.getElementById('btnVoltarLista').style.display = 'inline-flex';
  } else {
    document.getElementById('btnVoltarLista').style.display = 'none';
  }

  // Regras de Bloqueio

  
  const situacao = String(pegarValor(['Situacao', 'situacao', 'Status', 'status'])).toLowerCase();
  
  // Limpa bloqueios anteriores
  form.querySelectorAll('.bloqueado').forEach(c => c.classList.remove('bloqueado'));
  form.querySelectorAll('input, select, textarea').forEach(c => { c.readOnly = false; c.disabled = false; });
  document.getElementById('avisoEdicao').hidden = true;
  
// Não-admin sempre tem a regional travada
  if (!isAdmin) {
    const selectRegional = form.elements['regional'];
    selectRegional.classList.add('bloqueado');
    selectRegional.disabled = true;
  }
  
// Pendente de preenchimento: bloqueia campos iniciais
  if (situacao === 'pendente de preenchimento' || situacao === 'pendente') {
    ['regional', 'area', 'problema'].forEach(id => {
      const campo = form.elements[id];
      campo.classList.add('bloqueado');
      if (campo.tagName !== 'SELECT') campo.readOnly = true;
    });
    document.getElementById('textoAvisoEdicao').textContent = 'Os campos iniciais estão bloqueados. Preencha a tratativa.';
    document.getElementById('avisoEdicao').hidden = false;
    document.getElementById('btnConcluir').style.display = 'inline-flex';
    
    // Finalizado: bloqueia tudo, só status/comentário editáveis
  } else if (situacao === 'finalizado' || situacao === 'concluído') {
    ['regional', 'area', 'problema', 'causa', 'plano', 'responsavel',
     'dataPrevisaoInicio', 'dataInicioReal', 'dataPrevisaoConclusao', 'dataConclusaoReal'].forEach(id => {
      const campo = form.elements[id];
      campo.classList.add('bloqueado');
      if (campo.tagName !== 'SELECT') campo.readOnly = true;
    });
    document.getElementById('textoAvisoEdicao').textContent = 'Ocorrência finalizada. Apenas Status e Comentários podem ser alterados.';
    document.getElementById('avisoEdicao').hidden = false;
    document.getElementById('btnConcluir').style.display = 'inline-flex';
  } else {
    
    // Em andamento: nada bloqueado, pode concluir
    document.getElementById('btnConcluir').style.display = 'inline-flex';
  }
  
// Botão "Salvar progresso" só aparece para regional em item não finalizado
  const btnSalvar = document.getElementById('btnSalvarProgresso');
  const jaFinalizado = (situacao === 'finalizado' || situacao === 'concluído');
  btnSalvar.style.display = (!isAdmin && !jaFinalizado) ? 'inline-flex' : 'none';
  
// Rola o formulário para o topo da viewport
  document.getElementById('formPlano').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

//ENVIOS (CRIAR E CONCLUIR)

// Botões de navegação da tela
document.getElementById('btnVerLista').addEventListener('click', mostrarTelaLista);
document.getElementById('btnVoltarLista').addEventListener('click', mostrarTelaCriacao);
document.getElementById('btnAtualizar').addEventListener('click', () => carregarFormularios());

// SALVAR PROGRESSO (REGIONAIS)
document.getElementById('btnSalvarProgresso').addEventListener('click', async function () {
  if (isAdmin || !idEmEdicao) return;

  const botao = this;
  const htmlOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = 'Salvando...';

  try {
    
    // Se ainda estava "Pendente de preenchimento", vira "Em Andamento"
    const campoStatus = form.elements['status'];
    if (campoStatus.value === 'Pendente de preenchimento') campoStatus.value = 'Em Andamento';

    await chamarFluxo({
      ...lerCampos(),
      acao: 'atualizar',
      id: idEmEdicao,
      idFormulario: idFormulario,
      situacao: 'Em Andamento'
    }, URL_SALVAR);

    alert('Progresso salvo com sucesso! A ocorrência continua em andamento.');
    carregarFormularios();
  } catch (erro) {
    console.error(erro);
    alert('Erro ao salvar o progresso: ' + erro.message);
  }

  botao.disabled = false;
  botao.innerHTML = htmlOriginal;
});

// Submit principal do formulário: cria (tela de criação) OU conclui (tela de tratativa)
form.addEventListener('submit', async function (e) {
  e.preventDefault();
  
  // Se for a tela de criação (Nova Ocorrência)
  if (isTelaCriacao) {
    
    // Validação mínima dos campos obrigatórios
    if (!form.elements['regional'].value || !form.elements['area'].value || !form.elements['problema'].value) {
      alert('Preencha a Regional, Área e o Problema identificado.');
      return;
    }
    
    const botao = document.getElementById('btnEnviarOcorrencia');
    botao.disabled = true;
    botao.innerHTML = 'Enviando...';

    try {
      const resposta = await chamarFluxo({ 
        ...lerCampos(), 
        acao: 'criar', 
        idFormulario: idFormulario, 
        situacao: 'Pendente de preenchimento' 
      }, URL_SALVAR);
      
      if (resposta && resposta.sucesso === false) {
        alert(resposta.mensagem); 
      } else {
        alert('Ocorrência enviada com sucesso! O e-mail foi disparado para a Regional.');
        mostrarTelaLista();
      }
    } catch (erro) {
      console.error("ERRO COMPLETO:", erro);
      alert('Erro ao salvar: ' + erro.message);
    }
    botao.disabled = false;
    botao.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Ocorrência';
  } 
    
  // Se for a tela de Tratativa (Concluir)
  else {
    const botao = document.getElementById('btnConcluir');
    botao.disabled = true;
    botao.innerHTML = 'Salvando...';

    try {
            form.elements['status'].value = 'Concluído';   // normaliza o valor do <select>
      await chamarFluxo({ 
        ...lerCampos(), 
        acao: 'atualizar', 
        id: idEmEdicao, 
        idFormulario: idFormulario, 
        situacao: 'Finalizado',
        status: 'Concluído'                          // garante valor consistente
      }, URL_SALVAR);
      alert('Tratativa concluída com sucesso!');
      mostrarTelaLista();
    } catch (erro) {
      console.error("ERRO COMPLETO:", erro);
      alert('Erro ao salvar tratativa: ' + erro.message);
    }
    botao.disabled = false;
    botao.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Concluir Tratativa';
  }
});

// Injeta a animação de "girar" usada no spinner dos botões
const style = document.createElement('style');
style.innerHTML = `@keyframes girar { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

// Estado inicial: gera um ID de formulário e atualiza contadores
idFormulario = gerarIdFormulario();
mostrarId();
atualizarContadores();

// ==================== LOGOFF ====================

const btnSair = document.getElementById('btnSair');
const spanUsuario = document.getElementById('usuarioLogado');

// Mostra/esconde o botão conforme o estado de login
function atualizarCabecalho() {
  const email = sessionStorage.getItem('usuarioAutenticado');
  if (email) {
    document.body.classList.remove('nao-logado');
    spanUsuario.textContent = email;
  } else {
    document.body.classList.add('nao-logado');
    spanUsuario.textContent = '';
  }
}

// Executa ao carregar a página
atualizarCabecalho();

// Clique no botão "Sair": confirma, limpa a sessão e recarrega a página
btnSair.addEventListener('click', () => {
  if (!confirm('Deseja realmente sair do sistema?')) return;

  // 1) Limpa TODA a sessão
  sessionStorage.clear();

  // 2) Redireciona para o topo da página (limpa ?id=... se houver)
  window.location.href = window.location.pathname;
});