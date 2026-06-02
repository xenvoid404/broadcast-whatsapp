import { logger } from '@/lib/logger';
import { db } from './index';

logger.info('⏳ Memulai proses seeder...');

const configSeeder = db.prepare(`
INSERT INTO configs (id, start, end, link_threshold)
VALUES (?, ?, ?, ?)
`);

const messageSeeder = db.prepare(`
INSERT INTO messages (id, text)
VALUES (?, ?)
`);

db.transaction(() => {
    configSeeder.run(1, 8, 22, 5);
    messageSeeder.run(1, 'p');
})();

logger.info('🎉 Seeder selesai!');
