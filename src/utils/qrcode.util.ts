import QRCode from "qrcode";
import crypto from "crypto";

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
 * Hash reservation ID using HASH_PASSWORD_KEY
 * @param reservationId - ID of the reservation
 * @returns Hashed string
 */
export function hashReservationId(reservationId: string): string {
  const secret = process.env.HASH_PASSWORD_KEY || "default_secret_key";
  return crypto
    .createHmac("sha256", secret)
    .update(reservationId)
    .digest("hex");
}

/**
 * Verify hashed reservation ID
 * @param reservationId - Original reservation ID
 * @param hash - Hashed string to verify
 * @returns Boolean indicating if hash matches
 */
export function verifyReservationHash(reservationId: string, hash: string): boolean {
  const expectedHash = hashReservationId(reservationId);
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash),
    Buffer.from(hash)
  );
}

/**
 * Generate QR code data with hashed reservation ID
 * @param reservationId - ID of the reservation
 * @returns JSON string containing reservation ID and hash
 */
export function generateQRData(reservationId: string): string {
  const hash = hashReservationId(reservationId);
  return JSON.stringify({
    reservationId,
    hash,
  });
}

/**
 * Generate QR code for reservation
 * @param reservationId - ID of the reservation
 * @returns Base64 QR code image
 */
export async function generateReservationQRCode(reservationId: string): Promise<string> {
  const qrData = generateQRData(reservationId);
  return generateQRCodeBase64(qrData);
}


