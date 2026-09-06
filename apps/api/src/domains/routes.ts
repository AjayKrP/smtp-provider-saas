import { Router } from 'express';
import { z } from 'zod';
import {
  DomainModel,
  encryptString,
  generateDkimKeyPair,
  generateDkimSelector,
  type DomainDoc,
} from '@smtp-saas/shared';
import { ApiError } from '../http/errors.js';
import { validateBody } from '../http/validate.js';
import { auth, requireAuth } from '../auth/middleware.js';
import { orgPlanLimits } from '../plans/limits.js';
import { dnsRecordsFor, verifyDomainDns } from './dns.js';

export const domainsRouter: Router = Router();
domainsRouter.use(requireAuth);

const createSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/, 'Invalid domain'),
});

function present(d: DomainDoc | (DomainDoc & object)) {
  return {
    id: d._id,
    domain: d.domain,
    status: d.status,
    dkimSelector: d.dkimSelector,
    dkimVerified: d.dkimVerified,
    spfVerified: d.spfVerified,
    verifiedAt: d.verifiedAt,
    lastCheckedAt: d.lastCheckedAt,
    dnsRecords: dnsRecordsFor(d),
  };
}

domainsRouter.get('/', async (req, res) => {
  const { organizationId } = auth(req);
  const domains = await DomainModel.find({ organizationId }).sort({ createdAt: -1 });
  res.json(domains.map(present));
});

domainsRouter.post('/', validateBody(createSchema), async (req, res) => {
  const { organizationId } = auth(req);
  const { domain } = req.body as z.infer<typeof createSchema>;

  const [count, limits, existing] = await Promise.all([
    DomainModel.countDocuments({ organizationId }),
    orgPlanLimits(organizationId),
    DomainModel.findOne({ organizationId, domain }).lean(),
  ]);
  if (existing) throw ApiError.conflict('Domain already added');
  if (count >= limits.maxDomains) {
    throw ApiError.payment(`Your ${limits.name} plan allows ${limits.maxDomains} domain(s)`);
  }

  const { privateKey, publicKey } = generateDkimKeyPair();
  const created = await DomainModel.create({
    organizationId,
    domain,
    dkimSelector: generateDkimSelector(),
    dkimPrivateKeyEnc: encryptString(privateKey),
    dkimPublicKey: publicKey,
    status: 'pending',
  });
  res.status(201).json(present(created));
});

async function loadOwnedDomain(req: import('express').Request): Promise<DomainDoc> {
  const { organizationId } = auth(req);
  const doc = await DomainModel.findOne({ _id: req.params.id, organizationId });
  if (!doc) throw ApiError.notFound('Domain not found');
  return doc;
}

domainsRouter.get('/:id', async (req, res) => {
  res.json(present(await loadOwnedDomain(req)));
});

domainsRouter.post('/:id/verify', async (req, res) => {
  const doc = await loadOwnedDomain(req);
  const result = await verifyDomainDns(doc);

  doc.dkimVerified = result.dkimVerified;
  doc.spfVerified = result.spfVerified;
  doc.lastCheckedAt = new Date();
  if (result.dkimVerified) {
    doc.status = 'verified';
    doc.verifiedAt ??= new Date();
  } else if (doc.status !== 'verified') {
    doc.status = 'failed';
  }
  await doc.save();

  res.json({ ...present(doc), verification: result.details });
});

domainsRouter.delete('/:id', async (req, res) => {
  const doc = await loadOwnedDomain(req);
  await doc.deleteOne();
  res.status(204).end();
});
