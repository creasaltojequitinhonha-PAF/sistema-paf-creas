// ==========================================
// CONFIGURAÇÃO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBnHxMaz-JoMuFmz80kD9SDLAOYH0w_Sps",
  authDomain: "sistema-creas-paf.firebaseapp.com",
  projectId: "sistema-creas-paf",
  storageBucket: "sistema-creas-paf.appspot.com",
  messagingSenderId: "57137105910",
  appId: "1:57137105910:web:690ebff3cbad88e283527"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const CHAVE_COLECAO = "pacientes_paf";
let mapaPacientes = {};

// ==========================================
// SISTEMA DE LOGIN (NOME + 5 DÍGITOS CPF)
// ==========================================
async function fazerLogin() {
    const nome = document.getElementById('loginNome').value.trim().toUpperCase();
    const cpfCurto = document.getElementById('loginCPF').value.trim();
    const erroMsg = document.getElementById('erroLogin');

    if (!nome || !cpfCurto) {
        alert("Preencha o nome e os 5 primeiros dígitos do seu CPF.");
        return;
    }

    try {
        // Busca na coleção 'usuarios' (que você criará no Firestore)
        const docRef = db.collection("usuarios").doc(nome);
        const docSnap = await docRef.get();

        if (docSnap.exists && docSnap.data().cpf === cpfCurto) {
            document.getElementById('tela-login').style.display = 'none';
            sessionStorage.setItem('paf_autenticado', 'true');
        } else {
            erroMsg.style.display = 'block';
        }
    } catch (error) {
        console.error("Erro login:", error);
        alert("Erro ao conectar com a base de usuários.");
    }
}

// ==========================================
// LÓGICA DO PULSAR (RMA) - A partir do dia 08
// ==========================================
async function verificarPendenciasRMA() {
    // URL da sua planilha de status (exemplo fictício, substitua pela real se necessário)
    const LINK_PLANILHA_STATUS = "SUA_URL_DA_PLANILHA_AQUI"; 
    
    try {
        const dataAtual = new Date();
        const diaDoMes = dataAtual.getDate();
        const mesAtualIndex = dataAtual.getMonth();

        // Regra: Não pulsa em Janeiro ou antes do dia 08
        if (mesAtualIndex === 0 || diaDoMes < 8) {
            console.log("Pulsar aguardando dia 08.");
            return;
        }

        // Se quiser implementar a leitura da planilha para parar o pulsar:
        // const resposta = await fetch(LINK_PLANILHA_STATUS + "&t=" + new Date().getTime());
        // Lógica de busca aqui...
        
    } catch (e) { console.error("Erro RMA:", e); }
}

// ==========================================
// MÁSCARAS E UTILITÁRIOS
// ==========================================
function mascaraData(campo) {
    let v = campo.value.replace(/\D/g, "");
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length >= 5) v = v.replace(/^(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
    else if (v.length >= 3) v = v.replace(/^(\d{2})(\d{1,2})/, "$1/$2");
    campo.value = v;
}

// ==========================================
// GESTÃO DE MEMBROS DA FAMÍLIA
// ==========================================
function addMembro(nome = '', renda = '', data = '', parentesco = '') {
    const table = document.getElementById('membrosBody');
    if (!table) return;
    const row = table.insertRow();
    row.innerHTML = `
        <td><input type="text" class="m-nome" value="${nome}"></td>
        <td><input type="number" class="m-renda" value="${renda}" step="0.01" oninput="calcularRenda()"></td>
        <td><input type="text" class="m-data" value="${data}" placeholder="00/00/0000" maxlength="10" oninput="mascaraData(this)"></td>
        <td><input type="text" class="m-parent" value="${parentesco}"></td>
        <td class="no-print" align="center">
            <button onclick="this.parentElement.parentElement.remove(); calcularRenda();" style="background:red; color:white; border:none; border-radius:50%; width:22px; cursor:pointer;">×</button>
        </td>
    `;
    calcularRenda();
}

function calcularRenda() {
    let total = 0;
    document.querySelectorAll('.m-renda').forEach(input => {
        let valor = parseFloat(input.value);
        if (!isNaN(valor)) total += valor;
    });
    const campoTotal = document.getElementById('renda_total');
    if (campoTotal) {
        campoTotal.value = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
}

// ==========================================
// COLETA E APLICAÇÃO DE DADOS
// ==========================================
function coletarDados() {
    const data = { inputs: {}, radios: {}, membros: [] };
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el => {
        if (el.id && el.id !== 'renda_total' && el.id !== 'campo-pesquisa') {
            data.inputs[el.id] = el.value;
        }
    });
    document.querySelectorAll('input[type="radio"]').forEach(el => {
        if (el.id) data.radios[el.id] = el.checked;
    });
    document.querySelectorAll('#membrosBody tr').forEach(tr => {
        data.membros.push({
            nome: tr.querySelector('.m-nome').value,
            renda: tr.querySelector('.m-renda').value,
            data: tr.querySelector('.m-data').value,
            parentesco: tr.querySelector('.m-parent').value
        });
    });
    return data;
}

function aplicarDados(data) {
    if (!data) return;
    document.getElementById('membrosBody').innerHTML = '';
    for (let id in data.inputs) { 
        const el = document.getElementById(id);
        if (el) el.value = data.inputs[id]; 
    }
    for (let id in data.radios) { 
        const el = document.getElementById(id);
        if (el) el.checked = data.radios[id]; 
    }
    const idC = document.getElementById('id_creas');
    if(idC) { idC.value = "31216097899"; idC.readOnly = true; }
    if (data.membros && data.membros.length > 0) {
        data.membros.forEach(m => addMembro(m.nome, m.renda, m.data, m.parentesco));
    } else { 
        addMembro(); 
    }
    calcularRenda();
}

// ==========================================
// PERSISTÊNCIA E BACKUP
// ==========================================
async function validarESalvar() {
    const dados = coletarDados();
    const cpf = dados.inputs.cpf;

    if (!cpf) { alert("⚠️ Preencha o CPF para salvar."); return; }

    try {
        await db.collection(CHAVE_COLECAO).doc(cpf).set(dados);
        exportarDados(); 
        alert("✅ Salvo na Nuvem e Backup gerado!");
        listarPacientes(); 
    } catch (error) {
        alert("❌ Erro ao salvar na nuvem.");
        console.error(error);
    }
}

function exportarDados() {
    const dados = coletarDados();
    const cpf = dados.inputs.cpf || "000";
    const nomeBruto = dados.inputs.resp_familiar || "SEM_NOME";
    const nomeLimpo = nomeBruto.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PAF_${cpf}_${nomeLimpo}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ==========================================
// BUSCA E LISTAGEM
// ==========================================
async function listarPacientes() {
    const datalist = document.getElementById('lista-pacientes');
    if (!datalist) return;
    try {
        const snapshot = await db.collection(CHAVE_COLECAO).get();
        datalist.innerHTML = ''; mapaPacientes = {}; 
        snapshot.forEach(doc => {
            const p = doc.data();
            const nome = p.inputs.resp_familiar || "Sem Nome";
            const textoBusca = `${nome} - CPF: ${doc.id}`;
            const option = document.createElement('option');
            option.value = textoBusca;
            datalist.appendChild(option);
            mapaPacientes[textoBusca] = doc.id;
        });
    } catch (e) { console.error(e); }
}

function verificarSelecao(valor) {
    if (mapaPacientes[valor]) carregarPaciente(mapaPacientes[valor]);
}

async function carregarPaciente(cpf) {
    const doc = await db.collection(CHAVE_COLECAO).doc(cpf).get();
    if (doc.exists) aplicarDados(doc.data());
}

// ==========================================
// GERAR RELATÓRIO
// ==========================================
function gerarRelatorio() {
    const d = coletarDados();
    const situacao = d.radios.status_andamento ? "Em andamento" : (d.radios.status_concl ? "Concluído em " + d.inputs.data_concl : "N/A");
    const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    
    let membrosHtml = d.membros.map(m => `
        <tr>
            <td>${m.nome}</td>
            <td>R$ ${m.renda || '0'}</td>
            <td>${m.data}</td>
            <td>${m.parentesco}</td>
        </tr>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>Relatório PAF - ${d.inputs.resp_familiar}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 25px; font-size: 10px; line-height: 1.3; color: #333; }
                .report-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 15px; }
                .logo-container { width: 100px; text-align: center; }
                .logo-container img { max-height: 60px; max-width: 100%; object-fit: contain; }
                .header-text { text-align: center; flex: 1; }
                .header-text h2 { font-size: 11px; margin: 0; color: #1e3a8a; text-transform: uppercase; }
                h1 { text-align: center; color: #1e3a8a; font-size: 14px; margin: 10px 0; border-bottom: 1px solid #eee; text-transform: uppercase; }
                h2.section-title { background: #f1f5f9; color: #1e3a8a; padding: 5px; font-size: 10px; border-left: 5px solid #1e3a8a; margin-top: 12px; text-transform: uppercase; font-weight: bold; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
                .box { border: 1px solid #ddd; padding: 6px; border-radius: 4px; background: #fff; }
                .label { font-weight: bold; font-size: 8px; color: #1e3a8a; display: block; text-transform: uppercase; margin-bottom: 2px; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
                th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
                th { background: #f8fafc; font-size: 9px; color: #1e3a8a; text-transform: uppercase; }
                .renda-total-texto { text-align: right; font-weight: bold; margin: 5px 0; font-size: 10px; color: #333; }
                .full-row-box { border: 1px solid #ddd; padding: 6px; margin-top: 6px; border-radius: 4px; min-height: 25px; }
                .assinaturas { margin-top: 35px; display: flex; flex-direction: column; align-items: center; gap: 30px; }
                .linha { width: 320px; border-top: 1px solid #000; text-align: center; padding-top: 3px; font-weight: bold; text-transform: uppercase; font-size: 9px; }
                @media print { .no-print { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <button class="no-print" onclick="window.print()" style="padding:8px 15px; background:#1e3a8a; color:white; border:none; border-radius:4px; cursor:pointer; margin-bottom:15px; font-weight:bold;">🖨️ IMPRIMIR</button>
            <header class="report-header">
                <div class="logo-container"><img src="brasao.png"></div>
                <div class="header-text">
                    <h2>SECRETARIA DE ESTADO DE DESENVOLVIMENTO SOCIAL - SEDESE</h2>
                    <p style="margin:2px 0; font-size:10px; font-weight:bold;">CREAS Regional Alto Jequitinhonha - Diamantina/MG</p>
                </div>
                <div class="logo-container"><img src="logo_creas.png"></div>
            </header>
            <h1>PLANO DE ACOMPANHAMENTO FAMILIAR - PAF</h1>
            <h2 class="section-title">I - IDENTIFICAÇÃO</h2>
            <div class="grid">
                <div class="box"><span class="label">Responsável Familiar:</span>${d.inputs.resp_familiar || '---'}</div>
                <div class="box"><span class="label">CPF:</span>${d.inputs.cpf || '---'}</div>
                <div class="box"><span class="label">NIS:</span>${d.inputs.nis || '---'}</div>
                <div class="box"><span class="label">Nascimento:</span>${d.inputs.nasc_resp || '---'}</div>
                <div class="box"><span class="label">Forma de Ingresso:</span>${d.inputs.forma_ingresso || '---'}</div>
                <div class="box"><span class="label">Situação do PAF:</span>${situacao}</div>
            </div>
            <h2 class="section-title">II - COMPOSIÇÃO FAMILIAR E RENDA</h2>
            <table>
                <thead><tr><th>Nome Completo</th><th>Renda (R$)</th><th>Nascimento</th><th>Parentesco</th></tr></thead>
                <tbody>${membrosHtml}</tbody>
            </table>
            <div class="renda-total-texto">Renda Total: ${document.getElementById('renda_total').value}</div>
            <div class="full-row-box"><span class="label">BPC/PBF Obs:</span>${d.inputs.obs_beneficios || '---'}</div>
            <h2 class="section-title">III - PLANEJAMENTO</h2>
            <div class="grid">
                <div class="box"><span class="label">1) Potencialidades:</span>${d.inputs.potencialidades || '---'}</div>
                <div class="box"><span class="label">2) Vulnerabilidades:</span>${d.inputs.vulnerabilidades || '---'}</div>
                <div class="box"><span class="label">3) Prioridades:</span>${d.inputs.prioridades || '---'}</div>
                <div class="box"><span class="label">4) Proposta:</span>${d.inputs.proposta || '---'}</div>
            </div>
            <div class="assinaturas">
                <p>Diamantina/MG, ${dataHoje}.</p>
                <div class="linha">Técnico Responsável</div>
                <div class="linha">Responsável Familiar</div>
            </div>
        </body>
        </html>
    `);
    win.document.close();
}

// ==========================================
// INICIALIZAÇÃO E CONTROLE DE ACESSO
// ==========================================
window.onload = () => {
    // 1. Verifica se já está logado
    if (sessionStorage.getItem('paf_autenticado') === 'true') {
        const tela = document.getElementById('tela-login');
        if (tela) tela.style.display = 'none';
    }

    // 2. Preenche ID CREAS padrão
    const idC = document.getElementById('id_creas');
    if(idC) { idC.value = "31216097899"; }

    // 3. Inicia lista de pacientes e pulsar do RMA
    listarPacientes();
    verificarPendenciasRMA();
};
