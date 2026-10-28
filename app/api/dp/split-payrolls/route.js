import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Função focada exclusivamente no campo MÊS/ANO do Senior HCM
function extrairCompetenciaReal(texto) {
  // 1. Procura o bloco MÊS/ANO ou MES/ANO do cabeçalho superior direito
  // Ex: "MÊS/ANO \n 09 / 2026" ou "MES/ANO: 09/2026"
  const regexCabecalho = /M[ÊE]S\s*[\/\-]?\s*ANO[^\d\n\r]*[\r\n\s]*(\d{1,2})\s*[\/\-]\s*(\d{4})/i;
  const matchCabecalho = texto.match(regexCabecalho);

  if (matchCabecalho) {
    const mes = matchCabecalho[1].padStart(2, '0');
    const ano = matchCabecalho[2];
    return { mes, ano, formatado: `${mes}/${ano}` };
  }

  // 2. Fallback: Procura padrão isolado MM / AAAA onde o ano seja 20XX e não seja data com dia (ex: ignora dd/mm/aaaa)
  const regexFallback = /(?:^|[^\d\/])(\d{2})\s*[\/\-]\s*(20\d{2})(?:[^\d\/]|$)/m;
  const matchFallback = texto.match(regexFallback);

  if (matchFallback) {
    const mes = matchFallback[1].padStart(2, '0');
    const ano = matchFallback[2];
    return { mes, ano, formatado: `${mes}/${ano}` };
  }

  return null;
}

function validarCompetenciaSenior(texto, competenciaEsperada) {
  const textoLimpo = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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
        motivo: `O PDF não contém a verba de "13º Salário Adiantado" para o ano de ${ano}.`
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
    // Rejeita se o holerite contiver verba de 13º
    if (textoLimpo.includes('13o salario adiantado') || textoLimpo.includes('13o salario integral')) {
      return {
        valido: false,
        motivo: 'O arquivo contém folha de 13º Salário, mas a competência selecionada é de folha mensal.'
      };
    }

    const compDetectada = extrairCompetenciaReal(texto);

    if (!compDetectada) {
      return {
        valido: false,
        motivo: 'Não foi possível identificar o campo "MÊS/ANO" no cabeçalho do holerite.'
      };
    }

    const [mesEsperado, anoEsperado] = competenciaEsperada.split('/');
    const mesEspFormatado = mesEsperado.padStart(2, '0');

    if (compDetectada.mes !== mesEspFormatado || compDetectada.ano !== anoEsperado) {
      return {
        valido: false,
        motivo: `O PDF enviado é da competência "${compDetectada.formatado}", mas a competência selecionada no painel é "${competenciaEsperada}".`
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

    // 1. Validação estrita da competência na 1ª página
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

    // 2. Fatiamento página por página
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // Extração de CPF no rodapé ("portador do CPF 074.940.539-21")
      const cpfMatch = pageText.match(/(?:CPF|cpf)[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                    || pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
                    || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);

      const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

      if (!rawCpf || rawCpf.length !== 11) {
        continue;
      }

      // Extração de Matrícula (CADASTRO)
      const regMatch = pageText.match(/CADASTRO[^\d]*([\d.]+)/i)
                    || pageText.match(/(?:Matrícula|Cadastro|Empregado):?\s*([\d.]+)/i);
      const matricula = regMatch ? regMatch[1].trim() : null;

      // Extração do Nome
      let nomeEncontrado = 'Colaborador';
      const nomeMatch = pageText.match(/NOME[^\n\r]*[\r\n]+\s*(?:[\d.]+\s+)?([A-ZÀ-Ú\s]{4,60})/i)
                     || pageText.match(/NOME\s+([A-ZÀ-Ú\s]{4,60})/i);

      if (nomeMatch && nomeMatch[1]) {
        nomeEncontrado = nomeMatch[1].split(/\s{2,}|\n|\r|DATA/)[0].trim();
      }

      // Prevenção de duplicidade (Upsert)
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
      message: `${processados.length} holerites novos importados e ${atualizados.length} atualizados com sucesso.`
    });
  } catch (error) {
    console.error('Erro ao processar PDF do Senior HCM:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
