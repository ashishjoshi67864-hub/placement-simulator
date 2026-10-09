const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

function buildSimplePdf(textContent) {
    const streamContent = `BT /F1 12 Tf 72 712 Td (${textContent.replace(/\r?\n/g, ") ' (")}) Tj ET`;
    const streamLen = Buffer.byteLength(streamContent);

    let pdf = "%PDF-1.4\n";
    const offsets = [];

    offsets.push(Buffer.byteLength(pdf));
    pdf += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

    offsets.push(Buffer.byteLength(pdf));
    pdf += "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";

    offsets.push(Buffer.byteLength(pdf));
    pdf += "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";

    offsets.push(Buffer.byteLength(pdf));
    pdf += `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

    offsets.push(Buffer.byteLength(pdf));
    pdf += "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

    const xrefOffset = Buffer.byteLength(pdf);
    pdf += "xref\n0 6\n0000000000 65535 f \n";
    for (const offset of offsets) {
        pdf += String(offset).padStart(10, "0") + " 00000 n \n";
    }
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, "utf8");
}

async function main() {
    const outDir = path.join(__dirname, "test-artifacts");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 1. Dummy PDF
    const dummyPdf = buildSimplePdf("Dummy PDF file");
    fs.writeFileSync(path.join(outDir, "dummy.pdf"), dummyPdf);

    // Verify extraction
    const p1 = new PDFParse({ data: dummyPdf });
    const r1 = await p1.getText();
    await p1.destroy();
    console.log("dummy.pdf extracted text:", JSON.stringify(r1.text));

    // 2. Realistic Resume PDF
    const realisticText = "Jane Doe Education B.Tech in Computer Science NIT CGPA 9.0 Skills JavaScript React Node.js Python PostgreSQL Git Projects Placement Simulator and Analytics Experience Software Engineer Intern at TechNova";
    const realPdf = buildSimplePdf(realisticText);
    fs.writeFileSync(path.join(outDir, "realistic.pdf"), realPdf);

    const p2 = new PDFParse({ data: realPdf });
    const r2 = await p2.getText();
    await p2.destroy();
    console.log("realistic.pdf extracted text:", JSON.stringify(r2.text));
}

main().catch(console.error);
