'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Home() {
  const [candidates, setCandidates] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [job, setJob] = useState('');
  const [dept, setDept] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  async function carregarCandidatos() {
    const { data } = await supabase
      .from('onboarding_candidates')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCandidates(data);
  }

  useEffect(() => {
    carregarCandidatos();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    let docUrl = null;

    if (file) {
      const extensao = file.name.split('.').pop();
      const nomeUnico = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documentos-rh')
        .upload(nomeUnico, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        alert('Erro ao enviar documento: ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: publicData } = supabase.storage
        .from('documentos-rh')
        .getPublicUrl(nomeUnico);

      docUrl = publicData.publicUrl;
    }

    const { error: insertError } = await supabase.from('onboarding_candidates').insert([
      {
        full_name: name,
        email,
        phone,
        job_title: job,
        department: dept,
        document_url: docUrl,
        status: 'Pendente'
      }
    ]);

    if (!insertError) {
      setName('');
      setEmail('');
      setPhone('');
      setJob('');
      setDept('');
      setFile(null);
      e.target.reset();
      carregarCandidatos();
      alert('Candidato registrado com sucesso!');
    } else {
      alert('Erro ao salvar: ' + insertError.message);
    }

    setLoading(false);
  }

  // Função para aprovar o candidato
  async function handleAprovar(id) {
    const { error } = await supabase
      .from('onboarding_candidates')
      .update({ status: 'Aprovado', feedback_reason: null })
      .eq('id', id);

    if (error) {
      alert('Erro ao aprovar: ' + error.message);
    } else {
      carregarCandidatos();
    }
  }

  // Função para rejeitar com justificativa
  async function handleRejeitar(id) {
    const motivo = prompt('Informe o motivo da recusa ou correção necessária:');
    if (!motivo) return; // Se cancelar o prompt, não faz nada

    const { error } = await supabase
      .from('onboarding_candidates')
      .update({ status: 'Rejeitado / Pendência', feedback_reason: motivo })
      .eq('id', id);

    if (error) {
      alert('Erro ao rejeitar: ' + error.message);
    } else {
      carregarCandidatos();
    }
  }

  // Cor visual conforme o status
  function getStatusBadge(status) {
    if (status === 'Aprovado') {
      return { bg: '#dcfce7', color: '#15803d', label: 'Aprovado' };
    }
    if (status?.includes('Rejeitado')) {
      return { bg: '#fee2e2', color: '#b91c1c', label: status };
    }
    return { bg: '#fef3c7', color: '#b45309', label: 'Pendente' };
  }

  return (
    <main style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '850px', margin: '0 auto', color: '#333' }}>
      <h1 style={{ borderBottom: '2px solid #0284c7', paddingBottom: '10px' }}>
        Portal de Admissão & Onboarding - RH
      </h1>
      
      {/* Formulário de Cadastro */}
      <section style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ marginTop: 0 }}>Novo Contratado (Cadastrar Admissão)</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
          <input 
            placeholder="Nome Completo" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
          />
          <input 
            placeholder="E-mail" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
          />
          <input 
            placeholder="Telefone / WhatsApp" 
            value={phone} 
            onChange={e => setPhone(e.target.value)} 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
          />
          <input 
            placeholder="Cargo" 
            value={job} 
            onChange={e => setJob(e.target.value)} 
            required 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
          />
          <input 
            placeholder="Departamento" 
            value={dept} 
            onChange={e => setDept(e.target.value)} 
            required 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>
              Documento Admissional (RG, CNH ou Comprovante):
            </label>
            <input 
              type="file" 
              accept=".pdf,image/*" 
              onChange={e => setFile(e.target.files[0])} 
              style={{ padding: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px' }} 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{ padding: '12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
          >
            {loading ? 'A enviar e a guardar...' : 'Cadastrar no Processo de Admissão'}
          </button>
        </form>
      </section>

      {/* Painel do RH / Lista de Candidatos */}
      <section>
        <h2>Painel de Validação do RH</h2>
        {candidates.length === 0 ? (
          <p>Nenhum candidato registrado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {candidates.map((c) => {
              const badge = getStatusBadge(c.status);
              return (
                <div key={c.id} style={{ padding: '18px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '17px' }}>{c.full_name}</strong>
                        <span style={{ backgroundColor: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
                        <b>Cargo:</b> {c.job_title} | <b>Depto:</b> {c.department}<br />
                        <b>Contato:</b> {c.email} | {c.phone || 'Não informado'}
                      </div>
                      {c.feedback_reason && (
                        <div style={{ marginTop: '8px', padding: '8px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '13px' }}>
                          <b>Motivo da Pendência:</b> {c.feedback_reason}
                        </div>
                      )}
                    </div>

                    {/* Ações do RH */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {c.document_url ? (
                        <a 
                          href={c.document_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ padding: '7px 12px', background: '#e0f2fe', color: '#0369a1', textDecoration: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px' }}
                        >
                          Ver Doc 📄
                        </a>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sem anexo</span>
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
            })}
          </div>
        )}
      </section>
    </main>
  );
}
