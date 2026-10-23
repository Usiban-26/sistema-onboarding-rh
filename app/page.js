'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Formata cada primeira letra em Maiúscula
function formatarNomeProprio(texto) {
  return texto
    .toLowerCase()
    .split(' ')
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ');
}

// Valida se possui nome e sobrenome
function validarNomeSobrenome(texto) {
  if (!texto) return false;
  const partes = texto.trim().split(/\s+/);
  return partes.length >= 2 && partes[0].length >= 2 && partes[1].length >= 2;
}

// Máscara dinâmica de Celular: (00) 00000-0000
function aplicarMascaraTelefone(valor) {
  let v = valor.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) {
    return v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (v.length > 2) {
    return v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  }
  return v;
}

function validarTelefoneCelular(valor) {
  const numeros = valor.replace(/\D/g, '');
  return numeros.length === 11;
}

// Máscara dinâmica de CPF: 000.000.000-00
function aplicarMascaraCPF(valor) {
  let v = valor.replace(/\D/g, '').slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2') .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Validação oficial do CPF
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

  useEffect(() => {
    async function carregarConfiguracoes() {
      const { data: fieldsData } = await supabase
        .from('required_personal_fields')
        .select('*')
        .eq('is_active', true)
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

  function handleInputChange(field, valorOriginal) {
    let valor = valorOriginal;
    const regra = field.validation_rule || 'none';

    if (regra === 'cpf' || field.label.toLowerCase().includes('cpf')) {
      valor = aplicarMascaraCPF(valor);
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
      alert('Existem dados incompletos ou inválidos no formulário. Verifique os campos destacados em vermelho.');
      return;
    }

    setLoading(true);

    try {
      const fullName = formValues['Nome Completo'] || Object.values(formValues)[0] || 'Candidato';
      const email = formValues['E-mail'] || '';
      const phone = formValues['WhatsApp / Telefone'] || formValues['Telefone'] || formValues['Celular'] || '';
      const job = formValues['Cargo Pretendido'] || '';
      const dept = formValues['Departamento'] || '';

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
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '30px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      
      {/* Topo Institucional com Identidade USIBAN */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ height: '2px', width: '20px', background: '#003366' }}></span>
          <p style={{ color: '#003366', margin: 0, fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Açúcar e Álcool Bandeirantes S.A. • USIBAN
          </p>
          <span style={{ height: '2
