import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_URL });

/**
 * Upload a PDF and convert to slides.
 * @param {File} file - The PDF file to upload
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<ConvertResponse>}
 */
export async function convertPDF(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/api/convert", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      const pct = Math.round((e.loaded * 100) / e.total);
      onProgress?.(pct);
    },
  });

  return response.data;
}

/**
 * Download a generated .pptx by job_id.
 */
export function getDownloadUrl(jobId) {
  return `${API_URL}/api/download/${jobId}`;
}

export default api;