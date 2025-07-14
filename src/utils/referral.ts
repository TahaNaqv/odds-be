// Generate a unique 8-character referral code using alphanumeric characters
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[randomIndex];
  }
  return code;
}

export const generateReferralCode = (): string => {
  return generateCode();
};

export function isValidReferralCode(code: string): boolean {
  return /^[a-z0-9]{8}$/.test(code);
}
