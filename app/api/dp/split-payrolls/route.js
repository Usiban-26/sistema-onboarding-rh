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

    // Fatiamento direto página por página
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // 1. Extração do CPF (ex: "portador do CPF 074.940.539-21" ou genérico)
      const cpfMatch = pageText.match(/(?:CPF|cpf)[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                    || pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
                    || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);

      const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

      if (!rawCpf || rawCpf.length !== 11) {
        continue; // Ignora páginas sem CPF
      }

      // 2. Extração de Matrícula (CADASTRO)
      const regMatch = pageText.match(/CADASTRO[^\d]*([\d.]+)/i)
                    || pageText.match(/(?:Matrícula|Cadastro|Empregado):?\s*([\d.]+)/i);
      const matricula = regMatch ? regMatch[1].trim() : null;

      // 3. Extração do Nome do Colaborador
      let nomeEncontrado = 'Colaborador';
      const nomeMatch = pageText.match(/NOME[^\n\r]*[\r\n]+\s*(?:[\d.]+\s+)?([A-ZÀ-Ú\s]{4,60})/i)
                     || pageText.match(/NOME\s+([A-ZÀ-Ú\s]{4,60})/i);

      if (nomeMatch && nomeMatch[1]) {
        nomeEncontrado = nomeMatch[1].split(/\s{2,}|\n|\r|DATA/)[0].trim();
      }

      // 4. Prevenção de duplicidade: checa se já existe registro com mesmo CPF e competência
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
        // Atualiza mantendo o mesmo ID
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
        // Cria novo
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
