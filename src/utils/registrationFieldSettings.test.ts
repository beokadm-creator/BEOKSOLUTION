import { normalizeFieldSettings, DEFAULT_REGISTRATION_FIELD_SETTINGS } from './registrationFieldSettings';

describe('registrationFieldSettings', () => {
  it('returns default settings when raw is undefined', () => {
    const result = normalizeFieldSettings();
    expect(result).toEqual(DEFAULT_REGISTRATION_FIELD_SETTINGS);
  });

  it('forces name field to be visible and required even if overridden', () => {
    const result = normalizeFieldSettings({
      name: { visible: false, required: false }
    });
    expect(result.name).toEqual({ visible: true, required: true });
  });

  it('merges provided settings with defaults', () => {
    const result = normalizeFieldSettings({
      licenseNumber: { visible: false, required: false }
    });
    expect(result.licenseNumber).toEqual({ visible: false, required: false });
    expect(result.email).toEqual(DEFAULT_REGISTRATION_FIELD_SETTINGS.email);
  });

  it('forces required to false if visible is false', () => {
    const result = normalizeFieldSettings({
      phone: { visible: false, required: true }
    });
    expect(result.phone).toEqual({ visible: false, required: false });
  });
});
