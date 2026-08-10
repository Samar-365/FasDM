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

  /**
   * Imports a private key JWK into a CryptoKey for ECDH derivation
   */
  async importPrivateKeyJWK(privateKeyJWK: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'jwk',
      privateKeyJWK,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Imports a public key PEM string into a CryptoKey for ECDH derivation
   */
  async importPublicKeyPEM(publicKeyPEM: string): Promise<CryptoKey> {
    const cleanPem = publicKeyPEM
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s+/g, '');
    const binaryDerString = atob(cleanPem);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
      'spki',
      binaryDer.buffer,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  }

  /**
   * Derives an ECDH AES-256-GCM shared secret key between local private key and target peer's public key
   */
  async deriveSharedAESKey(myPrivateKeyJWK: JsonWebKey, peerPublicKeyPEM: string): Promise<CryptoKey> {
    const myPrivateKey = await this.importPrivateKeyJWK(myPrivateKeyJWK);
    const peerPublicKey = await this.importPublicKeyPEM(peerPublicKeyPEM);

    return await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: peerPublicKey,
      },
      myPrivateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts plaintext message using derived AES-256-GCM key and returns base64 IV and Ciphertext
   */
  async encryptPayload(plaintext: string, sharedAESKey: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(plaintext);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      sharedAESKey,
      encodedData
    );

    const ivBase64 = btoa(String.fromCharCode(...iv));
    const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

    return {
      iv: ivBase64,
      ciphertext: ciphertextBase64,
    };
  }

  /**
   * Decrypts AES-256-GCM ciphertext using base64 IV and shared key back into UTF-8 plaintext string
   */
  async decryptPayload(ciphertextBase64: string, ivBase64: string, sharedAESKey: CryptoKey): Promise<string> {
    const ivString = atob(ivBase64);
    const iv = new Uint8Array(ivString.length);
    for (let i = 0; i < ivString.length; i++) {
      iv[i] = ivString.charCodeAt(i);
    }

    const ciphertextString = atob(ciphertextBase64);
    const ciphertext = new Uint8Array(ciphertextString.length);
    for (let i = 0; i < ciphertextString.length; i++) {
      ciphertext[i] = ciphertextString.charCodeAt(i);
    }

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      sharedAESKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }
}

export const cryptoService = new WebCryptoIdentityService();

