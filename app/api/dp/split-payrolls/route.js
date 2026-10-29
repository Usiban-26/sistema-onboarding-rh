import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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
  // Funciona mesmo que matrícula, nome e data estejam colados sem espaço!
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
                    || pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
                    || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);

      const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

      if (!rawCpf || rawCpf.length !== 11) {
        continue;
      }

      // 2. Extração de Matrícula e Nome ancorada na Matrícula Pontuada e na Data de Admissão
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
        const { data: dbData } = await supabase
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
          ])
          .select()
          .single();

        if (dbData) processados.push(dbData);
      }
    }

    return NextResponse.json({
      success: true,
      totalPages,
      processedCount: processados.length,
      updatedCount: atualizados.length,
      message: `${processados.length} novos holerites importados e ${atualizados.length} atualizados com sucesso.`
    });
  } catch (error) {
    console.error('Erro ao processar PDF do Senior HCM:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
