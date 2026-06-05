import { today } from '@/lib/utils';
import type { Config, Link, Message, Schedule } from '@/types';
import { BufferJSON } from '@whiskeysockets/baileys';
import { db } from './index';

const stmts = {
    getConfig: db.prepare<[], Config>('SELECT * FROM configs WHERE id = 1'),
    setStart: db.prepare<[number], void>('UPDATE configs SET start = ? WHERE id = 1'),
    setEnd: db.prepare<[number], void>('UPDATE configs SET end = ? WHERE id = 1'),
    setThreshold: db.prepare<[number], void>('UPDATE configs SET link_threshold = ? WHERE id = 1'),
    upsertSession: db.prepare<[string, string], void>(
        'INSERT INTO sessions (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
    ),
    getSession: db.prepare<[string], { data: string }>('SELECT data FROM sessions WHERE id = ? LIMIT 1'),
    deleteSession: db.prepare<[string], void>('DELETE FROM sessions WHERE id = ?'),
    clearSessions: db.prepare<[], void>('DELETE FROM sessions'),
    getMessage: db.prepare<[], Message>('SELECT * FROM messages WHERE id = 1'),
    upsertMessage: db.prepare<[string, string | null], void>(
        'INSERT INTO messages (id, text, image) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET text = excluded.text, image = excluded.image',
    ),
    upsertMessageTextOnly: db.prepare<[string], void>(
        'INSERT INTO messages (id, text) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET text = excluded.text',
    ),
    linkExists: db.prepare<[string], { id: number }>('SELECT id FROM links WHERE url = ?'),
    insertLink: db.prepare<[string, string, string, string], void>(
        'INSERT OR IGNORE INTO links (url, sender_name, source_group_name, collected_at) VALUES (?, ?, ?, ?)',
    ),
    unsentCount: db.prepare<[], { value: number }>('SELECT COUNT(*) as value FROM links WHERE is_sent = 0'),
    getUnsent: db.prepare<[], Link>('SELECT * FROM links WHERE is_sent = 0'),
    markAllSent: db.prepare<[], void>('UPDATE links SET is_sent = 1 WHERE is_sent = 0'),
    todayByGroup: db.prepare<[string, string], Schedule>('SELECT * FROM schedules WHERE group_jid = ? AND scheduled_date = ?'),
    getPendingToday: db.prepare<[string], Schedule>("SELECT * FROM schedules WHERE scheduled_date = ? AND status = 'pending'"),
    insertSchedule: db.prepare<[string, string, string], void>(
        'INSERT OR IGNORE INTO schedules (group_jid, scheduled_time, scheduled_date) VALUES (?, ?, ?)',
    ),
    setStatusWithSentAt: db.prepare<[string, string, number], void>('UPDATE schedules SET status = ?, sent_at = ? WHERE id = ?'),
    setStatusOnly: db.prepare<[string, number], void>('UPDATE schedules SET status = ? WHERE id = ?'),
    cleanOldSchedules: db.prepare<[string], void>('DELETE FROM schedules WHERE scheduled_date != ?'),
};

export const configQ = {
    get: (): Config | undefined => stmts.getConfig.get(),
    setStart: (val: number): void => {
        stmts.setStart.run(val);
    },
    setEnd: (val: number): void => {
        stmts.setEnd.run(val);
    },
    setThreshold: (val: number): void => {
        stmts.setThreshold.run(val);
    },
};

export const sessionQ = {
    upsert: (id: string, data: unknown): void => {
        stmts.upsertSession.run(id, JSON.stringify(data, BufferJSON.replacer));
    },
    get: (id: string): unknown | null => {
        const row = stmts.getSession.get(id);
        return row ? JSON.parse(row.data, BufferJSON.reviver) : null;
    },
    delete: (id: string): void => {
        stmts.deleteSession.run(id);
    },
    clearAll: (): void => {
        stmts.clearSessions.run();
    },
    writeBulk: (data: Record<string, Record<string, unknown>>): void => {
        db.transaction(() => {
            for (const category in data) {
                for (const id in data[category]) {
                    const keyId = `${category}-${id}`;
                    const value = data[category][id];
                    if (value) {
                        stmts.upsertSession.run(keyId, JSON.stringify(value, BufferJSON.replacer));
                    } else {
                        stmts.deleteSession.run(keyId);
                    }
                }
            }
        })();
    },
};

export const messageQ = {
    get: (): Message | undefined => stmts.getMessage.get(),
    set: (text: string, image?: string | null): void => {
        if (image !== undefined) {
            stmts.upsertMessage.run(text, image);
        } else {
            stmts.upsertMessageTextOnly.run(text);
        }
    },
};

export const linkQ = {
    exists: (url: string): boolean => !!stmts.linkExists.get(url),
    insert: (url: string, senderName: string, sourceGroupName: string, collectedAt: string): void => {
        stmts.insertLink.run(url, senderName, sourceGroupName, collectedAt);
    },
    unsentCount: (): number => stmts.unsentCount.get()?.value ?? 0,
    getUnsent: (): Link[] => stmts.getUnsent.all(),
    markAllSent: (): void => {
        stmts.markAllSent.run();
    },
};

export const scheduleQ = {
    todayByGroup: (groupJid: string): Schedule | undefined => stmts.todayByGroup.get(groupJid, today()),
    getPendingToday: (): Schedule[] => stmts.getPendingToday.all(today()),
    insertMany: (rows: Array<{ groupJid: string; scheduledTime: string }>): void => {
        const date = today();
        db.transaction(() => {
            for (const row of rows) {
                stmts.insertSchedule.run(row.groupJid, row.scheduledTime, date);
            }
        })();
    },
    setStatus: (id: number, status: Schedule['status'], sentAt?: string): void => {
        if (sentAt) {
            stmts.setStatusWithSentAt.run(status, sentAt, id);
        } else {
            stmts.setStatusOnly.run(status, id);
        }
    },
    cleanOld: (): void => {
        stmts.cleanOldSchedules.run(today());
    },
};
