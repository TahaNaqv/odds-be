const { customAlphabet } = require('nanoid');

// Generate a unique 8-character referral code using alphanumeric characters
const generateCode = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

export const generateReferralCode = (): string => {
  return generateCode();
};

export function isValidReferralCode(code: string): boolean {
  return /^[a-z0-9]{8}$/.test(code);
}
