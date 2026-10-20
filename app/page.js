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
  const [loading, setLoading] = useState(false);

  async function carregarCandidatos() {
    const { data } = await supabase.from('onboarding_candidates').select('*').order('created_at', { ascending: false });
    if (data) setCandidates(data);
  }

  useEffect(() => {
    carregarCandidatos();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('onboarding_candidates').insert([
      { full_name: name, email, phone, job_title: job, department: dept }
    ]);

    if (!error) {
      setName(''); setEmail(''); setPhone(''); setJob(''); setDept('');
      carregarCandidatos();
      alert('Candidato cadastrado com sucesso no sistema do RH!');
    } else {
      alert('Erro ao cadastrar: ' + error.message);
    }
    setLoading(false);
  }

  return (
    <main style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', color: '#333' }}>
      <h1 style={{ borderBottom: '2px solid #0284c7', paddingBottom: '10px' }}>Portal de Admissão & Onboarding - RH</h1>
      
      <section style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
        <h2>Novo Contratado (Cadastrar Admissão)</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '10px' }}>
          <input placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} required style={{ padding: '8px' }} />
          <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '8px' }} />
          <input placeholder="Telefone / WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: '8px' }} />
          <input placeholder="Cargo" value={job} onChange={e => setJob(e.target.value)} required style={{ padding: '8px' }} />
          <input placeholder="Departamento" value={dept} onChange={e => setDept(e.target.value)} required style={{ padding: '8px' }} />
          <button type="submit" disabled={loading} style={{ padding: '10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {loading ? 'Salvando...' : 'Cadastrar no Processo de Admissão'}
          </button>
        </form>
      </section>

      <section>
        <h2>Candidatos em Processo</h2>
        {candidates.length === 0 ? <p>Nenhum candidato registrado ainda.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {candidates.map((c) => (
              <li key={c.id} style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '10px', background: '#fff' }}>
                <strong>{c.full_name}</strong> — {c.job_title} ({c.department})<br />
                <small>Contato: {c.email} | {c.phone} | Status: <b>{c.status}</b></small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
