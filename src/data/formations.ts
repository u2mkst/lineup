import type { Pos } from '../types';

export const formationGroups: { label: string; items: string[] }[] = [
  { label: '백4', items: ['4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '4-1-4-1', '4-3-2-1', '4-5-1'] },
  { label: '백3', items: ['3-5-2', '3-4-3', '3-4-1-2', '3-4-2-1', '3-2-4-1'] },
  { label: '백5', items: ['5-3-2', '5-4-1'] },
];

// Field-player role names per line, from the defensive line to the attack.
export const formationRoles: Record<string, string[][]> = {
  '4-3-3': [['LB', 'LCB', 'RCB', 'RB'], ['LCM', 'CM', 'RCM'], ['LW', 'ST', 'RW']],
  '4-2-3-1': [['LB', 'LCB', 'RCB', 'RB'], ['LCM', 'RCM'], ['LW', 'AM', 'RW'], ['ST']],
  '4-4-2': [['LB', 'LCB', 'RCB', 'RB'], ['LM', 'LCM', 'RCM', 'RM'], ['LST', 'RST']],
  '4-1-2-1-2': [['LB', 'LCB', 'RCB', 'RB'], ['CDM'], ['LCM', 'RCM'], ['AM'], ['LST', 'RST']],
  '4-1-4-1': [['LB', 'LCB', 'RCB', 'RB'], ['CDM'], ['LM', 'LCM', 'RCM', 'RM'], ['ST']],
  '4-3-2-1': [['LB', 'LCB', 'RCB', 'RB'], ['LCM', 'CM', 'RCM'], ['LAM', 'RAM'], ['ST']],
  '4-5-1': [['LB', 'LCB', 'RCB', 'RB'], ['LM', 'LCM', 'CM', 'RCM', 'RM'], ['ST']],
  '3-5-2': [['LCB', 'CB', 'RCB'], ['LWB', 'LCM', 'CM', 'RCM', 'RWB'], ['LST', 'RST']],
  '3-4-3': [['LCB', 'CB', 'RCB'], ['LWB', 'LCM', 'RCM', 'RWB'], ['LW', 'ST', 'RW']],
  '3-4-1-2': [['LCB', 'CB', 'RCB'], ['LWB', 'LCM', 'RCM', 'RWB'], ['AM'], ['LST', 'RST']],
  '3-4-2-1': [['LCB', 'CB', 'RCB'], ['LWB', 'LCM', 'RCM', 'RWB'], ['LAM', 'RAM'], ['ST']],
  '3-2-4-1': [['LCB', 'CB', 'RCB'], ['LCM', 'RCM'], ['LW', 'LAM', 'RAM', 'RW'], ['ST']],
  '5-3-2': [['LWB', 'LCB', 'CB', 'RCB', 'RWB'], ['LCM', 'CM', 'RCM'], ['LST', 'RST']],
  '5-4-1': [['LWB', 'LCB', 'CB', 'RCB', 'RWB'], ['LM', 'LCM', 'RCM', 'RM'], ['ST']],
};

export const DEFAULT_FORMATION = '4-2-3-1';

/** Preferred roster position group for a role, used by auto-fill. */
export function roleGroup(role: string): Pos {
  if (role === 'GK') return 'GK';
  if (/^(LB|RB|LWB|RWB|LCB|RCB|CB)$/.test(role)) return 'DF';
  if (/^(LW|RW|ST|LST|RST)$/.test(role)) return 'FW';
  return 'MF';
}
