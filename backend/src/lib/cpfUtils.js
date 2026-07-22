/**
 * Brazilian CPF validation utilities.
 * CPF format: 000.000.000-00 or 00000000000 (11 digits)
 */

export function normalizeCpf(raw) {
  if (!raw) return null;
  return String(raw).replace(/\D/g, "");
}

export function isValidCpfFormat(cpf) {
  const digits = normalizeCpf(cpf);
  return digits !== null && /^\d{11}$/.test(digits);
}

export function isValidCpfChecksum(cpf) {
  const digits = normalizeCpf(cpf);
  if (!digits || digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // all same digit

  const calc = (factor) => {
    let sum = 0;
    for (let i = 0; i < factor - 1; i++) {
      sum += parseInt(digits[i]) * (factor - i);
    }
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };

  return calc(10) === parseInt(digits[9]) && calc(11) === parseInt(digits[10]);
}

/**
 * Validate CPF and return a normalized version.
 * Returns null if invalid; throws if throwOnInvalid is true.
 */
export function validateAndNormalizeCpf(raw, throwOnInvalid = false) {
  const digits = normalizeCpf(raw);
  if (!digits) return null;
  if (!isValidCpfFormat(digits) || !isValidCpfChecksum(digits)) {
    if (throwOnInvalid) {
      const err = new Error(`Invalid CPF: ${raw}`);
      err.status = 422;
      err.code = "INVALID_CPF";
      throw err;
    }
    return null;
  }
  return digits; // return as 11-digit string
}

/**
 * Validate CPF/foreigner rule on a fan profile payload.
 * Throws a 422 error if a Brazilian non-foreigner has an invalid or missing CPF.
 */
export function validateCpfOrForeigner(payload) {
  const { cpf, isForeigner } = payload;
  if (isForeigner) return; // foreigners don't need CPF
  if (!cpf) return; // optional field — data completeness tracked separately

  validateAndNormalizeCpf(cpf, true); // throws if invalid
}
