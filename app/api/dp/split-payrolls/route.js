import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request) {
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

    // 1. Validação prévia da competência na 1ª página
    const firstPageDoc = await PDFDocument.create();
    const [firstPage] = await firstPageDoc.copyPages(originalPdfDoc, [0]);
    firstPageDoc.addPage(firstPage);
    const firstPageBytes = await firstPageDoc.save();
    const firstParsed = await pdfParse(Buffer.from(firstPageBytes));
    const firstText = firstParsed.text;

    // Normaliza a checagem (Ex: "10/2026" ou "13º")
    const compParts = competence.split('/');
    if (compParts.length === 2) {
      const mes = compParts[0];
      const ano = compParts[1];
      const padraoSenior = new RegExp(`(${mes}\\s*[/.-]?\\s*${ano}|${mes}\\s*de\\s*${ano})`, 'i');
      if (!padraoSenior.test(firstText) && !firstText.includes(ano)) {
        return NextResponse.json({
          error: `O arquivo enviado parece não pertencer à competência ${competence}. Verifique se selecionou o arquivo correto da folha.`
        }, { status: 400 });
      }
    }

    const processados = [];
    const duplicadosIgnorados = [];

    // 2. Fatiamento e gravação página por página
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

      if (!rawCpf) {
        continue; // Ignora páginas sem CPF
      }

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

      // 3. Validação anti-duplicação: verifica se já existe
      const { data: existente } = await supabase
        .from('employee_payrolls')
        .select('id')
        .eq('cpf', rawCpf)
        .eq('competence', competence)
        .maybeSingle();

      const safeCompetence = competence.replace('/', '-');
      const fileName = `${safeCompetence}/${rawCpf}.pdf`;

      // Upload no storage (upsert)
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
        // Atualiza o existente para não duplicar linha
        await supabase
          .from('employee_payrolls')
          .update({
            employee_name: nomeEncontrado,
            registration_number: matricula,
            file_url: publicUrlData.publicUrl,
            status: 'Pendente' // reseta status ao reimportar
          })
          .eq('id', existente.id);

        duplicadosIgnorados.push(rawCpf);
      } else {
        // Insere novo
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
      updatedCount: duplicadosIgnorados.length,
      message: `${processados.length} novos importados e ${duplicadosIgnorados.length} atualizados (sem duplicidades).`
    });
  } catch (error) {
    console.error('Erro na rota de split:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
