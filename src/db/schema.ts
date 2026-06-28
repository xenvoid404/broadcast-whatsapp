import * as t from 'drizzle-orm/sqlite-core';

export const sessions = t.sqliteTable('sessions', {
    id: t.text('id').primaryKey().notNull(),
    data: t.text('data').notNull(),
    createdAt: t
        .integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: t
        .integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

export const links = t.sqliteTable('links', {
    id: t.integer('id').primaryKey({ autoIncrement: true }),
    url: t.text('url').unique().notNull(),
    senderName: t.text('sender_name').notNull().default(''),
    sourceGroupName: t.text('source_group_name').notNull().default(''),
    isSent: t.integer('is_sent', { mode: 'boolean' }).default(false).notNull(),
    createdAt: t
        .integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: t
        .integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

export const schedules = t.sqliteTable('schedules', {
    id: t.integer('id').primaryKey({ autoIncrement: true }),
    groupJid: t.text('group_jid').notNull(),
    text: t.text('text').notNull(),
    attachment: t.text('attachment'),
    status: t
        .text('status', { enum: ['pending', 'success', 'failed'] })
        .default('pending')
        .notNull(),
    scheduledAt: t.integer('scheduled_at', { mode: 'timestamp' }).notNull(),
    createdAt: t
        .integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: t
        .integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});
