import {
  type AuthenticationCreds,
  type AuthenticationState,
  BufferJSON,
  initAuthCreds,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#/db/index.js';
import * as model from '#/db/models.js';

export const sessionManager = (): { state: AuthenticationState; saveCreds: () => void } => {
  const [session] = db.select().from(model.sessions).where(eq(model.sessions.id, 'creds')).limit(1).all();
  const creds: AuthenticationCreds = session ? JSON.parse(session.data, BufferJSON.reviver) : initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: { [id: string]: SignalDataTypeMap[T] } = {};
          if (ids.length === 0) return result;

          const keys = ids.map((id) => `${type}-${id}`);
          const sessions = db.select().from(model.sessions).where(inArray(model.sessions.id, keys)).all();
          for (const s of sessions) {
            const originalId = s.id.replace(`${type}-`, '');
            result[originalId] = JSON.parse(s.data, BufferJSON.reviver);
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
                  tx.insert(model.sessions)
                    .values({ id: keyId, data: strData })
                    .onConflictDoUpdate({ target: model.sessions.id, set: { data: strData } })
                    .run();
                } else {
                  tx.delete(model.sessions).where(eq(model.sessions.id, keyId)).run();
                }
              }
            }
          });
        },
      },
    } as AuthenticationState,
    saveCreds: (): void => {
      const strCreds = JSON.stringify(creds, BufferJSON.replacer);
      db.insert(model.sessions)
        .values({ id: 'creds', data: strCreds })
        .onConflictDoUpdate({ target: model.sessions.id, set: { data: strCreds } })
        .run();
    },
  };
};
