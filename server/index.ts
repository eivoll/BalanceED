import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { typeDefs } from './schema.js';
import { resolvers, type Ctx } from './resolvers.js';
import { db } from './db.js';
import { gemmaEnabled } from './ai/gemma.js';
import {
  SESSION_COOKIE,
  clearedSessionCookie,
  hashToken,
  newSessionToken,
  parseCookies,
  sessionCookie,
} from './auth.js';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3300);

async function main() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req, res }): Promise<Ctx> => {
        const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        const tokenHash = token ? hashToken(token) : null;
        const userId = tokenHash ? db.sessions.userIdFor(tokenHash) : null;
        return {
          user: userId ? db.users.byId(userId) ?? null : null,
          openSession(id) {
            const fresh = newSessionToken();
            db.sessions.create(hashToken(fresh), id);
            res.append('Set-Cookie', sessionCookie(fresh));
          },
          closeSession() {
            if (tokenHash) db.sessions.drop(tokenHash);
            res.append('Set-Cookie', clearedSessionCookie());
          },
        };
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, ai: gemmaEnabled ? 'gemma' : 'heuristic-fallback' });
  });

  // Serve built UI when running the production bundle.
  const dist = resolve(here, '../../dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }

  app.listen(PORT, () => {
    console.log(`[balanceed] GraphQL ready at http://localhost:${PORT}/graphql`);
    console.log(`[balanceed] AI backend: ${gemmaEnabled ? `Gemma (${process.env.GEMMA_MODEL || 'gemma-3-27b-it'})` : 'built-in heuristic engine (set GOOGLE_AI_API_KEY for Gemma)'}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
