import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

function validarCompetenciaSenior(texto, competenciaEsperada) {
  const textoLimpo = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // -------------------------------------------------------------
  // CASO 1: 13º Salário Adiantado (1ª Parcela)
  // -------------------------------------------------------------
  if (competenciaEsperada.startsWith('13_1') || competenciaEsperada.toLowerCase().includes('adiantado')) {
    const partes = competenciaEsperada.split('_');
    const ano = partes[partes.length - 1];

    const temVerbaAdiantamento = textoLimpo.includes('13o salario adiantado')
                              || textoLimpo.includes('13 salario adiantado')
                              || textoLimpo.includes('adto 13');
    const temAno = ano ? textoLimpo.includes(ano) : true;

    if (!temVerbaAdiantamento || !temAno) {
      return {
        valido: false,
        motivo: `O PDF enviado não contém a verba de "13º Salário Adiantado" para o ano de ${ano}.`
      };
    }
    return { valido: true };
  }

  // -------------------------------------------------------------
  // CASO 2: 13º Salário Integral / 2ª Parcela ("13 / AAAA")
  // -------------------------------------------------------------
  if (competenciaEsperada.startsWith('13_2') || competenciaEsperada.startsWith('13/') || competenciaEsperada.toLowerCase().includes('integral')) {
    const partes = competenciaEsperada.split(/[_/]/);
    const ano = partes[partes.length - 1];

    const regexMes13 = new RegExp(`\\b13\\s*[/.-]\\s*${ano}\\b`, 'i');
    const temMes13 = regexMes13.test(textoLimpo);
    const temVerbaIntegral = textoLimpo.includes('13o salario integral') || textoLimpo.includes('13 salario integral');

    if (!temMes13 && !temVerbaIntegral) {
      return {
        valido: false,
        motivo: `O PDF não corresponde ao 13º Salário Integral (mês "13 / ${ano}").`
      };
    }
    return { valido: true };
  }

  // -------------------------------------------------------------
  // CASO 3: Folha Mensal Regular (Ex: "09/2026", "10/2026")
  // -------------------------------------------------------------
  if (competenciaEsperada.includes('/')) {
    // Bloqueia caso o ficheiro seja de 13º
    if (textoLimpo.includes('13o salario adiantado') || textoLimpo.includes('13o salario integral')) {
      return {
        valido: false,
        motivo: 'O ficheiro contém verbas de 13º Salário, mas selecionou uma competência de folha mensal regular.'
      };
    }

    const [mesEsperado, anoEsperado] = competenciaEsperada.split('/');
    const mesNum = parseInt(mesEsperado, 10);

    // Expressão regular que casa com "09 / 2026", "09/2026", "9/2026" ou "09 - 2026"
    const regexMesAno = new RegExp(`\\b0?${mesNum}\\s*[/.-]\\s*${anoEsperado}\\b`, 'i');
    const temCompetencia = regexMesAno.test(textoLimpo);

    if (!temCompetencia) {
      return {
        valido: false,
        motivo: `O PDF enviado não corresponde à competência "${competenciaEsperada}". Certifique-se de que selecionou a competência correta no seletor ou enviou o relatório correspondente.`
      };
    }

    return { valido: true };
  }

  return { valido: true };
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

    // 1. Validação estrita na 1ª página
    const firstPageDoc = await PDFDocument.create();
    const [firstPage] = await firstPageDoc.copyPages(originalPdfDoc, [0]);
    firstPageDoc.addPage(firstPage);
    const firstPageBytes = await firstPageDoc.save();

    const firstParsed = await pdfParse(Buffer.from(firstPageBytes));
    const firstText = firstParsed.text;

    const checagem = validarCompetenciaSenior(firstText, competence);
    if (!checagem.valido) {
      return NextResponse.json({ error: checagem.motivo }, { status: 400 });
    }

    const processados = [];
    const atualizados = [];

    // 2. Fatiamento e gravação página a página
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // Extração de CPF ("portador do CPF 074.940.539-21")
      const cpfMatch = pageText.match(/(?:CPF|cpf)[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                    || pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
                    || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);

      const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

      if (!rawCpf || rawCpf.length !== 11) {
        continue;
      }

      // Matrícula / Cadastro
      const regMatch = pageText.match(/CADASTRO[^\d]*([\d.]+)/i)
                    || pageText.match(/(?:Matrícula|Cadastro|Empregado):?\s*([\d.]+)/i);
      const matricula = regMatch ? regMatch[1].trim() : null;

      // Nome do Colaborador
      let nomeEncontrado = 'Colaborador';
      const nomeMatch = pageText.match(/NOME[^\n\r]*[\r\n]+\s*(?:[\d.]+\s+)?([A-ZÀ-Ú\s]{4,60})/i)
                     || pageText.match(/NOME\s+([A-ZÀ-Ú\s]{4,60})/i);

      if (nomeMatch && nomeMatch[1]) {
        nomeEncontrado = nomeMatch[1].split(/\s{2,}|\n|\r|DATA/)[0].trim();
      }

      // Prevenção de duplicados (Upsert)
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
      message: `${processados.length} recibos importados e ${atualizados.length} atualizados com sucesso.`
    });
  } catch (error) {
    console.error('Erro ao processar PDF do Senior HCM:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
