import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Mapeamento dos meses para reconhecimento do Senior HCM
const MESES = {
  '01': ['01', 'janeiro', 'jan'],
  '02': ['02', 'fevereiro', 'fev'],
  '03': ['03', 'março', 'marco', 'mar'],
  '04': ['04', 'abril', 'abr'],
  '05': ['05', 'maio', 'mai'],
  '06': ['06', 'junho', 'jun'],
  '07': ['07', 'julho', 'jul'],
  '08': ['08', 'agosto', 'ago'],
  '09': ['09', 'setembro', 'set'],
  '10': ['10', 'outubro', 'out'],
  '11': ['11', 'novembro', 'nov'],
  '12': ['12', 'dezembro', 'dez']
};

function validarCompetenciaNoTexto(texto, competenciaEsperada) {
  const textoLimpo = texto.toLowerCase().replace(/\s+/g, ' ');

  // Caso 1: Folha Mensal (Ex: "10/2026" ou "09/2026")
  if (competenciaEsperada.includes('/')) {
    const [mes, ano] = competenciaEsperada.split('/');
    const aliasesMes = MESES[mes] || [mes];

    // Verifica se o ano selecionado existe no texto do cabeçalho
    const temAno = textoLimpo.includes(ano);
    if (!temAno) {
      return { valido: false, motivo: `O arquivo não menciona o ano ${ano}.` };
    }

    // Verifica se algum termo referente ao mês esperado está presente
    const temMes = aliasesMes.some(m => {
      // Ex: "10/2026", "10-2026", "outubro/2026", "out/2026", "mês: 10"
      const regex1 = new RegExp(`\\b${m}\\s*[/.-]?\\s*${ano}\\b`, 'i');
      const regex2 = new RegExp(`(referência|competência|período|mês|folha)[^\\n\\r]{0,30}\\b${m}\\b`, 'i');
      return regex1.test(textoLimpo) || regex2.test(textoLimpo);
    });

    if (!temMes) {
      return {
        valido: false,
        motivo: `O arquivo PDF não corresponde ao mês ${mes}/${ano}. Verifique se selecionou o relatório correto.`
      };
    }

    return { valido: true };
  }

  // Caso 2: 13º Salário (Ex: "13_1_2026" ou "13_2_2026")
  if (competenciaEsperada.startsWith('13')) {
    const partes = competenciaEsperada.split('_');
    const parcela = partes[1] || '1';
    const ano = partes[2] || '';

    const tem13 = textoLimpo.includes('13') || textoLimpo.includes('décimo') || textoLimpo.includes('decimo');
    const temAno = ano ? textoLimpo.includes(ano) : true;

    if (!tem13 || !temAno) {
      return {
        valido: false,
        motivo: `O arquivo enviado não parece ser do 13º Salário (${parcela}ª Parcela) de ${ano}.`
      };
    }

    return { valido: true };
  }

  return { valido: true };
}

export default async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const competence = formData.get('competence') || '';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    if (!competence) {
      return NextResponse.json({ error: 'Nenhuma competência informada.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const originalPdfDoc = await PDFDocument.load(fileBuffer);
    const totalPages = originalPdfDoc.getPageCount();

    if (totalPages === 0) {
      return NextResponse.json({ error: 'O PDF enviado está vazio.' }, { status: 400 });
    }

    // 1. Validação da Competência na Primeira Página
    const firstPageDoc = await PDFDocument.create();
    const [firstPage] = await firstPageDoc.copyPages(originalPdfDoc, [0]);
    firstPageDoc.addPage(firstPage);
    const firstPageBytes = await firstPageDoc.save();
    const firstParsed = await pdfParse(Buffer.from(firstPageBytes));
    const firstText = firstParsed.text;

    const checagem = validarCompetenciaNoTexto(firstText, competence);
    if (!checagem.valido) {
      return NextResponse.json({
        error: `DIVERGÊNCIA DE COMPETÊNCIA: ${checagem.motivo}`
      }, { status: 400 });
    }

    const processados = [];
    const atualizados = [];

    // 2. Fatiamento e Salvamento Seguro Página por Página
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // Extração de CPF
      const cpfMatch = pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/) || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);
      const rawCpf = cpfMatch ? cpfMatch[0].replace(/\D/g, '') : null;

      if (!rawCpf) continue;

      // Matrícula Senior
      const regMatch = pageText.match(/(?:Cadastro|Empregado|Matrícula):\s*(\d+)/i);
      const matricula = regMatch ? regMatch[1] : null;

      // Nome do Colaborador
      let nomeEncontrado = 'Colaborador';
      const linhas = pageText.split('\n').map(l => l.trim()).filter(Boolean);
      for (const linha of linhas) {
        if (linha.toLowerCase().includes('nome:') || linha.toLowerCase().includes('empregado:')) {
          nomeEncontrado = linha.replace(/.*(?:nome:|empregado:)/i, '').trim();
          break;
        }
      }

      // Validação Anti-Duplicidade (Upsert)
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
    console.error('Erro na rota de split:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export { POST };
