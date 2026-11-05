import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PALAVRAS_BLOQUEADAS = [
  'DEMONSTRATIVO', 'PAGAMENTO', 'SALARIO', 'SALÁRIO', 'EMPRESA', 'ACUCAR', 'AÇÚCAR',
  'ALCOOL', 'ÁLCOOL', 'BANDEIRANTES', 'CADASTRO', 'NOME', 'DATA', 'ADMISSAO', 'ADMISSÃO',
  'CARGO', 'LOCAL', 'REFERENCIA', 'REFERÊNCIA', 'CREDITOS', 'CRÉDITOS', 'DESCONTOS',
  'DESCRICAO', 'DESCRIÇÃO', 'VALOR', 'LIQUIDO', 'LÍQUIDO', 'BASE', 'INSS', 'FGTS', 'IRRF', 'CNPJ'
];

function sanitizarNome(texto) {
  if (!texto) return '';
  let limpo = texto.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const palavras = limpo.split(' ').filter(p => {
    const pUpper = p.toUpperCase();
    return pUpper.length > 1 && !PALAVRAS_BLOQUEADAS.includes(pUpper);
  });
  return palavras.join(' ').trim();
}

function extrairDadosSenior(pageText) {
  let matricula = null;
  let nomeEncontrado = 'Colaborador';
  const flat = pageText.replace(/[\r\n]+/g, ' ');

  // 1. Extração da Matrícula:
  // Padrão A: Com ponto (ex: 101.014698, 1.015344)
  const matchPonto = flat.match(/\b(\d{1,6}\.\d{4,8})\b/);
  if (matchPonto) {
    matricula = matchPonto[1].trim();
  } else {
    // Padrão B: 4 a 7 dígitos antecedendo o nome e a data (ex: 25150 ZILDA DE FATIMA... 16/05/2024)
    const matchSimples = flat.match(/\b(\d{4,7})\s+([A-ZÀ-Ú][A-ZÀ-Ú\s]{3,50}?)\s+\d{2}\/\d{2}\/\d{4}/);
    if (matchSimples) {
      matricula = matchSimples[1].trim();
      nomeEncontrado = sanitizarNome(matchSimples[2]);
    } else {
      // Padrão C: Número isolado logo após a palavra CADASTRO
      const matchPosCadastro = flat.match(/CADASTRO\s*[:.-]?\s*(\d{4,8})\b/i);
      if (matchPosCadastro) {
        matricula = matchPosCadastro[1].trim();
      }
    }
  }

  // 2. Extração do Nome (se ainda não achado no Padrão B)
  if (nomeEncontrado === 'Colaborador') {
    const matchNome = flat.match(/([A-ZÀ-Ú][A-ZÀ-Ú\s]{3,60}?)\s*\d{2}\/\d{2}\/\d{4}/);
    if (matchNome && matchNome[1]) {
      const n = sanitizarNome(matchNome[1]);
      if (n.length >= 3) nomeEncontrado = n;
    }
  }

  return { matricula, nomeEncontrado };
}

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pageText, competence } = await request.json();

    if (!pageText || !competence) {
      return NextResponse.json({ error: 'Texto ou competência ausente.' }, { status: 400 });
    }

    // Extração do CPF no rodapé
    const cpfMatch = pageText.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/)
                  || pageText.match(/(?:CPF|cpf)[^\d]{0,20}(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                  || pageText.match(/\b(\d{11})\b/);

    const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

    if (!rawCpf || rawCpf.length !== 11) {
      const amostra = pageText.slice(0, 150).replace(/\s+/g, ' ');
      return NextResponse.json({ error: `Sem CPF válido. Amostra: "${amostra}"` }, { status: 422 });
    }

    let { matricula, nomeEncontrado } = extrairDadosSenior(pageText);

    // Fallback inteligente: se faltou matrícula ou nome, busca na base oficial de funcionários
    const { data: colab } = await supabase
      .from('employees')
      .select('registration_number, full_name')
      .eq('cpf', rawCpf)
      .maybeSingle();

    if (colab) {
      if (!matricula && colab.registration_number) matricula = colab.registration_number;
      if (nomeEncontrado === 'Colaborador' && colab.full_name) nomeEncontrado = colab.full_name;
    }

    const safeCompetence = competence.replace('/', '-');
    const fileName = `${safeCompetence}/${rawCpf}.pdf`;

    // Gravação no banco
    const { error: dbError } = await supabase
      .from('employee_payrolls')
      .upsert({
        cpf: rawCpf,
        employee_name: nomeEncontrado,
        registration_number: matricula,
        competence: competence,
        file_url: fileName,
        status: 'Pendente'
      }, { onConflict: 'cpf,competence' });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cpf: rawCpf,
      name: nomeEncontrado,
      matricula,
      fileName
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
