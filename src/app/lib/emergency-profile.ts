export const ageRanges = { '': 'Prefer not to say', under18: 'Under 18', '18to59': '18–59', '60plus': '60 and above' } as const;
export const pwdStatuses = { '': 'Prefer not to say', yes: 'Yes', no: 'No' } as const;
export const assistanceOptions = {
  mobility: 'Mobility or wheelchair assistance',
  hearing: 'Hearing or communication assistance',
  vision: 'Vision or navigation assistance',
  transport: 'Evacuation transport',
  caregiver: 'Caregiver or companion support',
} as const;
export const contactRelationships = { '': 'Select relationship', parent: 'Parent / guardian', partner: 'Spouse / partner', family: 'Other family member', friend: 'Friend', caregiver: 'Caregiver', other: 'Other trusted person' } as const;
export interface EmergencyContact { name: string; phone: string; relationship: keyof typeof contactRelationships }
export interface EmergencyProfile {
  version: 1;
  ageRange: keyof typeof ageRanges;
  pwdStatus: keyof typeof pwdStatuses;
  assistanceNeeds: (keyof typeof assistanceOptions)[];
  shareWithOperators: boolean;
  emergencyContact: EmergencyContact;
  contactConsent: boolean;
}
export const emptyEmergencyProfile = (): EmergencyProfile => ({ version: 1, ageRange: '', pwdStatus: '', assistanceNeeds: [], shareWithOperators: false, emergencyContact: { name: '', phone: '', relationship: '' }, contactConsent: false });
export const contactFieldLabel = (field: string) => field === 'emergencyContact' ? 'emergency contact' : field;
