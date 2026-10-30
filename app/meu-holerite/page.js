'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
);

// WhatsApp do Departamento Pessoal / RH Usiban (com DDI + DDD)
const WHATSAPP_DP_USIBAN = '5543999999999'; 

export default function MeuHoleritePage() {
  const [cpf, setCpf] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [colaboradorNome, setColaboradorNome] = useState('');
  const [holerites, setHolerites] = useState([]);
  const [pesquisou, setPesquisou] = useState(false);
  const [erro, setErro] = useState('');

  // Estados do Canal de Atendimento
  const [abaAtiva, setAbaAtiva] = useState('holerites'); // 'holerites' ou 'atendimento'
  const [assuntoSuporte, setAssuntoSuporte] = useState('Dúvida sobre Holerite / Descontos');
  const [mensagemSuporte, setMensagemSuporte] = useState('');

  function formatarCpf(valor) {
    return valor
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  }

  async function handleConsultarHolerites(e) {
    e.preventDefault();
    setErro('');
    const rawCpf = cpf.replace(/\D/g, '');

    if (rawCpf.length !== 11) {
      setErro('Informe um CPF válido com 11 dígitos.');
      return;
    }

    setCarregando(true);
    setPesquisou(false);

    try {
      const { data, error } = await supabase
        .from('employee_payrolls')
        .select('*')
        .eq('cpf', rawCpf)
        .order('competence', { ascending: false });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setHolerites(data);
        const primeiroValido = data.find(h => h.employee_name && h.employee_name !== 'Colaborador');
        setColaboradorNome(primeiroValido ? primeiroValido.employee_name : 'Colaborador');
      } else {
        setHolerites([]);
        setColaboradorNome('');
      }
      setPesquisou(true);
    } catch (err) {
      setErro('Não foi possível carregar os demonstrativos. Tente novamente mais tarde.');
    } finally {
      setCarregando(false);
    }
  }

  function handleAbrirWhatsAppDP() {
    const nome = colaboradorNome || 'Colaborador';
    const cpfFormatado = cpf || 'Não informado';
    const texto = `Olá, equipe de Recursos Humanos / DP da Usina Bandeirante (USIBAN).\n\n*Solicitação de Atendimento:*\n👤 *Colaborador:* ${nome}\n🪪 *CPF:* ${cpfFormatado}\n📌 *Assunto:* ${assuntoSuporte}\n\n💬 *Mensagem:* ${mensagemSuporte || 'Gostaria de tirar uma dúvida sobre meus holerites.'}`;

    window.open(`https://wa.me/${WHATSAPP_DP_USIBAN}?text=${encodeURIComponent(texto)}`, '_blank');
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: '24px 16px', color: '#1e293b' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        
        {/* Topo Institucional */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/logo-usiban.png" alt="USIBAN" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '80px', height: 'auto', marginBottom: '10px' }} />
          <h1 style={{ margin: 0, color: '#0c5e31', fontSize: '24px', fontWeight: '800' }}>Central do Colaborador</h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Usina Bandeirante (USIBAN) • Consulta de Holerites & Atendimento ao Trabalhador
          </p>
        </div>

        {/* Card de Identificação */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: '24px' }}>
          <form onSubmit={handleConsultarHolerites} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
                Informe o seu CPF:
              </label>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={e => setCpf(formatarCpf(e.target.value))}
                required
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px' }}
              />
            </div>
            <button
              type="submit"
              disabled={carregando}
              style={{ marginTop: '24px', padding: '12px 24px', background: carregando ? '#94a3b8' : '#0c5e31', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: carregando ? 'not-allowed' : 'pointer' }}
            >
              {carregando ? 'Consultando...' : '🔍 Consultar Documentos'}
            </button>
          </form>

          {erro && (
            <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px' }}>
              ⚠️ {erro}
            </div>
          )}
        </div>

        {/* Painel do Colaborador Identificado */}
        {pesquisou && (
          <div>
            {colaboradorNome && (
              <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <small style={{ color: '#0c5e31', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Colaborador Identificado</small>
                  <h3 style={{ margin: 0, color: '#0c5e31', fontSize: '18px' }}>{colaboradorNome}</h3>
                </div>
                <div style={{ fontSize: '13px', color: '#2e7d32' }}>
                  CPF: <b>{cpf}</b>
                </div>
              </div>
            )}

            {/* Alternador de Abas */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid #cbd5e1' }}>
              <button
                onClick={() => setAbaAtiva('holerites')}
                style={{ padding: '10px 18px', border: 'none', borderBottom: abaAtiva === 'holerites' ? '3px solid #0c5e31' : 'none', background: 'transparent', color: abaAtiva === 'holerites' ? '#0c5e31' : '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
              >
                📑 Meus Holerites ({holerites.length})
              </button>
              <button
                onClick={() => setAbaAtiva('atendimento')}
                style={{ padding: '10px 18px', border: 'none', borderBottom: abaAtiva === 'atendimento' ? '3px solid #003366' : 'none', background: 'transparent', color: abaAtiva === 'atendimento' ? '#003366' : '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
              >
                💬 Fale com o RH / DP
              </button>
            </div>

            {/* ABA 1: LISTAGEM DE HOLERITES */}
            {abaAtiva === 'holerites' && (
              <div>
                {holerites.length === 0 ? (
                  <div style={{ background: '#fff', padding: '36px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '32px' }}>📂</span>
                    <h3 style={{ color: '#475569', margin: '12px 0 6px 0' }}>Nenhum demonstrativo encontrado</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: 0 }}>
                      Não há holerites disponibilizados para este CPF até o momento. Caso tenha dúvidas, utilize a aba de atendimento.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {holerites.map((h) => (
                      <div
                        key={h.id}
                        style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}
                      >
                        <div>
                          <strong style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>
                            Competência: {h.competence}
                          </strong>
                          <small style={{ color: '#64748b', fontSize: '12.5px' }}>
                            Matrícula: {h.registration_number || 'Padrão'} • Emissor: Açúcar e Álcool Bandeirantes S.A.
                          </small>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a
                            href={h.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            style={{ padding: '8px 16px', background: '#0c5e31', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            ⬇️ Baixar / Ver PDF
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: CANAL DE ATENDIMENTO RH/DP */}
            {abaAtiva === 'atendimento' && (
              <div style={{ background: '#fff', padding: '24px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#003366', fontSize: '18px' }}>Central de Ajuda & Dúvidas</h3>
                <p style={{ margin: '0 0 18px 0', color: '#64748b', fontSize: '13.5px' }}>
                  Envie sua solicitação diretamente para o WhatsApp oficial do Departamento Pessoal da USIBAN.
                </p>

                <div style={{ display: 'grid', gap: '14px', maxWidth: '520px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Tipo de Solicitação:
                    </label>
                    <select
                      value={assuntoSuporte}
                      onChange={e => setAssuntoSuporte(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    >
                      <option value="Dúvida sobre Holerite / Descontos">Dúvida sobre Holerite / Descontos</option>
                      <option value="Informações sobre Férias">Informações sobre Férias</option>
                      <option value="Informe de Rendimentos / IRPF">Informe de Rendimentos / IRPF</option>
                      <option value="Atualização Cadastral (Endereço, Banco, Telefone)">Atualização Cadastral</option>
                      <option value="Benefícios (Plano de Saúde, VT, VR)">Benefícios</option>
                      <option value="Outro Assunto">Outro Assunto</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Descreva resumidamente sua dúvida (opcional):
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Gostaria de entender o desconto de adiantamento na folha de Outubro."
                      value={mensagemSuporte}
                      onChange={e => setMensagemSuporte(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAbrirWhatsAppDP}
                    style={{ padding: '12px 18px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    📱 Iniciar Conversa no WhatsApp com o DP
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
