import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  );
}

// 1. SOLICITAR CÓDIGO OTP (POST) - EXCLUSIVO TABELA EMPLOYEES
export async function POST(request) {
  try {
    const { cpf } = await request.json();
    const rawCpf = (cpf || '').replace(/\D/g, '');

    if (!rawCpf || rawCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Consulta restrita à base de funcionários ativos importados do Senior
    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('full_name, phone, email, is_active')
      .eq('cpf', rawCpf)
      .maybeSingle();

    if (empError) {
      throw empError;
    }

    if (!emp) {
      return NextResponse.json({ 
        error: 'CPF não localizado no quadro de colaboradores ativos da USIBAN. Procure o Departamento Pessoal.' 
      }, { status: 404 });
    }

    if (!emp.is_active) {
      return NextResponse.json({ 
        error: 'Cadastro inativo. Entre em contato com o Departamento Pessoal.' 
      }, { status: 403 });
    }

    let telefone = (emp.phone || '').replace(/\D/g, '');

    if (!telefone || telefone.length < 10) {
      return NextResponse.json({ 
        error: 'Nenhum celular cadastrado para este colaborador. Solicite a inclusão do número junto ao DP.' 
      }, { status: 404 });
    }

    if (!telefone.startsWith('55') && telefone.length <= 11) {
      telefone = '55' + telefone;
    }

    // Gera código numérico de uso único (6 dígitos)
    const codigoOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos

    // Invalida tokens anteriores não utilizados deste CPF
    await supabase
      .from('employee_otp_codes')
      .update({ used: true })
      .eq('cpf', rawCpf);

    // Registra o token gerado
    await supabase.from('employee_otp_codes').insert([
      {
        cpf: rawCpf,
        code: codigoOtp,
        phone: telefone,
        expires_at: expiraEm,
        used: false
      }
    ]);

    // Mascara o número para exibição segura na tela
    const ddd = telefone.slice(2, 4);
    const ultimos = telefone.slice(-2);
    const foneMascarado = `(${ddd}) *****-**${ultimos}`;

    const textoWhatsApp = `🔒 *USIBAN - Código de Acesso ao Demonstrativo*\n\nOlá ${emp.full_name.split(' ')[0]}, seu código de segurança é: *${codigoOtp}*\n\nEle expira em 5 minutos. Não compartilhe com terceiros.`;

    return NextResponse.json({
      success: true,
      phoneMasked: foneMascarado,
      phoneRaw: telefone,
      emailAvailable: !!emp.email,
      whatsappUrl: `https://wa.me/${telefone}?text=${encodeURIComponent(textoWhatsApp)}`
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. VALIDAR CÓDIGO E GERAR SIGNED URLS DE 15 MINUTOS (PUT)
export async function PUT(request) {
  try {
    const { cpf, code } = await request.json();
    const rawCpf = (cpf || '').replace(/\D/g, '');
    const cleanCode = (code || '').trim();

    const supabase = getSupabase();

    // Valida token temporário ativo
    const { data: otpValido } = await supabase
      .from('employee_otp_codes')
      .select('*')
      .eq('cpf', rawCpf)
      .eq('code', cleanCode)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!otpValido) {
      return NextResponse.json({ error: 'Código de segurança incorreto ou expirado.' }, { status: 401 });
    }

    // Invalida o token após uso
    await supabase
      .from('employee_otp_codes')
      .update({ used: true })
      .eq('id', otpValido.id);

    // Busca os holerites do colaborador
    const { data: payrolls } = await supabase
      .from('employee_payrolls')
      .select('*')
      .eq('cpf', rawCpf)
      .order('competence', { ascending: false });

    // Busca o nome do colaborador direto de employees
    const { data: emp } = await supabase
      .from('employees')
      .select('full_name')
      .eq('cpf', rawCpf)
      .maybeSingle();

    // Gera links protegidos sob demanda para a nova rota /api/dp/get-pdf
    const holeritesProtegidos = (payrolls || []).map(h => ({
      id: h.id,
      competence: h.competence,
      employee_name: emp?.full_name || h.employee_name,
      registration_number: h.registration_number,
      file_url: `/api/dp/get-pdf?cpf=${rawCpf}&competence=${encodeURIComponent(h.competence)}`
    }));

    return NextResponse.json({
      success: true,
      employeeName: emp?.full_name || holeritesProtegidos[0]?.employee_name || 'Colaborador',
      payrolls: holeritesProtegidos
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
