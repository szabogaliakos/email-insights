import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Simple encryption utilities for storing app passwords securely
 * Uses a hash of user email + environment variable as encryption key
 */
export class PasswordEncryption {
  private static getKey(email: string): Buffer {
    const salt = process.env.ENCRYPTION_SALT || "default-salt-change-in-production";
    return crypto.scryptSync(salt + email, "salt", KEY_LENGTH);
  }

  static encrypt(text: string, email: string): string {
    try {
      const key = this.getKey(email);
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Return format: iv:encrypted
      return `${iv.toString("hex")}:${encrypted}`;
    } catch (error) {
      throw new Error("Encryption failed");
    }
  }

  static decrypt(encryptedText: string, email: string): string {
    try {
      const key = this.getKey(email);
      const [ivHex, encrypted] = encryptedText.split(":");

      if (!ivHex || !encrypted) {
        throw new Error("Invalid encrypted format");
      }

      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new Error("Decryption failed");
    }
  }
}
