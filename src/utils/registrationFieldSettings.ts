import type { RegistrationFieldSettings, RegistrationFieldKey } from '../types/schema';

export const FIELD_LABELS: Record<RegistrationFieldKey, string> = {
  name: '이름',
  email: '이메일',
  phone: '휴대폰 번호',
  affiliation: '소속',
  licenseNumber: '면허번호'
};

export const DEFAULT_REGISTRATION_FIELD_SETTINGS: RegistrationFieldSettings = {
  name: { visible: true, required: true },
  email: { visible: true, required: true },
  phone: { visible: true, required: true },
  affiliation: { visible: true, required: true },
  licenseNumber: { visible: true, required: false }
};

export function normalizeFieldSettings(
  raw?: Partial<RegistrationFieldSettings>
): RegistrationFieldSettings {
  if (!raw) {
    return { ...DEFAULT_REGISTRATION_FIELD_SETTINGS };
  }

  const merged = { ...DEFAULT_REGISTRATION_FIELD_SETTINGS };

  for (const key of Object.keys(DEFAULT_REGISTRATION_FIELD_SETTINGS) as RegistrationFieldKey[]) {
    if (raw[key]) {
      merged[key] = {
        visible: raw[key]?.visible ?? DEFAULT_REGISTRATION_FIELD_SETTINGS[key].visible,
        required: raw[key]?.required ?? DEFAULT_REGISTRATION_FIELD_SETTINGS[key].required
      };
      
      // If a field is not visible, it cannot be required
      if (!merged[key].visible) {
        merged[key].required = false;
      }
    }
  }

  // FORCE name field to always be visible and required
  merged.name = { visible: true, required: true };

  return merged;
}
