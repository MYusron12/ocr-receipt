// pages/api/process-image-link.js
import fetch from 'node-fetch'; // Digunakan untuk mengunduh gambar dan mengirim request ke OCR.space
import dotenv from 'dotenv'; // Untuk membaca variabel lingkungan dari .env.local

dotenv.config({ path: '.env.local' }); // Memuat variabel lingkungan

/**
 * Handler untuk API Route.
 * Menerima permintaan POST dengan 'imageUrl' di body.
 */
export default async function handler(req, res) {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Dapatkan 'imageUrl' dari body request
  const { imageUrl } = req.body;

  // Validasi: pastikan 'imageUrl' ada
  if (!imageUrl) {
    return res.status(400).json({ message: 'Missing imageUrl in request body' });
  }

  // Ambil API Key dari variabel lingkungan
  const OCR_SPACE_API_KEY = 'K84881763088957';

  if (!OCR_SPACE_API_KEY) {
    console.error('OCR_SPACE_API_KEY is not set in .env.local');
    return res.status(500).json({ message: 'Server configuration error: OCR API Key missing.' });
  }

  try {
    // 1. Kirim URL gambar ke OCR.space API
    // OCR.space API mendukung input URL gambar secara langsung
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': OCR_SPACE_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded' // Penting untuk mengirim URL
      },
      body: `url=${encodeURIComponent(imageUrl)}&language=eng&isOverlayRequired=true` // Gunakan 'eng' atau 'ind'
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR.space API request failed: ${ocrResponse.statusText} (Status: ${ocrResponse.status})`);
    }

    const ocrResult = await ocrResponse.json();

    // Periksa apakah OCR.space mengembalikan error
    if (ocrResult.IsErroredOnProcessing) {
      console.error('OCR.space processing error:', ocrResult.ErrorMessage);
      return res.status(500).json({
        message: 'OCR.space failed to process image',
        errors: ocrResult.ErrorMessage || 'Unknown OCR.space error'
      });
    }

    // Ambil teks hasil OCR. OCR.space sering mengembalikan dalam bentuk array ParsedResults.
    // Kita asumsikan mengambil yang pertama jika ada.
    const rawText = ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0
      ? ocrResult.ParsedResults[0].ParsedText
      : '';

    if (!rawText) {
      return res.status(404).json({ message: 'No text found in the image by OCR.space.' });
    }

    console.log('--- Raw OCR Text Extracted by OCR.space ---');
    console.log(rawText);
    console.log('-----------------------------------------');

    // 2. Parsing teks mentah dari OCR ke struktur data JSON yang terstruktur
    const parsedData = parseStrukText(rawText);

    // 3. Kirim hasil JSON kembali ke klien
    res.status(200).json(parsedData);

  } catch (error) {
    // Tangani kesalahan yang terjadi (network error, API key invalid, dll.)
    console.error('Error processing image with OCR.space:', error);
    res.status(500).json({ message: 'Error processing image', error: error.message });
  }
}

/**
 * Fungsi pembantu untuk mengurai teks mentah dari OCR menjadi objek data struk terstruktur.
 * Logika ini adalah bagian paling kompleks dan mungkin memerlukan penyesuaian untuk berbagai format struk.
 * @param {string} rawText - Teks mentah hasil dari OCR.
 * @returns {object} Objek yang berisi data struk yang telah diurai.
 */
function parseStrukText(rawText) {
  const data = {};
  // Pisahkan teks menjadi baris-baris, hapus spasi di awal/akhir, dan filter baris kosong
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // --- 1. Pengambilan Nama Merchant (Dinamis) ---
  let bcaIndex = -1;
  let foundMerchantName = false;

  for (let i = 0; i < lines.length; i++) {
    // Cari baris yang mengandung 'BCA' (case-insensitive)
    if (lines[i].toUpperCase().includes('BCA')) {
      bcaIndex = i;
      // Coba ambil baris-baris setelah 'BCA' sebagai nama merchant
      for (let j = bcaIndex + 1; j < lines.length; j++) {
        let potentialName = lines[j].trim();
        const excludePatterns = new RegExp(
          '^(JL\\.?|RT\\.?|RW\\.?|KEC\\.?|KOTA|BLOK|NO\\.?|ACT\\.?|TANGGAL|WAKTU|MID|TERM#|MERC#|DATE|TIME|BATCH|TRACE|REF\\.NO|APPR\\.CODE|\\d{10,}|C[0-9]{2}D[0-9]{4}|\\*+|SIGNATURE NOT REQUIRED|Cardholder Copy|Merchant Copy|[\\d\\s\\W]{0,3}$)',
          'i' // Case-insensitive
        );

        // Kriteria untuk baris yang dianggap nama merchant yang valid:
        // - Panjang lebih dari 3 karakter (untuk menghindari sisa OCR atau karakter tunggal)
        // - Tidak cocok dengan pola pengecualian yang luas
        // - Mengandung setidaknya satu huruf (untuk memastikan itu bukan hanya angka atau simbol)
        const containsLetters = /[a-zA-Z]/.test(potentialName);

        if (potentialName.length > 3 && !excludePatterns.test(potentialName) && containsLetters) {
          data.merchant_name = potentialName;
          foundMerchantName = true;
          break; // Keluar dari loop inner setelah menemukan nama merchant
        }
      }
      if (foundMerchantName) break; // Keluar dari loop outer jika sudah ditemukan
    }
  }

  // --- 2. Pengambilan Field Lainnya Menggunakan Regex ---

  // Tanggal dan Waktu Transaksi
  const dateTimeMatch = rawText.match(/(?:DATE|TIME)?\s*(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*,\s*\d{2}(?:\s*\d{2})?\s*\d{2}:\d{2})/i) ||
                        rawText.match(/(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,\s*\d{2}:\d{2})/i);

  if (dateTimeMatch && (dateTimeMatch[1] || dateTimeMatch[0])) {
      let dateTimeStr = dateTimeMatch[1] || dateTimeMatch[0];
      data.transaction_date_time = dateTimeStr.replace(/(\s*DATE|\s*TIME)/i, '').trim();
  }

  // Terminal ID (TERM#)
  const termMatch = rawText.match(/(?:TERM|FERM|FERN)\s*#?\s*([A-Z0-9]+)/i);
  if (termMatch && termMatch[1]) {
      data.terminal_id = termMatch[1];
  }

  // Merchant Code (MERC#) - diasumsikan deretan angka (?:HERC|MERC)
  const mercMatch = rawText.match(/(?:HERC|MERC)\s*#?\s*([0-9]+)/i);
  if (mercMatch && mercMatch[1]) {
      data.merchant_id = mercMatch[1];
      if (data.merchant_id.length >= 9) {
          data.merchant_id = data.merchant_id.slice(-9); // Ambil 9 karakter terakhir
      } else {
          data.merchant_id = data.merchant_id; // Jika kurang dari 9, gunakan seluruh string
      }
  }

  // Jenis Kartu (contoh: DEBIT BCA (DIP), DEBIT MC BCA (FLY), DEBIT VISA)
  const cardTypeMatch = rawText.match(/CARD TYPE\s*([A-Z\s]+(?:MC|BCA|VISA)?(?:\s*\(DIP\)|\s*\(FLY\))?)/i);
  if (cardTypeMatch && cardTypeMatch[1]) {
      data.card_type = cardTypeMatch[1].trim();
  } else {
    // Fallback jika 'CARD TYPE' tidak terdeteksi, cari pola umum seperti 'DEBIT BCA'
    const genericCardTypeMatch = rawText.match(/(DEBIT\s*(?:MC|BCA|VISA)(?:\s*\(DIP\)|\s*\(FLY\))?)/i);
    if (genericCardTypeMatch && genericCardTypeMatch[1]) {
        data.card_type = genericCardTypeMatch[1].trim();
    }
  }

  // Nomor Kartu Masked (format: ************1234)
  const cardNumberMatch = rawText.match(/(\*{6,}\d{4})/);
  if (cardNumberMatch && cardNumberMatch[1]) {
      data.card_number_masked = cardNumberMatch[1];
  }

  // Batch Number
  const batchMatch = rawText.match(/BATCH\s*:\s*(\d+)/i);
  if (batchMatch && batchMatch[1]) {
      data.batch_number = batchMatch[1];
  }

  // Trace Number
  const traceMatch = rawText.match(/TRACE NO:\s*(\d+)/i);
  if (traceMatch && traceMatch[1]) {
      data.trace_number = traceMatch[1];
  }

  // Approval Code (APPR. CODE)
  const approvalMatch = rawText.match(/APPR\.CODE\s*(\d+)/i);
  if (approvalMatch && approvalMatch[1]) {
      data.approval_code = approvalMatch[1];
  }

  // Reference Number (REF. NO.)
  const refNoMatch = rawText.match(/REF\.NO\.\s*(\d+)/i);
  if (refNoMatch && refNoMatch[1]) {
      data.reference_number = refNoMatch[1];
  }

  // Total Amount (mencoba menangani format Rp. X.XXX atau Rp. XXX,XX)
  // Menghapus titik ribuan, mengganti koma desimal dengan titik untuk parseFloat
  const totalMatch = rawText.match(/(-?)\s*Rp\s*([\d\.,]+)/i); // Perubahan di sini: -? adalah grup penangkap terpisah
  if (totalMatch && totalMatch[2]) { // totalMatch[2] akan berisi angka, totalMatch[1] akan berisi '-' atau ''
    let amountStr = totalMatch[2].replace(/\./g, '').replace(',', '.');
    let amount = parseFloat(amountStr);
    if (totalMatch[1] === '-') { // Jika grup pertama menangkap tanda minus
      amount = -amount; // Buat angka menjadi negatif
    }
    data.total_amount = amount;
  }

  // Kode Internal/Referensi (termasuk pola dengan ANS)
  // Mencari pola seperti XXXXXXXX/ANSXXXX, ANSXXXX, atau pola alfanumerik serupa
  const internalCodeMatch = rawText.match(/([A-Z0-9]{4,}\/[A-Z0-9]{4,})|\bANS[A-Z0-9]+\b|\b[0-9]{2}[A-Z][0-9]{2}[A-Z]{3}\/[A-Z0-9]+\b/i);
  if (internalCodeMatch && internalCodeMatch[0]) {
      data.internal_code_reference = internalCodeMatch[0];
  }

  // Status Transaksi (VOID/COMPLETED)
  if (rawText.includes('VOID')) {
      data.transaction_status = 'VOID';
  } else {
      data.transaction_status = 'COMPLETED'; // Asumsi transaksi berhasil jika tidak ada 'VOID'
  }

  // Catatan (misal: "SIGNATURE NOT REQUIRED")
  if (rawText.includes('SIGNATURE NOT REQUIRED')) {
      data.notes = 'SIGNATURE NOT REQUIRED';
  }

  // Kembalikan objek data yang telah diurai.
  // Raw OCR text juga disertakan untuk referensi atau debugging.
  return {
    raw_ocr_text: rawText,
    parsed_data: data
  };
}