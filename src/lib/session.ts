import { sessionQ } from '@/db/queries';
import { initAuthCreds } from '@whiskeysockets/baileys';

export function useSqliteAuthState() {
    let creds = sessionQ.get('creds');
    if (!creds) creds = initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: (type: string, ids: string[]) => {
                    const data: any = {};
                    for (const id of ids) {
                        let value = sessionQ.get(`${type}-${id}`);
                        if (value) data[id] = value;
                    }
                    return data;
                },
                set: (data: any) => {
                    sessionQ.writeBulk(data);
                },
            },
        },
        saveCreds: () => {
            sessionQ.create('creds', creds);
        },
    };
}
