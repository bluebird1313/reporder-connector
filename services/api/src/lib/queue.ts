import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import logger from './logger'

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
})

export const syncQueue = new Queue('sync-jobs', { connection })

logger.info('Queue initialized')

export { connection }


