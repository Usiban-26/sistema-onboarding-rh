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

  return { matricula, nomeEncontrado };
}

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração do Supabase ausente.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await request.formData();
    const file = formData.get('file');
    const competence = formData.get('competence') || '';

    if (!file || !competence) {
      return NextResponse.json({ error: 'Arquivo ou competência não enviados.' }, { status: 400 });
    }

    const singlePdfBytes = Buffer.from(await file.arrayBuffer());
    const parsedText = await pdfParse(singlePdfBytes);
    const pageText = parsedText.text || '';

    // Regex abrangente para localizar o CPF no relatório Senior HCM:
    // 1. Formato pontuado clássico: 000.000.000-00
    // 2. Após a palavra CPF com espaços ou quebras
    // 3. Sequência de 11 dígitos numéricos isolados
    const cpfMatch = pageText.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/)
                  || pageText.match(/(?:CPF|cpf)[^\d]{0,20}(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                  || pageText.match(/\b(\d{11})\b/);

    const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

    if (!rawCpf || rawCpf.length !== 11) {
      // Devolve uma amostra do texto lido para diagnóstico imediato no alerta
      const previewTexto = pageText.slice(0, 300).replace(/\s+/g, ' ');
      return NextResponse.json({ 
        error: `CPF não encontrado na página. Texto extraído: "${previewTexto}"` 
      }, { status: 422 });
    }

    const { matricula, nomeEncontrado } = extrairCabecalhoSenior(pageText);

    // Salvar no bucket privado
    const safeCompetence = competence.replace('/', '-');
    const fileName = `${safeCompetence}/${rawCpf}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('holerites')
      .upload(fileName, singlePdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      return NextResponse.json({ error: `Falha no Supabase Storage: ${uploadError.message}` }, { status: 500 });
    }

    // Salvar na tabela employee_payrolls
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
      return NextResponse.json({ error: `Falha no banco: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, cpf: rawCpf, name: nomeEncontrado });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erro interno no processamento.' }, { status: 500 });
  }
}
