import { mysqlTable, varchar, bigint, datetime, text, int, decimal, json, boolean, index } from 'drizzle-orm/mysql-core';

// Sync State Table
export const syncState = mysqlTable('sync_state', {
  id: int('id').primaryKey().autoincrement(),
  objectType: varchar('object_type', { length: 50 }).notNull().unique(),
  lastSyncTimestamp: bigint('last_sync_timestamp', { mode: 'number' }),
  lastSyncDate: datetime('last_sync_date'),
  status: varchar('status', { length: 20 }).notNull().default('success'),
  recordsSynced: int('records_synced').default(0),
  errorMessage: text('error_message'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Contacts Table
export const hubspotContacts = mysqlTable('hubspot_contacts', {
  id: varchar('id', { length: 50 }).primaryKey(),
  email: varchar('email', { length: 255 }),
  firstname: varchar('firstname', { length: 255 }),
  lastname: varchar('lastname', { length: 255 }),
  phone: varchar('phone', { length: 500 }), // Increased from 50 to 500 to handle multiple phone numbers
  company: varchar('company', { length: 255 }),
  website: varchar('website', { length: 255 }),
  lifecyclestage: varchar('lifecyclestage', { length: 100 }),
  jobtitle: varchar('jobtitle', { length: 255 }),
  createdate: datetime('createdate'),
  lastmodifieddate: datetime('lastmodifieddate'),
  hsLastmodifieddate: bigint('hs_lastmodifieddate', { mode: 'number' }),
  propertiesJson: json('properties_json'),
  syncedAt: datetime('synced_at').notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
}, (table) => ({
  emailIdx: index('email_idx').on(table.email),
  lastmodifiedIdx: index('lastmodified_idx').on(table.lastmodifieddate),
  hsLastmodifiedIdx: index('hs_lastmodified_idx').on(table.hsLastmodifieddate),
}));

// Deals Table
export const hubspotDeals = mysqlTable('hubspot_deals', {
  id: varchar('id', { length: 50 }).primaryKey(),
  dealname: varchar('dealname', { length: 255 }),
  dealstage: varchar('dealstage', { length: 100 }),
  pipeline: varchar('pipeline', { length: 100 }),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  closedate: datetime('closedate'),
  createdate: datetime('createdate'),
  lastmodifieddate: datetime('lastmodifieddate'),
  hsLastmodifieddate: bigint('hs_lastmodifieddate', { mode: 'number' }),
  hubspotOwnerId: varchar('hubspot_owner_id', { length: 50 }),
  dealtype: varchar('dealtype', { length: 100 }),
  propertiesJson: json('properties_json'),
  syncedAt: datetime('synced_at').notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
}, (table) => ({
  dealstageIdx: index('dealstage_idx').on(table.dealstage),
  pipelineIdx: index('pipeline_idx').on(table.pipeline),
  lastmodifiedIdx: index('lastmodified_idx').on(table.lastmodifieddate),
  hsLastmodifiedIdx: index('hs_lastmodified_idx').on(table.hsLastmodifieddate),
}));

// Deal Pipelines Table
export const hubspotDealPipelines = mysqlTable('hubspot_deal_pipelines', {
  id: varchar('id', { length: 50 }).primaryKey(),
  label: varchar('label', { length: 255 }).notNull(),
  displayOrder: int('display_order').notNull(),
  active: boolean('active').notNull().default(true),
  createdAtHubspot: datetime('created_at_hubspot'),
  updatedAtHubspot: datetime('updated_at_hubspot'),
  syncedAt: datetime('synced_at').notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Deal Stages Table
export const hubspotDealStages = mysqlTable('hubspot_deal_stages', {
  id: varchar('id', { length: 50 }).primaryKey(),
  pipelineId: varchar('pipeline_id', { length: 50 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  displayOrder: int('display_order').notNull(),
  metadataJson: json('metadata_json'),
  active: boolean('active').notNull().default(true),
  createdAtHubspot: datetime('created_at_hubspot'),
  updatedAtHubspot: datetime('updated_at_hubspot'),
  syncedAt: datetime('synced_at').notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
}, (table) => ({
  pipelineIdx: index('pipeline_idx').on(table.pipelineId),
}));

// Deal Stage Table (separate structure for portal queries)
// This table links deals to their current stage value
export const dealStage = mysqlTable('deal_stage', {
  id: int('id').primaryKey().autoincrement(),
  dealId: varchar('deal_id', { length: 50 }).notNull(),
  stageId: varchar('stage_id', { length: 50 }),
  value: varchar('value', { length: 255 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
}, (table) => ({
  dealIdx: index('deal_idx').on(table.dealId),
  stageIdx: index('stage_idx').on(table.stageId),
}));
