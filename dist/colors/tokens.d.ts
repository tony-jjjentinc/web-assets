// generated
export type GroupSlug = 'jjjei_gmo-0' | 'jjjei_gmo-1' | 'jjjei_gmo-2' | 'jjjei_gmo-3' | 'jjjei_admin-0' | 'jjjei_admin-1' | 'jjjei_admin-2' | 'jjjei_admin-3' | 'jjjei_admin-4' | 'jjjei_admin-5' | 'jjjei_facilities-0' | 'jjjei_facilities-1' | 'jjjei_facilities-2' | 'jjjei_facilities-3' | 'jjjei_facilities-4' | 'jjjei_facilities-5' | 'jjjei_facilities-6' | 'jjjei_leasing-0' | 'jjjei_leasing-1' | 'jjjei_leasing-2' | 'jjjei_leasing-3' | 'jjjei_hr-0' | 'jjjei_hr-1' | 'jjjei_hr-2' | 'jjjei_procinv-0' | 'jjjei_procinv-1' | 'jjjei_procinv-2' | 'jjjei_controller-0' | 'jjjei_controller-1' | 'jjjei_controller-2' | 'jjjei_controller-3' | 'jjjei_treasury-0' | 'jjjei_treasury-1' | 'jjjei_treasury-2' | 'jjjei_treasury-3';
export type StatusName = 'status-0' | 'status-1' | 'status-2' | 'status-3' | 'status-4' | 'status-5' | 'status-6' | 'status-7' | 'status-8' | 'status-9';
export interface LightRoles {
  base: string;
  rgb: string;
  contrast: string;
  hoverContrast: string;
  activeContrast: string;
  hoverBg: string;
  hoverBorder: string;
  activeBg: string;
  activeBorder: string;
  focusRgb: string;
  focusBorder: string;
  subtle: string;
  borderSubtle: string;
  faint: string;
  faintBorder: string;
  shaded: string;
  shadedBorder: string;
  body: string;
  bodyBorder: string;
  emphasis: string;
  link: string;
  linkRgb: string;
  linkHover: string;
  linkHoverRgb: string;
  linkFocusRgb: string;
  linkHelperHover: string;
  linkHelperHoverRgb: string;
  rangeActive: string;
  text: string;
  tableBg: string;
  tableColor: string;
  tableBorder: string;
  tableStriped: string;
  tableActive: string;
  tableHover: string;
}
export interface DarkRoles {
  subtle: string;
  borderSubtle: string;
  faint: string;
  faintBorder: string;
  body: string;
  bodyBorder: string;
  emphasis: string;
  link: string;
  linkRgb: string;
  linkHover: string;
  linkHoverRgb: string;
}
export interface ColorTokens { hex: string; light: LightRoles; dark: DarkRoles; }
export interface GroupTokens extends ColorTokens { label: string | null; department: string; legacyId: string; status: 'active' | 'deprecated'; baseBg: { light: string; dark: string }; }
export const version: string;
export const groups: Record<GroupSlug, GroupTokens>;
export const system: Record<string, ColorTokens>;
export const status: Record<StatusName, ColorTokens & { meaning: string | null }>;
