import { envConfig } from '@/config.js';
import pino from 'pino';

export const logger = pino({ level: envConfig.log.level });
