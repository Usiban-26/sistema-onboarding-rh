'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
);

const LINK_OFICIAL_PORTAL = 'https://sistema-onboarding-rh-4mj4.vercel.app/';

export default function AdminPage() {
  // Controle de Sessão
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');

  // Navegação
  const [moduloAtivo, setModuloAtivo] = useState('menu');
  const [abaRS, setAbaRS] = useState('candidatos');

  // Dados Globais
  const [candidates, setCandidates] = useState([]);
  const [candidateDocs, setCandidateDocs] = useState({});
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [requiredFields, setRequiredFields] = useState([]);
  const [invites, setInvites] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [filtro, setFiltro] = useState('Todos');

  // Módulo DP (Holerites e Competências)
  const [competencias, setCompetencias] = useState([]);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState('');
  const [payrolls, setPayrolls] = useState([]);
  const [arquivoSenior, setArquivoSenior] = useState(null);
  const [processandoPdf, setProcessandoPdf] = useState(false);
  const [statusProcessamento, setStatusProcessamento] = useState('');

  // Configuração do Telefone do DP
  const [telefoneAtendimentoDP, setTelefoneAtendimentoDP] = useState('');

  // Modal Gerenciar Competências
  const [modalCompAberto, setModalCompAberto] = useState(false);
  const [compEditando, setCompEditando] = useState(null);
  const [novaCompTitulo, setNovaCompTitulo] = useState('');
  const [novaCompCodigo, setNovaCompCodigo] = useState('');
  const [novaCompAno, setNovaCompAno] = useState(new Date().getFullYear());

  // Gestão de Usuários (Admin)
  const [novoUserNome, setNovoUserNome] = useState('');
  const [novoUserEmail, setNovoUserEmail] = useState('');
  const [novoUserSenha, setNovoUserSenha] = useState('');
  const [novoUserRole, setNovoUserRole] = useState('recrutamento');

  // Edição de Candidatos pelo RH (R&S)
  const [candidatoEditando, setCandidatoEditando] = useState(null);
  const [dadosEdicao, setDadosEdicao] = useState({});

  // Documentos e Campos (R&S)
  const [novoDocTitulo, setNovoDocTitulo] = useState('');
  const [novoDocDesc, setNovoDocDesc] = useState('');
  const [novoDocObrigatorio, setNovoDocObrigatorio] = useState(true);
  const [novoCampoLabel, setNovoCampoLabel] = useState('');
  const [novoCampoTipo, setNovoCampoTipo] = useState('text');
  const [novoCampoPlaceholder, setNovoCampoPlaceholder] = useState('');
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(true);
  const [novoCampoValidacao, setNovoCampoValidacao] = useState('none');

  // Convites WhatsApp (R&S)
  const [conviteNome, setConviteNome] = useState('');
  const [conviteTelefone, setConviteTelefone] = useState('');
  const [conviteCargo, setConviteCargo] = useState('');
  const [listaLote, setListaLote] = useState('');
  const [mensagemModelo, setMensagemModelo] = useState(
    `Olá {NOME}, parabéns! Você avançou no processo seletivo da Usina Bandeirante (USIBAN). O seu próximo passo é preencher os seus dados e anexar os documentos admissionais pelo link oficial: ${LINK_OFICIAL_PORTAL}`
  );

  async function carregarDados() {
    // 1. Candidatos R&S
    const { data: candData } = await supabase
      .from('onboarding_candidates')
      .select('*')
      .order('created_at', { ascending: false });
    if (candData) setCandidates(candData);

    // 2. Documentos de Candidatos
    const { data: docsData } = await supabase.from('candidate_documents').select('*');
    if (docsData) {
      const agrupados = {};
      docsData.forEach(d => {
        if (!agrupados[d.candidate_id]) agrupados[d.candidate_id] = [];
        agrupados[d.candidate_id].push(d);
      });
      setCandidateDocs(agrupados);
    }

    // 3. Documentos Exigidos & Campos Pessoais
    const { data: reqDocs } = await supabase
      .from('required_documents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (reqDocs) setRequiredDocs(reqDocs);

    const { data: reqFields } = await supabase
      .from('required_personal_fields')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (reqFields) setRequiredFields(reqFields);

    // 4. Convites & Usuários
    const { data: invData } = await supabase
      .from('admission_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (invData) setInvites(invData);

    const { data: usersData } = await supabase
      .from('system_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (usersData) setSystemUsers(usersData);

    // 5. Competências Gerenciadas do DP
    const { data: compData } = await supabase
      .from('payroll_competences')
      .select('*')
      .order('created_at', { ascending: false });

    if (compData && compData.length > 0) {
      setCompetencias(compData);
      if (!competenciaSelecionada) setCompetenciaSelecionada(compData[0].code);
    } else {
      const padroes = [
        { id: '1', title: '10/2026 - Folha Mensal', code: '10/2026', year: 2026 },
        { id: '2', title: '09/2026 - Folha Mensal', code: '09/2026', year: 2026 },
        { id: '3', title: '2026 - 1ª Parcela 13º Salário', code: '13_1_2026', year: 2026 },
        { id: '4', title: '2026 - 2ª Parcela 13º Salário', code: '13_2_2026', year: 2026 }
      ];
      setCompetencias(padroes);
      if (!competenciaSelecionada) setCompetenciaSelecionada(padroes[0].code);
    }

    // 6. Holerites do DP
    const { data: payrollsData } = await supabase
      .from('employee_payrolls')
      .select('*')
      .order('created_at', { ascending: false });
    if (payrollsData) setPayrolls(payrollsData);

    // 7. Telefone de Atendimento do DP
    const { data: configPhone } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'whatsapp_dp_phone')
      .maybeSingle();

    if (configPhone && configPhone.value) {
      setTelefoneAtendimentoDP(configPhone.value);
    }
  }

  useEffect(() => {
    if (usuarioLogado) {
      carregarDados();
    }
  }, [usuarioLogado]);

  // LOGIN
  async function handleLogin(e) {
    e.preventDefault();
    setErroLogin('');
    const emailLimpo = loginEmail.trim().toLowerCase();
    const { data: user, error } = await supabase
      .from('system_users')
      .select('*')
      .eq('email', emailLimpo)
      .eq('password', loginSenha)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      setErroLogin('E-mail ou senha incorretos, ou usuário inativo.');
      return;
    }

    setUsuarioLogado(user);
    if (user.role === 'recrutamento') setModuloAtivo('recrutamento');
    else if (user.role === 'dp') setModuloAtivo('dp');
    else setModuloAtivo('menu');
  }

  function handleLogout() {
    setUsuarioLogado(null);
    setModuloAtivo('menu');
    setLoginEmail('');
    setLoginSenha('');
  }

  // --- R&S: AÇÕES DO CANDIDATO ---
  function extrairTelefone(candidato) {
    let fone = candidato.phone || '';
    if (!fone && candidato.custom_data) {
      const k = Object.keys(candidato.custom_data).find(key => {
        const lower = key.toLowerCase();
        return lower.includes('whatsapp') || lower.includes('telefone') || lower.includes('celular');
      });
      if (k) fone = candidato.custom_data[k];
    }
    fone = (fone || '').replace(/\D/g, '');
    if (fone && !fone.startsWith('55') && fone.length <= 11) fone = '55' + fone;
    return fone;
  }

  async function handleAprovar(candidato) {
    const dataExame = prompt('Data e Horário do Exame Médico Admissional:');
    if (dataExame === null) return;
    const dataIntegracao = prompt('Data e Horário da Integração na Usina:');
    if (dataIntegracao === null) return;

    const { error } = await supabase
      .from('onboarding_candidates')
      .update({ 
        status: 'Aprovado', 
        feedback_reason: `Exame: ${dataExame || 'A definir'} | Integração: ${dataIntegracao || 'A definir'}` 
      })
      .eq('id', candidato.id);

    if (!error) {
      carregarDados();
      const fone = extrairTelefone(candidato);
      const primeiroNome = (candidato.full_name || 'Candidato').trim().split(' ')[0];
      const texto = `Olá ${primeiroNome}, parabéns! Seus documentos e cadastro foram validados e aprovados com sucesso pelo RH da Usina Bandeirante (USIBAN).\n\nSeguem as orientações para suas próximas etapas:\n🩺 *Exame Médico Admissional:* ${dataExame || 'A agendar'}\n🤝 *Integração e Boas-Vindas:* ${dataIntegracao || 'A agendar'}\n\nEm caso de dúvidas, estamos à disposição. Seja bem-vindo(a) à equipe Usiban!`;
      if (fone && fone.length >= 10) window.open(`https://wa.me/${fone}?text=${encodeURIComponent(texto)}`, '_blank');
      else alert('Candidato aprovado com sucesso!');
    }
  }

  async function handleRejeitar(candidato) {
    const motivo = prompt('Informe o motivo da pendência com os documentos/dados (Ex: RG ilegível, CPF incorreto):');
    if (!motivo) return;

    const { error } = await supabase
      .from('onboarding_candidates')
      .update({ status: 'Rejeitado / Pendência', feedback_reason: motivo })
      .eq('id', candidato.id);

    if (!error) {
      carregarDados();
      const fone = extrairTelefone(candidato);
      const primeiroNome = (candidato.full_name || 'Candidato').trim().split(' ')[0];
      const texto = `Olá ${primeiroNome}, aqui é do setor de Recursos Humanos da Usina Bandeirante (USIBAN).\n\nIdentificamos uma pendência na documentação enviada para sua admissão:\n⚠️ *Motivo da Pendência:* ${motivo}\n\nPor favor, acesse o link a seguir para corrigir seus dados ou reenviar os documentos pendentes:\n👉 ${LINK_OFICIAL_PORTAL}\n\nQualquer dúvida, responda por aqui.`;
      if (fone && fone.length >= 10) window.open(`https://wa.me/${fone}?text=${encodeURIComponent(texto)}`, '_blank');
      else alert('Status alterado para pendência!');
    }
  }

  async function handleExcluirCandidato(candidato) {
    const confirmacao = prompt(`⚠️ ATENÇÃO - AÇÃO IRREVERSÍVEL ⚠️\n\nDeseja excluir permanentemente o candidato "${candidato.full_name}"?\nTodos os dados e arquivos serão deletados.\n\nDigite EXCLUIR para confirmar:`);
    if (confirmacao !== 'EXCLUIR') return;

    await supabase.from('candidate_documents').delete().eq('candidate_id', candidato.id);
    await supabase.from('onboarding_candidates').delete().eq('id', candidato.id);
    alert(`Candidato "${candidato.full_name}" excluído.`);
    carregarDados();
  }

  function iniciarEdicao(candidato) {
    setCandidatoEditando(candidato);
    setDadosEdicao(candidato.custom_data ? { ...candidato.custom_data } : {
      'Nome Completo': candidato.full_name,
      'Cargo Pretendido': candidato.job_title,
      'Departamento': candidato.department,
      'E-mail': candidato.email,
      'WhatsApp / Telefone': candidato.phone
    });
  }

  async function salvarEdicaoRH(e) {
    e.preventDefault();
    if (!candidatoEditando) return;
    const novoNome = dadosEdicao['Nome Completo'] || candidatoEditando.full_name;
    const novoEmail = dadosEdicao['E-mail'] || candidatoEditando.email;
    const novoTelefone = dadosEdicao['WhatsApp / Telefone'] || dadosEdicao['Telefone'] || candidatoEditando.phone;
    const novoCargo = dadosEdicao['Cargo Pretendido'] || candidatoEditando.job_title;
    const novoDepto = dadosEdicao['Departamento'] || candidatoEditando.department;

    const { error } = await supabase.from('onboarding_candidates').update({
      full_name: novoNome,
      email: novoEmail,
      phone: novoTelefone,
      job_title: novoCargo,
      department: novoDepto,
      custom_data: dadosEdicao
    }).eq('id', candidatoEditando.id);

    if (!error) {
      alert('Dados cadastrais atualizados com sucesso!');
      setCandidatoEditando(null);
      carregarDados();
    }
  }

  // --- EXPORTAÇÕES R&S (EXCEL CSV & PDF) ---
  function handleExportarCSV(somenteAprovados = true) {
    const listaAlvo = somenteAprovados ? candidates.filter(c => c.status === 'Aprovado') : candidates;
    if (listaAlvo.length === 0) {
      alert('Nenhum candidato encontrado para exportar.');
      return;
    }
    const colunasDinamicas = new Set();
    listaAlvo.forEach(c => {
      if (c.custom_data) Object.keys(c.custom_data).forEach(col => colunasDinamicas.add(col));
    });
    const listaColunas = Array.from(colunasDinamicas);
    const cabecalho = ['Nome Completo', 'Status', 'Data de Envio', 'Observações / Agendamento', ...listaColunas];

    const linhas = listaAlvo.map(c => {
      const dataCriacao = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '';
      const linhaBase = [
        `"${(c.full_name || '').replace(/"/g, '""')}"`,
        `"${(c.status || '').replace(/"/g, '""')}"`,
        `"${dataCriacao}"`,
        `"${(c.feedback_reason || '').replace(/"/g, '""')}"`
      ];
      const valoresDinamicos = listaColunas.map(col => `"${String(c.custom_data?.[col] ?? '').replace(/"/g, '""')}"`);
      return [...linhaBase, ...valoresDinamicos].join(';');
    });

    const blob = new Blob(['\uFEFF' + [cabecalho.map(c => `"${c}"`).join(';'), ...linhas].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admissoes_usiban_${somenteAprovados ? 'aprovados' : 'todos'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportarPDF(somenteAprovados = false) {
    const listaAlvo = somenteAprovados ? candidates.filter(c => c.status === 'Aprovado') : candidates;
    if (listaAlvo.length === 0) {
      alert('Nenhum candidato encontrado.');
      return;
    }
    const janela = window.open('', '_blank');
    if (!janela) return;

    const linhasTabela = listaAlvo.map((c, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px;">
        <td style="padding: 6px; text-align: center;">${i + 1}</td>
        <td style="padding: 6px; font-weight: bold;">${c.full_name}</td>
        <td style="padding: 6px;">${c.custom_data?.['CPF'] || '-'}</td>
        <td style="padding: 6px;">${c.job_title || '-'}</td>
        <td style="padding: 6px;">${c.department || '-'}</td>
        <td style="padding: 6px;">${c.phone || '-'}</td>
        <td style="padding: 6px; font-weight: bold;">${c.status}</td>
        <td style="padding: 6px;">${c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-'}</td>
      </tr>
    `).join('');

    janela.document.write(`
      <html>
        <head><title>Relatório Usiban</title></head>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2 style="color: #0c5e31; margin-bottom: 4px;">Usina Bandeirante (USIBAN)</h2>
          <p style="color: #64748b; font-size: 12px; margin-top: 0;">Relatório de Candidatos e Admissões • Emissão: ${new Date().toLocaleDateString('pt-BR')}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <thead>
              <tr style="background: #0c5e31; color: #fff; font-size: 11px; text-align: left;">
                <th style="padding: 6px;">#</th><th>Nome</th><th>CPF</th><th>Cargo</th><th>Departamento</th><th>Contato</th><th>Status</th><th>Data</th>
              </tr>
            </thead>
            <tbody>${linhasTabela}</tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    janela.document.close();
  }

  // --- CONVITES WHATSAPP ---
  async function handleAdicionarConviteIndividual(e) {
    e.preventDefault();
    if (!conviteNome || !conviteTelefone) return;
    const telefoneLimpo = conviteTelefone.replace(/\D/g, '');
    const { error } = await supabase.from('admission_invites').insert([
      { candidate_name: conviteNome.trim(), phone: telefoneLimpo, job_title: conviteCargo.trim(), status: 'Pendente' }
    ]);
    if (!error) {
      setConviteNome('');
      setConviteTelefone('');
      setConviteCargo('');
      carregarDados();
      alert('Convite adicionado!');
    }
  }

  async function handleImportarLote(e) {
    e.preventDefault();
    if (!listaLote.trim()) return;

    const linhas = listaLote.split('\n');
    const novosConvites = [];
    linhas.forEach(linha => {
      const partes = linha.split(/[,;\t]/);
      if (partes.length >= 2) {
        const nome = partes[0].trim();
        const telefone = partes[1].replace(/\D/g, '');
        const cargo = partes[2] ? partes[2].trim() : '';
        if (nome && telefone.length >= 10) {
          novosConvites.push({ candidate_name: nome, phone: telefone, job_title: cargo, status: 'Pendente' });
        }
      }
    });

    if (novosConvites.length === 0) {
      alert('Formato inválido. Use: Nome, Telefone (um por linha).');
      return;
    }

    const { error } = await supabase.from('admission_invites').insert(novosConvites);
    if (!error) {
      setListaLote('');
      carregarDados();
      alert(`${novosConvites.length} candidatos importados!`);
    }
  }

  async function dispararWhatsAppConvite(convite) {
    const primeiroNome = convite.candidate_name.split(' ')[0];
    const mensagem = mensagemModelo.replace('{NOME}', primeiroNome);
    let fone = convite.phone.replace(/\D/g, '');
    if (!fone.startsWith('55') && fone.length <= 11) fone = '55' + fone;

    await supabase.from('admission_invites').update({ status: 'Enviado' }).eq('id', convite.id);
    carregarDados();
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  async function handleExcluirConvite(id) {
    if (!confirm('Deseja remover este convite?')) return;
    await supabase.from('admission_invites').delete().eq('id', id);
    carregarDados();
  }

  // --- CAMPOS E DOCUMENTOS EXIGIDOS ---
  async function handleMoverCampo(index, direcao) {
    const novoIndex = direcao === 'cima' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= requiredFields.length) return;

    const novaLista = [...requiredFields];
    const [itemRemovido] = novaLista.splice(index, 1);
    novaLista.splice(novoIndex, 0, itemRemovido);
    setRequiredFields(novaLista);

    for (let i = 0; i < novaLista.length; i++) {
      await supabase
        .from('required_personal_fields')
        .update({ display_order: i + 1 })
        .eq('id', novaLista[i].id);
    }
  }

  async function handleAdicionarCampo(e) {
    e.preventDefault();
    if (!novoCampoLabel) return;
    const proximaOrdem = requiredFields.length + 1;
    const { error } = await supabase.from('required_personal_fields').insert([
      {
        label: novoCampoLabel,
        field_type: novoCampoTipo,
        placeholder: novoCampoPlaceholder,
        is_required: novoCampoObrigatorio,
        validation_rule: novoCampoValidacao,
        display_order: proximaOrdem,
        is_active: true
      }
    ]);
    if (!error) {
      setNovoCampoLabel('');
      setNovoCampoPlaceholder('');
      setNovoCampoValidacao('none');
      carregarDados();
      alert('Campo adicionado!');
    }
  }

  async function handleDesativarCampo(id) {
    if (!confirm('Deseja desativar este campo?')) return;
    await supabase.from('required_personal_fields').update({ is_active: false }).eq('id', id);
    carregarDados();
  }

  async function handleAdicionarDoc(e) {
    e.preventDefault();
    if (!novoDocTitulo) return;
    const { error } = await supabase.from('required_documents').insert([
      { title: novoDocTitulo, description: novoDocDesc, is_required: novoDocObrigatorio, is_active: true }
    ]);
    if (!error) {
      setNovoDocTitulo('');
      setNovoDocDesc('');
      carregarDados();
      alert('Documento adicionado!');
    }
  }

  async function handleDesativarDoc(id) {
    if (!confirm('Deseja desativar este documento?')) return;
    await supabase.from('required_documents').update({ is_active: false }).eq('id', id);
    carregarDados();
  }

  // --- MÓDULO DP: GERENCIAR COMPETÊNCIAS ---
  async function handleSalvarCompetencia(e) {
    e.preventDefault();
    if (!novaCompTitulo || !novaCompCodigo) return;

    if (compEditando) {
      await supabase
        .from('payroll_competences')
        .update({ title: novaCompTitulo, code: novaCompCodigo, year: Number(novaCompAno) })
        .eq('id', compEditando.id);
    } else {
      const { error } = await supabase
        .from('payroll_competences')
        .insert([{ title: novaCompTitulo, code: novaCompCodigo, year: Number(novaCompAno) }]);
      if (error) {
        alert('Código de competência já existente.');
        return;
      }
    }

    setCompEditando(null);
    setNovaCompTitulo('');
    setNovaCompCodigo('');
    carregarDados();
  }

  async function handleExcluirCompetencia(id) {
    if (!confirm('Deseja excluir esta competência? Os holerites já existentes não serão apagados.')) return;
    await supabase.from('payroll_competences').delete().eq('id', id);
    carregarDados();
  }

  // --- SALVAR NÚMERO DE ATENDIMENTO DO DP ---
  async function handleSalvarTelefoneDP(e) {
    e.preventDefault();
    const foneLimpo = telefoneAtendimentoDP.replace(/\D/g, '');
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'whatsapp_dp_phone',
        value: foneLimpo,
        updated_at: new Date().toISOString()
      });

    if (!error) {
      alert('Telefone do WhatsApp de atendimento do DP salvo com sucesso!');
      carregarDados();
    } else {
      alert('Erro ao salvar telefone: ' + error.message);
    }
  }

  // --- FAIXA DO SENIOR: FATIAMENTO COM CONFIRMAÇÃO DO OPERADOR ---
  async function handleUploadSeniorHCM(e) {
    e.preventDefault();
    if (!arquivoSenior) {
      alert('Selecione o arquivo PDF consolidado exportado pelo Senior HCM.');
      return;
    }
    if (!competenciaSelecionada) {
      alert('Selecione uma competência ativa antes de importar.');
      return;
    }

    const confirma = confirm(
      `⚠️ CONFERÊNCIA OBRIGATÓRIA DE COMPETÊNCIA ⚠️\n\nVocê está prestes a importar os holerites para a competência:\n👉 "${competenciaSelecionada}"\n\nArquivo selecionado: "${arquivoSenior.name}"\n\nVocê confirma que este arquivo pertence exatamente a esta competência?`
    );

    if (!confirma) return;

    setProcessandoPdf(true);
    setStatusProcessamento('Fatiando páginas e cadastrando colaboradores...');

    try {
      const formData = new FormData();
      formData.append('file', arquivoSenior);
      formData.append('competence', competenciaSelecionada);

      const resposta = await fetch('/api/dp/split-payrolls', {
        method: 'POST',
        body: formData,
      });

      const resultado = await resposta.json();

      if (resultado.success) {
        setStatusProcessamento(resultado.message || 'Processamento concluído com sucesso!');
        setArquivoSenior(null);
        const inputFile = document.getElementById('input-folha-senior');
        if (inputFile) inputFile.value = '';
        carregarDados();
        alert(`✅ Sucesso!\n${resultado.message}`);
      } else {
        setStatusProcessamento(`⚠️ Erro: ${resultado.error}`);
        alert(resultado.error);
      }
    } catch (err) {
      setStatusProcessamento('Falha na comunicação com a API de fatiamento.');
      alert('Falha na requisição: ' + err.message);
    }

    setProcessandoPdf(false);
  }

  // Limpeza de Holerites da Competência
  async function handleLimparTodosHolerites() {
    const confirmacao = prompt(`⚠️ ATENÇÃO: Deseja apagar TODOS os holerites da competência "${competenciaSelecionada}"?\n\nDigite EXCLUIR para confirmar:`);
    if (confirmacao !== 'EXCLUIR') return;

    await supabase.from('employee_payrolls').delete().eq('competence', competenciaSelecionada);
    alert('Holerites da competência removidos.');
    carregarDados();
  }

  // Disparo WhatsApp do Holerite
  function obterTelefonePorCpf(cpf) {
    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    const achado = candidates.find(c => {
      const cCpf = (c.custom_data?.['CPF'] || '').replace(/\D/g, '');
      return cCpf && cCpf === cpfLimpo;
    });
    let fone = '';
    if (achado) fone = achado.phone || achado.custom_data?.['WhatsApp / Telefone'] || '';
    fone = (fone || '').replace(/\D/g, '');
    if (fone && !fone.startsWith('55') && fone.length <= 11) fone = '55' + fone;
    return fone;
  }

  async function handleDispararHoleriteWhatsApp(holerite) {
    let fone = obterTelefonePorCpf(holerite.cpf);

    if (!fone || fone.length < 10) {
      const foneInformado = prompt(`Informe o WhatsApp com DDD para o colaborador (CPF: ${holerite.cpf}):`);
      if (!foneInformado) return;
      fone = foneInformado.replace(/\D/g, '');
      if (!fone.startsWith('55') && fone.length <= 11) fone = '55' + fone;
    }

    let nomePuro = (holerite.employee_name || '').trim();
    if (nomePuro.toLowerCase().includes('demonstrativo') || !nomePuro) {
      nomePuro = 'Colaborador(a)';
    }
    const primeiroNome = nomePuro.split(' ')[0];

    const mensagem = `Olá ${primeiroNome}, o seu Demonstrativo de Pagamento referente à competência *${holerite.competence}* da Usina Bandeirante (USIBAN) já está disponível.\n\n📄 *Acesse o documento oficial no link abaixo:*\n${holerite.file_url}\n\nEm caso de dúvidas sobre a folha, entre em contato com o Departamento Pessoal.`;

    await supabase.from('employee_payrolls').update({ status: 'Enviado', channel: 'WhatsApp' }).eq('id', holerite.id);
    carregarDados();
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  async function handleIniciarDisparoEmFila() {
    const pendentes = payrolls.filter(p => p.competence === competenciaSelecionada && p.status !== 'Enviado');
    if (pendentes.length === 0) {
      alert('Nenhum holerite pendente nesta competência.');
      return;
    }

    if (!confirm(`Iniciar envio sequencial para ${pendentes.length} colaboradores pendentes? O WhatsApp de cada um será aberto em fila.`)) return;

    for (const item of pendentes) {
      await handleDispararHoleriteWhatsApp(item);
      const continuar = confirm(`Envio aberto para ${item.employee_name}. Deseja prosseguir para o próximo da fila?`);
      if (!continuar) break;
    }
  }

  // --- GESTÃO DE USUÁRIOS (ADMIN) ---
  async function handleCriarUsuario(e) {
    e.preventDefault();
    if (!novoUserNome || !novoUserEmail || !novoUserSenha) return;

    const { error } = await supabase.from('system_users').insert([
      {
        name: novoUserNome.trim(),
        email: novoUserEmail.trim().toLowerCase(),
        password: novoUserSenha,
        role: novoUserRole,
        is_active: true
      }
    ]);

    if (!error) {
      alert(`Usuário ${novoUserNome} criado com sucesso!`);
      setNovoUserNome('');
      setNovoUserEmail('');
      setNovoUserSenha('');
      setNovoUserRole('recrutamento');
      carregarDados();
    } else {
      alert('Erro ao criar usuário: ' + error.message);
    }
  }

  async function handleAlternarStatusUsuario(id, statusAtual) {
    await supabase.from('system_users').update({ is_active: !statusAtual }).eq('id', id);
    carregarDados();
  }

  async function handleExcluirUsuario(user) {
    if (user.email === 'admin@usiban.com.br') {
      alert('O administrador master não pode ser excluído.');
      return;
    }
    if (!confirm(`Deseja remover permanentemente o usuário ${user.name}?`)) return;
    await supabase.from('system_users').delete().eq('id', user.id);
    carregarDados();
  }

  // --- TELA DE LOGIN ---
  if (!usuarioLogado) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#f4f6f5' }}>
        <form onSubmit={handleLogin} style={{ background: '#fff', padding: '36px 30px', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.08)', width: '340px', borderTop: '6px solid #0c5e31', border: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src="/logo-usiban.png" alt="USIBAN" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '90px', height: 'auto', marginBottom: '10px' }} />
            <h2 style={{ margin: 0, color: '#0c5e31', fontSize: '20px', fontWeight: '800' }}>Portal RH & DP</h2>
            <small style={{ color: '#64748b' }}>Açúcar e Álcool Bandeirantes S.A.</small>
          </div>

          {erroLogin && (
            <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '12.5px', marginBottom: '14px', textAlign: 'center' }}>
              ⚠️ {erroLogin}
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>E-mail Corporativo</label>
            <input type="email" placeholder="seu.email@usiban.com.br" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>Senha</label>
            <input type="password" placeholder="••••••••" value={loginSenha} onChange={e => setLoginSenha(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
          </div>

          <button type="submit" style={{ width: '100%', padding: '12px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
            Acessar Sistema
          </button>
        </form>
      </main>
    );
  }

  const anosDisponiveis = Array.from(new Set(competencias.map(c => c.year || 2026))).sort((a, b) => b - a);
  const competenciasDoAno = competencias.filter(c => Number(c.year) === Number(anoFiltro));
  const holeritesFiltrados = payrolls.filter(p => p.competence === competenciaSelecionada);
  const totalEnviados = holeritesFiltrados.filter(p => p.status === 'Enviado').length;
  const totalPendentes = holeritesFiltrados.filter(p => p.status !== 'Enviado').length;

  return (
    <main style={{ padding: '24px 16px', fontFamily: 'system-ui, sans-serif', maxWidth: '1100px', margin: '0 auto', color: '#1e293b' }}>
      
      {/* Topo Institucional */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/logo-usiban.png" alt="USIBAN" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '55px', height: 'auto' }} />
          <div>
            <h1 style={{ margin: 0, color: '#0c5e31', fontSize: '22px', fontWeight: 'bold' }}>Portal Integrado RH & DP</h1>
            <small style={{ color: '#64748b' }}>Açúcar e Álcool Bandeirantes S.A. • USIBAN</small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right', fontSize: '13px' }}>
            <span style={{ fontWeight: 'bold', display: 'block', color: '#0f172a' }}>{usuarioLogado.name}</span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: usuarioLogado.role === 'admin' ? '#e8f5e9' : '#e0f2fe', color: usuarioLogado.role === 'admin' ? '#0c5e31' : '#0369a1', fontWeight: 'bold' }}>
              {usuarioLogado.role === 'admin' ? 'Administrador Geral' : usuarioLogado.role === 'recrutamento' ? 'Módulo R&S' : 'Módulo DP'}
            </span>
          </div>
          <button onClick={handleLogout} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
            Sair
          </button>
        </div>
      </div>

      {/* Navegação entre Módulos Principais */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {usuarioLogado.role === 'admin' && (
          <button onClick={() => setModuloAtivo('menu')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'menu' ? '#0c5e31' : '#f1f5f9', color: moduloAtivo === 'menu' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            🏠 Início (Módulos)
          </button>
        )}

        {(usuarioLogado.role === 'admin' || usuarioLogado.role === 'recrutamento') && (
          <button onClick={() => setModuloAtivo('recrutamento')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'recrutamento' ? '#0c5e31' : '#f1f5f9', color: moduloAtivo === 'recrutamento' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            🟢 Recrutamento & Seleção (R&S)
          </button>
        )}

        {(usuarioLogado.role === 'admin' || usuarioLogado.role === 'dp') && (
          <button onClick={() => setModuloAtivo('dp')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'dp' ? '#003366' : '#f1f5f9', color: moduloAtivo === 'dp' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            🔵 Departamento Pessoal (Holerites Senior HCM)
          </button>
        )}

        {usuarioLogado.role === 'admin' && (
          <button onClick={() => setModuloAtivo('usuarios')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'usuarios' ? '#475569' : '#f1f5f9', color: moduloAtivo === 'usuarios' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}>
            ⚙️ Gestão de Usuários
          </button>
        )}
      </div>

      {/* --- MÓDULO 0: HUB CENTRAL --- */}
      {moduloAtivo === 'menu' && usuarioLogado.role === 'admin' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '10px' }}>
          <div onClick={() => setModuloAtivo('recrutamento')} style={{ background: '#fff', border: '2px solid #0c5e31', borderRadius: '10px', padding: '24px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '32px' }}>🟢</span>
            <h3 style={{ color: '#0c5e31', margin: '12px 0 6px 0', fontSize: '18px' }}>Módulo Recrutamento & Seleção</h3>
            <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>Gestão de admissões, convites via WhatsApp, conferência documental e relatórios admissionais.</p>
          </div>

          <div onClick={() => setModuloAtivo('dp')} style={{ background: '#fff', border: '2px solid #003366', borderRadius: '10px', padding: '24px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '32px' }}>🔵</span>
            <h3 style={{ color: '#003366', margin: '12px 0 6px 0', fontSize: '18px' }}>Módulo Departamento Pessoal (DP)</h3>
            <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>Fatiamento de folha do Senior HCM, armazenamento seguro no Supabase e envio de holerites por WhatsApp.</p>
          </div>

          <div onClick={() => setModuloAtivo('usuarios')} style={{ background: '#fff', border: '2px solid #64748b', borderRadius: '10px', padding: '24px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '32px' }}>⚙️</span>
            <h3 style={{ color: '#334155', margin: '12px 0 6px 0', fontSize: '18px' }}>Gestão de Acessos & Usuários</h3>
            <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>Controle de perfis com permissões exclusivas para equipes de R&S, DP ou Administradores.</p>
          </div>
        </div>
      )}

      {/* --- MÓDULO 1: RECRUTAMENTO & SELEÇÃO (R&S) --- */}
      {moduloAtivo === 'recrutamento' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <button onClick={() => setAbaRS('candidatos')} style={{ padding: '8px 14px', border: 'none', borderBottom: abaRS === 'candidatos' ? '3px solid #0c5e31' : 'none', background: abaRS === 'candidatos' ? '#e8f5e9' : '#f8fafc', color: abaRS === 'candidatos' ? '#0c5e31' : '#64748b', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}>
              👥 Candidatos & Validação
            </button>
            <button onClick={() => setAbaRS('convites')} style={{ padding: '8px 14px', border: 'none', borderBottom: abaRS === 'convites' ? '3px solid #0c5e31' : 'none', background: abaRS === 'convites' ? '#e8f5e9' : '#f8fafc', color: abaRS === 'convites' ? '#0c5e31' : '#64748b', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}>
              📨 Convidar Candidatos (WhatsApp)
            </button>
            <button onClick={() => setAbaRS('campos')} style={{ padding: '8px 14px', border: 'none', borderBottom: abaRS === 'campos' ? '3px solid #0c5e31' : 'none', background: abaRS === 'campos' ? '#e8f5e9' : '#f8fafc', color: abaRS === 'campos' ? '#0c5e31' : '#64748b', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}>
              📝 Campos Pessoais
            </button>
            <button onClick={() => setAbaRS('documentos')} style={{ padding: '8px 14px', border: 'none', borderBottom: abaRS === 'documentos' ? '3px solid #0c5e31' : 'none', background: abaRS === 'documentos' ? '#e8f5e9' : '#f8fafc', color: abaRS === 'documentos' ? '#0c5e31' : '#64748b', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}>
              📋 Documentos Exigidos
            </button>
          </div>

          {candidatoEditando && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
              <div style={{ background: '#fff', padding: '24px', borderRadius: '10px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#0c5e31' }}>✏️ Corrigir Dados: {candidatoEditando.full_name}</h3>
                <form onSubmit={salvarEdicaoRH} style={{ display: 'grid', gap: '10px' }}>
                  {Object.entries(dadosEdicao).map(([campo, valor]) => (
                    <div key={campo}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '4px' }}>{campo}</label>
                      <input
                        type="text"
                        value={valor || ''}
                        onChange={(e) => setDadosEdicao({ ...dadosEdicao, [campo]: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                    <button type="button" onClick={() => setCandidatoEditando(null)} style={{ padding: '8px 14px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" style={{ padding: '8px 16px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {abaRS === 'candidatos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Todos', 'Pendentes', 'Aprovados', 'Com Pendência'].map(status => (
                    <button key={status} onClick={() => setFiltro(status)} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid #cbd5e1', background: filtro === status ? '#0c5e31' : '#fff', color: filtro === status ? '#fff' : '#475569', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
                      {status}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleExportarCSV(true)} style={{ padding: '7px 12px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>📊 Excel (Aprovados)</button>
                  <button onClick={() => handleExportarCSV(false)} style={{ padding: '7px 12px', background: '#003366', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>📥 Excel (Todos)</button>
                  <button onClick={() => handleExportarPDF(false)} style={{ padding: '7px 12px', background: '#475569', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>📄 Relatório PDF</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {candidates
                  .filter(c => filtro === 'Todos' ? true : filtro === 'Pendentes' ? c.status === 'Pendente' : filtro === 'Aprovados' ? c.status === 'Aprovado' : c.status?.includes('Rejeitado'))
                  .map((c) => {
                    const badge = c.status === 'Aprovado' ? { bg: '#e8f5e9', color: '#0c5e31' } : c.status?.includes('Rejeitado') ? { bg: '#fee2e2', color: '#b91c1c' } : { bg: '#fef3c7', color: '#b45309' };
                    const docsEnviados = candidateDocs[c.id] || [];
                    const dadosExtras = c.custom_data || {};

                    return (
                      <div key={c.id} style={{ padding: '18px 20px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ fontSize: '18px' }}>{c.full_name}</strong>
                            <span style={{ backgroundColor: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{c.status}</span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={() => iniciarEdicao(c)} style={{ padding: '6px 10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                              ✏️ Editar
                            </button>

                            <button
                              onClick={() => {
                                const fone = extrairTelefone(c);
                                if (!fone) {
                                  alert('Telefone não informado pelo candidato.');
                                  return;
                                }
                                const primeiroNome = (c.full_name || 'Candidato').trim().split(' ')[0];
                                const texto = `Olá ${primeiroNome}, aqui é do setor de Recursos Humanos da Usina Bandeirante (USIBAN).`;
                                window.open(`https://wa.me/${fone}?text=${encodeURIComponent(texto)}`, '_blank');
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                            >
                              📱 WhatsApp
                            </button>

                            <button onClick={() => handleAprovar(c)} style={{ padding: '6px 12px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>
                              Aprovar ✓
                            </button>
                            <button onClick={() => handleRejeitar(c)} style={{ padding: '6px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>
                              Pendência ✕
                            </button>
                            <button onClick={() => handleExcluirCandidato(c)} style={{ padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                              🗑️
                            </button>
                          </div>
                        </div>

                        <div style={{ padding: '14px', background: '#f8faf9', borderRadius: '6px', fontSize: '13.5px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {Object.entries(dadosExtras).map(([k, v]) => (
                              <div key={k} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}><b>{k}:</b> {String(v)}</div>
                            ))}
                          </div>
                        </div>

                        {c.feedback_reason && (
                          <div style={{ marginTop: '10px', padding: '10px', background: c.status === 'Aprovado' ? '#e8f5e9' : '#fef2f2', borderLeft: `4px solid ${c.status === 'Aprovado' ? '#0c5e31' : '#ef4444'}`, fontSize: '13px' }}>
                            <b>{c.status === 'Aprovado' ? 'Agendamentos:' : 'Motivo da Pendência:'}</b> {c.feedback_reason}
                          </div>
                        )}

                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Documentos Enviados ({docsEnviados.length}):</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {docsEnviados.map(d => (
                              <a key={d.id} href={d.document_url} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 10px', background: '#e8f5e9', border: '1px solid #c8e6c9', color: '#0c5e31', textDecoration: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                📄 {d.document_name}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {abaRS === 'convites' && (
            <div>
              <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <strong style={{ color: '#0c5e31', fontSize: '15px', display: 'block', marginBottom: '6px' }}>💬 Mensagem Padrão do WhatsApp</strong>
                <textarea rows={3} value={mensagemModelo} onChange={e => setMensagemModelo(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ marginTop: 0, color: '#0c5e31', fontSize: '16px' }}>+ Convidar Candidato Avulso</h3>
                  <form onSubmit={handleAdicionarConviteIndividual} style={{ display: 'grid', gap: '10px' }}>
                    <input placeholder="Nome do Candidato" value={conviteNome} onChange={e => setConviteNome(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <input placeholder="WhatsApp com DDD" value={conviteTelefone} onChange={e => setConviteTelefone(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <input placeholder="Cargo Pretendido" value={conviteCargo} onChange={e => setConviteCargo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ padding: '10px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Adicionar à Fila</button>
                  </form>
                </div>

                <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ marginTop: 0, color: '#003366', fontSize: '16px' }}>📋 Importar Lista em Lote</h3>
                  <form onSubmit={handleImportarLote} style={{ display: 'grid', gap: '10px' }}>
                    <textarea rows={4} placeholder="Nome, Telefone, Cargo (um por linha)" value={listaLote} onChange={e => setListaLote(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ padding: '10px', background: '#003366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Importar Lista</button>
                  </form>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invites.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <div><b>{inv.candidate_name}</b> - {inv.phone} ({inv.status})</div>
                    <button onClick={() => dispararWhatsAppConvite(inv)} style={{ padding: '6px 12px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      📱 Enviar WhatsApp
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaRS === 'campos' && (
            <div>
              <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#0c5e31' }}>+ Cadastrar Novo Campo</h3>
                <form onSubmit={handleAdicionarCampo} style={{ display: 'grid', gap: '10px', maxWidth: '500px' }}>
                  <input placeholder="Rótulo / Pergunta do Campo" value={novoCampoLabel} onChange={e => setNovoCampoLabel(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <select value={novoCampoValidacao} onChange={e => setNovoCampoValidacao(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="none">Sem validação especial</option>
                    <option value="fullname">Nome Completo</option>
                    <option value="cpf">CPF Válido</option>
                    <option value="phone">WhatsApp 9 Dígitos</option>
                  </select>
                  <button type="submit" style={{ padding: '10px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Salvar Campo</button>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {requiredFields.map((f, idx) => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <div><b>{idx + 1}.</b> {f.label} ({f.validation_rule})</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleMoverCampo(idx, 'cima')} disabled={idx === 0} style={{ padding: '4px 8px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}>▲</button>
                      <button onClick={() => handleMoverCampo(idx, 'baixo')} disabled={idx === requiredFields.length - 1} style={{ padding: '4px 8px', cursor: idx === requiredFields.length - 1 ? 'not-allowed' : 'pointer' }}>▼</button>
                      <button onClick={() => handleDesativarCampo(f.id)} style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Desativar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaRS === 'documentos' && (
            <div>
              <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#0c5e31' }}>+ Cadastrar Novo Documento</h3>
                <form onSubmit={handleAdicionarDoc} style={{ display: 'grid', gap: '10px', maxWidth: '500px' }}>
                  <input placeholder="Título do Documento" value={novoDocTitulo} onChange={e => setNovoDocTitulo(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <input placeholder="Instruções" value={novoDocDesc} onChange={e => setNovoDocDesc(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" style={{ padding: '10px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Salvar Documento</button>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {requiredDocs.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <div><b>{d.title}</b> - {d.description}</div>
                    <button onClick={() => handleDesativarDoc(d.id)} style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Desativar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MÓDULO 2: DEPARTAMENTO PESSOAL (SENIOR HCM) --- */}
      {moduloAtivo === 'dp' && (
        <div>
          {/* Configuração Dinâmica do WhatsApp do DP */}
          <div style={{ background: '#fff', padding: '18px 22px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: '#003366', fontSize: '16px' }}>📱 Canal WhatsApp de Atendimento ao Colaborador</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Número corporativo do DP que receberá as dúvidas e solicitações enviadas pela Central do Colaborador.
              </p>
            </div>
            <form onSubmit={handleSalvarTelefoneDP} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Ex: 5543999999999"
                value={telefoneAtendimentoDP}
                onChange={e => setTelefoneAtendimentoDP(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', minWidth: '180px' }}
              />
              <button
                type="submit"
                style={{ padding: '8px 16px', background: '#003366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
              >
                Salvar Número
              </button>
            </form>
          </div>

          {/* Modal Gerenciar Competências */}
          {modalCompAberto && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
              <div style={{ background: '#fff', padding: '24px', borderRadius: '10px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#003366' }}>⚙️ Gerenciar Competências do DP</h3>
                
                <form onSubmit={handleSalvarCompetencia} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: '8px', marginBottom: '18px', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Título de Exibição</label>
                    <input placeholder="Ex: 11/2026 - Folha Mensal" value={novaCompTitulo} onChange={e => setNovaCompTitulo(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Código no PDF</label>
                    <input placeholder="Ex: 11/2026" value={novaCompCodigo} onChange={e => setNovaCompCodigo(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Ano</label>
                    <input type="number" value={novaCompAno} onChange={e => setNovaCompAno(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <button type="submit" style={{ padding: '8px 14px', background: '#003366', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {compEditando ? 'Salvar' : '+ Criar'}
                  </button>
                </form>

                <h4 style={{ margin: '14px 0 8px 0', fontSize: '13px', color: '#475569' }}>Competências Cadastradas:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {competencias.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}>
                      <div>
                        <b>{c.title}</b> <span style={{ color: '#64748b' }}>({c.code}) - Ano: {c.year}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setCompEditando(c); setNovaCompTitulo(c.title); setNovaCompCodigo(c.code); setNovaCompAno(c.year); }} style={{ padding: '3px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
                        <button onClick={() => handleExcluirCompetencia(c.id)} style={{ padding: '3px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
                  <button type="button" onClick={() => { setModalCompAberto(false); setCompEditando(null); }} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Fechar</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: '#fff', padding: '22px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #003366', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#003366', fontSize: '20px' }}>📑 Importador & Disparador de Holerites (Senior HCM)</h2>
                <small style={{ color: '#64748b' }}>Fatiamento por CPF, checagem de competência e prevenção de envios duplicados</small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginRight: '4px' }}>Ano:</label>
                  <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                    {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginRight: '4px' }}>Competência:</label>
                  <select 
                    value={competenciaSelecionada} 
                    onChange={e => setCompetenciaSelecionada(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold', color: '#003366' }}
                  >
                    {competenciasDoAno.map(c => (
                      <option key={c.code} value={c.code}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <button onClick={() => setModalCompAberto(true)} style={{ padding: '7px 10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold', color: '#334155' }}>
                  ⚙️ Gerenciar
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px dashed #003366' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#003366', fontSize: '16px' }}>1. Upload da Folha (Senior HCM)</h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: 0 }}>
                  O sistema confere se o PDF pertence à competência <b>{competenciaSelecionada}</b> e atualiza sem duplicar:
                </p>

                <form onSubmit={handleUploadSeniorHCM} style={{ display: 'grid', gap: '10px' }}>
                  <input 
                    id="input-folha-senior"
                    type="file" 
                    accept=".pdf"
                    onChange={e => setArquivoSenior(e.target.files[0])}
                    style={{ padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} 
                  />
                
                  <div style={{ padding: '10px 12px', background: '#fef3c7', borderLeft: '4px solid #b45309', borderRadius: '4px', fontSize: '12px', color: '#92400e', lineHeight: '1.4' }}>
                    <b>⚠️ Atenção Operador:</b> Confira se a competência ativa selecionada (<b>{competenciaSelecionada}</b>) confere exatamente com o mês/ano impresso no arquivo que você está enviando.
                  </div>
                
                  <button 
                    type="submit" 
                    disabled={processandoPdf}
                    style={{ padding: '11px', background: processandoPdf ? '#64748b' : '#003366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: processandoPdf ? 'not-allowed' : 'pointer', fontSize: '13.5px' }}
                  >
                    {processandoPdf ? 'Fatiando Páginas e Salvando...' : '⚡ Fatiar e Importar Folha'}
                  </button>
                </form>

                {statusProcessamento && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: '5px', fontSize: '12px', fontWeight: '500' }}>
                    {statusProcessamento}
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#0c5e31', fontSize: '16px' }}>2. Status dos Envios</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
                    <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c5e31', display: 'block' }}>{totalEnviados}</span>
                      <small style={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}>Enviados com Sucesso</small>
                    </div>
                    <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#b45309', display: 'block' }}>{totalPendentes}</span>
                      <small style={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}>Pendentes de Envio</small>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button 
                    onClick={handleIniciarDisparoEmFila}
                    style={{ flex: 1, padding: '10px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                  >
                    🚀 Disparar Todos os Pendentes ({totalPendentes})
                  </button>

                  <button 
                    onClick={handleLimparTodosHolerites}
                    style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                    title="Excluir todos os holerites desta competência"
                  >
                    🗑️ Limpar
                  </button>
                </div>
              </div>
            </div>

            <h3 style={{ color: '#003366', margin: '24px 0 12px 0' }}>Holerites da Competência ({holeritesFiltrados.length})</h3>

            {holeritesFiltrados.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13.5px', background: '#f8fafc', padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                Nenhum holerite cadastrado para {competenciaSelecionada}. Carregue o PDF acima.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {holeritesFiltrados.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#003366', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                          {idx + 1}
                        </span>
                        <strong style={{ fontSize: '15px' }}>{item.employee_name}</strong>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: item.status === 'Enviado' ? '#e8f5e9' : '#fef3c7', color: item.status === 'Enviado' ? '#0c5e31' : '#b45309', fontWeight: 'bold' }}>
                          {item.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', marginLeft: '30px' }}>
                        CPF: <b>{item.cpf}</b> {item.registration_number ? `| Matrícula: ${item.registration_number}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', background: '#f1f5f9', color: '#003366', border: '1px solid #cbd5e1', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px' }}>
                        📄 Ver PDF
                      </a>
                      <button onClick={() => handleDispararHoleriteWhatsApp(item)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        📱 WhatsApp
                      </button>
                      <button onClick={async () => { if (confirm('Remover este holerite?')) { await supabase.from('employee_payrolls').delete().eq('id', item.id); carregarDados(); } }} style={{ padding: '6px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MÓDULO 3: GESTÃO DE USUÁRIOS (ADMIN) --- */}
      {moduloAtivo === 'usuarios' && usuarioLogado.role === 'admin' && (
        <div style={{ background: '#fff', padding: '22px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
          <h3 style={{ marginTop: 0, color: '#334155' }}>+ Cadastrar Novo Operador</h3>
          <form onSubmit={handleCriarUsuario} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <input placeholder="Nome Completo" value={novoUserNome} onChange={e => setNovoUserNome(e.target.value)} required style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="email" placeholder="E-mail" value={novoUserEmail} onChange={e => setNovoUserEmail(e.target.value)} required style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="password" placeholder="Senha" value={novoUserSenha} onChange={e => setNovoUserSenha(e.target.value)} required style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <select value={novoUserRole} onChange={e => setNovoUserRole(e.target.value)} style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>
              <option value="recrutamento">🟢 Operador R&S</option>
              <option value="dp">🔵 Operador DP</option>
              <option value="admin">⚙️ Administrador Geral</option>
            </select>
            <button type="submit" style={{ padding: '10px 16px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Cadastrar</button>
          </form>

          <h4 style={{ marginTop: '24px' }}>Usuários Cadastrados ({systemUsers.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {systemUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div><b>{u.name}</b> ({u.email}) - Perfil: {u.role}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleAlternarStatusUsuario(u.id, u.is_active)} style={{ padding: '4px 8px', background: u.is_active ? '#fef3c7' : '#e8f5e9', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{u.is_active ? 'Desativar' : 'Ativar'}</button>
                  {u.email !== 'admin@usiban.com.br' && (
                    <button onClick={() => handleExcluirUsuario(u)} style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Excluir</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
