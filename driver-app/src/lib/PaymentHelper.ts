// Payment Helper Runtime Module
// Provides payment-related utility functions for both driver and customer apps

// Format currency (NOK) for display
export const formatCurrency = (
  amount: number,
  options: {
    showCurrency?: boolean;
    locale?: string;
    currency?: string;
  } = {}
): string => {
  const { showCurrency = true, locale = 'nb-NO', currency = 'NOK' } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace(/ /g, ' '); // Replace non-breaking space with regular space
};

// Format currency without symbol
export const formatCurrencyWithoutSymbol = (
  amount: number,
  options: {
    locale?: string;
    currency?: string;
  } = {}
): string => {
  const { locale = 'nb-NO', currency = 'NOK' } = options;

  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace(/ /g, ' '); // Replace non-breaking space with regular space
};

// Calculate tip based on percentage
export const calculateTip = (amount: number, tipPercentage: number): number => {
  return Math.round((amount * tipPercentage) / 100);
};

// Calculate total with tip
export const calculateTotalWithTip = (amount: number, tipPercentage: number): number => {
  const tip = calculateTip(amount, tipPercentage);
  return amount + tip;
};

// Format payment status
export const formatPaymentStatus = (status: string): { text: string; variant: string } => {
  const statusMap: Record<string, { text: string; variant: string }> = {
    pending: { text: 'Venter', variant: 'warning' },
    processing: { text: 'Behandler', variant: 'info' },
    paid: { text: 'Betalt', variant: 'success' },
    failed: { text: 'Mislyktes', variant: 'error' },
    cancelled: { text: 'Avbrutt', variant: 'default' },
    refunded: { text: 'Tilbakebetalt', variant: 'success' },
  };

  return statusMap[status.toLowerCase()] || { text: status, variant: 'default' };
};

// Generate payment reference ID
export const generatePaymentReference = (
  prefix: string = 'KJAPP',
  length: number = 10
): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
};

// Validate card number using Luhn algorithm
export const validateCardNumber = (cardNumber: string): boolean => {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Check if all digits
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  // Implement Luhn algorithm
  let sum = 0;
  let shouldDouble = false;

  // Start from the rightmost digit and move left
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i));

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

// Mask card number for display
export const maskCardNumber = (cardNumber: string): string => {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Check if we have enough digits to mask
  if (cleaned.length < 4) {
    return cardNumber; // Return original if too short
  }

  // Keep last 4 digits visible
  const lastFour = cleaned.slice(-4);
  const maskedLength = cleaned.length - 4;

  // Create masked portion
  let masked = '';
  for (let i = 0; i < maskedLength; i++) {
    masked += '*';
  }

  // Format with spaces for readability (groups of 4)
  const result = masked + lastFour;
  return result.replace(/(.{4})/g, '$1 ').trim();
};

// Detect card type from number
export const getCardType = (cardNumber: string): string => {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Define card patterns
  const cardPatterns: Record<string, RegExp> = {
    visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
    mastercard: /^5[1-5][0-9]{14}$/,
    amex: /^3[47][0-9]{13}$/,
    discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
    maestro: /^(?:5[0678]\\d\\d|6304|6390|67\\d\\d)[0-9]{8,15}$/,
    dankort: /^5019[0-9]{12}$/,
    visaElectron: /^(4026|417500|4508|4844|491(3|7))[0-9]{10,12}$/,
  };

  // Check each pattern
  for (const [type, pattern] of Object.entries(cardPatterns)) {
    if (pattern.test(cleaned)) {
      return type;
    }
  }

  return 'unknown';
};

// Format amount in NOK with proper spacing
export const formatNOKAmount = (amount: number): string => {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace(/ /g, ' ');
};

// Calculate fee based on percentage
export const calculateFee = (amount: number, feePercentage: number): number => {
  return Math.round((amount * feePercentage) / 100);
};

// Calculate net amount after fee
export const calculateNetAmount = (amount: number, feePercentage: number): number => {
  const fee = calculateFee(amount, feePercentage);
  return amount - fee;
};

// Format split payment details
export const formatSplitPayment = (
  totalAmount: number,
  splitCount: number
): { perPerson: string; total: string } => {
  const perPerson = totalAmount / splitCount;
  return {
    perPerson: formatNOKAmount(perPerson),
    total: formatNOKAmount(totalAmount),
  };
};