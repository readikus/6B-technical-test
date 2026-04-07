import type { HelmetOptions } from 'helmet';

/**
 * Shared Helmet configuration used by main.ts (production) and the
 * test apps. Keeping this in one place ensures security tests exercise
 * the same headers as production.
 */
export const helmetConfig: HelmetOptions = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: [`'none'`],
      baseUri: [`'none'`],
      frameAncestors: [`'none'`],
      formAction: [`'none'`],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
};
