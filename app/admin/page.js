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

  // --- MÓDULO DP: PROCESSAMENTO DO PDF DO SENIOR HCM ---
  async function handleUploadSeniorHCM(e) {
    e.preventDefault();
    if (!arquivoSenior) {
      alert('Por favor, selecione o arquivo PDF consolidado exportado pelo Senior HCM.');
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
        setStatusProcessamento(`Processamento concluído! ${resultado.processedCount} de ${resultado.totalPages} páginas separadas com sucesso.`);
        setArquivoSenior(null);
        // Reseta o input file
        const inputFile = document.getElementById('input-folha-senior');
        if (inputFile) inputFile.value = '';
        carregarDados();
      } else {
        setStatusProcessamento(`Erro ao processar: ${resultado.error}`);
        alert('Erro: ' + resultado.error);
      }
    } catch (err) {
      setStatusProcessamento('Falha na comunicação com a API de fatiamento.');
      alert('Falha na requisição: ' + err.message);
    }

    setProcessandoPdf(false);
  }

  // DISPARAR WHATSAPP DO HOLERITE
  async function handleDispararHoleriteWhatsApp(holerite) {
    // Tenta encontrar o número do colaborador pelo CPF nos cadastros
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

    if (!fone.startsWith('55') && fone.length <= 11) {
      fone = '55' + fone;
    }

    const primeiroNome = (holerite.employee_name || 'Colaborador').split(' ')[0];
    const mensagem = `Olá ${primeiroNome}, o seu Demonstrativo de Pagamento referente à competência *${holerite.competence}* da Usina Bandeirante (USIBAN) já está disponível.\n\n📄 *Acesse o seu documento oficial no link abaixo:*\n${holerite.file_url}\n\nEm caso de dúvidas sobre a folha, entre em contato com o Departamento Pessoal.`;

    // Atualiza status no banco
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

  // --- FUNÇÕES R&S ---
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
      
      {/* Topo */}
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

      {/* Navegação de Módulos */}
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

      {/* --- MÓDULO 1: RECRUTAMENTO & SELEÇÃO --- */}
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
                            <button onClick={() => { const fone = extrairTelefone(c); if (fone) window.open(`https://wa.me/${fone}`, '_blank'); else alert('Sem telefone.'); }} style={{ padding: '6px 10px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>📱 WhatsApp</button>
                            <button onClick={() => handleAprovar(c)} style={{ padding: '6px 12px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>Aprovar ✓</button>
                            <button onClick={() => handleRejeitar(c)} style={{ padding: '6px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}>Pendência ✕</button>
                            <button onClick={() => handleExcluirCandidato(c)} style={{ padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🗑️</button>
                          </div>
                        </div>

                        <div style={{ padding: '14px', background: '#f8faf9', borderRadius: '6px', fontSize: '13.5px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {Object.entries(dadosExtras).map(([k, v]) => (
                              <div key={k} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}><b>{k}:</b> {String(v)}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
            <h3 style={{ marginTop: 0, color: '#334155' }}>+ Cadastrar Operador</h3>
            <form onSubmit={handleCriarUsuario} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
              <input placeholder="Nome Completo" value={novoUserNome} onChange={e => setNovoUserNome(e.target.value)} required style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="email" placeholder="E-mail Corporativo" value={novoUserEmail} onChange={e => setNovoUserEmail(e.target.value)} required style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="password" placeholder="Senha" value={novoUserSenha} onChange={e => setNovoUserSenha(e.target.value)} required style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <select value={novoUserRole} onChange={e => setNovoUserRole(e.target.value)} style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold' }}>
                <option value="recrutamento">🟢 Operador R&S</option>
                <option value="dp">🔵 Operador DP</option>
                <option value="admin">⚙️ Administrador Geral</option>
              </select>
              <button type="submit" style={{ padding: '10px 16px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Cadastrar</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
