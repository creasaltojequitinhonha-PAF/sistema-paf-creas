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
// --- ATIVAÇÃO DE PERSISTÊNCIA OFFLINE (NOVO) ---
firebase.firestore().enablePersistence()
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.log("Múltiplas abas abertas, persistência não ativada.");
      } else if (err.code == 'unimplemented') {
          console.log("O navegador não suporta persistência.");
      }
  });

const db = firebase.firestore();
const CHAVE_COLECAO = "pacientes_paf";
let mapaPacientes = {};

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
    const data = { inputs: {}, radios: {}, checkboxes: {}, membros: [] };
    
    // Coleta inputs tradicionais e textareas
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el => {
        if (el.id && el.id !== 'renda_total' && el.id !== 'campo-pesquisa') {
            data.inputs[el.id] = el.value;
        }
    });
    
    // Coleta botões de rádio
    document.querySelectorAll('input[type="radio"]').forEach(el => {
        if (el.id) data.radios[el.id] = el.checked;
    });

    // Coleta caixas de seleção (Checkboxes dos diagnósticos)
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
        // Se tiver id, usa o id (como o diag_check_outras), se não, usa o valor/texto
        if (el.id) {
            data.checkboxes[el.id] = el.checked;
        } else if (el.value) {
            data.checkboxes[el.value] = el.checked;
        }
    });
    
    // Coleta a listagem da tabela de membros
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
    
    // Restaura inputs de texto e textareas
    for (let id in data.inputs) { 
        const el = document.getElementById(id);
        if (el) el.value = data.inputs[id]; 
    }
    
    // Restaura os botões radio
    for (let id in data.radios) { 
        const el = document.getElementById(id);
        if (el) el.checked = data.radios[id]; 
    }

    // Limpa todas as marcações de checkboxes atuais na tela antes de aplicar
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);

    // Restaura as caixas de seleção salvas (Checkboxes dos diagnósticos)
    if (data.checkboxes) {
        for (let chave in data.checkboxes) {
            // Tenta encontrar pelo ID primeiro (ex: diag_check_outras)
            let el = document.getElementById(chave);
            // Se não achar pelo ID, busca pelo atributo value correspondente ao diagnóstico
            if (!el) {
                el = document.querySelector(`input[type="checkbox"][value="${chave}"]`);
            }
            if (el) el.checked = data.checkboxes[chave];
        }
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

function importarDados(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            
            // Chama a função que distribui os dados nos campos
            aplicarDados(dados);
            
            Swal.fire({
                title: 'Sucesso!',
                text: 'Backup carregado com sucesso!',
                icon: 'success',
                confirmButtonColor: '#1e3a8a'
            });
        } catch (erro) {
            Swal.fire({
                title: 'Erro!',
                text: 'Erro ao ler o arquivo JSON.',
                icon: 'error',
                confirmButtonColor: '#1e3a8a'
            });
            console.error(erro);
        }
    };
    leitor.readAsText(arquivo);
}

async function validarESalvar() {
    const dados = coletarDados();
    const cpf = dados.inputs.cpf;
    if (!cpf) { 
        Swal.fire({
            title: 'Atenção',
            text: 'Preencha o CPF para salvar.',
            icon: 'warning',
            confirmButtonColor: '#1e3a8a'
        });
        return; 
    }

    try {
        await db.collection(CHAVE_COLECAO).doc(cpf).set(dados);
        exportarDados(); 
        Swal.fire({
            title: 'Salvo com Sucesso!',
            text: 'PAF salvo!',
            icon: 'success',
            confirmButtonColor: '#1e3a8a'
        });
        listarPacientes(); 
    } catch (error) {
        Swal.fire({
            title: 'Erro de Gravação',
            text: 'Não foi possível salvar os dados na nuvem.',
            icon: 'error',
            confirmButtonColor: '#1e3a8a'
        });
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
        const snapshot = await db.collection(CHAVE_COLECAO).get({ source: 'server' });
        
        datalist.innerHTML = ''; 
        mapaPacientes = {}; 
        
        snapshot.forEach(doc => {
            const p = doc.data();
            const nome = (p.inputs && p.inputs.resp_familiar) ? p.inputs.resp_familiar : (p.resp_familiar || "Sem Nome");
            
            const textoBusca = `${nome.toUpperCase()} - CPF: ${doc.id}`;
            const option = document.createElement('option');
            option.value = textoBusca;
            datalist.appendChild(option);
            mapaPacientes[textoBusca] = doc.id;
        });
        console.log("Total de registros carregados do servidor:", snapshot.size);
    } catch (e) { 
        console.error("Erro ao listar pacientes:", e); 
    }
}

function verificarSelecao(valor) {
    if (mapaPacientes[valor]) carregarPaciente(mapaPacientes[valor]);
}

async function carregarPaciente(cpf) {
    const doc = await db.collection(CHAVE_COLECAO).doc(cpf).get();
    if (doc.exists) aplicarDados(doc.data());
}

async function executarLoginRobusto() {
    const nome = document.getElementById('loginNome').value.toUpperCase().trim();
    const cpf = document.getElementById('loginCPF').value.trim();
    const erroMsg = document.getElementById('erroLogin');

    try {
        const doc = await db.collection("usuarios").doc(nome).get();
        if (doc.exists && doc.data().cpf.toString().startsWith(cpf)) {
            liberarSistema();
        } else {
            erroMsg.style.display = 'block';
            erroMsg.innerText = "Usuário ou CPF incorretos";
        }
    } catch (e) {
        Swal.fire({
            title: 'Erro de Conexão',
            text: 'Verifique o console (F12) para analisar os detalhes da conexão com o banco.',
            icon: 'error',
            confirmButtonColor: '#1e3a8a'
        });
    }
}

function liberarSistema() {
    const login = document.getElementById('tela-login');
    if (login) login.remove();

    const paf = document.querySelector('.container');
    if (paf) {
        paf.style.setProperty("display", "block", "important");
        paf.style.setProperty("visibility", "visible", "important");
        paf.style.setProperty("opacity", "1", "important");
        
        if (typeof listarPacientes === "function") {
            listarPacientes();
        }
    } else {
        console.error("Erro: Classe .container não encontrada.");
    }
}

// ==========================================
// GERAR RELATÓRIO COMPLETO E REORGANIZADO
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

    // Filtra e prepara a exibição dinâmica dos diagnósticos marcados
    let listagemDiagnosticosHtml = '';
    let possuiDiagnostico = false;

    if (d.checkboxes) {
        let listaSelecionados = [];
        for (let chave in d.checkboxes) {
            // Ignora temporariamente o id do checkbox 'Outras' no loop padrão para tratá-lo separadamente abaixo
            if (chave === 'diag_check_outras') continue;

            if (d.checkboxes[chave] === true) {
                possuiDiagnostico = true;
                listaSelecionados.push(chave);
            }
        }

        // VERIFICAÇÃO DO CAMPO "OUTRAS" DESTACADO NA IMAGEM
        if (d.checkboxes['diag_check_outras'] === true) {
            possuiDiagnostico = true;
            const textoOutras = d.inputs.diag_texto_outras ? d.inputs.diag_texto_outras.trim() : '';
            listaSelecionados.push(`<strong>OUTRAS:</strong> ${textoOutras || 'Marcado, mas sem descrição detalhada.'}`);
        }

        if (possuiDiagnostico) {
            listagemDiagnosticosHtml = listaSelecionados.map(diag => `
                <div class="diagnostico-tag">✓ ${diag}</div>
            `).join('');
        } else {
            listagemDiagnosticosHtml = `<div style="grid-column: 1 / -1; color: #666; font-style: italic;">Nenhuma situação ou violação de direito foi marcada previamente para este prontuário.</div>`;
        }
    }

    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>Relatório PAF - ${d.inputs.resp_familiar}</title>
            <style>
                @page { size: A4; margin: 1cm; }
                body { font-family: Arial, sans-serif; padding: 0; font-size: 8.5px; line-height: 1.2; color: #333; margin: 0; }
                
                /* CABEÇALHO PROFISSIONAL */
                .report-header { 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-between; 
                    border-bottom: 2px solid #1e3a8a; 
                    padding-bottom: 8px; 
                    margin-bottom: 12px; 
                }
                .logo-container { width: 70px; text-align: center; }
                .logo-container img { max-height: 45px; max-width: 100%; object-fit: contain; }
                .header-text { text-align: center; flex: 1; }
                .header-text h2 { font-size: 10px; margin: 0; color: #1e3a8a; font-weight: bold; text-transform: uppercase; }
                .header-text p { margin: 2px 0 0; font-size: 9px; font-weight: bold; color: #555; }
                
                h1 { text-align: center; color: #1e3a8a; font-size: 12px; margin: 10px 0; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                h2.section-title { background: #f1f5f9; color: #1e3a8a; padding: 3px 8px; font-size: 9px; border-left: 4px solid #1e3a8a; margin-top: 10px; text-transform: uppercase; font-weight: bold; }
                
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 4px; }
                .box { border: 1px solid #ddd; padding: 4px; border-radius: 3px; background: #fff; }
                .label { font-weight: bold; font-size: 7.5px; color: #1e3a8a; display: block; text-transform: uppercase; margin-bottom: 2px; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 8.5px; }
                th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
                th { background: #f8fafc; color: #1e3a8a; text-transform: uppercase; font-size: 8px; }
                
                .full-row-box { border: 1px solid #ddd; padding: 5px; margin-top: 4px; border-radius: 3px; }
                .content { font-size: 8.5px; white-space: pre-wrap; word-wrap: break-word; }

                /* GRID DOS DIAGNÓSTICOS SELECIONADOS NO RELATÓRIO */
                .diagnosticos-container-report {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                    background: #fdfdfd;
                    border: 1px dashed #cbd5e1;
                    padding: 8px;
                    margin-top: 4px;
                    border-radius: 3px;
                }
                .diagnostico-tag {
                    font-size: 8.5px;
                    color: #1e293b;
                    padding: 2px 4px;
                    background: #f1f5f9;
                    border-left: 3px solid #10b981;
                    border-radius: 2px;
                }

                /* ÁREA DE ASSINATURAS PARA ASSINATURA DIGITAL */
                .assinaturas-container { 
                    margin-top: 30px; 
                    page-break-inside: avoid; 
                }
                .assinaturas-grid { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 30px 50px; 
                    margin-top: 30px; 
                    text-align: center; 
                }
                .campo-assinatura {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .linha-assinatura { 
                    width: 100%;
                    border-top: 1px solid #000; 
                    padding-top: 5px; 
                    font-weight: bold; 
                    text-transform: uppercase; 
                    font-size: 7.5px; 
                }
                
                @media print { .no-print { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <button class="no-print" onclick="window.print()" style="padding:8px 15px; background:#1e3a8a; color:white; border:none; border-radius:4px; cursor:pointer; margin: 10px; font-weight:bold;">🖨️ IMPRIMIR</button>
            
            <header class="report-header">
                <div class="logo-container"><img src="brasao.png"></div>
                <div class="header-text">
                    <h2>SECRETARIA DE ESTADO DE DESENVOLVIMENTO SOCIAL - SEDESE</h2>
                    <p>CREAS Regional Alto Jequitinhonha - Diamantina/MG</p>
                </div>
                <div class="logo-container"><img src="logo_creas.png"></div>
            </header>

            <h1>PLANO DE ACOMPANHAMENTO FAMILIAR - PAF</h1>

            <h2 class="section-title">I - IDENTIFICAÇÃO</h2>
            <div class="grid">
                <div class="box"><span class="label">Responsável Familiar:</span><div class="content">${d.inputs.resp_familiar || '---'}</div></div>
                <div class="box"><span class="label">CPF:</span><div class="content">${d.inputs.cpf || '---'}</div></div>
                <div class="box"><span class="label">NIS:</span><div class="content">${d.inputs.nis || '---'}</div></div>
                <div class="box"><span class="label">Nascimento:</span><div class="content">${d.inputs.nasc_resp || '---'}</div></div>
                <div class="box"><span class="label">Forma de Ingresso:</span><div class="content">${d.inputs.forma_ingresso || '---'}</div></div>
                <div class="box"><span class="label">Situação do PAF:</span><div class="content">${situacao}</div></div>
            </div>

            <h2 class="section-title">II - COMPOSIÇÃO FAMILIAR E RENDA</h2>
            <table>
                <thead><tr><th>Nome Completo</th><th>Renda (R$)</th><th>Nascimento</th><th>Parentesco</th></tr></thead>
                <tbody>${membrosHtml}</tbody>
            </table>
            <div style="text-align: right; font-weight: bold; margin-top: 5px; font-size: 9px;">Renda Total: ${document.getElementById('renda_total').value}</div>
            
            <div class="full-row-box">
                <span class="label">Família beneficiária do BPC ou PBF (Observações):</span>
                <div class="content">${d.inputs.obs_beneficios || '---'}</div>
            </div>

            <h2 class="section-title">I - DIAGNÓSTICOS </h2>
            <div class="diagnosticos-container-report">
                ${listagemDiagnosticosHtml}
            </div>
            
            <div class="full-row-box" style="margin-top: 6px;">
                <span class="label">Outras Observações:</span>
                <div class="content">${d.inputs.texto_demandas || '---'}</div>
            </div>

            <h2 class="section-title">III - PLANEJAMENTO E INTERVENÇÃO</h2>
            <div class="grid">
                <div class="box"><span class="label">1) Potencialidades:</span><div class="content">${d.inputs.potencialidades || '---'}</div></div>
                <div class="box"><span class="label">2) Vulnerabilidades:</span><div class="content">${d.inputs.vulnerabilidades || '---'}</div></div>
                <div class="box"><span class="label">3) Prioridades:</span><div class="content">${d.inputs.prioridades || '---'}</div></div>
                <div class="box"><span class="label">4) Proposta de Intervenção:</span><div class="content">${d.inputs.proposta || '---'}</div></div>
                <div class="box"><span class="label">5) Responsável:</span><div class="content">${d.inputs.responsavel || '---'}</div></div>
                <div class="box"><span class="label">6) Resultados Esperados:</span><div class="content">${d.inputs.resultados_esperados || '---'}</div></div>
                <div class="box"><span class="label">7) Lista de Atividades:</span><div class="content">${d.inputs.atividades_lista || '---'}</div></div>
                <div class="box"><span class="label">8) Resultados Alcançados:</span><div class="content">${d.inputs.resultados_alcancados || '---'}</div></div>
                <div class="box"><span class="label">9) Articulação de Rede:</span><div class="content">${d.inputs.obs_rede || '---'}</div></div>
                <div class="box"><span class="label">10) Compromissos da Família:</span><div class="content">${d.inputs.comp_familia || '---'}</div></div>
            </div>
            <div class="full-row-box">
                <span class="label">11) Compromissos da Equipe:</span>
                <div class="content">${d.inputs.obs_equipe || '---'}</div>
            </div>

            <h2 class="section-title">IV - ACOMPANHAMENTO E EVOLUÇÃO</h2>
            <div class="full-row-box" style="border-color: #1e3a8a; background: #f8fafc;">
                <span class="label">OBJETIVO DO ACOMPANHAMENTO FAMILIAR:</span>
                <div class="content">${d.inputs.obj_acompanhamento || '---'}</div>
            </div>

            <h2 class="section-title">V - ENCAMINHAMENTOS E CONCLUSÃO</h2>
            <div class="grid">
                <div class="box">
                    <span class="label">Acordos / Orientações Realizadas:</span>
                    <div class="content">${d.inputs.acordos_familia || d.inputs.acordos_orientacoes || '---'}</div>
                </div>
                <div class="box">
                    <span class="label">Encaminhamentos Rede de Proteção:</span>
                    <div class="content">${d.inputs.encaminhamentos_rede || d.inputs.encaminhamentos_protecao || '---'}</div>
                </div>
            </div>

            <div class="full-row-box">
                <span class="label">Evolução:</span>
                <div class="content">${d.inputs.evolucao_final || '---'}</div>
            </div>

            <div class="assinaturas-container">
                <p style="text-align: center; margin: 0; font-size: 8.5px; font-weight: bold;">Diamantina/MG, ${dataHoje}.</p>
                <div class="assinaturas-grid">
                    <div class="campo-assinatura">
                        <div style="height: 25px;"></div> <div class="linha-assinatura">Técnico Responsável</div>
                    </div>
                    <div class="campo-assinatura">
                        <div style="height: 25px;"></div>
                        <div class="linha-assinatura">Técnico Responsável</div>
                    </div>
                    <div class="campo-assinatura">
                        <div style="height: 25px;"></div>
                        <div class="linha-assinatura">Técnico Responsável</div>
                    </div>
                    <div class="campo-assinatura">
                        <div style="height: 25px;"></div>
                        <div class="linha-assinatura">Referência Técnica</div>
                    </div>
                    <div class="campo-assinatura">
                        <div style="height: 25px;"></div>
                        <div class="linha-assinatura">Responsável Familiar</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    win.document.close();
}

window.onload = () => {
    // 0. Injeta as dependências do SweetAlert2 automaticamente
    if (!document.getElementById('sweetalert-css')) {
        const link = document.createElement('link');
        link.id = 'sweetalert-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css';
        document.head.appendChild(link);
    }
    if (!window.Swal) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
        document.head.appendChild(script);
    }

    // 1. Configura o ID do CREAS
    const idC = document.getElementById('id_creas');
    if(idC) { idC.value = "31216097899"; }
    
    // 2. Carrega a lista do PAF (Banco de Dados)
    listarPacientes();
};
