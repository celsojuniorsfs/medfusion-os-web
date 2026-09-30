import { components } from '../api-types';
import { UserRole } from '../auth/user-role';

export type AlertType = NonNullable<components['schemas']['Alert']['type']>;

export type Alert = components['schemas']['Alert'] & {
  id: string;
  type: AlertType;
  title: string;
  notified_at: string;
};

export const ALERT_ROLES: UserRole[] = ['administrative', 'general_admin'];

export const canSeeAlerts = (role: UserRole | undefined): boolean =>
  role !== undefined && ALERT_ROLES.includes(role);
