'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const SENHA_MESTRA_RH = 'rh2026';
const LINK_OFICIAL_PORTAL = 'https://sistema-onboarding-rh-4mj4.vercel.app/';

export default function AdminPage() {
  const [autenticado, setAutenticado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [candidateDocs, setCandidateDocs] = useState({});
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [requiredFields, setRequiredFields] = useState([]);
  const [invites, setInvites] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
  const [abaAtiva, setAbaAtiva] = useState('candidatos');

  // Documentos
  const [novoDocTitulo, setNovoDocTitulo] = useState('');
  const [novoDocDesc, setNovoDocDesc] = useState('');
  const [novoDocObrigatorio, setNovoDocObrigatorio] = useState(true);

  // Campos Pessoais
  const [novoCampoLabel, setNovoCampoLabel] = useState('');
  const [novoCampoTipo, setNovoCampoTipo] = useState('text');
  const [novoCampoPlaceholder, setNovoCampoPlaceholder] = useState('');
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(true);
  const [novoCampoValidacao, setNovoCampoValidacao] = useState('none');

  // Convites
  const [conviteNome, setConviteNome] = useState('');
  const [conviteTelefone, setConviteTelefone] = useState('');
  const [conviteCargo, setConviteCargo] = useState('');
  const [listaLote, setListaLote] = useState('');
  const [mensagemModelo, setMensagemModelo] = useState(
    `Olá {NOME}, parabéns! Você avançou no processo seletivo da Usina Bandeirante (USIBAN). O seu próximo passo é preencher os seus dados e anexar os documentos admissionais pelo link oficial: ${LINK_OFICIAL_PORTAL}`
  );

  async function carregarDados() {
    // 1. Candidatos
    const { data: candData, error: candError } = await supabase
      .from('onboarding_candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (candError) {
      console.error('Erro ao carregar candidatos:', candError);
    } else if (candData) {
      setCandidates(candData);
    }

    // 2. Documentos
    const { data: docsData } = await supabase
      .from('candidate_documents')
      .select('*');
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

    // 4. Campos Pessoais Exigidos
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
  }

  useEffect(() => {
    if (autenticado) {
      carregarDados();
    }
  }, [autenticado]);

  function handleLogin(e) {
    e.preventDefault();
    if (senhaInput === SENHA_MESTRA_RH) {
      setAutenticado(true);
    } else {
      alert('Senha incorreta!');
    }
  }

  async function handleAprovar(id) {
    const { error } = await supabase
      .from('onboarding_candidates')
      .update({ status: 'Aprovado', feedback_reason: null })
      .eq('id', id);
    if (!error) carregarDados();
  }

  async function handleRejeitar(id) {
    const motivo = prompt('Informe o motivo da pendência / recusa:');
    if (!motivo) return;
    const { error } = await supabase
      .from('onboarding_candidates')
      .update({ status: 'Rejeitado / Pendência', feedback_reason: motivo })
      .eq('id', id);
    if (!error) carregarDados();
  }

  // --- CONTATO DIRETO VIA WHATSAPP A PARTIR DO CARD ---
  function abrirWhatsAppCandidato(candidato) {
    // Tenta encontrar o telefone em c.phone ou dentro do custom_data
    let telefoneBruto = candidato.phone || '';
    if (!telefoneBruto && candidato.custom_data) {
      const chaves = Object.keys(candidato.custom_data);
      const chaveTel = chaves.find(k => {
        const lower = k.toLowerCase();
        return lower.includes('whatsapp') || lower.includes('telefone') || lower.includes('celular');
      });
      if (chaveTel) telefoneBruto = candidato.custom_data[chaveTel];
    }

    const numeros = (telefoneBruto || '').replace(/\D/g, '');
    if (!numeros || numeros.length < 10) {
      alert('Número de WhatsApp não encontrado ou formato inválido para este candidato.');
      return;
    }

    let fone = numeros;
    if (!fone.startsWith('55') && fone.length <= 11) {
      fone = '55' + fone;
    }

    const primeiroNome = (candidato.full_name || 'Candidato').trim().split(' ')[0];
    
    // Mensagem contextual baseada no status atual
    let texto = `Olá ${primeiroNome}, aqui é do setor de Recursos Humanos da Usina Bandeirante (USIBAN).`;
    if (candidato.status === 'Aprovado') {
      texto = `Olá ${primeiroNome}, parabéns! Seus documentos e cadastro foram validados e aprovados pelo RH da Usina Bandeirante (USIBAN). Em breve passaremos as orientações para o início das atividades.`;
    } else if (candidato.status?.includes('Rejeitado')) {
      const motivo = candidato.feedback_reason ? ` Motivo: ${candidato.feedback_reason}` : '';
      texto = `Olá ${primeiroNome}, estamos revisando seu cadastro na Usina Bandeirante (USIBAN) e identificamos uma pendência nos documentos enviados.${motivo} Por favor, acesse o portal para reenviar: ${LINK_OFICIAL_PORTAL}`;
    }

    const url = `https://wa.me/${fone}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  // --- EXPORTAÇÃO CSV PARA EXCEL (UTF-8 COM BOM E SEPARADOR ;) ---
  function handleExportarCSV() {
    const aprovados = candidates.filter(c => c.status === 'Aprovado');

    if (aprovados.length === 0) {
      alert('Nenhum candidato com status "Aprovado" encontrado para exportar.');
      return;
    }

    const colunasDinamicas = new Set();
    aprovados.forEach(c => {
      if (c.custom_data) {
        Object.keys(c.custom_data).forEach(col => colunasDinamicas.add(col));
      }
    });

    const listaColunas = Array.from(colunasDinamicas);
    const cabecalho = ['Nome Completo', 'Status', 'Data de Envio', ...listaColunas];

    const linhas = aprovados.map(c => {
      const dataCriacao = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '';
      const linhaBase = [
        `"${(c.full_name || '').replace(/"/g, '""')}"`,
        `"${(c.status || '').replace(/"/g, '""')}"`,
        `"${dataCriacao}"`
      ];

      const valoresDinamicos = listaColunas.map(col => {
        const val = c.custom_data?.[col] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });

      return [...linhaBase, ...valoresDinamicos].join(';');
    });

    const conteudoCSV = '\uFEFF' + [cabecalho.map(c => `"${c}"`).join(';'), ...linhas].join('\r\n');
    const blob = new Blob([conteudoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admissoes_aprovadas_usiban_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- REORDENAÇÃO DOS CAMPOS ---
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

  // --- CONVITES WHATSAPP ---
  async function handleAdicionarConviteIndividual(e) {
    e.preventDefault();
    if (!conviteNome || !conviteTelefone) return;

    const telefoneLimpo = conviteTelefone.replace(/\D/g, '');
    const { error } = await supabase.from('admission_invites').insert([
      {
        candidate_name: conviteNome.trim(),
        phone: telefoneLimpo,
        job_title: conviteCargo.trim(),
        status: 'Pendente'
      }
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
          novosConvites.push({
            candidate_name: nome,
            phone: telefone,
            job_title: cargo,
            status: 'Pendente'
          });
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
    } else {
      alert('Erro: ' + error.message);
    }
  }

  async function dispararWhatsApp(convite) {
    const primeiroNome = convite.candidate_name.split(' ')[0];
    const mensagem = mensagemModelo.replace('{NOME}', primeiroNome);
    
    let fone = convite.phone.replace(/\D/g, '');
    if (!fone.startsWith('55') && fone.length <= 11) {
      fone = '55' + fone;
    }

    const url = `https://wa.me/${fone}?text=${encodeURIComponent(mensagem)}`;
    
    await supabase
      .from('admission_invites')
      .update({ status: 'Enviado' })
      .eq('id', convite.id);

    carregarDados();
    window.open(url, '_blank');
  }

  async function handleExcluirConvite(id) {
    if (!confirm('Deseja remover este convite?')) return;
    await supabase.from('admission_invites').delete().eq('id', id);
    carregarDados();
  }

  // --- CAMPOS E DOCUMENTOS ---
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

  function getStatusBadge(status) {
    if (status === 'Aprovado') return { bg: '#e8f5e9', color: '#0c5e31', label: 'Aprovado' };
    if (status?.includes('Rejeitado')) return { bg: '#fee2e2', color: '#b91c1c', label: status };
    return { bg: '#fef3c7', color: '#b45309', label: 'Pendente' };
  }

  const candidatosFiltrados = candidates.filter(c => {
    if (filtro === 'Todos') return true;
    if (filtro === 'Pendentes') return c.status === 'Pendente';
    if (filtro === 'Aprovados') return c.status === 'Aprovado';
    if (filtro === 'Com Pendência') return c.status?.includes('Rejeitado');
    return true;
  });

  if (!autenticado) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#f4f6f5' }}>
        <form onSubmit={handleLogin} style={{ background: '#fff', padding: '32px 28px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', width: '320px', borderTop: '5px solid #0c5e31', border: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <img 
              src="/logo-usiban.png" 
              alt="USIBAN" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              style={{ width: '85px', height: 'auto', marginBottom: '10px' }} 
            />
            <h2 style={{ margin: 0, color: '#0c5e31', fontSize: '20px', fontWeight: 'bold' }}>Gestão de RH</h2>
            <small style={{ color: '#64748b' }}>Usiban</small>
          </div>
          <input 
            type="password" 
            placeholder="Senha de acesso" 
            value={senhaInput} 
            onChange={e => setSenhaInput(e.target.value)} 
            required 
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px', fontSize: '14px' }} 
          />
          <button type="submit" style={{ width: '100%', padding: '11px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
            Entrar no Painel
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ padding: '24px 16px', fontFamily: 'system-ui, sans-serif', maxWidth: '1050px', margin: '0 auto', color: '#1e293b' }}>
      
      {/* Topo Institucional */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img 
            src="/logo-usiban.png" 
            alt="USIBAN" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            style={{ width: '55px', height: 'auto' }} 
          />
          <div>
            <h1 style={{ margin: 0, color: '#0c5e31', fontSize: '22px', fontWeight: 'bold' }}>Painel de Admissões RH</h1>
            <small style={{ color: '#64748b' }}>Açúcar e Álcool Bandeirantes S.A. • USIBAN</small>
          </div>
        </div>
        <button onClick={() => setAutenticado(false)} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          Sair
        </button>
      </div>

      {/* Abas de Navegação */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setAbaAtiva('candidatos')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: abaAtiva === 'candidatos' ? '3px solid #0c5e31' : 'none',
            background: abaAtiva === 'candidatos' ? '#e8f5e9' : '#f1f5f9',
            color: abaAtiva === 'candidatos' ? '#0c5e31' : '#475569',
            fontWeight: 'bold',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer'
          }}
        >
          👥 Candidatos & Validação
        </button>
        <button 
          onClick={() => setAbaAtiva('convites')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: abaAtiva === 'convites' ? '3px solid #0c5e31' : 'none',
            background: abaAtiva === 'convites' ? '#e8f5e9' : '#f1f5f9',
            color: abaAtiva === 'convites' ? '#0c5e31' : '#475569',
            fontWeight: 'bold',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer'
          }}
        >
          📨 Convidar Candidatos (WhatsApp)
        </button>
        <button 
          onClick={() => setAbaAtiva('campos')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: abaAtiva === 'campos' ? '3px solid #0c5e31' : 'none',
            background: abaAtiva === 'campos' ? '#e8f5e9' : '#f1f5f9',
            color: abaAtiva === 'campos' ? '#0c5e31' : '#475569',
            fontWeight: 'bold',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer'
          }}
        >
          📝 Campos de Dados Pessoais
        </button>
        <button 
          onClick={() => setAbaAtiva('documentos')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: abaAtiva === 'documentos' ? '3px solid #0c5e31' : 'none',
            background: abaAtiva === 'documentos' ? '#e8f5e9' : '#f1f5f9',
            color: abaAtiva === 'documentos' ? '#0c5e31' : '#475569',
            fontWeight: 'bold',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer'
          }}
        >
          📋 Documentos Exigidos
        </button>
      </div>

      {/* ABA 1: CANDIDATOS */}
      {abaAtiva === 'candidatos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Todos', 'Pendentes', 'Aprovados', 'Com Pendência'].map(status => (
                <button 
                  key={status} 
                  onClick={() => setFiltro(status)} 
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid #cbd5e1',
                    background: filtro === status ? '#0c5e31' : '#fff',
                    color: filtro === status ? '#fff' : '#475569',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '13px'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportarCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: '#0c5e31',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              📥 Exportar Aprovados (Excel)
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {candidatosFiltrados.length === 0 ? (
              <p style={{ color: '#64748b' }}>Nenhum candidato encontrado nesta categoria.</p>
            ) : (
              candidatosFiltrados.map((c) => {
                const badge = getStatusBadge(c.status);
                const docsEnviados = candidateDocs[c.id] || [];
                const dadosExtras = c.custom_data || {};

                return (
                  <div key={c.id} style={{ padding: '18px 20px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    
                    {/* Topo Limpo: Nome, Status, Botão WhatsApp e Ações */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <strong style={{ fontSize: '18px', color: '#0f172a' }}>{c.full_name}</strong>
                        <span style={{ backgroundColor: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          {badge.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Botão de WhatsApp Direto */}
                        <button
                          type="button"
                          onClick={() => abrirWhatsAppCandidato(c)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '7px 12px',
                            background: '#25D366',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px'
                          }}
                          title="Abrir WhatsApp com este candidato"
                        >
                          <span>📱</span> WhatsApp
                        </button>

                        <button onClick={() => handleAprovar(c.id)} style={{ padding: '7px 14px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                          Aprovar ✓
                        </button>
                        <button onClick={() => handleRejeitar(c.id)} style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                          Rejeitar ✕
                        </button>
                      </div>
                    </div>

                    {/* Dados Cadastrados: 1 Informação por Linha */}
                    {Object.keys(dadosExtras).length > 0 ? (
                      <div style={{ padding: '14px 16px', background: '#f8faf9', borderRadius: '6px', fontSize: '14px', border: '1px solid #e2e8f0' }}>
                        <strong style={{ display: 'block', marginBottom: '10px', color: '#0c5e31', fontSize: '15px' }}>
                          Dados Cadastrados:
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {Object.entries(dadosExtras).map(([chave, valor]) => (
                            <div key={chave} style={{ color: '#334155', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}>
                              <b style={{ color: '#0f172a' }}>{chave}:</b> {String(valor)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '14px 16px', background: '#f8faf9', borderRadius: '6px', fontSize: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#334155' }}>
                          <div style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}><b style={{ color: '#0f172a' }}>Cargo:</b> {c.job_title}</div>
                          <div style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}><b style={{ color: '#0f172a' }}>Departamento:</b> {c.department}</div>
                          <div style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}><b style={{ color: '#0f172a' }}>E-mail:</b> {c.email}</div>
                          <div style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}><b style={{ color: '#0f172a' }}>Telefone:</b> {c.phone}</div>
                        </div>
                      </div>
                    )}

                    {/* Motivo de Pendência */}
                    {c.feedback_reason && (
                      <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '13px' }}>
                        <b>Motivo da Pendência:</b> {c.feedback_reason}
                      </div>
                    )}

                    {/* Documentos */}
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '8px' }}>
                        Documentos Enviados ({docsEnviados.length}):
                      </span>
                      {docsEnviados.length === 0 ? (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum documento anexado.</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {docsEnviados.map(d => (
                            <a
                              key={d.id}
                              href={d.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5e9', border: '1px solid #c8e6c9', color: '#0c5e31', textDecoration: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
                            >
                              📄 {d.document_name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ABA 2: CONVITES WHATSAPP */}
      {abaAtiva === 'convites' && (
        <div>
          <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <strong style={{ color: '#0c5e31', fontSize: '15px', display: 'block', marginBottom: '6px' }}>💬 Mensagem Padrão do WhatsApp</strong>
            <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
              Use <code>{'{NOME}'}</code> onde deseja que apareça o primeiro nome do candidato:
            </span>
            <textarea
              rows={3}
              value={mensagemModelo}
              onChange={e => setMensagemModelo(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, color: '#0c5e31', fontSize: '16px' }}>+ Convidar Candidato Avulso</h3>
              <form onSubmit={handleAdicionarConviteIndividual} style={{ display: 'grid', gap: '10px' }}>
                <input
                  placeholder="Nome do Candidato"
                  value={conviteNome}
                  onChange={e => setConviteNome(e.target.value)}
                  required
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <input
                  placeholder="WhatsApp com DDD (Ex: 43999998888)"
                  value={conviteTelefone}
                  onChange={e => setConviteTelefone(e.target.value)}
                  required
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <input
                  placeholder="Cargo Pretendido (Opcional)"
                  value={conviteCargo}
                  onChange={e => setConviteCargo(e.target.value)}
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <button
                  type="submit"
                  style={{ padding: '10px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Adicionar à Fila
                </button>
              </form>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, color: '#003366', fontSize: '16px' }}>📋 Importar Lista em Lote</h3>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 8px 0' }}>
                Cole os candidatos (um por linha): <b>Nome, Telefone</b> ou <b>Nome, Telefone, Cargo</b>
              </p>
              <form onSubmit={handleImportarLote} style={{ display: 'grid', gap: '10px' }}>
                <textarea
                  rows={4}
                  placeholder="Exemplo:&#10;João da Silva, 43999991111, Operador&#10;Maria Santos, 43988882222, RH"
                  value={listaLote}
                  onChange={e => setListaLote(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  style={{ padding: '10px', background: '#003366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Importar Lista
                </button>
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
                        onClick={() => dispararWhatsApp(inv)}
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

      {/* ABA 3: CAMPOS DE DADOS PESSOAIS */}
      {abaAtiva === 'campos' && (
        <div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: '#0c5e31' }}>+ Cadastrar Novo Campo com Validação</h3>
            <p style={{ color: '#64748b', fontSize: '13px' }}>Defina a pergunta e a regra de formatação/validação que o sistema executará automaticamente.</p>

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

      {/* ABA 4: DOCUMENTOS EXIGIDOS */}
      {abaAtiva === 'documentos' && (
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
    </main>
  );
}
