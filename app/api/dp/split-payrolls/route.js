import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Validador inteligente de competência conforme os padrões do Senior HCM
function checarCompetenciaSenior(texto, competenciaEsperada) {
  // Normalização do texto (remove acentuações e múltiplos espaços)
  const textoNormalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // -------------------------------------------------------------
  // CASO 1: 13º Salário Adiantado (1ª Parcela)
  // -------------------------------------------------------------
  if (competenciaEsperada.startsWith('13_1') || competenciaEsperada.toLowerCase().includes('adiantado')) {
    const partes = competenciaEsperada.split('_');
    const ano = partes[partes.length - 1]; // Ex: "2026"

    const temVerbaAdiantamento = textoNormalizado.includes('13o salario adiantado')
                              || textoNormalizado.includes('13 salario adiantado')
                              || textoNormalizado.includes('adto 13');

    const temAno = ano ? textoNormalizado.includes(ano) : true;

    if (!temVerbaAdiantamento || !temAno) {
      return {
        valido: false,
        motivo: `O PDF não contém a verba de "13º Salário Adiantado" para o ano de ${ano}.`
      };
    }

    return { valido: true };
  }

  // -------------------------------------------------------------
  // CASO 2: 13º Salário Integral / 2ª Parcela (Padrão Senior: "13 / AAAA")
  // -------------------------------------------------------------
  if (competenciaEsperada.startsWith('13_2') || competenciaEsperada.startsWith('13/') || competenciaEsperada.toLowerCase().includes('integral')) {
    const partes = competenciaEsperada.split(/[_/]/);
    const ano = partes[partes.length - 1]; // Ex: "2025" ou "2026"

    // Verifica cabeçalho específico "13 / AAAA" ou eventos de quitação
    const regexMes13 = new RegExp(`\\b13\\s*[/.-]\\s*${ano}\\b`, 'i');
    const temMes13 = regexMes13.test(textoNormalizado);
    const temVerbaIntegral = textoNormalizado.includes('13o salario integral')
                          || textoNormalizado.includes('13 salario integral');

    if (!temMes13 && !temVerbaIntegral) {
      return {
        valido: false,
        motivo: `O PDF enviado não corresponde ao 13º Salário Integral (mês "13 / ${ano}").`
      };
    }

    return { valido: true };
  }

  // -------------------------------------------------------------
  // CASO 3: Folha Mensal Normal (Ex: "09/2026", "10/2026", "07/2026")
  // -------------------------------------------------------------
  if (competenciaEsperada.includes('/')) {
    const [mes, ano] = competenciaEsperada.split('/');
    const mesNum = parseInt(mes, 10);

    // Se o arquivo for um holerite de 13º adiantado, rejeita na folha normal
    if (textoNormalizado.includes('13o salario adiantado') || textoNormalizado.includes('13o salario integral')) {
      return {
        valido: false,
        motivo: 'O arquivo contém pagamento de 13º Salário, mas você selecionou uma competência de folha mensal normal.'
      };
    }

    // Aceita "09 / 2026", "09/2026", "9/2026", "09 - 2026"
    const regexMesAno = new RegExp(`\\b0?${mesNum}\\s*[/.-]\\s*${ano}\\b`, 'i');
    const temCompetencia = regexMesAno.test(textoNormalizado);

    if (!temCompetencia) {
      // Localiza qual competência veio no arquivo para orientar o operador
      const matchDetectado = texto.match(/M[ÊE]S\s*[\/\-]?\s*ANO[^\d]*(\d{2}\s*[\/\-]\s*\d{4})/i)
                          || texto.match(/\b(\d{2}\s*[\/\-]\s*20\d{2})\b/);
      const detectado = matchDetectado ? matchDetectado[1].replace(/\s+/g, '') : 'não identificada';

      return {
        valido: false,
        motivo: `O PDF enviado parece ser da competência "${detectado}", mas a competência ativa selecionada no painel é "${competenciaEsperada}".`
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

    // 1. Validação prévia com a 1ª página
    const firstPageDoc = await PDFDocument.create();
    const [firstPage] = await firstPageDoc.copyPages(originalPdfDoc, [0]);
    firstPageDoc.addPage(firstPage);
    const firstPageBytes = await firstPageDoc.save();

    const firstParsed = await pdfParse(Buffer.from(firstPageBytes));
    const firstText = firstParsed.text;

    const checagem = checarCompetenciaSenior(firstText, competence);
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

      // Extração do CPF (ex: "portador do CPF 074.940.539-21")
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

      // Extração do Nome do Colaborador
      let nomeEncontrado = 'Colaborador';
      const nomeMatch = pageText.match(/NOME[^\n\r]*[\r\n]+\s*(?:[\d.]+\s+)?([A-ZÀ-Ú\s]{4,60})/i)
                     || pageText.match(/NOME\s+([A-ZÀ-Ú\s]{4,60})/i);

      if (nomeMatch && nomeMatch[1]) {
        nomeEncontrado = nomeMatch[1].split(/\s{2,}|\n|\r|DATA/)[0].trim();
      }

      // Prevenção de duplicidade
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
