import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UsageCounterModel } from './models/usageCounter.js';
import { reserveQuota, incrementUsage } from './usage.js';

let mongod: MongoMemoryServer;
const org = new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await UsageCounterModel.deleteMany({});
});

describe('reserveQuota', () => {
  it('allows up to the quota then rejects', async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 6; i += 1) results.push(await reserveQuota(org, 5, 1));
    expect(results).toEqual([true, true, true, true, true, false]);

    const counter = await UsageCounterModel.findOne({ organizationId: org });
    expect(counter?.accepted).toBe(5);
  });

  it('rejects a batch that would overshoot the quota', async () => {
    expect(await reserveQuota(org, 10, 8)).toBe(true);
    expect(await reserveQuota(org, 10, 5)).toBe(false);
    expect(await reserveQuota(org, 10, 2)).toBe(true);
  });

  it('never exceeds the quota under concurrency', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 50 }, () => reserveQuota(org, 20, 1)),
    );
    expect(attempts.filter(Boolean)).toHaveLength(20);
    const counter = await UsageCounterModel.findOne({ organizationId: org });
    expect(counter?.accepted).toBe(20);
  });
});

describe('incrementUsage', () => {
  it('increments the named field', async () => {
    await incrementUsage(org, 'delivered', 3);
    await incrementUsage(org, 'bounced');
    const counter = await UsageCounterModel.findOne({ organizationId: org });
    expect(counter?.delivered).toBe(3);
    expect(counter?.bounced).toBe(1);
  });
});
