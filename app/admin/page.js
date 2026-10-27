'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const LINK_OFICIAL_PORTAL = 'https://sistema-onboarding-rh-4mj4.vercel.app/';

export default function AdminPage() {
  // Controle de Sessão
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');

  // Navegação entre Módulos: 'menu' | 'recrutamento' | 'dp' | 'usuarios'
  const [moduloAtivo, setModuloAtivo] = useState('menu');

  // Sub-abas do Módulo R&S: 'candidatos' | 'convites' | 'campos' | 'documentos'
  const [abaRS, setAbaRS] = useState('candidatos');

  // Dados do Sistema
  const [candidates, setCandidates] = useState([]);
  const [candidateDocs, setCandidateDocs] = useState({});
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [requiredFields, setRequiredFields] = useState([]);
  const [invites, setInvites] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [filtro, setFiltro] = useState('Todos');

  // Dados do Módulo DP (Holerites)
  const [payrolls, setPayrolls] = useState([]);
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState('10/2026');
  const [arquivoSenior, setArquivoSenior] = useState(null);
  const [processandoPdf, setProcessandoPdf] = useState(false);
  const [statusProcessamento, setStatusProcessamento] = useState('');

  // Gestão de Usuários (Admin)
  const [novoUserNome, setNovoUserNome] = useState('');
  const [novoUserEmail, setNovoUserEmail] = useState('');
  const [novoUserSenha, setNovoUserSenha] = useState('');
  const [novoUserRole, setNovoUserRole] = useState('recrutamento');

  // Edição de Candidatos (R&S)
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

    // 3. Documentos Exigidos
    const { data: reqDocs } = await supabase
      .from('required_documents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (reqDocs) setRequiredDocs(reqDocs);

    // 4. Campos Exigidos
    const { data: reqFields } = await supabase
      .from('required_personal_fields')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (reqFields) setRequiredFields(reqFields);

    // 5. Convites
    const { data: invData } = await supabase
      .from('admission_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (invData) setInvites(invData);

    // 6. Usuários do Sistema
    const { data: usersData } = await supabase
      .from('system_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (usersData) setSystemUsers(usersData);

    // 7. Holerites do DP
    const { data: payrollsData } = await supabase
      .from('employee_payrolls')
      .select('*')
      .order('created_at', { ascending: false });
    if (payrollsData) setPayrolls(payrollsData);
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

  // --- FUNÇÕES R&S: APROVAÇÃO, PENDÊNCIA E EXCLUSÃO ---
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
    const motivo = prompt('Informe o motivo da pendência com os documentos/dados:');
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
    const confirmacao = prompt(`⚠️ ATENÇÃO - AÇÃO IRREVERSÍVEL ⚠️\n\nDeseja excluir permanentemente o candidato "${candidato.full_name}"?\nDigite EXCLUIR para confirmar:`);
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

  // --- REORDENAÇÃO E GESTÃO DE CAMPOS ---
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

  // --- DOCUMENTOS EXIGIDOS ---
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

  // --- EXPORTAÇÕES ---
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
    const cabecalho = ['Nome Completo', 'Status', 'Data de Envio', 'Observações', ...listaColunas];

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
    link.setAttribute('download', `admissoes_usiban_${somenteAprovados ? 'aprovados' : 'geral'}.csv`);
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
                <th style="padding: 6px;">#</th><th>Nome</th><th>CPF</th><th>Cargo</th><th>Departamento</th><th>Contato</th><th>Status</th>
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

  // --- MÓDULO DP: PROCESSAMENTO DO SENIOR HCM ---
  async function handleUploadSeniorHCM(e) {
    e.preventDefault();
    if (!arquivoSenior) {
      alert('Selecione o arquivo PDF consolidado exportado pelo Senior HCM.');
      return;
    }

    setProcessandoPdf(true);
    setStatusProcessamento('Enviando arquivo e processando páginas...');

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
        setStatusProcessamento(`Sucesso! ${resultado.processedCount} de ${resultado.totalPages} páginas separadas e registradas.`);
        setArquivoSenior(null);
        const inputFile = document.getElementById('input-folha-senior');
        if (inputFile) inputFile.value = '';
        carregarDados();
      } else {
        setStatusProcessamento(`Erro: ${resultado.error}`);
        alert('Erro: ' + resultado.error);
      }
    } catch (err) {
      setStatusProcessamento('Falha na comunicação com a API de fatiamento.');
      alert('Falha na requisição: ' + err.message);
    }

    setProcessandoPdf(false);
  }

  async function handleDispararHoleriteWhatsApp(holerite) {
    const cpfLimpo = (holerite.cpf || '').replace(/\D/g, '');
    let fone = '';
    
    const candidatoCorrespondente = candidates.find(c => {
      const cCpf = (c.custom_data?.['CPF'] || '').replace(/\D/g, '');
      return cCpf && cCpf === cpfLimpo;
    });

    if (candidatoCorrespondente) {
      fone = candidatoCorrespondente.phone || candidatoCorrespondente.custom_data?.['WhatsApp / Telefone'] || '';
    }

    fone = (fone || '').replace(/\D/g, '');
    if (!fone || fone.length < 10) {
      const foneInformado = prompt(`Informe o WhatsApp com DDD para o colaborador (CPF: ${holerite.cpf}):`);
      if (!foneInformado) return;
      fone = foneInformado.replace(/\D/g, '');
    }

    if (!fone.startsWith('55') && fone.length <= 11) fone = '55' + fone;

    const primeiroNome = (holerite.employee_name || 'Colaborador').split(' ')[0];
    const mensagem = `Olá ${primeiroNome}, o seu Demonstrativo de Pagamento referente à competência *${holerite.competence}* da Usina Bandeirante (USIBAN) já está disponível.\n\n📄 *Acesse o seu documento oficial no link abaixo:*\n${holerite.file_url}\n\nEm caso de dúvidas sobre a folha, entre em contato com o Departamento Pessoal.`;

    await supabase
      .from('employee_payrolls')
      .update({ status: 'Enviado', channel: 'WhatsApp' })
      .eq('id', holerite.id);

    carregarDados();
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  async function handleExcluirHolerite(id) {
    if (!confirm('Deseja remover o registro deste holerite?')) return;
    await supabase.from('employee_payrolls').delete().eq('id', id);
    carregarDados();
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
            <img 
              src="/logo-usiban.png" 
              alt="USIBAN" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              style={{ width: '90px', height: 'auto', marginBottom: '10px' }} 
            />
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
            <input 
              type="email" 
              placeholder="seu.email@usiban.com.br" 
              value={loginEmail} 
              onChange={e => setLoginEmail(e.target.value)} 
              required 
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} 
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={loginSenha} 
              onChange={e => setLoginSenha(e.target.value)} 
              required 
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} 
            />
          </div>

          <button type="submit" style={{ width: '100%', padding: '12px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
            Acessar Sistema
          </button>
        </form>
      </main>
    );
  }

  const holeritesFiltrados = payrolls.filter(p => p.competence === competenciaSelecionada);
  const totalEnviados = holeritesFiltrados.filter(p => p.status === 'Enviado').length;
  const totalPendentes = holeritesFiltrados.filter(p => p.status !== 'Enviado').length;

  return (
    <main style={{ padding: '24px 16px', fontFamily: 'system-ui, sans-serif', maxWidth: '1100px', margin: '0 auto', color: '#1e293b' }}>
      
      {/* Topo Institucional */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img 
            src="/logo-usiban.png" 
            alt="USIBAN" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            style={{ width: '55px', height: 'auto' }} 
          />
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

      {/* Navegação de Módulos Principais */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {usuarioLogado.role === 'admin' && (
          <button 
            onClick={() => setModuloAtivo('menu')}
            style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'menu' ? '#0c5e31' : '#f1f5f9', color: moduloAtivo === 'menu' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
          >
            🏠 Início (Módulos)
          </button>
        )}

        {(usuarioLogado.role === 'admin' || usuarioLogado.role === 'recrutamento') && (
          <button 
            onClick={() => setModuloAtivo('recrutamento')}
            style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'recrutamento' ? '#0c5e31' : '#f1f5f9', color: moduloAtivo === 'recrutamento' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
          >
            🟢 Recrutamento & Seleção (R&S)
          </button>
        )}

        {(usuarioLogado.role === 'admin' || usuarioLogado.role === 'dp') && (
          <button 
            onClick={() => setModuloAtivo('dp')}
            style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'dp' ? '#003366' : '#f1f5f9', color: moduloAtivo === 'dp' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
          >
            🔵 Departamento Pessoal (Holerites Senior HCM)
          </button>
        )}

        {usuarioLogado.role === 'admin' && (
          <button 
            onClick={() => setModuloAtivo('usuarios')}
            style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'usuarios' ? '#475569' : '#f1f5f9', color: moduloAtivo === 'usuarios' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}
          >
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
          {/* Sub-abas de R&S */}
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

          {/* Modal Edição do RH */}
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

          {/* SUB-ABA 1: CANDIDATOS */}
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
                            <button onClick={() => iniciarEdicao(c)} style={{ padding: '6px 10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>✏️ Editar</button>
                            <button onClick={() => { const fone = extrairTelefone(c); if (fone) window.open(`https://wa.me/${fone}`, '_blank'); else alert('Sem telefone.'); }} style={{ padding: '6px 10px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>📱 WhatsApp</button>
                            <button onClick={() => handleAprovar(c)} style={{ padding: '6px 12px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>Aprovar ✓</button>
                            <button onClick={() => handleRejeitar(c)} style={{ padding: '6px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>Pendência ✕</button>
                            <button onClick={() => handleExcluirCandidato(c)} style={{ padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🗑️</button>
                          </div>
                        </div>

                        {/* Dados cadastrados em linha única */}
                        <div style={{ padding: '14px', background: '#f8faf9', borderRadius: '6px', fontSize: '13.5px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {Object.entries(dadosExtras).length > 0 ? (
                              Object.entries(dadosExtras).map(([k, v]) => (
                                <div key={k} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}><b>{k}:</b> {String(v)}</div>
                              ))
                            ) : (
                              <div><b>Cargo:</b> {c.job_title} | <b>Depto:</b> {c.department}</div>
                            )}
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

          {/* SUB-ABA 2: CONVITES WHATSAPP */}
          {abaRS === 'convites' && (
            <div>
              <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <strong style={{ color: '#0c5e31', fontSize: '15px', display: 'block', marginBottom: '6px' }}>💬 Mensagem Padrão do WhatsApp</strong>
                <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                  Use <code>{'{NOME}'}</code> onde deseja que apareça o primeiro nome do candidato:
                </span>
                <textarea rows={3} value={mensagemModelo} onChange={e => setMensagemModelo(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ marginTop: 0, color: '#0c5e31', fontSize: '16px' }}>+ Convidar Candidato Avulso</h3>
                  <form onSubmit={handleAdicionarConviteIndividual} style={{ display: 'grid', gap: '10px' }}>
                    <input placeholder="Nome do Candidato" value={conviteNome} onChange={e => setConviteNome(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <input placeholder="WhatsApp com DDD (Ex: 43999998888)" value={conviteTelefone} onChange={e => setConviteTelefone(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <input placeholder="Cargo Pretendido (Opcional)" value={conviteCargo} onChange={e => setConviteCargo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ padding: '10px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Adicionar à Fila</button>
                  </form>
                </div>

                <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ marginTop: 0, color: '#003366', fontSize: '16px' }}>📋 Importar Lista em Lote</h3>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 8px 0' }}>
                    Cole os candidatos (um por linha): <b>Nome, Telefone</b> ou <b>Nome, Telefone, Cargo</b>
                  </p>
                  <form onSubmit={handleImportarLote} style={{ display: 'grid', gap: '10px' }}>
                    <textarea rows={4} placeholder="Exemplo:&#10;João da Silva, 43999991111, Operador&#10;Maria Santos, 43988882222, RH" value={listaLote} onChange={e => setListaLote(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                    <button type="submit" style={{ padding: '10px', background: '#003366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Importar Lista</button>
                  </form>
                </div>
              </div>

              <h3 style={{ color: '#0c5e31', margin: '0 0 12px 0' }}>Fila de Convites ({invites.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {invites.length === 0 ? (
                  <p style={{ color: '#64748b' }}>Nenhum convite na fila.</p>
                ) : (
                  invites.map(inv => {
                    const enviado = inv.status === 'Enviado';
                    return (
                      <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '15px' }}>{inv.candidate_name}</strong>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', background: enviado ? '#e8f5e9' : '#fef3c7', color: enviado ? '#0c5e31' : '#b45309' }}>
                              {inv.status}
                            </span>
                          </div>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>
                            WhatsApp: {inv.phone} {inv.job_title ? `| Cargo: ${inv.job_title}` : ''}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => dispararWhatsAppConvite(inv)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                          >
                            <span style={{ fontSize: '16px' }}>📱</span>
                            {enviado ? 'Reenviar WhatsApp' : 'Enviar WhatsApp'}
                          </button>
                          <button
                            onClick={() => handleExcluirConvite(inv.id)}
                            style={{ padding: '8px 10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SUB-ABA 3: CAMPOS PESSOAIS */}
          {abaRS === 'campos' && (
            <div>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, color: '#0c5e31' }}>+ Cadastrar Novo Campo com Validação</h3>
                <p style={{ color: '#64748b', fontSize: '13px' }}>Defina a pergunta e a regra de formatação/validação que o formulário executará automaticamente.</p>

                <form onSubmit={handleAdicionarCampo} style={{ display: 'grid', gap: '12px', maxWidth: '650px' }}>
                  <input 
                    placeholder="Título do Campo (Ex: Nome da Mãe, CPF, WhatsApp, Estado Civil)"
                    value={novoCampoLabel}
                    onChange={e => setNovoCampoLabel(e.target.value)}
                    required
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>Tipo de Entrada</label>
                      <select 
                        value={novoCampoTipo} 
                        onChange={e => setNovoCampoTipo(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                      >
                        <option value="text">Texto Simples</option>
                        <option value="date">Data</option>
                        <option value="tel">Telefone</option>
                        <option value="email">E-mail</option>
                        <option value="number">Número</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>Regra de Validação & Máscara</label>
                      <select 
                        value={novoCampoValidacao} 
                        onChange={e => setNovoCampoValidacao(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold', color: '#0c5e31' }}
                      >
                        <option value="none">Nenhuma (Livre)</option>
                        <option value="fullname">Nome Completo (Nome + Sobrenome e Caixa Alta)</option>
                        <option value="cpf">CPF (Máscara + Validador Oficial)</option>
                        <option value="phone">WhatsApp / Celular (Máscara 9 Dígitos)</option>
                      </select>
                    </div>
                  </div>

                  <input 
                    placeholder="Exemplo visual no campo (Placeholder)"
                    value={novoCampoPlaceholder}
                    onChange={e => setNovoCampoPlaceholder(e.target.value)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={novoCampoObrigatorio}
                      onChange={e => setNovoCampoObrigatorio(e.target.checked)}
                    />
                    Preenchimento obrigatório para o candidato
                  </label>

                  <button 
                    type="submit"
                    style={{ padding: '10px 18px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: 'fit-content' }}
                  >
                    Adicionar Campo ao Formulário
                  </button>
                </form>
              </div>

              <h3 style={{ color: '#0c5e31' }}>Campos Ativos no Formulário (Ordem de Exibição)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {requiredFields.map((campo, index) => (
                  <div key={campo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: '#0c5e31', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                        {index + 1}
                      </span>
                      <div>
                        <strong style={{ fontSize: '15px' }}>{campo.label}</strong>
                        <span style={{ marginLeft: '8px', background: '#e2e8f0', color: '#475569', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>
                          Tipo: {campo.field_type}
                        </span>
                        {campo.validation_rule && campo.validation_rule !== 'none' && (
                          <span style={{ marginLeft: '6px', background: '#e8f5e9', color: '#0c5e31', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Validação: {campo.validation_rule === 'fullname' ? 'Nome Completo' : campo.validation_rule === 'cpf' ? 'CPF Válido' : 'Celular 9 Dígitos'}
                          </span>
                        )}
                        {campo.is_required && (
                          <span style={{ marginLeft: '6px', background: '#fef2f2', color: '#b91c1c', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Obrigatório
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button 
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoverCampo(index, 'cima')}
                        style={{ padding: '6px 10px', background: index === 0 ? '#e2e8f0' : '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: index === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        title="Mover para cima"
                      >
                        ▲
                      </button>
                      <button 
                        type="button"
                        disabled={index === requiredFields.length - 1}
                        onClick={() => handleMoverCampo(index, 'baixo')}
                        style={{ padding: '6px 10px', background: index === requiredFields.length - 1 ? '#e2e8f0' : '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: index === requiredFields.length - 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        title="Mover para baixo"
                      >
                        ▼
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDesativarCampo(campo.id)}
                        style={{ padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginLeft: '6px' }}
                      >
                        Desativar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-ABA 4: DOCUMENTOS EXIGIDOS */}
          {abaRS === 'documentos' && (
            <div>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, color: '#0c5e31' }}>+ Cadastrar Novo Documento Exigido</h3>
                <p style={{ color: '#64748b', fontSize: '13px' }}>Ao cadastrar um documento aqui, o campo de anexo aparecerá para os candidatos.</p>

                <form onSubmit={handleAdicionarDoc} style={{ display: 'grid', gap: '12px', maxWidth: '600px' }}>
                  <input 
                    placeholder="Nome do Documento (Ex: Título de Eleitor, Certidão de Casamento)"
                    value={novoDocTitulo}
                    onChange={e => setNovoDocTitulo(e.target.value)}
                    required
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <input 
                    placeholder="Instruções para o candidato (Ex: Frente e verso nítidos)"
                    value={novoDocDesc}
                    onChange={e => setNovoDocDesc(e.target.value)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={novoDocObrigatorio}
                      onChange={e => setNovoDocObrigatorio(e.target.checked)}
                    />
                    Envio obrigatório para o candidato
                  </label>
                  <button 
                    type="submit"
                    style={{ padding: '10px 18px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: 'fit-content' }}
                  >
                    Salvar Exigência
                  </button>
                </form>
              </div>

              <h3 style={{ color: '#0c5e31' }}>Documentos Atualmente Exigidos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {requiredDocs.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{doc.title}</strong>
                      {doc.is_required && (
                        <span style={{ marginLeft: '8px', background: '#fef2f2', color: '#b91c1c', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          Obrigatório
                        </span>
                      )}
                      {doc.description && <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>{doc.description}</p>}
                    </div>
                    <button 
                      onClick={() => handleDesativarDoc(doc.id)}
                      style={{ padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      Desativar
                    </button>
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
          <div style={{ background: '#fff', padding: '22px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #003366', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#003366', fontSize: '20px' }}>📑 Importador & Disparador de Holerites (Senior HCM)</h2>
                <small style={{ color: '#64748b' }}>Fatiamento de PDF consolidado e envio individual aos colaboradores por WhatsApp</small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>Competência Ativa:</label>
                <select 
                  value={competenciaSelecionada} 
                  onChange={e => setCompetenciaSelecionada(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold', color: '#003366' }}
                >
                  <option value="10/2026">10/2026 - Folha Mensal</option>
                  <option value="09/2026">09/2026 - Folha Mensal</option>
                  <option value="13_1_2026">2026 - 1ª Parcela 13º Salário</option>
                  <option value="13_2_2026">2026 - 2ª Parcela 13º Salário</option>
                </select>
              </div>
            </div>

            {/* Painel de Upload e Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              
              {/* Formulário de Processamento */}
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px dashed #003366' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#003366', fontSize: '16px' }}>1. Carregar Relatório de Folha (Senior HCM)</h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: 0 }}>
                  Selecione o arquivo PDF contendo os holerites de todos os colaboradores gerado pelo Senior:
                </p>

                <form onSubmit={handleUploadSeniorHCM} style={{ display: 'grid', gap: '10px' }}>
                  <input 
                    id="input-folha-senior"
                    type="file" 
                    accept=".pdf"
                    onChange={e => setArquivoSenior(e.target.files[0])}
                    style={{ padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} 
                  />
                  <button 
                    type="submit" 
                    disabled={processandoPdf}
                    style={{ padding: '11px', background: processandoPdf ? '#64748b' : '#003366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: processandoPdf ? 'not-allowed' : 'pointer', fontSize: '13.5px' }}
                  >
                    {processandoPdf ? 'Fatiando Páginas e Salvando...' : '⚡ Fatiar e Importar Holerites'}
                  </button>
                </form>

                {statusProcessamento && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: '5px', fontSize: '12px', fontWeight: '500' }}>
                    ℹ️ {statusProcessamento}
                  </div>
                )}
              </div>

              {/* Indicadores de Envio */}
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#0c5e31', fontSize: '16px' }}>2. Painel de Envios da Competência</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
                    <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c5e31', display: 'block' }}>{totalEnviados}</span>
                      <small style={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}>Enviados com Sucesso</small>
                    </div>
                    <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#b45309', display: 'block' }}>{totalPendentes}</span>
                      <small style={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}>Pendentes de Disparo</small>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '14px', fontSize: '12.5px', color: '#64748b' }}>
                  Total fatiado nesta competência: <b>{holeritesFiltrados.length} colaboradores</b>
                </div>
              </div>
            </div>

            {/* Listagem dos Holerites Fatiados */}
            <h3 style={{ color: '#003366', margin: '24px 0 12px 0' }}>Holerites Prontos para Envio ({holeritesFiltrados.length})</h3>

            {holeritesFiltrados.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13.5px', background: '#f8fafc', padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                Nenhum holerite importado ainda para a competência {competenciaSelecionada}. Carregue o PDF do Senior acima.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {holeritesFiltrados.map((item, idx) => (
                  <div 
                    key={item.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 18px', 
                      background: '#fff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '8px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#003366', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                          {idx + 1}
                        </span>
                        <strong style={{ fontSize: '15px', color: '#0f172a' }}>{item.employee_name}</strong>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: item.status === 'Enviado' ? '#e8f5e9' : '#fef3c7', color: item.status === 'Enviado' ? '#0c5e31' : '#b45309', fontWeight: 'bold' }}>
                          {item.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', marginLeft: '30px' }}>
                        CPF: <b>{item.cpf}</b> {item.registration_number ? `| Matrícula: ${item.registration_number}` : ''} | Competência: {item.competence}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <a 
                        href={item.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ padding: '6px 12px', background: '#f1f5f9', color: '#003366', border: '1px solid #cbd5e1', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12.5px' }}
                      >
                        📄 Ver PDF
                      </a>

                      <button
                        onClick={() => handleDispararHoleriteWhatsApp(item)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}
                      >
                        📱 Enviar WhatsApp
                      </button>

                      <button
                        onClick={() => handleExcluirHolerite(item.id)}
                        style={{ padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        title="Excluir este holerite"
                      >
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
        <div>
          <div style={{ background: '#fff', padding: '22px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: '#334155' }}>+ Cadastrar Novo Operador do Sistema</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0 }}>
              Crie contas com permissões isoladas para cada equipe (Recrutamento ou DP):
            </p>

            <form onSubmit={handleCriarUsuario} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '4px' }}>Nome Completo</label>
                <input 
                  placeholder="Ex: Ana Paula Silva" 
                  value={novoUserNome} 
                  onChange={e => setNovoUserNome(e.target.value)} 
                  required 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '4px' }}>E-mail de Acesso</label>
                <input 
                  type="email" 
                  placeholder="ana.silva@usiban.com.br" 
                  value={novoUserEmail} 
                  onChange={e => setNovoUserEmail(e.target.value)} 
                  required 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '4px' }}>Senha Temporária</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={novoUserSenha} 
                  onChange={e => setNovoUserSenha(e.target.value)} 
                  required 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '4px' }}>Perfil / Permissão</label>
                <select 
                  value={novoUserRole} 
                  onChange={e => setNovoUserRole(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13.5px', fontWeight: 'bold' }}
                >
                  <option value="recrutamento">🟢 Operador R&S (Apenas Admissões)</option>
                  <option value="dp">🔵 Operador DP (Apenas Holerites)</option>
                  <option value="admin">⚙️ Administrador Geral (Acesso Total)</option>
                </select>
              </div>

              <button type="submit" style={{ padding: '10px 16px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '40px' }}>
                Cadastrar Usuário
              </button>
            </form>
          </div>

          <h3 style={{ color: '#0c5e31', marginBottom: '12px' }}>Usuários Cadastrados ({systemUsers.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {systemUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong style={{ fontSize: '15px' }}>{u.name}</strong>
                  <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>({u.email})</span>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: u.role === 'admin' ? '#e8f5e9' : u.role === 'recrutamento' ? '#ecfdf5' : '#e0f2fe', color: u.role === 'admin' ? '#0c5e31' : u.role === 'recrutamento' ? '#047857' : '#0369a1', fontWeight: 'bold' }}>
                      {u.role === 'admin' ? '⚙️ Administrador Geral' : u.role === 'recrutamento' ? '🟢 Apenas R&S' : '🔵 Apenas DP'}
                    </span>
                    <span style={{ fontSize: '11px', marginLeft: '8px', color: u.is_active ? '#0c5e31' : '#b91c1c', fontWeight: 'bold' }}>
                      {u.is_active ? '● Ativo' : '○ Inativo'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleAlternarStatusUsuario(u.id, u.is_active)}
                    style={{ padding: '6px 12px', background: u.is_active ? '#fef3c7' : '#e8f5e9', color: u.is_active ? '#b45309' : '#0c5e31', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    {u.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  {u.email !== 'admin@usiban.com.br' && (
                    <button 
                      onClick={() => handleExcluirUsuario(u)}
                      style={{ padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      Excluir
                    </button>
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
