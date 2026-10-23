'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const SENHA_MESTRA_RH = 'rh2026';

export default function AdminPage() {
  const [autenticado, setAutenticado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [candidateDocs, setCandidateDocs] = useState({});
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [requiredFields, setRequiredFields] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
  const [abaAtiva, setAbaAtiva] = useState('candidatos'); // 'candidatos' | 'documentos' | 'campos'

  // Novo documento
  const [novoDocTitulo, setNovoDocTitulo] = useState('');
  const [novoDocDesc, setNovoDocDesc] = useState('');
  const [novoDocObrigatorio, setNovoDocObrigatorio] = useState(true);

  // Novo campo de dados pessoais
  const [novoCampoLabel, setNovoCampoLabel] = useState('');
  const [novoCampoTipo, setNovoCampoTipo] = useState('text');
  const [novoCampoPlaceholder, setNovoCampoPlaceholder] = useState('');
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(true);
  const [novoCampoValidacao, setNovoCampoValidacao] = useState('none');

  async function carregarDados() {
    // 1. Candidatos
    const { data: candData } = await supabase
      .from('onboarding_candidates')
      .select('*')
      .order('created_at', { ascending: false });
    if (candData) setCandidates(candData);

    // 2. Documentos dos candidatos
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
      .order('created_at', { ascending: true });
    if (reqFields) setRequiredFields(reqFields);
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

  // Gestão de Documentos
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

  // Gestão de Campos Pessoais
  async function handleAdicionarCampo(e) {
    e.preventDefault();
    if (!novoCampoLabel) return;
    const { error } = await supabase.from('required_personal_fields').insert([
      {
        label: novoCampoLabel,
        field_type: novoCampoTipo,
        placeholder: novoCampoPlaceholder,
        is_required: novoCampoObrigatorio,
        validation_rule: novoCampoValidacao,
        is_active: true
      }
    ]);
    if (!error) {
      setNovoCampoLabel('');
      setNovoCampoPlaceholder('');
      setNovoCampoValidacao('none');
      carregarDados();
      alert('Campo com validação adicionado ao formulário com sucesso!');
    }
  }

  async function handleDesativarCampo(id) {
    if (!confirm('Deseja desativar este campo do formulário?')) return;
    await supabase.from('required_personal_fields').update({ is_active: false }).eq('id', id);
    carregarDados();
  }

  function getStatusBadge(status) {
    if (status === 'Aprovado') return { bg: '#dcfce7', color: '#15803d', label: 'Aprovado' };
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
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <form onSubmit={handleLogin} style={{ background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '320px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ marginTop: 0, color: '#0f172a', textAlign: 'center' }}>Acesso do RH</h2>
          <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>Digite a senha mestre para acessar o painel.</p>
          <input 
            type="password" 
            placeholder="Senha de acesso" 
            value={senhaInput} 
            onChange={e => setSenhaInput(e.target.value)} 
            required 
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px' }} 
          />
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Entrar no Painel
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ padding: '30px 20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto', color: '#1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0284c7' }}>Painel do RH - Gestão de Admissões</h1>
          <small style={{ color: '#64748b' }}>Usiban | Gestão integral de candidatos, campos e documentos</small>
        </div>
        <button onClick={() => setAutenticado(false)} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
          Sair
        </button>
      </div>

      {/* Navegação entre Abas */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setAbaAtiva('candidatos')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: abaAtiva === 'candidatos' ? '3px solid #0284c7' : 'none',
            background: abaAtiva === 'candidatos' ? '#e0f2fe' : '#f1f5f9',
            color: abaAtiva === 'candidatos' ? '#0369a1' : '#475569',
            fontWeight: 'bold',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer'
          }}
        >
          👥 Candidatos & Validação
        </button>
        <button 
          onClick={() => setAbaAtiva('campos')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: abaAtiva === 'campos' ? '3px solid #0284c7' : 'none',
            background: abaAtiva === 'campos' ? '#e0f2fe' : '#f1f5f9',
            color: abaAtiva === 'campos' ? '#0369a1' : '#475569',
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
            borderBottom: abaAtiva === 'documentos' ? '3px solid #0284c7' : 'none',
            background: abaAtiva === 'documentos' ? '#e0f2fe' : '#f1f5f9',
            color: abaAtiva === 'documentos' ? '#0369a1' : '#475569',
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
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            {['Todos', 'Pendentes', 'Aprovados', 'Com Pendência'].map(status => (
              <button 
                key={status} 
                onClick={() => setFiltro(status)} 
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid #cbd5e1',
                  background: filtro === status ? '#0284c7' : '#fff',
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '17px' }}>{c.full_name}</strong>
                          <span style={{ backgroundColor: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                            {badge.label}
                          </span>
                        </div>
                        <div style={{ color: '#475569', fontSize: '14px', lineHeight: '1.4' }}>
                          <b>Cargo:</b> {c.job_title} | <b>Depto:</b> {c.department}<br />
                          <b>Contato:</b> {c.email} | {c.phone}
                        </div>

                        {/* Exibição dos Dados Dinâmicos Cadastrados */}
                        {Object.keys(dadosExtras).length > 0 && (
                          <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                            <strong style={{ display: 'block', marginBottom: '4px', color: '#0f172a' }}>Dados Cadastrados:</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
                              {Object.entries(dadosExtras).map(([chave, valor]) => (
                                <span key={chave} style={{ color: '#334155' }}>
                                  <b>{chave}:</b> {String(valor)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {c.feedback_reason && (
                          <div style={{ marginTop: '8px', padding: '8px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '13px' }}>
                            <b>Motivo:</b> {c.feedback_reason}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => handleAprovar(c.id)} style={{ padding: '7px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                          Aprovar ✓
                        </button>
                        <button onClick={() => handleRejeitar(c.id)} style={{ padding: '7px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                          Rejeitar ✕
                        </button>
                      </div>
                    </div>

                    {/* Documentos Anexados */}
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
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', textDecoration: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}
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

      {/* ABA 2: CAMPOS DE DADOS PESSOAIS */}
      {abaAtiva === 'campos' && (
        <div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>+ Cadastrar Novo Campo com Validação</h3>
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
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold', color: '#0284c7' }}
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
                style={{ padding: '10px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: 'fit-content' }}
              >
                Adicionar Campo ao Formulário
              </button>
            </form>
          </div>

          <h3 style={{ color: '#0f172a' }}>Campos Atualmente Ativos no Formulário</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requiredFields.map(campo => (
              <div key={campo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div>
                  <strong style={{ fontSize: '15px' }}>{campo.label}</strong>
                  <span style={{ marginLeft: '8px', background: '#e2e8f0', color: '#475569', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>
                    Tipo: {campo.field_type}
                  </span>
                  {campo.validation_rule && campo.validation_rule !== 'none' && (
                    <span style={{ marginLeft: '6px', background: '#e0f2fe', color: '#0369a1', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      Validação: {campo.validation_rule === 'fullname' ? 'Nome Completo' : campo.validation_rule === 'cpf' ? 'CPF Válido' : 'Celular 9 Dígitos'}
                    </span>
                  )}
                  {campo.is_required && (
                    <span style={{ marginLeft: '6px', background: '#fef2f2', color: '#b91c1c', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      Obrigatório
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => handleDesativarCampo(campo.id)}
                  style={{ padding: '6px 10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  Desativar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 3: DOCUMENTOS EXIGIDOS */}
      {abaAtiva === 'documentos' && (
        <div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>+ Cadastrar Novo Documento Exigido</h3>
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
                style={{ padding: '10px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: 'fit-content' }}
              >
                Salvar Exigência
              </button>
            </form>
          </div>

          <h3 style={{ color: '#0f172a' }}>Documentos Atualmente Exigidos</h3>
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
