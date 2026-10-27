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
    const competence = formData.get('competence') || '10/2026';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const originalPdfDoc = await PDFDocument.load(fileBuffer);
    const totalPages = originalPdfDoc.getPageCount();

    const processados = [];

    for (let i = 0; i < totalPages; i++) {
      // 1. Isola a página do colaborador
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      // 2. Extrai o texto para capturar CPF e Nome (Padrão Senior HCM)
      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // Localiza CPF com ou sem pontuação
      const cpfMatch = pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/) || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);
      const rawCpf = cpfMatch ? cpfMatch[0].replace(/\D/g, '') : null;

      // Localiza Matrícula / Cadastro se houver
      const regMatch = pageText.match(/(?:Cadastro|Empregado|Matrícula):\s*(\d+)/i);
      const matricula = regMatch ? regMatch[1] : null;

      // Tenta capturar o nome do colaborador
      let nomeEncontrado = 'Colaborador';
      const linhas = pageText.split('\n').map(l => l.trim()).filter(Boolean);
      for (const linha of linhas) {
        if (linha.toLowerCase().includes('nome:') || linha.toLowerCase().includes('empregado:')) {
          nomeEncontrado = linha.replace(/.*(?:nome:|empregado:)/i, '').trim();
          break;
        }
      }

      const identificador = rawCpf || `pagina_${i + 1}`;
      const safeCompetence = competence.replace('/', '-');
      const fileName = `${safeCompetence}/${identificador}_${Date.now()}.pdf`;

      // 3. Salva no Bucket holerites
      const { error: uploadError } = await supabase.storage
        .from('holerites')
        .upload(fileName, singlePdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('holerites')
          .getPublicUrl(fileName);

        // 4. Registra na tabela employee_payrolls
        const { data: dbData } = await supabase
          .from('employee_payrolls')
          .insert([
            {
              employee_name: nomeEncontrado,
              cpf: rawCpf || 'Não identificado',
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
      data: processados
    });
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
