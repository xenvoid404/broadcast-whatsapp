import { db } from '@/db/index.js';
import * as schema from '@/db/schema.js';
import { BufferJSON, initAuthCreds, type AuthenticationCreds, type AuthenticationState } from '@whiskeysockets/baileys';
import { eq, inArray } from 'drizzle-orm';

export function sessionManager(): { state: AuthenticationState; saveCreds: () => void } {
    const [session] = db.select().from(schema.sessions).where(eq(schema.sessions.id, 'creds')).limit(1).all();
    const creds: AuthenticationCreds = session ? JSON.parse(session.data, BufferJSON.reviver) : initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: (type: string, ids: string[]): Record<string, unknown> => {
                    const result: Record<string, unknown> = {};
                    if (ids.length === 0) return result;

                    const keys = ids.map((id) => `${type}-${id}`);
                    const rows = db.select().from(schema.sessions).where(inArray(schema.sessions.id, keys)).all();

                    for (const row of rows) {
                        const originalId = row.id.replace(`${type}-`, '');
                        result[originalId] = JSON.parse(row.data, BufferJSON.reviver);
                    }

                    return result;
                },
                set: (data: Record<string, Record<string, unknown>>): void => {
                    db.transaction((tx) => {
                        for (const category in data) {
                            for (const id in data[category]) {
                                const value = data[category][id];
                                const keyId = `${category}-${id}`;

                                if (value) {
                                    const strData = JSON.stringify(value, BufferJSON.replacer);

                                    tx.insert(schema.sessions)
                                        .values({ id: keyId, data: strData })
                                        .onConflictDoUpdate({ target: schema.sessions.id, set: { data: strData } })
                                        .run();
                                } else {
                                    tx.delete(schema.sessions).where(eq(schema.sessions.id, keyId)).run();
                                }
                            }
                        }
                    });
                },
            },
        } as AuthenticationState,
        saveCreds: (): void => {
            const strCreds = JSON.stringify(creds, BufferJSON.replacer);
            db.insert(schema.sessions)
                .values({ id: 'creds', data: strCreds })
                .onConflictDoUpdate({ target: schema.sessions.id, set: { data: strCreds } })
                .run();
        },
    };
}
