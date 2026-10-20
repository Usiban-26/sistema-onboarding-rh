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

    // 1. Upload do documento para o Supabase Storage (se selecionado)
    if (file) {
      const extensao = file.name.split('.').pop();
      const nomeUnico = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documentos-rh')
        .upload(nomeUnico, file);

      if (uploadError) {
        alert('Erro ao enviar documento: ' + uploadError.message);
        setLoading(false);
        return;
      }

      // Obtém o link público do ficheiro enviado
      const { data: publicData } = supabase.storage
        .from('documentos-rh')
        .getPublicUrl(nomeUnico);

      docUrl = publicData.publicUrl;
    }

    // 2. Registo dos dados do candidato na tabela
    const { error: insertError } = await supabase.from('onboarding_candidates').insert([
      {
        full_name: name,
        email,
        phone,
        job_title: job,
        department: dept,
        document_url: docUrl
      }
    ]);

    if (!insertError) {
      setName('');
      setEmail('');
      setPhone('');
      setJob('');
      setDept('');
      setFile(null);
      e.target.reset(); // Limpa o campo do ficheiro no formulário
      carregarCandidatos();
      alert('Candidato e documento registados com sucesso!');
    } else {
      alert('Erro ao guardar candidato: ' + insertError.message);
    }

    setLoading(false);
  }

  return (
    <main style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', color: '#333' }}>
      <h1 style={{ borderBottom: '2px solid #0284c7', paddingBottom: '10px' }}>
        Portal de Admissão & Onboarding - RH
      </h1>
      
      <section style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
        <h2>Novo Contratado (Cadastrar Admissão)</h2>
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
              Documento Admissional (RG, CNH ou Comprovativo em PDF/Imagem):
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

      <section>
        <h2>Candidatos em Processo</h2>
        {candidates.length === 0 ? (
          <p>Nenhum candidato registado ainda.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {candidates.map((c) => (
              <li key={c.id} style={{ padding: '15px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '12px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '16px' }}>{c.full_name}</strong> — {c.job_title} ({c.department})<br />
                    <small style={{ color: '#64748b' }}>Contato: {c.email} | {c.phone} | Status: <b>{c.status}</b></small>
                  </div>
                  {c.document_url && (
                    <a 
                      href={c.document_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ padding: '6px 12px', background: '#e0f2fe', color: '#0369a1', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px' }}
                    >
                      Ver Documento 📄
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
