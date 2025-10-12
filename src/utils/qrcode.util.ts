import QRCode from "qrcode";

/**
 * Generate QR code as base64 string
 * @param data - Data to encode in QR code (URL, text, etc.)
 * @returns Base64 string of QR code image
 */
export async function generateQRCodeBase64(data: string): Promise<string> {
  try {
    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: 300,
      margin: 2,
    });
    
    // Return the full data URL (includes data:image/png;base64,...)
    return qrCodeDataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Không thể tạo QR code");
  }
}

/**
 * Generate QR code check URL for reservation
 * @param reservationId - ID of the reservation
 * @param baseUrl - Base URL of the frontend (e.g., https://fe-ev-charging-station.vercel.app)
 * @returns Full URL for QR check endpoint
 */
export function generateQRCheckUrl(
  reservationId: string,
  baseUrl: string = process.env.FRONTEND_URL || "https://fe-ev-charging-station.vercel.app"
): string {
  // Remove trailing slash if exists
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  return `${cleanBaseUrl}/reservations/qr-check?reservationId=${reservationId}`;
}

