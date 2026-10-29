import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

// Impede o Next.js de tentar pré-renderizar esta rota de API durante o build na Vercel
export const dynamic = 'force-dynamic';

// Lista de palavras fixas do formulário Senior que NUNCA fazem parte do nome
const PALAVRAS_RESERVADAS = [
  'DEMONSTRATIVO', 'PAGAMENTO', 'SALARIO', 'SALÁRIO', 'EMPRESA', 'ACUCAR', 'AÇÚCAR',
  'ALCOOL', 'ÁLCOOL', 'BANDEIRANTES', 'CADASTRO', 'NOME', 'DATA', 'ADMISSAO', 'ADMISSÃO',
  'CARGO', 'LOCAL', 'REFERENCIA', 'REFERÊNCIA', 'CREDITOS', 'CRÉDITOS', 'DESCONTOS',
  'DESCRICAO', 'DESCRIÇÃO', 'VALOR', 'LIQUIDO', 'LÍQUIDO', 'BASE', 'INSS', 'FGTS', 'IRRF', 'CNPJ'
];

function limparNomeExtraido(textoBruto) {
  if (!textoBruto) return '';
  let limpo = textoBruto
    .replace(/[0-9.\-_\/]/g, ' ') // Remove qualquer número, ponto ou barra
    .replace(/\s+/g, ' ')
    .trim();

  // Remove palavras reservadas caso alguma tenha ficado colada
  const palavras = limpo.split(' ').filter(p => {
    const pUpper = p.toUpperCase();
    return pUpper.length > 1 && !PALAVRAS_RESERVADAS.includes(pUpper);
  });

  return palavras.join(' ').trim();
}

function extrairDadosSeniorHCM(pageText) {
  let matricula = null;
  let nomeEncontrado = 'Colaborador';

  // Transforma quebras de linha em espaços para leitura linear
  const flatText = pageText.replace(/[\r\n]+/g, ' ');

  // ESTRATÉGIA 1 (Principal): Procura [Matrícula com ponto: ex 1.015344 ou 101.015392] + [Nome] + [Data DD/MM/AAAA]
  const regexMatriculaNomeData = /(\d{1,5}\.\d{4,8})\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{3,60}?)\s*(\d{2}\/\d{2}\/\d{4})/;
  const match1 = flatText.match(regexMatriculaNomeData);

  if (match1) {
    matricula = match1[1].trim();
    const nomeLimpo = limparNomeExtraido(match1[2]);
    if (nomeLimpo.length >= 3) {
      return { matricula, nomeEncontrado: nomeLimpo };
    }
  }

  // ESTRATÉGIA 2: Qualquer sequência de letras maiúsculas imediatamente antes da Data de Admissão (DD/MM/AAAA)
  const regexAntesDaData = /([0-9.\-_]{3,12})?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,60}?)\s*\d{2}\/\d{2}\/\d{4}/g;
  let matchData;
  while ((matchData = regexAntesDaData.exec(flatText)) !== null) {
    const possivelMat = matchData[1] ? matchData[1].trim() : null;
    const possivelNome = limparNomeExtraido(matchData[2]);

    if (possivelNome.length >= 4) {
      if (possivelMat) matricula = possivelMat;
      nomeEncontrado = possivelNome;
      break;
    }
  }

  // ESTRATÉGIA 3: Procura diretamente pelo padrão de matrícula da Usiban (ex: 1.015344 ou 101.015392) e pega o nome a seguir
  if (nomeEncontrado === 'Colaborador' || !matricula) {
    const regexPorMatricula = /\b(\d{1,4}\.\d{5,7})\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,55})/;
    const matchMat = flatText.match(regexPorMatricula);
    if (matchMat) {
      matricula = matchMat[1].trim();
      const nomeLimpo = limparNomeExtraido(matchMat[2]);
      if (nomeLimpo.length >= 4) {
        nomeEncontrado = nomeLimpo;
      }
    }
  }

  return { matricula, nomeEncontrado };
}

export async function POST(request) {
  try {
    // Inicializa o cliente Supabase apenas em tempo de execução (evita erro de build na Vercel)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Variáveis de ambiente do Supabase não configuradas na Vercel.' },
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

    // Fatiamento página por página
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // 1. Extração do CPF no rodapé ("portador do CPF 225.083.378-89")
      const cpfMatch = pageText.match(/(?:CPF|cpf)[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                    || pageText.match(/\d{3}\.\d{3}\
