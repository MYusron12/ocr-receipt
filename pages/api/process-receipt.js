// pages/api/process-receipt.js

import { createWorker } from 'tesseract.js';

/**
 * Fungsi ini adalah inti dari logika parsing.
 * @param {string} text - Teks mentah hasil OCR dari Tesseract.
 * @returns {object} - Objek JSON yang terstruktur.
 */
const parseReceiptText = (text) => {
    const extractedData = {};

    const extract = (regex) => {
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    };

    // --- Ekstraksi Data ---

    // Merchant Name: Cari baris teks signifikan pertama, lalu bersihkan
    const lines = text.split('\n');
    let merchantNameFound = false;
    for (const line of lines) {
        let candidateLine = line.trim();
        if (candidateLine === '' || candidateLine.toUpperCase() === 'BCA' || /GRUPECA/i.test(candidateLine)) {
            continue;
        }
        if (!merchantNameFound) {
            candidateLine = candidateLine.replace(/^MID\s*:\s*[\d\s-]+\s*-\s*/i, '');
            candidateLine = candidateLine.replace(/\s*DATE\s*:.*$/i, '');
            extractedData.merchant_name = candidateLine.trim();
            merchantNameFound = true;
        }
    }

    // Terminal ID & Merchant ID: Cari baris yang mengandung keduanya sekaligus.
    const idsMatch = text.match(/(?:TERM#?|TID)\s*([A-Z0-9]+)\s+(?:MERC#?|MID)\s*([A-Z0-9]+)/i);
    if (idsMatch) {
        extractedData.terminal_id = idsMatch[1];
        extractedData.merchant_id = idsMatch[2];
    } else {
        // Fallback jika formatnya berbeda
        extractedData.terminal_id = extract(/(?:TERM#?|TID)\s*([A-Z0-9]+)/i);
        extractedData.merchant_id = extract(/(?:MERC#?|MID)\s*([A-Z0-9]+)/i);
    }
    
    // Merchant Address: Cari baris yang mengandung JL. atau Jalan
    extractedData.merchant_address = extract(/^(JL\.?.*?)\n/im) || extract(/^(Jalan.*?)\n/im);
    
    // Tanggal & Waktu Transaksi
    const dateTimeMatch = text.match(/DATE\/TIME\s+(\d{1,2}\s+\w{3},\s*\d{2})\s+(\d{2}:\d{2})/i);
    if (dateTimeMatch) {
        try {
            const dateString = dateTimeMatch[1].replace(/,/, '');
            const parsedDate = new Date(dateString);
            if (parsedDate.getFullYear() < 2000) {
                parsedDate.setFullYear(parsedDate.getFullYear() + 100);
            }
            extractedData.transaction_date = parsedDate.toISOString().split('T')[0];
            extractedData.transaction_time = dateTimeMatch[2];
        } catch (e) {
            extractedData.transaction_date = null;
            extractedData.transaction_time = null;
        }
    }

    // Nomor Kartu
    extractedData.payment_card_number = extract(/\*{8,}(\d{4})/);
    if (extractedData.payment_card_number) {
        extractedData.payment_card_number = `************${extractedData.payment_card_number}`;
    }

    // Metode Pembayaran
    extractedData.payment_method = extract(/CARD TYPE\s+(.*?)\n/i);

    // Software Code & Type
    const softwareMatch = text.match(/([A-Z0-9]+)\/(ANS\w+)/i);
    if (softwareMatch) {
        extractedData.software_code = softwareMatch[1];
        extractedData.software_type = softwareMatch[2];
    }

    // Total & Mata Uang
    const totalMatch = text.match(/(?:TOTAL|TOTAI)\s*(-?Rp\.?\s*[\d,.]+)/i);
    extractedData.currency = "Rp";
    if (totalMatch) {
        let totalValue = totalMatch[1].replace(/Rp\.?\s*/i, '').replace(/\./g, '').replace(',', '.');
        extractedData.total = parseFloat(totalValue).toFixed(2);
    } else {
        const voidTotalMatch = text.match(/-\s*Rp\s*([,\d.]+)/i);
        if (voidTotalMatch) {
            let totalValue = voidTotalMatch[1].replace(/\./g, '').replace(',', '.');
            extractedData.total = (parseFloat(totalValue) * -1).toFixed(2);
        }
    }

    // Cek kata "VOID" untuk memastikan total negatif
    if (/VOID/i.test(text) && extractedData.total && parseFloat(extractedData.total) > 0) {
        extractedData.total = (parseFloat(extractedData.total) * -1).toFixed(2);
    }

    // Line Items (disimulasikan dari total)
    const isVoid = /VOID/i.test(text);
    extractedData.line_items = [{
        description: isVoid ? "VOID" : "TOTAL",
        amount: parseFloat(extractedData.total || 0)
    }];

    return extractedData;
};


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { imageUrl } = req.body;

    if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required' });
    }

    let worker;
    try {
        worker = await createWorker();
        const { data: { text } } = await worker.recognize(imageUrl, {
            lang: 'ind+eng'
        });

        console.log("--- RAW TEXT FROM OCR ---");
        console.log(text);
        console.log("-------------------------");

        const structuredData = parseReceiptText(text);
        res.status(200).json(structuredData);

    } catch (error) {
        console.error('Error processing receipt:', error);
        res.status(500).json({ error: 'Failed to process image', details: error.message });
    } finally {
        if (worker) {
            await worker.terminate();
        }
    }
}