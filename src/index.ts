import { connect } from './bot/connection';
import { logger } from './lib/logger';

async function main(): Promise<void> {
    logger.info('🤖 WA Bot starting...');
    await connect();
}

main().catch((err) => {
    logger.error({ err }, 'Fatal error');
    process.exit(1);
});
