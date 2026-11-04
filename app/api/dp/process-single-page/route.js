import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
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

function extrairCabecalhoSenior(pageText) {
  let matricula = null;
  let nomeEncontrado = 'Colaborador';
  const textoLinear = pageText.replace(/[\r\n]+/g, ' ');

  const matchMatricula = textoLinear.match(/\b(\d{1,6}\.\d{4,8})\b/);
  if (matchMatricula) {
    matricula = matchMatricula[1].trim();
  }

  const regexAntesDaData = new RegExp('([A-ZÀ-Ú][A-ZÀ-Ú\\s]{3,60}?)\\s*\\d{2}/\\d{2}/\\d{4}');
  const matchNome = textoLinear.match(regexAntesDaData);

  if (matchNome && matchNome[1]) {
    const nomeLimpo = sanitizarNome(matchNome[1]);
    if (nomeLimpo.length >= 3) {
      nomeEncontrado = nomeLimpo;
    }
  }

  if (nomeEncontrado === 'Colaborador' && matricula) {
    const regexAposMatricula = new RegExp(matricula.replace('.', '\\.') + '\\s*([A-ZÀ-Ú][A-ZÀ-Ú\\s]{3,50})');
    const matchAlt = textoLinear.match(regexAposMatricula);
    if (matchAlt && matchAlt[1]) {
      const nomeLimpo = sanitizarNome(matchAlt[1]);
      if (nomeLimpo.length >= 3) {
        nomeEncontrado = nomeLimpo;
      }
    }
  }

  return { matricula, nomeEncontrado };
}

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await request.formData();
    const file = formData.get('file');
    const competence = formData.get('competence') || '';

    if (!file || !competence) {
      return NextResponse.json({ error: 'Parâmetros incompletos.' }, { status: 400 });
    }

    const singlePdfBytes = Buffer.from(await file.arrayBuffer());
    const parsedText = await pdfParse(singlePdfBytes);
    const pageText = parsedText.text;

    // Extração do CPF
    const cpfMatch = pageText.match(/(?:CPF|cpf)[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                  || pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
                  || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);

    const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

    if (!rawCpf || rawCpf.length !== 11) {
      return NextResponse.json({ skipped: true, reason: 'CPF não identificado' });
    }

    const { matricula, nomeEncontrado } = extrairCabecalhoSenior(pageText);

    // Salvar arquivo no Supabase Storage
    const safeCompetence = competence.replace('/', '-');
    const fileName = `${safeCompetence}/${rawCpf}.pdf`;

    await supabase.storage
      .from('holerites')
      .upload(fileName, singlePdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    const { data: publicUrlData } = supabase.storage
      .from('holerites')
      .getPublicUrl(fileName);

    // Upsert no banco de dados
    const { data: existente } = await supabase
      .from('employee_payrolls')
      .select('id')
      .eq('cpf', rawCpf)
      .eq('competence', competence)
      .maybeSingle();

    if (existente) {
      await supabase
        .from('employee_payrolls')
        .update({
          employee_name: nomeEncontrado,
          registration_number: matricula,
          file_url: publicUrlData.publicUrl,
          status: 'Pendente'
        })
        .eq('id', existente.id);
    } else {
      await supabase
        .from('employee_payrolls')
        .insert([
          {
            employee_name: nomeEncontrado,
            cpf: rawCpf,
            registration_number: matricula,
            competence: competence,
            file_url: publicUrlData.publicUrl,
            status: 'Pendente'
          }
        ]);
    }

    return NextResponse.json({ success: true, cpf: rawCpf, name: nomeEncontrado });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
