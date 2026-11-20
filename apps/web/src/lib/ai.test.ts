import { describe, expect, it } from 'vitest';
import { aiBlock, lostVariables, type AiStatus } from './ai';

const base: AiStatus = {
  enabled: true,
  features: {
    write: true,
    translate: true,
    suggest: true,
    generate: true,
    dataset: true,
    chart: true,
    assistant: true,
  },
  used: 0,
  quota: 500,
  userToday: 0,
  userDailyRequests: 30,
  workspaceQuotaReached: false,
  userQuotaReached: false,
  renewsOn: '2026-12-01',
  canEdit: true,
  canManage: false,
};

describe('aiBlock', () => {
  it('désactivé, fonction décochée, rôle, quotas', () => {
    expect(aiBlock(null, 'write')).toBe('disabled');
    expect(aiBlock({ ...base, enabled: false }, 'write')).toBe('disabled');
    expect(aiBlock({ ...base, features: { ...base.features, chart: false } }, 'chart')).toBe('disabled');
    expect(aiBlock({ ...base, canEdit: false }, 'write')).toBe('role');
    expect(aiBlock({ ...base, workspaceQuotaReached: true }, 'write')).toBe('quota');
    expect(aiBlock({ ...base, userQuotaReached: true }, 'write')).toBe('userQuota');
    expect(aiBlock(base, 'write')).toBeNull();
  });
});

describe('lostVariables', () => {
  it('variables disparues de la proposition', () => {
    expect(lostVariables('Bonjour {{first_name}}, ouvrez {{ app }}', 'Bonjour, ouvrez {{app}}')).toEqual([
      'first_name',
    ]);
    expect(lostVariables('Sans variable', 'Autre')).toEqual([]);
  });
});
