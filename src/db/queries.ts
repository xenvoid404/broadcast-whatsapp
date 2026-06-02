import { db } from './index';
import { BufferJSON } from '@whiskeysockets/baileys';
import { today } from '@/lib/utils';

const getConfigStmt = db.prepare(`SELECT * FROM configs LIMIT 1`);
const updateConfigStartStmt = db.prepare(`UPDATE configs SET start = ? WHERE id = 1`);
const updateConfigEndStmt = db.prepare(`UPDATE configs SET end = ? WHERE id = 1`);
const updateConfigThresholdStmt = db.prepare(`UPDATE configs SET link_threshold = ? WHERE id = 1`);

const insertSessionStmt = db.prepare(`INSERT INTO sessions (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`);
const getSessionStmt = db.prepare(`SELECT data FROM sessions WHERE id = ? LIMIT 1`);
const deleteSessionStmt = db.prepare(`DELETE FROM sessions WHERE id = ?`);
const clearAllSessionsStmt = db.prepare(`DELETE FROM sessions`);

const getMessageStmt = db.prepare(`SELECT * FROM messages WHERE id = 1`);
const setMessageStmt = db.prepare(`
    INSERT INTO messages (id, text, image) VALUES (1, ?, ?) 
    ON CONFLICT(id) DO UPDATE SET text = excluded.text, image = excluded.image
`);
const setMessageTextOnlyStmt = db.prepare(`
    INSERT INTO messages (id, text) VALUES (1, ?) 
    ON CONFLICT(id) DO UPDATE SET text = excluded.text
`);

const linkExistsStmt = db.prepare(`SELECT id FROM links WHERE url = ?`);
const insertLinkStmt = db.prepare(`INSERT OR IGNORE INTO links (url, sender_name, source_group_name, collected_at, is_sent) VALUES (?, ?, ?, ?, ?)`);
const unsentCountStmt = db.prepare(`SELECT count(*) as value FROM links WHERE is_sent = 0`);
const getUnsentLinksStmt = db.prepare(`SELECT * FROM links WHERE is_sent = 0`);
const markAllSentStmt = db.prepare(`UPDATE links SET is_sent = 1 WHERE is_sent = 0`);

const scheduleTodayByGroupStmt = db.prepare(`SELECT * FROM schedules WHERE group_jid = ? AND scheduled_date = ?`);
const getPendingTodayStmt = db.prepare(`SELECT * FROM schedules WHERE scheduled_date = ? AND status = 'pending'`);
const insertScheduleStmt = db.prepare(
    `INSERT OR IGNORE INTO schedules (group_jid, scheduled_time, scheduled_date, status, sent_at) VALUES (?, ?, ?, ?, ?)`
);
const setStatusWithSentAtStmt = db.prepare(`UPDATE schedules SET status = ?, sent_at = ? WHERE id = ?`);
const setStatusOnlyStmt = db.prepare(`UPDATE schedules SET status = ? WHERE id = ?`);
const cleanOldSchedulesStmt = db.prepare(`DELETE FROM schedules WHERE scheduled_date != ?`);

export const configQ = {
    get: () => getConfigStmt.get(),
    setStart: (bcStart: number) => updateConfigStartStmt.run(bcStart),
    setEnd: (bcEnd: number) => updateConfigEndStmt.run(bcEnd),
    setThreshold: (linkThreshold: number) => updateConfigThresholdStmt.run(linkThreshold)
};

export const sessionQ = {
    create: (id: string, data: any) => {
        const strData = JSON.stringify(data, BufferJSON.replacer);
        insertSessionStmt.run(id, strData);
    },
    get: (id: string) => {
        const row = getSessionStmt.get(id) as { data: string } | undefined;
        if (row && row.data) return JSON.parse(row.data, BufferJSON.reviver);
        return null;
    },
    delete: (id: string) => {
        deleteSessionStmt.run(id);
    },
    clearAll: () => {
        clearAllSessionsStmt.run();
    },
    writeBulk: (data: any) => {
        const transaction = db.transaction((txData: any) => {
            for (const category in txData) {
                for (const id in txData[category]) {
                    const value = txData[category][id];
                    const keyId = `${category}-${id}`;
                    if (value) {
                        const strData = JSON.stringify(value, BufferJSON.replacer);
                        insertSessionStmt.run(keyId, strData);
                    } else {
                        deleteSessionStmt.run(keyId);
                    }
                }
            }
        });
        transaction(data);
    }
};

export const messageQ = {
    get: () => getMessageStmt.get(),
    set: (text: string, image?: string | null) => {
        if (image !== undefined) return setMessageStmt.run(text, image);
        return setMessageTextOnlyStmt.run(text);
    }
};

export const linkQ = {
    exists: (url: string) => linkExistsStmt.get(url),
    insert: (data: { url: string; sender_name?: string; source_group_name?: string; collected_at: string; is_sent?: boolean | number }) => {
        return insertLinkStmt.run(data.url, data.sender_name ?? '', data.source_group_name ?? '', data.collected_at, data.is_sent ? 1 : 0);
    },
    unsentCount: () => unsentCountStmt.get(),
    getUnsent: () => getUnsentLinksStmt.all(),
    markAllSent: () => markAllSentStmt.run()
};

type ScheduleInsert = {
    group_jid: string;
    scheduled_time: string;
    scheduled_date: string;
    status?: string;
    sent_at?: string | null;
};

export const scheduleQ = {
    todayByGroup: (groupJid: string) => scheduleTodayByGroupStmt.get(groupJid, today()),
    getPendingToday: () => getPendingTodayStmt.all(today()),
    insertMany: (rows: ScheduleInsert[]) => {
        const transaction = db.transaction((schedules: ScheduleInsert[]) => {
            for (const row of schedules) {
                insertScheduleStmt.run(row.group_jid, row.scheduled_time, row.scheduled_date, row.status ?? 'pending', row.sent_at ?? null);
            }
        });
        transaction(rows);
    },
    setStatus: (id: number, status: string, sentAt?: string) => {
        if (sentAt) {
            return setStatusWithSentAtStmt.run(status, sentAt, id);
        }
        return setStatusOnlyStmt.run(status, id);
    },
    cleanOld: () => cleanOldSchedulesStmt.run(today())
};
