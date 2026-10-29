import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PALAVRAS_RESERVADAS = [
  'DEMONSTRATIVO', 'PAGAMENTO', 'SALARIO', 'SALÁRIO', 'EMPRESA', 'ACUCAR', 'AÇÚCAR',
  'ALCOOL', 'ÁLCOOL', 'BANDEIRANTES', 'CADASTRO', 'NOME', 'DATA', 'ADMISSAO', 'ADMISSÃO',
  'CARGO', 'LOCAL', 'REFERENCIA', 'REFERÊNCIA', 'CREDITOS', 'CRÉDITOS', 'DESCONTOS',
  'DESCRICAO', 'DESCRIÇÃO', 'VALOR', 'LIQUIDO', 'LÍQUIDO', 'BASE', 'INSS', 'FGTS', 'IRRF', 'CNPJ'
];

function limparNomeExtraido(textoBruto) {
  if (!textoBruto) return '';
  const limpo = textoBruto
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const palavras = limpo.split(' ').filter(p => {
    const pUpper = p.toUpperCase();
    return pUpper.length > 1 && !PALAVRAS_RESERVADAS.includes(pUpper);
  });

  return palavras.join(' ').trim();
}

function extrairDadosSeniorHCM(pageText) {
  let matricula = null;
  let nomeEncontrado = 'Colaborador';

  const flatText = pageText.replace(/[\r\n]+/g, ' ');

  // Estratégia 1: Matrícula com ponto (ex: 1.015344 ou 101.015392) + Nome + Data DD/MM/AAAA
  const r1 = new RegExp('(\\d{1,5}\\.\\d{4,8})\\s*([A-ZÀ-Ú][A-ZÀ-Ú\\s]{3,60}?)\\s*(\\d{2}/\\d{2}/\\d{4})');
  const m1 = flatText.match(r1);

  if (m1) {
    matricula = m1[1].trim();
    const nomeLimpo = limparNomeExtraido(m1[2]);
    if (nomeLimpo.length >= 3) {
      return { matricula, nomeEncontrado: nomeLimpo };
    }
  }

  // Estratégia 2: Letras maiúsculas imediatamente antes da Data de Admissão (DD/MM/AAAA)
  const r2 = new RegExp('([0-9.\\-_]{3,12})?\\s*([A-ZÀ-Ú][A-ZÀ-Ú\\s]{4,60}?)\\s*\\d{2}/\\d{2}/\\d{4}', 'g');
  let m2;
  while ((m2 = r2.exec(flatText)) !== null) {
    const possivelMat = m2[1] ? m2[1].trim() : null;
    const possivelNome = limparNomeExtraido(m2[2]);

    if (possivelNome.length >= 4) {
      if (possivelMat) matricula = possivelMat;
      nomeEncontrado = possivelNome;
      break;
    }
  }

  // Estratégia 3: Busca direta pelo padrão de matrícula pontuada + Nome
  if (nomeEncontrado === 'Colaborador' || !matricula) {
    const r3 = new RegExp('\\b(\\d{1,4}\\.\\d{5,7})\\s*([A-ZÀ-Ú][A-ZÀ-Ú\\s]{4,55})');
    const m3 = flatText.match(r3);
    if (m3) {
      matricula = m3[1].trim();
      const nomeLimpo = limparNomeExtraido(m3[2]);
      if (nomeLimpo.length >= 4) {
        nomeEncontrado = nomeLimpo;
      }
    }
  }

  return { matricula, nomeEncontrado };
}

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Variáveis de ambiente do Supabase não configuradas.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await request.formData();
    const file = formData.get('file');
    const competence = formData.get('competence') || '';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    if (!competence) {
      return NextResponse.json({ error: 'Nenhuma competência selecionada.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const originalPdfDoc = await PDFDocument.load(fileBuffer);
    const totalPages = originalPdfDoc.getPageCount();

    if (totalPages === 0) {
      return NextResponse.json({ error: 'O PDF enviado está vazio.' }, { status: 400 });
    }

    const processados = [];
    const atualizados = [];

    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // 1. Extração segura do CPF
      const rCpf1 = new RegExp('(?:CPF|cpf)[^\\d]*(\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2})', 'i');
      const rCpf2 = new RegExp('\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}');
      const rCpf3 = new RegExp('(?:\\D|^)(\\d{11})(?:\\D|$)');

      const cpfMatch = pageText.match(rCpf1) || pageText.match(rCpf2) || pageText.match(rCpf3);
      const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

      if (!rawCpf || rawCpf.length !== 11) {
        continue;
      }

      // 2. Extração de Matrícula e Nome
      const { matricula, nomeEncontrado } = extrairDadosSeniorHCM(pageText);

      // 3. Prevenção de duplicidade (Upsert)
      const { data: existente } = await supabase
        .from('employee_payrolls')
        .select('id')
        .eq('cpf', rawCpf)
        .eq('competence', competence)
        .maybeSingle();

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

        atualizados.push(rawCpf);
      } else {
        const { data:
