import QRCode from 'qrcode';
import { CryptographicKeyPair } from '../types';

export class WebCryptoIdentityService {
  /**
   * Generates a modern ECDH P-256 key pair for peer-to-peer identity and message encryption
   */
  async generateKeyPair(): Promise<CryptographicKeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );

    // Export Public Key to SubjectPublicKeyInfo (SPKI) ArrayBuffer
    const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyPEM = this.arrayBufferToPEM(spkiBuffer, 'PUBLIC KEY');

    // Export Private Key to JWK for secure storage inside IndexedDB
    const privateKeyJWK = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

    // Generate SHA-256 fingerprint hex of public key
    const fingerprint = await this.calculateFingerprint(spkiBuffer);

    return {
      publicKeyPEM,
      privateKeyJWK,
      keyFingerprint: fingerprint,
    };
  }

  /**
   * Computes a clean 16-character uppercase hex fingerprint formatted as XXXX-XXXX-XXXX-XXXX
   */
  private async calculateFingerprint(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexFull = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    // Group into 4-char chunks: ABCD-1234-EF56-7890
    return `${hexFull.slice(0, 4)}-${hexFull.slice(4, 8)}-${hexFull.slice(8, 12)}-${hexFull.slice(12, 16)}`;
  }

  /**
   * Converts ArrayBuffer to Base64 PEM string
   */
  private arrayBufferToPEM(buffer: ArrayBuffer, label: string): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const formattedBase64 = base64.match(/.{1,64}/g)?.join('\n') || base64;
    return `-----BEGIN ${label}-----\n${formattedBase64}\n-----END ${label}-----`;
  }

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
   * Generates formatted identity JSON string for QR Code exchange (FR-3)
   */
  formatQRPayload(userId: string, username: string, publicKeyPEM: string, fingerprint: string): string {
    return JSON.stringify({
      protocol: 'FasDM_Mesh_v1',
      type: 'IDENTITY',
      userId,
      username,
      fingerprint,
      pubKey: publicKeyPEM,
    });
  }
}

export const cryptoService = new WebCryptoIdentityService();
