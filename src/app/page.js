'use client';
import { useState } from 'react';

export default function Home() {
    const [ocrResult, setOcrResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedJob, setSelectedJob] = useState(''); // Untuk tombol job dari DB
    const [imageUrlInput, setImageUrlInput] = useState(''); // Untuk input URL gambar

    // Ubah state ini menjadi pilihan default untuk select
    const [customJobSelect, setCustomJobSelect] = useState('maintenance'); // State baru untuk select job custom, default 'maintenance'

    const API_BASE_URL = 'https://jadintracker.id/operation/api_ocr/ocr';

    // Definisi jenis pekerjaan yang bisa dipilih, untuk kedua bagian UI
    const commonJobTypes = ['maintenance', 'instal', 'init', 'project'];

    // Fungsi untuk mengambil data OCR berdasarkan job type (dari DB)
    const fetchOCRDataByJob = async (jobType) => {
        setLoading(true);
        setOcrResult(null);
        setError(null);
        setSelectedJob(jobType); // Set selectedJob untuk indikator
        setImageUrlInput(''); // Kosongkan input URL
        setCustomJobSelect('maintenance'); // Reset custom job select ke default

        try {
            const response = await fetch(`${API_BASE_URL}?job=${jobType}`);
            const contentType = response.headers.get("content-type");

            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Received non-JSON response from API. Please check your CodeIgniter API headers and ensure it returns JSON.");
            }

            const data = await response.json();

            if (response.ok && data.responseCode === '200') {
                setOcrResult(data.data);
            } else {
                const errorMessage = data.responseMessage || 'Unknown error occurred on the API side.';
                setError(`API Error: ${errorMessage}. Details: ${JSON.stringify(data.data, null, 2)}`);
                setOcrResult(null);
            }
        } catch (err) {
            console.error('Error fetching OCR data by job:', err);
            setError(`Failed to fetch OCR data: ${err.message}. Please check your network connection or API URL.`);
            setOcrResult(null);
        } finally {
            setLoading(false);
        }
    };

    // Fungsi baru untuk mengambil data OCR berdasarkan URL gambar yang dimasukkan
    const fetchOCRDataByImageUrl = async () => {
        if (!imageUrlInput) {
            setError('Please enter an image URL.');
            return;
        }

        setLoading(true);
        setOcrResult(null);
        setError(null);
        setSelectedJob('custom-url'); // Indikator ini dari URL custom

        const encodedImageUrl = encodeURIComponent(imageUrlInput);
        const encodedCustomJob = encodeURIComponent(customJobSelect); // Gunakan nilai dari select

        try {
            const response = await fetch(`${API_BASE_URL}?image_url=${encodedImageUrl}&job=${encodedCustomJob}`);
            const contentType = response.headers.get("content-type");

            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Received non-JSON response from API. Please check your CodeIgniter API headers and ensure it returns JSON.");
            }

            const data = await response.json();

            if (response.ok && data.responseCode === '200') {
                setOcrResult(data.data);
            } else {
                const errorMessage = data.responseMessage || 'Unknown error occurred on the API side.';
                setError(`API Error: ${errorMessage}. Details: ${JSON.stringify(data.data, null, 2)}`);
                setOcrResult(null);
            }
        } catch (err) {
            console.error('Error fetching OCR data by URL:', err);
            setError(`Failed to fetch OCR data from URL: ${err.message}. Please check your network connection or image URL.`);
            setOcrResult(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.heading}>OCR Receipt Processor</h1>
            <p style={styles.description}>Pilih jenis pekerjaan untuk mendapatkan data OCR terbaru dari database:</p>

            <div style={styles.buttonContainer}>
                {commonJobTypes.map((job) => (
                    <button
                        key={job}
                        onClick={() => fetchOCRDataByJob(job)}
                        style={{
                            ...styles.button,
                            backgroundColor: selectedJob === job ? '#0056b3' : '#007bff'
                        }}
                        disabled={loading}
                    >
                        Get {job.charAt(0).toUpperCase() + job.slice(1)} OCR
                    </button>
                ))}
            </div>

            ---

            <p style={styles.description}>Atau masukkan URL gambar dan pilih jenis pekerjaan secara manual:</p>
            <div style={styles.inputContainer}>
                <input
                    type="text"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Masukkan URL gambar di sini (mis: https://example.com/image.jpg)"
                    style={styles.inputField}
                    disabled={loading}
                />
                {/* Bagian Select Option baru */}
                <select
                    value={customJobSelect}
                    onChange={(e) => setCustomJobSelect(e.target.value)}
                    style={styles.selectField}
                    disabled={loading}
                >
                    {commonJobTypes.map((job) => (
                        <option key={job} value={job}>
                            {job.charAt(0).toUpperCase() + job.slice(1)}
                        </option>
                    ))}
                </select>

                <button
                    onClick={fetchOCRDataByImageUrl}
                    style={{
                        ...styles.button,
                        backgroundColor: selectedJob === 'custom-url' ? '#28a745' : '#4CAF50'
                    }}
                    disabled={loading}
                >
                    Process Custom Image URL
                </button>
            </div>

            ---

            {loading && <p style={styles.loading}>Loading OCR data...</p>}
            {error && (
                <div style={styles.errorContainer}>
                    <p style={styles.errorMessage}>{error}</p>
                </div>
            )}

            {ocrResult && (
                <div style={styles.resultContainer}>
                    <div style={styles.imageSection}>
                        <h2 style={styles.subHeading}>Original Image ({selectedJob === 'custom-url' ? (customJobSelect || 'Custom URL') : selectedJob})</h2>
                        {ocrResult.image_url ? (
                            <img
                                src={ocrResult.image_url}
                                alt="OCR Image"
                                style={styles.image}
                            />
                        ) : (
                            <p>No image URL found for this result.</p>
                        )}
                        {ocrResult.image_url && (
                             <p style={styles.imageLinkText}>
                                 <a href={ocrResult.image_url} target="_blank" rel="noopener noreferrer">
                                     Lihat Gambar Asli
                                 </a>
                             </p>
                         )}
                    </div>
                    <div style={styles.jsonSection}>
                        <h2 style={styles.subHeading}>Parsed Data</h2>
                        <pre style={styles.pre}>
                            {JSON.stringify(ocrResult.parsed_receipt_data, null, 2)}
                        </pre>
                        <h2 style={styles.subHeading}>Full OCR Text</h2>
                        <pre style={styles.pre}>
                            {ocrResult.json_full}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        fontFamily: 'Arial, sans-serif',
        maxWidth: '1000px',
        margin: '40px auto',
        padding: '30px',
        border: '1px solid #ddd',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        backgroundColor: '#fdfdfd',
        color: '#333',
    },
    heading: {
        textAlign: 'center',
        color: '#0056b3',
        marginBottom: '25px',
        fontSize: '2.5em',
        fontWeight: 'bold',
    },
    description: {
        textAlign: 'center',
        marginBottom: '20px',
        fontSize: '1.1em',
        color: '#555',
    },
    buttonContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '15px',
        marginBottom: '30px',
    },
    button: {
        padding: '12px 25px',
        fontSize: '1em',
        fontWeight: 'bold',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.3s ease, transform 0.2s ease',
    },
    inputContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginBottom: '30px',
        alignItems: 'center',
    },
    inputField: {
        width: 'calc(100% - 40px)',
        maxWidth: '600px',
        padding: '12px',
        fontSize: '1em',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxSizing: 'border-box',
    },
    selectField: { // Gaya baru untuk select
        width: 'calc(100% - 40px)',
        maxWidth: '600px',
        padding: '12px',
        fontSize: '1em',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxSizing: 'border-box',
        backgroundColor: '#fff',
        cursor: 'pointer',
    },
    loading: {
        textAlign: 'center',
        color: '#007bff',
        fontSize: '1.2em',
        marginTop: '20px',
        fontStyle: 'italic',
    },
    errorContainer: {
        backgroundColor: '#ffe6e6',
        border: '1px solid #ff0000',
        padding: '15px',
        borderRadius: '8px',
        marginTop: '20px',
    },
    errorMessage: {
        color: '#ff0000',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    resultContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '30px',
        marginTop: '30px',
    },
    imageSection: {
        flex: '1 1 45%',
        minWidth: '300px',
        backgroundColor: '#f0f0f0',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    jsonSection: {
        flex: '1 1 45%',
        minWidth: '300px',
        backgroundColor: '#f0f0f0',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    },
    subHeading: {
        color: '#0056b3',
        marginBottom: '15px',
        fontSize: '1.5em',
        textAlign: 'center',
        width: '100%',
    },
    image: {
        maxWidth: '100%',
        height: 'auto',
        borderRadius: '8px',
        border: '1px solid #ccc',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
        marginBottom: '10px',
    },
    imageLinkText: {
        fontSize: '0.9em',
        color: '#555',
        textAlign: 'center',
    },
    pre: {
        backgroundColor: '#e9ecef',
        padding: '15px',
        borderRadius: '8px',
        overflowX: 'auto',
        maxHeight: '400px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '0.9em',
        lineHeight: '1.4',
        border: '1px solid #dee2e6',
    },
};