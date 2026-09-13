import { SMTPServer, type SMTPServerOptions } from 'smtp-server';
import { logger } from '@smtp-saas/shared';
import { acceptMessage, SmtpError } from './accept.js';
import { authenticateCredential } from './auth.js';
import { TooManyAuthFailures, createAuthGuard, isAttributableIp } from './authGuard.js';
import { redisFailureStore } from './authGuardStore.js';
import { env } from './env.js';
import { enqueueDelivery } from './queue.js';
import { loadTls } from './tls.js';

function replyError(code: number, message: string): Error & { responseCode: number } {
  return Object.assign(new Error(message), { responseCode: code });
}

const AUTH_FAILURE_WINDOW_SEC = 15 * 60;

// Shared by both listeners: 10 failed logins per IP per 15 minutes, 8 argon2 checks at once.
const authGuard = createAuthGuard({
  store: redisFailureStore(AUTH_FAILURE_WINDOW_SEC),
  maxFailures: 10,
  windowSec: AUTH_FAILURE_WINDOW_SEC,
  maxConcurrent: 8,
});

function baseOptions(): SMTPServerOptions {
  return {
    name: env.SMTP_HOSTNAME,
    size: env.SMTP_MAX_MESSAGE_BYTES,
    authMethods: ['PLAIN', 'LOGIN'],
    // Cap simultaneous connections per listener; each can hold a DATA stream in memory.
    maxClients: 500,
    // Clients must authenticate before sending.
    onAuth(auth, session, callback) {
      authGuard
        .attempt(isAttributableIp(session.remoteAddress) ? session.remoteAddress : null, () =>
          authenticateCredential(auth.username ?? '', auth.password ?? ''),
        )
        .then((result) => {
          if (result) callback(null, { user: result });
          else callback(replyError(535, 'Invalid username or password'));
        })
        .catch((err: unknown) => {
          if (err instanceof TooManyAuthFailures) {
            logger.warn(
              { ip: session.remoteAddress },
              'smtp auth locked out after repeated failures',
            );
            return callback(replyError(421, err.message));
          }
          logger.error({ err }, 'onAuth failed');
          callback(replyError(451, 'Temporary authentication failure'));
        });
    },
    onMailFrom(_address, session, callback) {
      if (!session.user) return callback(replyError(530, 'Authentication required'));
      callback();
    },
    onRcptTo(_address, session, callback) {
      if (session.envelope.rcptTo.length >= 200) {
        return callback(replyError(452, 'Too many recipients'));
      }
      callback();
    },
    onData(stream, session, callback) {
      acceptMessage(stream, session, enqueueDelivery)
        .then((id) => callback(null, `2.0.0 Message queued (${id})`))
        .catch((err: unknown) => {
          if (err instanceof SmtpError) {
            callback(replyError(err.responseCode, err.message));
          } else {
            logger.error({ err }, 'message acceptance failed');
            callback(replyError(451, 'Temporary server error, please retry'));
          }
        });
    },
  };
}

export interface RunningServers {
  close: () => Promise<void>;
}

export function startSmtpServers(): RunningServers {
  const tls = loadTls();
  const shared = baseOptions();

  const submission = new SMTPServer({ ...shared, secure: false, key: tls.key, cert: tls.cert });
  const implicitTls = new SMTPServer({ ...shared, secure: true, key: tls.key, cert: tls.cert });

  for (const [server, label] of [
    [submission, 'submission'],
    [implicitTls, 'implicit-tls'],
  ] as const) {
    server.on('error', (err) => logger.error({ err, label }, 'smtp server error'));
  }

  submission.listen(env.SMTP_SUBMISSION_PORT, () =>
    logger.info({ port: env.SMTP_SUBMISSION_PORT }, 'smtp submission (STARTTLS) listening'),
  );
  implicitTls.listen(env.SMTP_TLS_PORT, () =>
    logger.info({ port: env.SMTP_TLS_PORT }, 'smtp implicit-TLS listening'),
  );

  return {
    close: () =>
      Promise.all([
        new Promise<void>((r) => submission.close(() => r())),
        new Promise<void>((r) => implicitTls.close(() => r())),
      ]).then(() => undefined),
  };
}
