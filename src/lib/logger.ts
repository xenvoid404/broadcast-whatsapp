import { envConfig } from '@/config';
import pino from 'pino';

export const logger = pino({ level: envConfig.log.level });
