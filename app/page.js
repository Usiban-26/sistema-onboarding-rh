'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

function formatarNomeProprio(texto) {
  return texto
    .toLowerCase()
    .split(' ')
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ');
}

function validarNomeSobrenome(texto) {
  if (!texto) return false;
  const partes = texto.trim().split(/\s+/);
  return partes.length >= 2 && partes[0].length >= 2 && partes[1].length >= 2;
}

function aplicarMascaraTelefone(valor) {
  let v = valor.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) return v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (v.length > 6) return v.replace(/^(\d{2})(\d{4,5})(\d{0,4})$/, '($1) $2-$3');
  if (v.length > 2) return v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
  return v;
}

function validarTelefoneCelular(valor) {
  const numeros = valor.replace(/\D/g, '');
  return numeros.length === 11;
}

function aplicarMascaraCPF(valor) {
  let v = valor.replace(/\D/g, '').slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validarCPF(cpfLimpo) {
  const cpf = cpfLimpo.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) return false;

  return true;
}

export default function CandidatoPage() {
  const [requiredFields, setRequiredFields] = useState([]);
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [erros, setErros] = useState({});
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [candidatoExistenteId, setCandidatoExistenteId] = useState(null);
  const [avisoReenvio, setAvisoReenvio] = useState('');

  useEffect(() => {
    async function carregarConfiguracoes() {
      const { data: fieldsData } = await supabase
        .from('required_personal_fields')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (fieldsData) setRequiredFields(fieldsData);

      const { data: docsData } = await supabase
        .from('required_documents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (docsData) setRequiredDocs(docsData);
    }
    carregarConfiguracoes();
  }, []);

  // VERIFICA SE O CANDIDATO JÁ TEM CADASTRO PELO CPF PARA EVITAR DUPLICAÇÃO
  async function verificarCadastroExistente(cpfFormatado) {
    const apenasNumeros = cpfFormatado.replace(/\D/g, '');
    if (apenasNumeros.length !== 11) return;

    const { data: candData } = await supabase
      .from('onboarding_candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (candData) {
      const achado = candData.find(c => {
        const cpfSalvo = (c.custom_data?.['CPF'] || '').replace(/\D/g, '');
        return cpfSalvo === apenasNumeros;
      });

      if (achado) {
        setCandidatoExistenteId(achado.id);
        if (achado.custom_data) {
          setFormValues(prev => ({ ...prev, ...achado.custom_data }));
        }
        if (achado.feedback_reason) {
          setAvisoReenvio(`Atenção: Identificamos que você está reenviando dados. Pendência anterior informada pelo RH: "${achado.feedback_reason}". Anexe o documento correto para atualizar seu processo.`);
        } else {
          setAvisoReenvio('Cadastro já localizado. Seus dados foram carregados abaixo; você pode atualizá-los ou reenviar os anexos pendentes.');
        }
      }
    }
  }

  function handleInputChange(field, valorOriginal) {
    let valor = valorOriginal;
    const regra = field.validation_rule || 'none';

    if (regra === 'cpf' || field.label.toLowerCase().includes('cpf')) {
      valor = aplicarMascaraCPF(valor);
      if (valor.replace(/\D/g, '').length === 11) {
        verificarCadastroExistente(valor);
      }
    } else if (regra === 'phone' || field.label.toLowerCase().includes('whatsapp') || field.label.toLowerCase().includes('telefone')) {
      valor = aplicarMascaraTelefone(valor);
    }

    setFormValues(prev => ({ ...prev, [field.label]: valor }));
    if (erros[field.label]) {
      setErros(prev => ({ ...prev, [field.label]: null }));
    }
  }

  function handleInputBlur(field) {
    const regra = field.validation_rule || 'none';
    const valorAtual = formValues[field.label] || '';
    if (regra === 'fullname' || field.label.toLowerCase().includes('nome')) {
      if (valorAtual) {
        setFormValues(prev => ({ ...prev, [field.label]: formatarNomeProprio(valorAtual) }));
      }
    }
  }

  function validarFormulario() {
    const novosErros = {};

    for (const f of requiredFields) {
      const valor = (formValues[f.label] || '').trim();
      const regra = f.validation_rule || 'none';

      if (f.is_required && !valor) {
        novosErros[f.label] = 'Este campo é obrigatório.';
        continue;
      }
      if (!valor) continue;

      if (regra === 'fullname' || f.label.toLowerCase().includes('nome completo') || f.label.toLowerCase().includes('nome da mãe')) {
        if (!validarNomeSobrenome(valor)) {
          novosErros[f.label] = 'Informe o nome e sobrenome completos.';
        }
      }

      if (regra === 'phone' || f.label.toLowerCase().includes('whatsapp') || f.label.toLowerCase().includes('celular')) {
        if (!validarTelefoneCelular(valor)) {
          novosErros[f.label] = 'Celular inválido. Digite 9 dígitos com DDD: (00) 00000-0000.';
        }
      }

      if (regra === 'cpf' || f.label.toLowerCase().includes('cpf')) {
        if (!validarCPF(valor)) {
          novosErros[f.label] = 'CPF inválido. Verifique os números.';
        }
      }
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validarFormulario()) {
      alert('Existem dados incompletos ou inválidos no formulário. Verifique os campos destacados.');
      return;
    }

    setLoading(true);

    try {
      const fullName = formValues['Nome Completo'] || Object.values(formValues)[0] || 'Candidato';
      const email = formValues['E-mail'] || '';
      const phone = formValues['WhatsApp / Telefone'] || formValues['Telefone'] || formValues['Celular'] || '';
      const job = formValues['Cargo Pretendido'] || '';
      const dept = formValues['Departamento'] || '';

      let candidateId = candidatoExistenteId;

      // SE JÁ EXISTE CADASTRO, ATUALIZA (UPDATE) SEM DUPLICAR
      if (candidateId) {
        const { error: updateError } = await supabase
          .from('onboarding_candidates')
          .update({
            full_name: fullName,
            email,
            phone,
            job_title: job,
            department: dept,
            custom_data: formValues,
            status: 'Pendente' // Retorna para conferência do RH
          })
          .eq('id', candidateId);

        if (updateError) throw updateError;
      } else {
        // NOVO CADASTRO
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

        if (candError || !candData) throw candError;
        candidateId = candData.id;
      }

      // PROCESSA ANEXOS DE ARQUIVOS
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

            // Remove versão anterior deste documento se estiver reenviando
            await supabase
              .from('candidate_documents')
              .delete()
              .eq('candidate_id', candidateId)
              .eq('document_name', doc.title);

            // Insere o novo arquivo atualizado
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
      alert('Erro ao enviar dados: ' + err.message);
    }

    setLoading(false);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f4f6f5', padding: '30px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <img 
          src="/logo-usiban.png" 
          alt="Usina Bandeirante - USIBAN" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
          style={{ width: '130px', height: 'auto', marginBottom: '12px' }} 
        />
        <h1 style={{ color: '#0c5e31', margin: '0 0 6px 0', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>
          Portal de Admissão Digital
        </h1>
        <p style={{ color: '#475569', margin: 0, fontSize: '14px', fontWeight: '500' }}>
          Açúcar e Álcool Bandeirantes S.A. • USIBAN
        </p>
      </header>

      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {avisoReenvio && !sucesso && (
          <div style={{ background: '#e0f2fe', borderLeft: '4px solid #0284c7', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px', color: '#0369a1' }}>
            ℹ️ {avisoReenvio}
          </div>
        )}

        {sucesso ? (
          <div style={{ background: '#ffffff', borderTop: '5px solid #003366', padding: '36px 24px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e8f5e9', color: '#0c5e31', fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              ✓
            </div>
            <h2 style={{ color: '#0c5e31', marginTop: 0, fontSize: '22px' }}>Cadastro e Documentos Recebidos!</h2>
            <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.5' }}>
              Os seus dados foram enviados com sucesso ao setor de Recursos Humanos da Usina Bandeirante para validação.
            </p>
            <button 
              onClick={() => { setSucesso(false); setFormValues({}); setCandidatoExistenteId(null); setAvisoReenvio(''); }} 
              style={{ marginTop: '18px', padding: '12px 24px', background: '#0c5e31', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            >
              Realizar Novo Envio
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#003366', height: '6px' }}></div>
            <div style={{ padding: '28px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#0c5e31', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e8f5e9', color: '#0c5e31', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>1</span>
                  Dados Pessoais & Cadastrais
                </h2>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Preencha com atenção todas as informações cadastrais</span>
              </div>

              {requiredFields.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px' }}>Carregando formulário...</p>
              ) : (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {requiredFields.map(f => {
                    const temErro = Boolean(erros[f.label]);
                    return (
                      <div key={f.id}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13.5px', color: temErro ? '#dc2626' : '#334155' }}>
                          {f.label} {f.is_required && !candidatoExistenteId && <span style={{ color: '#dc2626' }}>*</span>}
                        </label>
                        <input 
                          type={f.field_type || 'text'}
                          placeholder={f.placeholder || ''}
                          value={formValues[f.label] || ''}
                          onChange={e => handleInputChange(f, e.target.value)}
                          onBlur={() => handleInputBlur(f)}
                          style={{ 
                            width: '100%', 
                            boxSizing: 'border-box', 
                            padding: '10px 12px', 
                            borderRadius: '6px', 
                            border: temErro ? '2px solid #dc2626' : '1px solid #cbd5e1',
                            background: temErro ? '#fef2f2' : '#fff',
                            fontSize: '14px',
                            outline: 'none',
                            color: '#1e293b'
                          }} 
                        />
                        {temErro && (
                          <span style={{ display: 'block', marginTop: '4px', color: '#dc2626', fontSize: '12px', fontWeight: '500' }}>
                            ⚠️ {erros[f.label]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '28px 0' }} />

              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#0c5e31', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e8f5e9', color: '#0c5e31', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>2</span>
                  Documentação Admissional
                </h2>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Anexe arquivos legíveis (PDF ou Fotos nítidas)</span>
              </div>

              {requiredDocs.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px' }}>Carregando lista de documentos solicitados...</p>
              ) : (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {requiredDocs.map(doc => (
                    <div key={doc.id} style={{ background: '#f8faf9', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                        {doc.title} {doc.is_required && !candidatoExistenteId && <span style={{ color: '#dc2626' }}>*</span>}
                      </label>
                      {doc.description && <span style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>{doc.description}</span>}
                      <input 
                        name={`doc_${doc.id}`}
                        type="file" 
                        accept=".pdf,image/*" 
                        required={doc.is_required && !candidatoExistenteId}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }} 
                      />
                    </div>
                  ))}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                style={{ 
                  marginTop: '24px', 
                  width: '100%', 
                  padding: '14px', 
                  background: loading ? '#6b7280' : '#0c5e31', 
                  color: '#ffffff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: loading ? 'not-allowed' : 'pointer', 
                  fontWeight: '700', 
                  fontSize: '15px', 
                  boxShadow: '0 2px 4px rgba(12, 94, 49, 0.2)'
                }}
              >
                {loading ? 'Processando envio...' : (candidatoExistenteId ? 'Atualizar Dados e Reenviar ao RH' : 'Concluir Cadastro e Enviar ao RH')}
              </button>
            </div>
          </form>
        )}

        <footer style={{ textAlign: 'center', marginTop: '24px', color: '#94a3b8', fontSize: '12px' }}>
          <span>© {new Date().getFullYear()} Açúcar e Álcool Bandeirantes S.A. • USIBAN</span>
          <div style={{ marginTop: '6px' }}>
            <a href="/admin" style={{ color: '#0c5e31', textDecoration: 'none', fontWeight: 'bold' }}>Acesso Restrito RH</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
