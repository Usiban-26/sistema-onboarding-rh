'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function CandidatoPage() {
  const [requiredFields, setRequiredFields] = useState([]);
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Carrega tanto os campos cadastrais quanto os documentos exigidos
  useEffect(() => {
    async function carregarConfiguracoes() {
      // 1. Campos
      const { data: fieldsData } = await supabase
        .from('required_personal_fields')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (fieldsData) setRequiredFields(fieldsData);

      // 2. Documentos
      const { data: docsData } = await supabase
        .from('required_documents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (docsData) setRequiredDocs(docsData);
    }

    carregarConfiguracoes();
  }, []);

  function handleInputChange(fieldLabel, valor) {
    setFormValues(prev => ({ ...prev, [fieldLabel]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      // Extrai os campos base para a tabela principal
      const fullName = formValues['Nome Completo'] || Object.values(formValues)[0] || 'Candidato Sem Nome';
      const email = formValues['E-mail'] || '';
      const phone = formValues['WhatsApp / Telefone'] || '';
      const job = formValues['Cargo Pretendido'] || '';
      const dept = formValues['Departamento'] || '';

      // Grava candidato com os campos extras salvos em JSONB
      const { data: candData, error: candError } = await supabase
        .from('onboarding_candidates')
        .insert([
          {
            full_name: fullName,
            email,
            phone,
            job_title: job,
            department: dept,
            custom_data: formValues,
            status: 'Pendente'
          }
        ])
        .select()
        .single();

      if (candError || !candData) {
        alert('Erro ao gravar dados: ' + (candError?.message || 'Falha'));
        setLoading(false);
        return;
      }

      const candidateId = candData.id;

      // Upload de todos os arquivos anexados
      for (const doc of requiredDocs) {
        const inputElement = e.target.elements[`doc_${doc.id}`];
        const selectedFile = inputElement?.files?.[0];

        if (selectedFile && selectedFile.size > 0) {
          const extensao = selectedFile.name.split('.').pop().toLowerCase();
          const nomeUnico = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;

          const { error: uploadError } = await supabase.storage
            .from('documentos-rh')
            .upload(nomeUnico, selectedFile, {
              contentType: selectedFile.type || 'application/pdf',
              upsert: true
            });

          if (!uploadError) {
            const { data: publicData } = supabase.storage
              .from('documentos-rh')
              .getPublicUrl(nomeUnico);

            await supabase.from('candidate_documents').insert([
              {
                candidate_id: candidateId,
                document_name: doc.title,
                document_url: publicData.publicUrl
              }
            ]);
          }
        }
      }

      setSucesso(true);
    } catch (err) {
      alert('Erro inesperado: ' + err.message);
    }

    setLoading(false);
  }

  return (
    <main style={{ padding: '40px 20px', fontFamily: 'sans-serif', maxWidth: '680px', margin: '0 auto', color: '#1e293b' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#0284c7', margin: '0 0 8px 0' }}>Portal de Admissão - Usiban</h1>
        <p style={{ color: '#64748b', margin: 0 }}>Preencha os dados e anexe os documentos solicitados abaixo.</p>
      </header>

      {sucesso ? (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '30px', borderRadius: '8px', textAlign: 'center' }}>
          <h2 style={{ color: '#047857', marginTop: 0 }}>Dados e Documentos Enviados com Sucesso!</h2>
          <p style={{ color: '#065f46' }}>Nossa equipe de Recursos Humanos analisará a sua admissão em breve.</p>
          <button 
            onClick={() => setSucesso(false)} 
            style={{ marginTop: '15px', padding: '10px 18px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Enviar novo formulário
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ background: '#ffffff', padding: '28px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'grid', gap: '16px', border: '1px solid #e2e8f0' }}>
          
          <h3 style={{ margin: '0 0 4px 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            1. Dados Pessoais & Cadastrais
          </h3>

          {requiredFields.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '13px' }}>Carregando formulário...</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {requiredFields.map(f => (
                <div key={f.id}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    {f.label} {f.is_required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input 
                    type={f.field_type || 'text'}
                    placeholder={f.placeholder || ''}
                    required={f.is_required}
                    value={formValues[f.label] || ''}
                    onChange={e => handleInputChange(f.label, e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              ))}
            </div>
          )}

          <h3 style={{ margin: '14px 0 4px 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            2. Documentação Admissional
          </h3>

          {requiredDocs.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '13px' }}>Carregando lista de documentos solicitados...</p>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {requiredDocs.map(doc => (
                <div key={doc.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                    {doc.title} {doc.is_required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  {doc.description && <span style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>{doc.description}</span>}
                  <input 
                    name={`doc_${doc.id}`}
                    type="file" 
                    accept=".pdf,image/*" 
                    required={doc.is_required}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} 
                  />
                </div>
              ))}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            style={{ marginTop: '10px', padding: '14px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
          >
            {loading ? 'Enviando admissão...' : 'Concluir e Enviar ao RH'}
          </button>
        </form>
      )}

      <footer style={{ textAlign: 'center', marginTop: '30px' }}>
        <a href="/admin" style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none' }}>Acesso Restrito RH</a>
      </footer>
    </main>
  );
}
