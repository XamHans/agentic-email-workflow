// src/db/schema.ts
import {
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { VerificationReport } from '../company-valid-flow/types';

export const verificationReports = pgTable('verification_reports', {
  id: text('id').primaryKey(),
  report: jsonb('report').$type<VerificationReport>().notNull(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const schema = {
  verificationReports,
};
