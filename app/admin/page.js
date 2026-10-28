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

  // DP e Competências
  const [competencias, setCompetencias] = useState([]);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState('');
  const [payrolls, setPayrolls] = useState([]);
  const [arquivoSenior, setArquivoSenior] = useState(null);
  const [processandoPdf, setProcessandoPdf] = useState(false);
  const [statusProcessamento, setStatusProcessamento] = useState('');

  // Modal Gerenciar Competências
  const [modalCompAberto, setModalCompAberto] = useState(false);
  const [compEditando, setCompEditando] = useState(null);
  const [novaCompTitulo, setNovaCompTitulo] = useState('');
  const [novaCompCodigo, setNovaCompCodigo] = useState('');
  const [novaCompAno, setNovaCompAno] = useState(new Date().getFullYear());

  // Fila de Disparo em Massa
  const [disparandoEmFila, setDisparandoEmFila] = useState(false);
  const [filaRestante, setFilaRestante] = useState(0);

  // Usuários e R&S
  const [novoUserNome, setNovoUserNome] = useState('');
  const [novoUserEmail, setNovoUserEmail] = useState('');
  const [novoUserSenha, setNovoUserSenha] = useState('');
  const [novoUserRole, setNovoUserRole] = useState('recrutamento');
  const [candidatoEditando, setCandidatoEditando] = useState(null);
  const [dadosEdicao, setDadosEdicao] = useState({});
  const [novoDocTitulo, setNovoDocTitulo] = useState('');
  const [novoDocDesc, setNovoDocDesc] = useState('');
  const [novoDocObrigatorio, setNovoDocObrigatorio] = useState(true);
  const [novoCampoLabel, setNovoCampoLabel] = useState('');
  const [novoCampoTipo, setNovoCampoTipo] = useState('text');
  const [novoCampoPlaceholder, setNovoCampoPlaceholder] = useState('');
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(true);
  const [novoCampoValidacao, setNovoCampoValidacao] = useState('none');
  const [conviteNome, setConviteNome] = useState('');
  const [conviteTelefone, setConviteTelefone] = useState('');
  const [conviteCargo, setConviteCargo] = useState('');
  const [listaLote, setListaLote] = useState('');
  const [mensagemModelo, setMensagemModelo] = useState(
    `Olá {NOME}, parabéns! Você avançou no processo seletivo da Usina Bandeirante (USIBAN). O seu próximo passo é preencher os seus dados e anexar os documentos admissionais pelo link oficial: ${LINK_OFICIAL_PORTAL}`
  );

  async function carregarDados() {
    // 1. Candidatos
    const { data: candData } = await supabase.from('onboarding_candidates').select('*').order('created_at', { ascending: false });
    if (candData) setCandidates(candData);

    // 2. Documentos
    const { data: docsData } = await supabase.from('candidate_documents').select('*');
    if (docsData) {
      const agrupados = {};
      docsData.forEach(d => {
        if (!agrupados[d.candidate_id]) agrupados[d.candidate_id] = [];
        agrupados[d.candidate_id].push(d);
      });
      setCandidateDocs(agrupados);
    }

    // 3. Documentos Exigidos & Campos
    const { data: reqDocs } = await supabase.from('required_documents').select('*').eq('is_active', true).order('created_at', { ascending: true });
    if (reqDocs) setRequiredDocs(reqDocs);

    const { data: reqFields } = await supabase.from('required_personal_fields').select('*').eq('is_active', true).order('display_order', { ascending: true });
    if (reqFields) setRequiredFields(reqFields);

    // 4. Convites & Usuários
    const { data: invData } = await supabase.from('admission_invites').select('*').order('created_at', { ascending: false });
    if (invData) setInvites(invData);

    const { data: usersData } = await supabase.from('system_users').select('*').order('created_at', { ascending: false });
    if (usersData) setSystemUsers(usersData);

    // 5. Competências do DP
    const { data: compData } = await supabase.from('payroll_competences').select('*').order('created_at', { ascending: false });
    if (compData && compData.length > 0) {
      setCompetencias(compData);
      if (!competenciaSelecionada) setCompetenciaSelecionada(compData[0].code);
    }

    // 6. Holerites
    const { data: payrollsData } = await supabase.from('employee_payrolls').select('*').order('created_at', { ascending: false });
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

  // --- GESTÃO DE COMPETÊNCIAS ---
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
    if (!confirm('Deseja excluir esta competência? Os holerites já associados a ela permanecerão no banco.')) return;
    await supabase.from('payroll_competences').delete().eq('id', id);
    carregarDados();
  }

  // --- FAIXA DO SENIOR: FATIAMENTO COM VALIDAÇÃO ---
  async function handleUploadSeniorHCM(e) {
    e.preventDefault();
    if (!arquivoSenior) {
      alert('Selecione o arquivo PDF consolidado exportado pelo Senior HCM.');
      return;
    }
    if (!competenciaSelecionada) {
      alert('Selecione a competência antes de importar.');
      return;
    }

    setProcessandoPdf(true);
    setStatusProcessamento('Validando competência e separando páginas...');

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
      } else {
        setStatusProcessamento(`⚠️ Atenção: ${resultado.error}`);
        alert(resultado.error);
      }
    } catch (err) {
      setStatusProcessamento('Falha na comunicação com a API de fatiamento.');
      alert('Falha na requisição: ' + err.message);
    }

    setProcessandoPdf(false);
  }

  // --- EXCLUSÃO EM MASSA DE HOLERITES DA COMPETÊNCIA ---
  async function handleLimparTodosHolerites() {
    const confirmacao = prompt(`⚠️ ATENÇÃO: Deseja apagar TODOS os holerites importados da competência "${competenciaSelecionada}"?\n\nDigite EXCLUIR para confirmar:`);
    if (confirmacao !== 'EXCLUIR') return;

    await supabase.from('employee_payrolls').delete().eq('competence', competenciaSelecionada);
    alert('Todos os holerites da competência foram excluídos.');
    carregarDados();
  }

  // --- DISPARO DE WHATSAPP (INDIVIDUAL E EM MASSA) ---
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

    const primeiroNome = (holerite.employee_name || 'Colaborador').split(' ')[0];
    const mensagem = `Olá ${primeiroNome}, o seu Demonstrativo de Pagamento referente à competência *${holerite.competence}* da Usina Bandeirante (USIBAN) já está disponível.\n\n📄 *Acesse o documento oficial no link abaixo:*\n${holerite.file_url}\n\nEm caso de dúvidas sobre a folha, contate o Departamento Pessoal.`;

    await supabase.from('employee_payrolls').update({ status: 'Enviado', channel: 'WhatsApp' }).eq('id', holerite.id);
    carregarDados();
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  // Envio Sequencial da Fila
  async function handleIniciarDisparoEmFila() {
    const pendentes = payrolls.filter(p => p.competence === competenciaSelecionada && p.status !== 'Enviado');
    if (pendentes.length === 0) {
      alert('Não existem holerites pendentes de envio nesta competência.');
      return;
    }

    if (!confirm(`Deseja iniciar o envio sequencial para ${pendentes.length} colaboradores pendentes? O sistema abrirá o WhatsApp do próximo a cada confirmação.`)) return;

    for (const item of pendentes) {
      await handleDispararHoleriteWhatsApp(item);
      const continuar = confirm(`Envio aberto para ${item.employee_name}. Deseja prosseguir para o próximo?`);
      if (!continuar) break;
    }
  }

  // --- R&S: CONTATO, APROVAÇÃO, PENDÊNCIA E EXCLUSÃO ---
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

    await supabase
      .from('onboarding_candidates')
      .update({ status: 'Aprovado', feedback_reason: `Exame: ${dataExame || 'A definir'} | Integração: ${dataIntegracao || 'A definir'}` })
      .eq('id', candidato.id);

    carregarDados();
    const fone = extrairTelefone(candidato);
    const primeiroNome = (candidato.full_name || 'Candidato').trim().split(' ')[0];
    const texto = `Olá ${primeiroNome}, parabéns! Seus documentos e cadastro foram validados e aprovados com sucesso pelo RH da Usina Bandeirante (USIBAN).\n\nSeguem as orientações:\n🩺 *Exame Médico:* ${dataExame || 'A agendar'}\n🤝 *Integração:* ${dataIntegracao || 'A agendar'}\n\nSeja bem-vindo(a) à equipe Usiban!`;
    if (fone && fone.length >= 10) window.open(`https://wa.me/${fone}?text=${encodeURIComponent(texto)}`, '_blank');
  }

  async function handleRejeitar(candidato) {
    const motivo = prompt('Informe o motivo da pendência:');
    if (!motivo) return;

    await supabase.from('onboarding_candidates').update({ status: 'Rejeitado / Pendência', feedback_reason: motivo }).eq('id', candidato.id);
    carregarDados();
    const fone = extrairTelefone(candidato);
    const primeiroNome = (candidato.full_name || 'Candidato').trim().split(' ')[0];
    const texto = `Olá ${primeiroNome}, aqui é do setor de Recursos Humanos da Usina Bandeirante (USIBAN).\n\nIdentificamos uma pendência na sua documentação:\n⚠️ *Motivo:* ${motivo}\n\nPor favor, acesse o link para corrigir:\n👉 ${LINK_OFICIAL_PORTAL}`;
    if (fone && fone.length >= 10) window.open(`https://wa.me/${fone}?text=${encodeURIComponent(texto)}`, '_blank');
  }

  async function handleExcluirCandidato(candidato) {
    const confirmacao = prompt(`⚠️ ATENÇÃO: Deseja excluir permanentemente o candidato "${candidato.full_name}"?\nDigite EXCLUIR para confirmar:`);
    if (confirmacao !== 'EXCLUIR') return;
    await supabase.from('candidate_documents').delete().eq('candidate_id', candidato.id);
    await supabase.from('onboarding_candidates').delete().eq('id', candidato.id);
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

  // Filtros de Competência por Ano
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

      {/* Navegação de Módulos */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {usuarioLogado.role === 'admin' && (
          <button onClick={() => setModuloAtivo('menu')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: moduloAtivo === 'menu' ? '#0c5e31' : '#f1f5f9', color: moduloAtivo === 'menu' ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            🏠 Início
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

      {/* --- MÓDULO DP: HOLERITES E SENIOR HCM --- */}
      {moduloAtivo === 'dp' && (
        <div>
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
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Código (Exato no PDF)</label>
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
            
            {/* Topo DP com Filtro de Ano e Seleção de Competência */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #003366', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#003366', fontSize: '20px' }}>📑 Importador & Disparador de Holerites (Senior HCM)</h2>
                <small style={{ color: '#64748b' }}>Fatiamento por CPF, checagem de competência e prevenção de envios duplicados</small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Filtro por Ano */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginRight: '4px' }}>Ano:</label>
                  <select value={anoFiltro} onChange={e => setAnoFiltro(Number(e.target.value))} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                    {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                  </select>
                </div>

                {/* Seletor da Competência Ativa */}
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

                {/* Botão para Gerenciar Competências */}
                <button onClick={() => setModalCompAberto(true)} style={{ padding: '7px 10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold', color: '#334155' }}>
                  ⚙️ Gerenciar
                </button>
              </div>
            </div>

            {/* Upload e Painel de Envios */}
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
                  <button 
                    type="submit" 
                    disabled={processandoPdf}
                    style={{ padding: '11px', background: processandoPdf ? '#64748b' : '#003366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: processandoPdf ? 'not-allowed' : 'pointer', fontSize: '13.5px' }}
                  >
                    {processandoPdf ? 'Validando e Fatiando Páginas...' : '⚡ Fatiar e Importar Folha'}
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
                  {/* Botão de Disparo em Fila */}
                  <button 
                    onClick={handleIniciarDisparoEmFila}
                    style={{ flex: 1, padding: '10px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                  >
                    🚀 Disparar Todos os Pendentes ({totalPendentes})
                  </button>

                  {/* Botão de Excluir em Lote */}
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

            {/* Listagem dos Holerites */}
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

      {/* --- MÓDULO R&S --- */}
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

          {/* Candidatos R&S com Mensagem de Apresentação Preservada */}
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
                            {/* Botão de WhatsApp com a mensagem oficial restaurada */}
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

          {/* Convites WhatsApp */}
          {abaRS === 'convites' && (
            <div>
              <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <strong style={{ color: '#0c5e31', fontSize: '15px', display: 'block', marginBottom: '6px' }}>💬 Mensagem Padrão do WhatsApp</strong>
                <textarea rows={3} value={mensagemModelo} onChange={e => setMensagemModelo(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ marginTop: 0, color: '#0c5e31', fontSize: '16px' }}>+ Convidar Candidato Avulso</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!conviteNome || !conviteTelefone) return;
                    await supabase.from('admission_invites').insert([{ candidate_name: conviteNome.trim(), phone: conviteTelefone.replace(/\D/g, ''), job_title: conviteCargo.trim(), status: 'Pendente' }]);
                    setConviteNome(''); setConviteTelefone(''); setConviteCargo(''); carregarDados();
                  }} style={{ display: 'grid', gap: '10px' }}>
                    <input placeholder="Nome do Candidato" value={conviteNome} onChange={e => setConviteNome(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <input placeholder="WhatsApp com DDD" value={conviteTelefone} onChange={e => setConviteTelefone(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <input placeholder="Cargo Pretendido" value={conviteCargo} onChange={e => setConviteCargo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ padding: '10px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Adicionar à Fila</button>
                  </form>
                </div>

                <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ marginTop: 0, color: '#003366', fontSize: '16px' }}>📋 Importar Lista em Lote</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const linhas = listaLote.split('\n');
                    const novos = [];
                    linhas.forEach(linha => {
                      const partes = linha.split(/[,;\t]/);
                      if (partes.length >= 2) {
                        const n = partes[0].trim();
                        const t = partes[1].replace(/\D/g, '');
                        const c = partes[2] ? partes[2].trim() : '';
                        if (n && t.length >= 10) novos.push({ candidate_name: n, phone: t, job_title: c, status: 'Pendente' });
                      }
                    });
                    if (novos.length > 0) {
                      await supabase.from('admission_invites').insert(novos);
                      setListaLote(''); carregarDados(); alert(`${novos.length} adicionados!`);
                    }
                  }} style={{ display: 'grid', gap: '10px' }}>
                    <textarea rows={4} placeholder="Nome, Telefone, Cargo (um por linha)" value={listaLote} onChange={e => setListaLote(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ padding: '10px', background: '#003366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Importar Lista</button>
                  </form>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invites.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <div><b>{inv.candidate_name}</b> - {inv.phone} ({inv.status})</div>
                    <button onClick={async () => {
                      let fone = inv.phone.replace(/\D/g, '');
                      if (!fone.startsWith('55')) fone = '55' + fone;
                      const msg = mensagemModelo.replace('{NOME}', inv.candidate_name.split(' ')[0]);
                      await supabase.from('admission_invites').update({ status: 'Enviado' }).eq('id', inv.id);
                      carregarDados();
                      window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
                    }} style={{ padding: '6px 12px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      📱 Enviar WhatsApp
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campos e Documentos */}
          {abaRS === 'campos' && (
            <div>
              <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#0c5e31' }}>+ Cadastrar Novo Campo</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!novoCampoLabel) return;
                  await supabase.from('required_personal_fields').insert([{ label: novoCampoLabel, field_type: novoCampoTipo, placeholder: novoCampoPlaceholder, is_required: novoCampoObrigatorio, validation_rule: novoCampoValidacao, display_order: requiredFields.length + 1, is_active: true }]);
                  setNovoCampoLabel(''); carregarDados();
                }} style={{ display: 'grid', gap: '10px', maxWidth: '500px' }}>
                  <input placeholder="Pergunta / Rótulo do Campo" value={novoCampoLabel} onChange={e => setNovoCampoLabel(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
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
                    <button onClick={async () => { await supabase.from('required_personal_fields').update({ is_active: false }).eq('id', f.id); carregarDados(); }} style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Desativar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaRS === 'documentos' && (
            <div>
              <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#0c5e31' }}>+ Cadastrar Novo Documento</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!novoDocTitulo) return;
                  await supabase.from('required_documents').insert([{ title: novoDocTitulo, description: novoDocDesc, is_required: novoDocObrigatorio, is_active: true }]);
                  setNovoDocTitulo(''); setNovoDocDesc(''); carregarDados();
                }} style={{ display: 'grid', gap: '10px', maxWidth: '500px' }}>
                  <input placeholder="Título do Documento" value={novoDocTitulo} onChange={e => setNovoDocTitulo(e.target.value)} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <input placeholder="Instruções" value={novoDocDesc} onChange={e => setNovoDocDesc(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button type="submit" style={{ padding: '10px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Salvar Documento</button>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {requiredDocs.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <div><b>{d.title}</b> - {d.description}</div>
                    <button onClick={async () => { await supabase.from('required_documents').update({ is_active: false }).eq('id', d.id); carregarDados(); }} style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Desativar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MÓDULO USUÁRIOS (ADMIN) --- */}
      {moduloAtivo === 'usuarios' && usuarioLogado.role === 'admin' && (
        <div style={{ background: '#fff', padding: '22px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
          <h3 style={{ marginTop: 0, color: '#334155' }}>+ Cadastrar Novo Operador</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!novoUserNome || !novoUserEmail || !novoUserSenha) return;
            await supabase.from('system_users').insert([{ name: novoUserNome.trim(), email: novoUserEmail.trim().toLowerCase(), password: novoUserSenha, role: novoUserRole, is_active: true }]);
            setNovoUserNome(''); setNovoUserEmail(''); setNovoUserSenha(''); carregarDados(); alert('Usuário criado com sucesso!');
          }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
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
                {u.email !== 'admin@usiban.com.br' && (
                  <button onClick={async () => { if (confirm('Excluir usuário?')) { await supabase.from('system_users').delete().eq('id', u.id); carregarDados(); } }} style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Excluir</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
