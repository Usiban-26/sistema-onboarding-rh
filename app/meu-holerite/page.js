'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

function aplicarMascaraCPF(valor) {
  let v = valor.replace(/\D/g, '').slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export default function MeuHoleritePage() {
  const [cpf, setCpf] = useState('');
  const [anoNascimento, setAnoNascimento] = useState('');
  const [loading, setLoading] = useState(false);
  const [colaboradorAutenticado, setColaboradorAutenticado] = useState(false);
  const [dadosColaborador, setDadosColaborador] = useState(null);
  const [holerites, setHolerites] = useState([]);
  const [erro, setErro] = useState('');

  async function handleConsultar(e) {
    e.preventDefault();
    setErro('');

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErro('Digite um CPF válido com 11 dígitos.');
      return;
    }

    if (anoNascimento.length !== 4) {
      setErro('Informe o ano de nascimento com 4 dígitos (Ex: 1985).');
      return;
    }

    setLoading(true);

    try {
      // 1. Busca os holerites vinculados ao CPF
      const { data: payrollData, error: payrollError } = await supabase
        .from('employee_payrolls')
        .select('*')
        .eq('cpf', cpfLimpo)
        .order('created_at', { ascending: false });

      if (payrollError) throw payrollError;

      if (!payrollData || payrollData.length === 0) {
        setErro('Nenhum demonstrativo de pagamento encontrado para este CPF.');
        setLoading(false);
        return;
      }

      // 2. Confirmação de segurança: checa ano de nascimento com base no cadastro do funcionário
      const { data: candData } = await supabase
        .from('onboarding_candidates')
        .select('*');

      const cadastro = candData?.find(c => {
        const cCpf = (c.custom_data?.['CPF'] || '').replace(/\D/g, '');
        return cCpf === cpfLimpo;
      });

      if (cadastro) {
        const dataNasc = cadastro.custom_data?.['Data de Nascimento'] || '';
        // Valida se o ano informado bate com a data cadastrada
        if (dataNasc && !dataNasc.includes(anoNascimento)) {
          setErro('Dados de confirmação incorretos. Verifique o ano de nascimento.');
          setLoading(false);
          return;
        }
      }

      setHolerites(payrollData);
      setDadosColaborador({
        nome: payrollData[0].employee_name || 'Colaborador',
        cpf: cpf,
        matricula: payrollData[0].registration_number || '-'
      });
      setColaboradorAutenticado(true);
    } catch (err) {
      setErro('Erro ao consultar dados: ' + err.message);
    }

    setLoading(false);
  }

  function handleSair() {
    setColaboradorAutenticado(false);
    setCpf('');
    setAnoNascimento('');
    setHolerites([]);
    setDadosColaborador(null);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f4f6f5', padding: '30px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      
      {/* Cabeçalho Institucional */}
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <img 
          src="/logo-usiban.png" 
          alt="Usina Bandeirante - USIBAN" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
          style={{ width: '120px', height: 'auto', marginBottom: '12px' }} 
        />
        <h1 style={{ color: '#003366', margin: '0 0 6px 0', fontSize: '24px', fontWeight: '800' }}>
          Portal do Colaborador • Demonstrativo de Pagamento
        </h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '13.5px' }}>
          Açúcar e Álcool Bandeirantes S.A. • USIBAN
        </p>
      </header>

      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {!colaboradorAutenticado ? (
          /* Formulário de Identificação e Consulta */
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#003366', height: '6px' }}></div>
            <div style={{ padding: '28px' }}>
              <h2 style={{ fontSize: '18px', color: '#003366', marginTop: 0, marginBottom: '6px' }}>
                Consultar Meus Holerites
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0, marginBottom: '20px' }}>
                Informe seu CPF e o ano de nascimento para acessar seus recibos de pagamento de forma segura.
              </p>

              {erro && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                  ⚠️ {erro}
                </div>
              )}

              <form onSubmit={handleConsultar} style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>
                    CPF do Colaborador
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(aplicarMascaraCPF(e.target.value))}
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>
                    Ano de Nascimento (4 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Ex: 1990"
                    value={anoNascimento}
                    onChange={(e) => setAnoNascimento(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: loading ? '#64748b' : '#003366',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Consultando...' : 'Acessar Demonstrativos'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Área Logada do Colaborador */
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#003366', fontSize: '18px' }}>
                  {dadosColaborador.nome}
                </h2>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  CPF: {dadosColaborador.cpf} {dadosColaborador.matricula !== '-' ? `| Matrícula: ${dadosColaborador.matricula}` : ''}
                </span>
              </div>
              <button
                onClick={handleSair}
                style={{ padding: '6px 12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                Encerrar Acesso
              </button>
            </div>

            <h3 style={{ fontSize: '15px', color: '#0c5e31', margin: '0 0 12px 0' }}>
              Demonstrativos Disponíveis ({holerites.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {holerites.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      Competência: {h.competence}
                    </strong>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11.5px', marginTop: '2px' }}>
                      Disponibilizado em: {new Date(h.created_at).toLocaleDateString('pt-BR')}
                    </small>
                  </div>

                  <a
                    href={h.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: '#003366',
                      color: '#fff',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}
                  >
                    📥 Baixar Holerite (PDF)
                  </a>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', padding: '12px', background: '#f8faf9', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '12.5px', color: '#475569', textAlign: 'center' }}>
              Em caso de inconsistência de valores ou dúvidas sobre a folha, entre em contato diretamente com o Departamento Pessoal da Usiban.
            </div>
          </div>
        )}

        <footer style={{ textAlign: 'center', marginTop: '24px', color: '#94a3b8', fontSize: '12px' }}>
          <span>© {new Date().getFullYear()} Açúcar e Álcool Bandeirantes S.A. • USIBAN</span>
        </footer>
      </div>
    </main>
  );
}
