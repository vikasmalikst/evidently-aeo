interface OTPData {
  otp: string;
  expiresAt: number;
}

export class OTPService {
  // In-memory store for OTPs: email -> OTPData
  private otpStore: Map<string, OTPData> = new Map();
  private readonly OTP_VALIDITY_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

  constructor() {
    // Periodically clean up expired OTPs
    setInterval(() => this.cleanupExpiredOTPs(), 60 * 60 * 1000); // Run every hour
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createOTP(email: string): Promise<string> {
    const otp = this.generateOTP();
    const expiresAt = Date.now() + this.OTP_VALIDITY_DURATION;
    
    this.otpStore.set(email, { otp, expiresAt });
    console.log(`Generated OTP for ${email}: ${otp}`); // For debugging (remove in prod logs if sensitive)
    
    return otp;
  }

  verifyOTP(email: string, otp: string): boolean {
    const data = this.otpStore.get(email);
    
    if (!data) {
      return false;
    }

    if (Date.now() > data.expiresAt) {
      this.otpStore.delete(email);
      return false;
    }

    if (data.otp !== otp) {
      return false;
    }

    // OTP is valid. Note: We might want to keep it until password reset is done, 
    // or delete it here and issue a temporary "reset token".
    // For this flow, we'll verify it again during reset or trust the frontend flow (less secure).
    // Better approach: verifyOTP returns true, and we keep it until resetPassword consumes it.
    // Or we can issue a signed token upon verification.
    
    return true;
  }

  // Helper to consume OTP (delete after use)
  consumeOTP(email: string, otp: string): boolean {
    if (this.verifyOTP(email, otp)) {
      this.otpStore.delete(email);
      return true;
    }
    return false;
  }

  private cleanupExpiredOTPs() {
    const now = Date.now();
    for (const [email, data] of this.otpStore.entries()) {
      if (now > data.expiresAt) {
        this.otpStore.delete(email);
      }
    }
  }
}

export const otpService = new OTPService();
