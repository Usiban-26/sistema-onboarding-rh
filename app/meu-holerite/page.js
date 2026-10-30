'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
);

export default function MeuHoleritePage() {
  const [etapa, setEtapa] = useState('cpf'); // 'cpf' | 'otp' | 'liberado'
  const [cpf, setCpf] = useState('');
  const [codigoOtp, setCodigoOtp] = useState('');
  const [telefoneMascarado, setTelefoneMascarado] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  
  const [colaboradorNome, setColaboradorNome] = useState('');
  const [holerites, setHolerites] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('holerites');
  const [assuntoSuporte, setAssuntoSuporte] = useState('Dúvida sobre Holerite / Descontos');
  const [mensagemSuporte, setMensagemSuporte] = useState('');

  // Telefone dinâmico configurado no Painel Admin
  const [telefoneDp, setTelefoneDp] = useState('5543999999999');

  useEffect(() => {
    async function carregarConfiguracoes() {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp_dp_phone')
        .maybeSingle();

      if (data && data.value) {
        setTelefoneDp(data.value.replace(/\D/g, ''));
      }
    }
    carregarConfiguracoes();
  }, []);

  function formatarCpf(valor) {
    return valor
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  }

  async function handleSolicitarOtp(e) {
    e.preventDefault();
    setErro('');
    const rawCpf = cpf.replace(/\D/g, '');

    if (rawCpf.length !== 11) {
      setErro('Informe um CPF válido com 11 dígitos.');
      return;
    }

    setCarregando(true);

    try {
      const resp = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: rawCpf })
      });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao gerar código de segurança.');
      }

      setTelefoneMascarado(data.phoneMasked);
      setWhatsappLink(data.whatsappUrl);
      setEtapa('otp');

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleValidarOtp(e) {
    e.preventDefault();
    setErro('');

    if (codigoOtp.length !== 6) {
      setErro('O código de segurança possui 6 dígitos.');
      return;
    }

    setCarregando(true);

    try {
      const resp = await fetch('/api/auth/otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ''), code: codigoOtp })
      });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Código incorreto ou expirado.');
      }

      setColaboradorNome(data.employeeName);
      setHolerites(data.payrolls || []);
      setEtapa('liberado');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  function handleAbrirWhatsAppDP() {
    let fone = telefoneDp;
    if (!fone.startsWith('55') && fone.length <= 11) fone = '55' + fone;

    const texto = `Olá, equipe de DP/RH da Usina Bandeirante (USIBAN).\n\n*Solicitação de Atendimento:*\n👤 *Colaborador:* ${colaboradorNome}\n🪪 *CPF:* ${cpf}\n📌 *Assunto:* ${assuntoSuporte}\n\n💬 *Mensagem:* ${mensagemSuporte || 'Gostaria de um esclarecimento sobre minha folha.'}`;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(texto)}`, '_blank');
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: '24px 16px', color: '#1e293b' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        
        {/* Topo Institucional */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/logo-usiban.png" alt="USIBAN" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '80px', height: 'auto', marginBottom: '10px' }} />
          <h1 style={{ margin: 0, color: '#0c5e31', fontSize: '24px', fontWeight: '800' }}>Central do Colaborador</h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Usina Bandeirante (USIBAN) • Acesso Seguro ao Demonstrativo de Pagamento
          </p>
        </div>

        {/* ETAPA 1: DIGITAR CPF */}
        {etapa === 'cpf' && (
          <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: '18px', color: '#0c5e31', margin: '0 0 8px 0' }}>🔐 Acesso Seguro ao Contracheque</h2>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 18px 0' }}>
              Para garantir a total privacidade dos seus rendimentos, enviaremos um código de uso único (OTP) para o seu WhatsApp cadastrado.
            </p>

            <form onSubmit={handleSolicitarOtp} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
                  Digite o seu CPF:
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={e => setCpf(formatarCpf(e.target.value))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px' }}
                />
              </div>

              {erro && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px' }}>
                  ⚠️ {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={carregando}
                style={{ padding: '13px', background: carregando ? '#94a3b8' : '#0c5e31', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: carregando ? 'not-allowed' : 'pointer' }}
              >
                {carregando ? 'Localizando cadastro...' : '📲 Enviar Código para meu WhatsApp'}
              </button>
            </form>
          </div>
        )}

        {/* ETAPA 2: DIGITAR CÓDIGO OTP */}
        {etapa === 'otp' && (
          <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: '18px', color: '#0c5e31', margin: '0 0 8px 0' }}>📲 Confirmação de Identidade</h2>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 16px 0' }}>
              Enviamos um código de 6 dígitos para o número <b>{telefoneMascarado}</b> via WhatsApp.
            </p>

            <form onSubmit={handleValidarOtp} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
                  Digite o código recebido:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={codigoOtp}
                  onChange={e => setCodigoOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: '2px solid #0c5e31', fontSize: '20px', letterSpacing: '6px', textAlign: 'center', fontWeight: 'bold' }}
                />
              </div>

              {erro && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px' }}>
                  ⚠️ {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={carregando}
                style={{ padding: '13px', background: carregando ? '#94a3b8' : '#0c5e31', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: carregando ? 'not-allowed' : 'pointer' }}
              >
                {carregando ? 'Validando...' : '🔓 Acessar Meus Holerites'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEtapa('cpf')}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}
                >
                  ← Trocar CPF
                </button>

                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#25D366', fontWeight: 'bold', textDecoration: 'none', fontSize: '13px' }}
                  >
                    Reabrir conversa no WhatsApp ↗
                  </a>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ETAPA 3: HOLERITES LIBERADOS (SIGNED URLS) */}
        {etapa === 'liberado' && (
          <div>
            <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <small style={{ color: '#0c5e31', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sessão Segura Ativa</small>
                <h3 style={{ margin: 0, color: '#0c5e31', fontSize: '18px' }}>{colaboradorNome}</h3>
              </div>
              <button
                onClick={() => { setEtapa('cpf'); setCodigoOtp(''); setHolerites([]); }}
                style={{ padding: '6px 12px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Encerrar Sessão
              </button>
            </div>

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

            {abaAtiva === 'holerites' && (
              <div>
                {holerites.length === 0 ? (
                  <div style={{ background: '#fff', padding: '36px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b' }}>Nenhum demonstrativo encontrado para seu CPF até o momento.</p>
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
                            Matrícula: {h.registration_number || 'Padrão'} • Link protegido temporário (15 min)
                          </small>
                        </div>

                        {h.file_url ? (
                          <a
                            href={h.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ padding: '8px 16px', background: '#0c5e31', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            ⬇️ Baixar / Ver PDF Seguro
                          </a>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#b91c1c' }}>Arquivo indisponível</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'atendimento' && (
              <div style={{ background: '#fff', padding: '24px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#003366', fontSize: '18px' }}>Central de Ajuda & Dúvidas</h3>
                <div style={{ display: 'grid', gap: '14px', maxWidth: '520px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Tipo de Solicitação:
                    </label>
                    <select
                      value={assuntoSuporte}
                      onChange={e => setAssuntoSuporte(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="Dúvida sobre Holerite / Descontos">Dúvida sobre Holerite / Descontos</option>
                      <option value="Informações sobre Férias">Informações sobre Férias</option>
                      <option value="Informe de Rendimentos / IRPF">Informe de Rendimentos / IRPF</option>
                      <option value="Atualização Cadastral">Atualização Cadastral</option>
                      <option value="Benefícios">Benefícios</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Descreva resumidamente sua dúvida:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Descreva sua solicitação..."
                      value={mensagemSuporte}
                      onChange={e => setMensagemSuporte(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAbrirWhatsAppDP}
                    style={{ padding: '12px 18px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    📱 Enviar Dúvida no WhatsApp do DP
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
