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
  const [filtro, setFiltro] = useState('Todos');

  async function carregarCandidatos() {
    const { data } = await supabase
      .from('onboarding_candidates')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCandidates(data);
  }

  useEffect(() => {
    if (autenticado) {
      carregarCandidatos();
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

    if (!error) carregarCandidatos();
  }

  async function handleRejeitar(id) {
    const motivo = prompt('Informe o motivo da pendência / recusa:');
    if (!motivo) return;

    const { error } = await supabase
      .from('onboarding_candidates')
      .update({ status: 'Rejeitado / Pendência', feedback_reason: motivo })
      .eq('id', id);

    if (!error) carregarCandidatos();
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
          <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>Digite a senha mestre para acessar o painel de aprovações.</p>
          <input 
            type="password" 
            placeholder="Senha de acesso" 
            value={senhaInput} 
            onChange={e => setSenhaInput(e.target.value)} 
            required 
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px' }} 
          />
          <button 
            type="submit" 
            style={{ width: '100%', padding: '10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Entrar no Painel
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ padding: '30px 20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto', color: '#1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0284c7' }}>Painel do RH - Gestão de Admissões</h1>
          <small style={{ color: '#64748b' }}>Conferência e validação de documentação admissional</small>
        </div>
        <button 
          onClick={() => setAutenticado(false)} 
          style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
        >
          Sair
        </button>
      </div>

      {/* Barra de Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
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

      {/* Lista de Registros */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {candidatosFiltrados.length === 0 ? (
          <p style={{ color: '#64748b' }}>Nenhum candidato encontrado nesta categoria.</p>
        ) : (
          candidatosFiltrados.map((c) => {
            const badge = getStatusBadge(c.status);
            return (
              <div key={c.id} style={{ padding: '16px 20px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '16px' }}>{c.full_name}</strong>
                      <span style={{ backgroundColor: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ color: '#475569', fontSize: '14px', lineHeight: '1.4' }}>
                      <b>Cargo:</b> {c.job_title} | <b>Depto:</b> {c.department}<br />
                      <b>Contato:</b> {c.email} | {c.phone}
                    </div>
                    {c.feedback_reason && (
                      <div style={{ marginTop: '8px', padding: '8px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '13px' }}>
                        <b>Motivo:</b> {c.feedback_reason}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {c.document_url && (
                      <a 
                        href={c.document_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ padding: '7px 12px', background: '#e0f2fe', color: '#0369a1', textDecoration: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px' }}
                      >
                        Ver Documento 📄
                      </a>
                    )}
                    <button 
                      onClick={() => handleAprovar(c.id)}
                      style={{ padding: '7px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                    >
                      Aprovar ✓
                    </button>
                    <button 
                      onClick={() => handleRejeitar(c.id)}
                      style={{ padding: '7px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                    >
                      Rejeitar ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
