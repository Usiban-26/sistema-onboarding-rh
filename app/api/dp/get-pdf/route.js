import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cpf = searchParams.get('cpf')?.replace(/\D/g, '');
    const competence = searchParams.get('competence');

    if (!cpf || !competence) {
      return new NextResponse('Parâmetros inválidos', { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // 1. Localiza a página do colaborador
    const { data: holerite } = await supabase
      .from('employee_payrolls')
      .select('page_number')
      .eq('cpf', cpf)
      .eq('competence', competence)
      .maybeSingle();

    if (!holerite || !holerite.page_number) {
      return new NextResponse('Holerite não localizado', { status: 404 });
    }

    const safeComp = competence.replace('/', '-');
    const pathConsolidado = `${safeComp}/folha_completa.pdf`;

    // 2. Baixa o arquivo mestre consolidado do bucket
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('holerites')
      .download(pathConsolidado);

    if (downloadError || !fileBlob) {
      return new NextResponse('Folha consolidada não encontrada no Storage', { status: 404 });
    }

    // 3. Extrai apenas a folha solicitada
    const pdfBytes = await fileBlob.arrayBuffer();
    const pdfDocOriginal = await PDFDocument.load(pdfBytes);

    const singleDoc = await PDFDocument.create();
    const [pageCopied] = await singleDoc.copyPages(pdfDocOriginal, [holerite.page_number - 1]);
    singleDoc.addPage(pageCopied);
    const finalPdfBytes = await singleDoc.save();

    return new NextResponse(finalPdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="holerite_${cpf}.pdf"`
      }
    });

  } catch (err) {
    return new NextResponse(`Erro: ${err.message}`, { status: 500 });
  }
}
