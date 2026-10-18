import { sql } from 'drizzle-orm';
import {
  pgTable, uuid, text, integer, smallint, timestamp, boolean, jsonb,
  primaryKey, unique, uniqueIndex, index, check, customType, foreignKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
const time = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => time('created_at').notNull().defaultNow();

export const events = pgTable('event', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(), title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  opensAt: time('opens_at'), closesAt: time('closes_at'), closedAt: time('closed_at'),
  rulesVersion: integer('rules_version').notNull(), cardVersion: text('card_version').notNull(),
  codeAllowance: integer('code_allowance').notNull(), createdAt: created(),
}, t => [
  check('event_status_valid', sql`${t.status} in ('draft','open','closed')`),
  check('event_allowance_valid', sql`${t.codeAllowance} between 1 and 24`),
  check('event_window_valid', sql`${t.closesAt} is null or ${t.opensAt} is null or ${t.closesAt} > ${t.opensAt}`),
]);

export const eventHosts = pgTable('event_host', {
  eventId: uuid('event_id').notNull().references(() => events.id),
  authUserId: text('auth_user_id').notNull(), createdAt: created(),
}, t => [primaryKey({ columns: [t.eventId, t.authUserId] })]);

export const participations = pgTable('participation', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  authUserId: text('auth_user_id').notNull(), displayName: text('display_name').notNull(),
  recruitmentConsent: boolean('recruitment_consent').notNull().default(false),
  consentAt: time('consent_at'), createdAt: created(),
}, t => [
  unique('participation_user_event_unique').on(t.eventId, t.authUserId),
  unique('participation_event_id_unique').on(t.eventId, t.id),
  check('participation_name_valid', sql`length(${t.displayName}) between 1 and 80`),
  check('participation_consent_valid', sql`${t.recruitmentConsent} = (${t.consentAt} is not null)`),
]);

export const invitations = pgTable('invitation', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  tokenDigest: bytea('token_digest').notNull().unique(),
  participationId: uuid('participation_id'),
  expiresAt: time('expires_at'), createdAt: created(),
}, t => [
  uniqueIndex('invitation_participation_unique').on(t.participationId).where(sql`${t.participationId} is not null`),
  foreignKey({ columns: [t.eventId, t.participationId], foreignColumns: [participations.eventId, participations.id] }),
]);

export const squares = pgTable('square', {
  id: uuid('id').primaryKey().defaultRandom(), cardVersion: text('card_version').notNull(),
  squareKey: text('square_key').notNull(), label: text('label').notNull(),
  category: text('category').notNull(), skillKey: text('skill_key'),
}, t => [unique('square_version_key_unique').on(t.cardVersion, t.squareKey)]);

export const cardCells = pgTable('card_cell', {
  participationId: uuid('participation_id').notNull().references(() => participations.id),
  position: smallint('position').notNull(), squareId: uuid('square_id').references(() => squares.id),
}, t => [
  primaryKey({ columns: [t.participationId, t.position] }),
  unique('card_square_unique').on(t.participationId, t.squareId),
  check('card_position_valid', sql`${t.position} between 0 and 24`),
  check('card_free_center', sql`(${t.position} = 12) = (${t.squareId} is null)`),
]);

export const codes = pgTable('code', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  ownerParticipationId: uuid('owner_participation_id').notNull(),
  tokenDigest: bytea('token_digest').notNull().unique(), tokenCiphertext: bytea('token_ciphertext').notNull(),
  ordinal: smallint('ordinal').notNull(),
  redeemedClaimId: uuid('redeemed_claim_id').references((): AnyPgColumn => claims.id),
  createdAt: created(),
}, t => [
  unique('code_owner_ordinal_unique').on(t.eventId, t.ownerParticipationId, t.ordinal),
  unique('code_event_owner_unique').on(t.eventId, t.ownerParticipationId, t.id),
  foreignKey({ columns: [t.eventId, t.ownerParticipationId], foreignColumns: [participations.eventId, participations.id] }),
  check('code_ordinal_valid', sql`${t.ordinal} between 1 and 24`),
]);

export const claims = pgTable('claim', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  claimantParticipationId: uuid('claimant_participation_id').notNull(),
  confirmerParticipationId: uuid('confirmer_participation_id').notNull(),
  squareId: uuid('square_id').notNull().references(() => squares.id),
  codeId: uuid('code_id').notNull(), requestId: uuid('request_id').notNull(),
  requestHash: bytea('request_hash').notNull(), createdAt: created(),
}, t => [
  unique('claim_code_unique').on(t.codeId),
  unique('claim_square_unique').on(t.eventId, t.claimantParticipationId, t.squareId),
  unique('claim_request_unique').on(t.eventId, t.claimantParticipationId, t.requestId),
  foreignKey({ columns: [t.eventId, t.claimantParticipationId], foreignColumns: [participations.eventId, participations.id] }),
  foreignKey({ columns: [t.eventId, t.confirmerParticipationId], foreignColumns: [participations.eventId, participations.id] }),
  foreignKey({ columns: [t.eventId, t.confirmerParticipationId, t.codeId], foreignColumns: [codes.eventId, codes.ownerParticipationId, codes.id] }),
  foreignKey({ columns: [t.claimantParticipationId, t.squareId], foreignColumns: [cardCells.participationId, cardCells.squareId] }),
  check('claim_no_self', sql`${t.claimantParticipationId} <> ${t.confirmerParticipationId}`),
  index('claim_event_claimant_index').on(t.eventId, t.claimantParticipationId),
]);

export const skillSelections = pgTable('skill_selection', {
  participationId: uuid('participation_id').notNull().references(() => participations.id),
  skillKey: text('skill_key').notNull(), createdAt: created(),
}, t => [primaryKey({ columns: [t.participationId, t.skillKey] })]);

export const hostAuditEvents = pgTable('host_audit_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  actorAuthUserId: text('actor_auth_user_id').notNull(), action: text('action').notNull(),
  metadata: jsonb('metadata').notNull().default({}), createdAt: created(),
});

export const rateLimitBuckets = pgTable('rate_limit_bucket', {
  participationId: uuid('participation_id').notNull().references(() => participations.id),
  bucketKey: text('bucket_key').notNull(), tokens: integer('tokens').notNull(),
  refilledAt: time('refilled_at').notNull(), expiresAt: time('expires_at').notNull(),
}, t => [
  primaryKey({ columns: [t.participationId, t.bucketKey] }),
  check('rate_tokens_nonnegative', sql`${t.tokens} >= 0`),
  index('rate_expiry_index').on(t.expiresAt),
]);
