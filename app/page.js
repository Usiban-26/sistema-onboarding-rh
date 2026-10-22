'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function CandidatoPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [job, setJob] = useState('');
  const [dept, setDept] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    let docUrl = null;

    if (file) {
      const extensao = file.name.split('.').pop();
      const nomeUnico = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;
      
      // Trecho idêntico ao que funcionou anteriormente:
      const { data: uploadData, error: uploadError } = await supabase.storage
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
      setSucesso(true);
    } else {
      alert('Erro ao enviar cadastro: ' + insertError.message);
    }

    setLoading(false);
  }

  return (
    <main style={{ padding: '40px 20px', fontFamily: 'sans-serif', maxWidth: '650px', margin: '0 auto', color: '#1e293b' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#0284c7', margin: '0 0 8px 0' }}>Portal de Admissão</h1>
        <p style={{ color: '#64748b', margin: 0 }}>Preencha seus dados e anexe os documentos para darmos início à sua contratação.</p>
      </header>

      {sucesso ? (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '30px', borderRadius: '8px', textAlign: 'center' }}>
          <h2 style={{ color: '#047857', marginTop: 0 }}>Dados enviados com sucesso!</h2>
          <p style={{ color: '#065f46' }}>Nossa equipe de Recursos Humanos analisará a sua documentação em breve.</p>
          <button 
            onClick={() => setSucesso(false)} 
            style={{ marginTop: '15px', padding: '10px 18px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Enviar novo formulário
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ background: '#ffffff', padding: '28px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'grid', gap: '14px', border: '1px solid #e2e8f0' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Nome Completo *</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              placeholder="Digite seu nome completo" 
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>E-mail *</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="seuemail@exemplo.com" 
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>WhatsApp / Telefone *</label>
              <input 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                required 
                placeholder="(00) 00000-0000" 
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Cargo Pretendido *</label>
              <input 
                value={job} 
                onChange={e => setJob(e.target.value)} 
                required 
                placeholder="Ex: Auxiliar de Produção" 
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Departamento *</label>
              <input 
                value={dept} 
                onChange={e => setDept(e.target.value)} 
                required 
                placeholder="Ex: Manutenção, RH, Logística" 
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Documento Admissional (RG, CNH ou Comprovante) *</label>
            <input 
              type="file" 
              accept=".pdf,image/*" 
              required
              onChange={e => setFile(e.target.files[0])} 
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }} 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{ marginTop: '10px', padding: '13px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
          >
            {loading ? 'Enviando documentação...' : 'Concluir e Enviar ao RH'}
          </button>
        </form>
      )}
      <footer style={{ textAlign: 'center', marginTop: '30px' }}>
        <a href="/admin" style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none' }}>Acesso Restrito RH</a>
      </footer>
    </main>
  );
}
