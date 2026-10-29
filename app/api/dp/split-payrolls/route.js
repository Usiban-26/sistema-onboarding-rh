import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Limpa títulos e rótulos do cabeçalho do Senior HCM para isolar apenas o nome e a matrícula
function extrairNomeEMatriculaSenior(pageText) {
  let matricula = null;
  let nomeEncontrado = 'Colaborador';

  // Transforma quebras de linha em espaço simples
  const textoUnico = pageText.replace(/[\r\n]+/g, ' ');

  // 1. Tenta isolar o bloco que fica entre o CNPJ (75.619.056/0001-28) e a palavra CARGO
  const matchBlocoCabecalho = textoUnico.match(/75\.619\.056\/0001-28([\s\S]*?)CARGO/i);
  const escopoBusca = matchBlocoCabecalho ? matchBlocoCabecalho[1] : textoUnico;

  // Remove os rótulos fixos do cabeçalho para sobrarem apenas: [Matrícula] [Nome] [Data Admissão]
  let limpo = escopoBusca
    .replace(/CADASTRO/gi, ' ')
    .replace(/NOME/gi, ' ')
    .replace(/DATA\s*ADMISS[AÃ]O/gi, ' ')
    .replace(/EMPRESA/gi, ' ')
    .replace(/ACUCAR\s*E\s*ALCOOL\s*BANDEIRANTES\s*S\.?A\.?/gi, ' ')
    .replace(/DEMONSTRATIVO\s*DE\s*PAGAMENTO\s*DE\s*SAL[AÁ]RIO/gi, ' ')
    .replace(/M[EÊ]S\s*\/\s*ANO/gi, ' ')
    .replace(/CNPJ/gi, ' ');

  // Remove datas no formato DD/MM/AAAA (mesmo que estejam coladas ao final do nome)
  limpo = limpo.replace(/\d{2}\/\d{2}\/\d{4}/g, ' ');

  // Remove competências no formato MM / AAAA
  limpo = limpo.replace(/\b\d{2}\s*\/\s*\d{4}\b/g, ' ');

  // Procura a matrícula (qualquer número ou formato 1.XXXXXX no início do bloco limpo)
  const matchMatricula = limpo.match(/([0-9]+\.[0-9]+|[0-9]{3,12})/);
  if (matchMatricula) {
    matricula = matchMatricula[1].trim();
    // Retira a matrícula encontrada para sobrar apenas o nome
    limpo = limpo.replace(matchMatricula[0], ' ');
  }

  // Agora extrai apenas as letras e espaços restantes (que correspondem ao Nome do Colaborador)
  const matchApenasLetras = limpo.match(/([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s]{3,60})/);
  if (matchApenasLetras) {
    const candidato = matchApenasLetras[1].replace(/\s{2,}/g, ' ').trim();
    if (candidato.length >= 4) {
      nomeEncontrado = candidato.toUpperCase();
    }
  }

  // Fallback direto: procura Letras Maiúsculas coladas ou seguidas de Data DD/MM/AAAA no texto geral
  if (nomeEncontrado === 'Colaborador') {
    const matchColadoNaData = textoUnico.match(/([A-ZÀ-Ú][A-ZÀ-Ú\s]{4,55}?)\s*\d{2}\/\d{2}\/\d{4}/);
    if (matchColadoNaData && matchColadoNaData[1]) {
      const cand = matchColadoNaData[1]
        .replace(/^(CADASTRO|NOME|ADMISSAO|ADMISSÃO|DATA|EMPRESA)\s*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (cand.length >= 4 && !cand.includes('BANDEIRANTES')) {
        nomeEncontrado = cand;
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
      return NextResponse.json({ error: 'Nenhum ficheiro enviado.' }, { status: 400 });
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

    // Fatiamento página a página
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // 1. Extração do CPF no rodapé ("portador do CPF 074.940.539-21")
      const cpfMatch = pageText.match(/(?:CPF|cpf)[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                    || pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
                    || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);

      const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

      if (!rawCpf || rawCpf.length !== 11) {
        continue;
      }

      // 2. Extração de Matrícula e Nome por isolamento do bloco entre CNPJ e CARGO
      const { matricula, nomeEncontrado } = extrairNomeEMatriculaSenior(pageText);

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
      message: `${processados.length} novos recibos importados e ${atualizados.length} atualizados com sucesso.`
    });
  } catch (error) {
    console.error('Erro ao processar PDF do Senior HCM:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
