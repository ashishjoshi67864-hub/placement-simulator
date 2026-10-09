const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");

async function testUploadAndAnalyze() {
    const dummyPath = path.join(__dirname, "test-artifacts", "dummy.pdf");
    const dummyBuffer = fs.readFileSync(dummyPath);

    const blob = new Blob([dummyBuffer], { type: "application/pdf" });
    const formData = new FormData();
    formData.append("resume", blob, "dummy.pdf");

    // 1. Upload dummy PDF
    const uploadRes = await fetch("http://localhost:5000/api/resume/upload", {
        method: "POST",
        body: formData,
    });
    assert.equal(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    console.log("Upload response:", uploadData);
    assert.ok(uploadData.resumeText.includes("Dummy PDF file"));

    // 2. Analyze dummy PDF text
    const analyzeRes = await fetch("http://localhost:5000/api/resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            resumeText: uploadData.resumeText,
            targetRole: "Full Stack Developer",
        }),
    });

    console.log("Analyze status for dummy PDF:", analyzeRes.status);
    const analyzeData = await analyzeRes.json();
    console.log("Analyze response for dummy PDF:", analyzeData);

    assert.equal(analyzeRes.status, 422);
    assert.equal(analyzeData.code, "INSUFFICIENT_RESUME_CONTENT");
    assert.equal(analyzeData.analysis, undefined);
    console.log("✅ Dummy PDF successfully rejected with 422 INSUFFICIENT_RESUME_CONTENT!");
}

testUploadAndAnalyze().catch(console.error);
