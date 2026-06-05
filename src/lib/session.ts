import { sessionQ } from '@/db/queries';
import { initAuthCreds, type AuthenticationCreds, type AuthenticationState } from '@whiskeysockets/baileys';

export function useSqliteAuthState() {
    let creds = sessionQ.get('creds') as AuthenticationCreds | null;
    if (!creds) creds = initAuthCreds();
    return {
        state: {
            creds,
            keys: {
                get: (type: string, ids: string[]): Record<string, unknown> => {
                    const data: Record<string, unknown> = {};
                    for (const id of ids) {
                        const value = sessionQ.get(`${type}-${id}`);
                        if (value) data[id] = value;
                    }
                    return data;
                },
                set: (data: Record<string, Record<string, unknown>>): void => {
                    sessionQ.writeBulk(data);
                },
            },
        } as AuthenticationState,
        saveCreds: (): void => {
            sessionQ.upsert('creds', creds!);
        },
    };
}
