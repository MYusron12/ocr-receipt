// pages/api/process-receipt-ocrspace.js

import { parseReceiptText } from '../../lib/receiptParser'; // Impor parser kita

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { imageUrl } = req.body;

    if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required' });
    }

    // Ambil API Key dari environment variable dengan aman
    const apiKey = 'K84881763088957';
    if (!apiKey) {
        return res.status(500).json({ error: 'OCR.space API key is not configured.' });
    }

    try {
        // Siapkan data untuk dikirim ke OCR.space API
        // Kita menggunakan FormData karena API mereka dirancang seperti itu
        const formData = new FormData();
        formData.append('url', imageUrl);
        formData.append('language', 'eng'); // Bahasa Inggris seringkali cukup untuk struk
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');

        // Panggil OCR.space API
        const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: {
                'apikey': apiKey,
            },
            body: formData,
        });

        const ocrData = await ocrResponse.json();

        // Cek jika ada error dari OCR.space
        if (ocrData.IsErroredOnProcessing) {
            console.error('OCR.space Error:', ocrData.ErrorMessage);
            return res.status(500).json({
                error: 'Failed to process image with OCR.space',
                details: ocrData.ErrorMessage,
            });
        }
        
        // Ekstrak teks mentah yang sudah bersih dari hasil OCR
        const rawText = ocrData.ParsedResults[0].ParsedText;

        console.log("--- RAW TEXT FROM OCR.space ---");
        console.log(rawText);
        console.log("-------------------------------");
        
        // Gunakan kembali parser yang sudah Anda buat!
        const structuredData = parseReceiptText(rawText);

        // Kirim hasil akhir
        res.status(200).json(structuredData);

    } catch (error) {
        console.error('API Route Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}