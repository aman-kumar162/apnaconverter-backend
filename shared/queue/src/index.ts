import { Queue, QueueEvents, Worker, type JobsOptions, type Processor } from "bullmq";
import IORedis from "ioredis";
import type { ConversionJobData, QueueName } from "@apna/shared-types";

export function createRedisConnection() {
  const RedisCtor = (IORedis as unknown as { default?: new (...args: any[]) => any }).default ?? (IORedis as unknown as new (...args: any[]) => any);
  return new RedisCtor(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
}

export function createQueue(name: QueueName) {
  return new Queue<ConversionJobData>(name, {
    connection: createRedisConnection(),
    defaultJobOptions: defaultJobOptions(),
  });
}

export function createQueueEvents(name: QueueName) {
  return new QueueEvents(name, { connection: createRedisConnection() });
}

export function createWorker(name: QueueName, processor: Processor<ConversionJobData>, concurrency: number) {
  return new Worker<ConversionJobData>(name, processor, {
    connection: createRedisConnection(),
    concurrency,
    removeOnComplete: { age: 1800, count: 1000 },
    removeOnFail: { age: 86400, count: 5000 },
  });
}

export function defaultJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 1800, count: 1000 },
    removeOnFail: { age: 86400, count: 5000 },
  };
}
