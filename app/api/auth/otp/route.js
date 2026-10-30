import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  );
}

// 1. SOLICITAR CÓDIGO OTP (POST)
export async function POST(request) {
  try {
    const { cpf } = await request.json();
    const rawCpf = (cpf || '').replace(/\D/g, '');

    if (!rawCpf || rawCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Localiza o colaborador na base para recuperar o telefone
    const { data: candidato } = await supabase
      .from('onboarding_candidates')
      .select('full_name, phone, custom_data')
      .filter('custom_data->>CPF', 'eq', rawCpf)
      .maybeSingle();

    let telefone = candidato?.phone || candidato?.custom_data?.['WhatsApp / Telefone'] || candidato?.custom_data?.['Telefone'] || '';
    telefone = telefone.replace(/\D/g, '');

    // Se não encontrou em R&S, pesquisa na lista de convites
    if (!telefone) {
      const { data: convite } = await supabase
        .from('admission_invites')
        .select('phone')
        .eq('status', 'Enviado')
        .limit(1)
        .maybeSingle();
      if (convite) telefone = convite.phone.replace(/\D/g, '');
    }

    if (!telefone || telefone.length < 10) {
      return NextResponse.json({ 
        error: 'Nenhum telefone móvel localizado para este CPF. Entre em contato com o Departamento Pessoal.' 
      }, { status: 404 });
    }

    if (!telefone.startsWith('55') && telefone.length <= 11) {
      telefone = '55' + telefone;
    }

    // Gera código de segurança numérico de 6 dígitos
    const codigoOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos de validade

    // Invalida códigos anteriores não usados deste CPF
    await supabase
      .from('employee_otp_codes')
      .update({ used: true })
      .eq('cpf', rawCpf);

    // Salva o novo código
    await supabase.from('employee_otp_codes').insert([
      {
        cpf: rawCpf,
        code: codigoOtp,
        phone: telefone,
        expires_at: expiraEm,
        used: false
      }
    ]);

    // Mascara o número (ex: (43) 998**-**21)
    const ddd = telefone.slice(2, 4);
    const ultimos = telefone.slice(-2);
    const foneMascarado = `(${ddd}) *****-**${ultimos}`;

    const textoWhatsApp = `🔒 *USIBAN - Código de Acesso ao Holerite*\n\nSeu código de segurança é: *${codigoOtp}*\n\nEle expira em 5 minutos. Não compartilhe este código com ninguém.`;

    return NextResponse.json({
      success: true,
      phoneMasked: foneMascarado,
      phoneRaw: telefone,
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

    // Invalida o código utilizado
    await supabase
      .from('employee_otp_codes')
      .update({ used: true })
      .eq('id', otpValido.id);

    // Consulta os holerites do colaborador
    const { data: payrolls } = await supabase
      .from('employee_payrolls')
      .select('*')
      .eq('cpf', rawCpf)
      .order('competence', { ascending: false });

    // Gera Signed URLs com expiração em 900s (15 min) para cada holerite
    const holeritesProtegidos = [];
    for (const h of (payrolls || [])) {
      const safeComp = h.competence.replace('/', '-');
      const filePath = `${safeComp}/${rawCpf}.pdf`;

      const { data: signedData } = await supabase.storage
        .from('holerites')
        .createSignedUrl(filePath, 900);

      holeritesProtegidos.push({
        id: h.id,
        competence: h.competence,
        employee_name: h.employee_name,
        registration_number: h.registration_number,
        file_url: signedData ? signedData.signedUrl : null
      });
    }

    return NextResponse.json({
      success: true,
      employeeName: holeritesProtegidos[0]?.employee_name || 'Colaborador',
      payrolls: holeritesProtegidos
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
