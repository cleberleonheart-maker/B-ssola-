import { NativeModules } from 'react-native';
import { hasCountryCode, normalizePhone, phoneForWhatsApp } from '../utils/beacon';

export { hasCountryCode, phoneForWhatsApp };

/**
 * Números de telefone no formato internacional (E.164).
 *
 * O WhatsApp só encontra um contacto pelo número completo: com o número local
 * ("21999990000") responde que o número não está no WhatsApp, mesmo estando —
 * o erro é do formato. O módulo nativo `PhoneNumber` passa o número ao
 * formato internacional usando o país do telemóvel, que é a única coisa que
 * falta para o número local fazer sentido.
 *
 * Sem o módulo nativo (iOS, testes, web) fica a normalização em JavaScript:
 * dígitos e, se o utilizador o escreveu, o `+` à frente. É menos do que o
 * ideal, mas nunca pior do que estava.
 */

type PhoneNumberNative = {
  countryIso?: () => Promise<string>;
  toE164?: (number: string) => Promise<string | null>;
};

const native = (NativeModules as { PhoneNumber?: PhoneNumberNative }).PhoneNumber;

/** O país do telemóvel em ISO ("BR"), ou "" se não se conseguir saber. */
export const deviceCountryIso = async (): Promise<string> => {
  if (!native?.countryIso) return '';
  try {
    return (await native.countryIso()) || '';
  } catch {
    return '';
  }
};

/**
 * O número no formato internacional, com `+` ("+5521999990000").
 *
 * Devolve o número tal e qual quando não há como convertê-lo: melhor guardar
 * o que o utilizador escreveu do que inventar um.
 */
export const toInternationalPhone = async (raw: string): Promise<string> => {
  const fallback = normalizePhone(raw);
  if (!native?.toE164 || fallback.length === 0) return fallback;
  try {
    const result = await native.toE164(raw);
    return result && result.length > 0 ? result : fallback;
  } catch {
    return fallback;
  }
};

/**
 * O número como o WhatsApp o quer: só dígitos, sem o `+` e sem o `00` do
 * prefixo internacional (`wa.me` e `whatsapp://send` não os aceitam).
 * A função mora em `utils/beacon` (é pura e testada); aqui fica reexportada
 * para quem deals com o WhatsApp não ter de saber onde está.
 */
