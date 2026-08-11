import QRCode from 'qrcode';

export class IdentityService {
  /**
   * Generates a Data URL for rendering a QR code image
   */
  async generateQRCodeDataURL(text: string): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.error('Failed to generate QR Code Data URL:', err);
      throw err;
    }
  }

  /**
   * Generates formatted identity JSON string for QR Code exchange
   */
  formatQRPayload(userId: string, username: string): string {
    return JSON.stringify({
      protocol: 'FasDM_Mesh_v1',
      type: 'IDENTITY',
      userId,
      username,
    });
  }
}

export const cryptoService = new IdentityService();


