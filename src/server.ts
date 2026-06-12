import 'dotenv/config';
import { buildApp } from './app.js';

const start = async () => {
  const app = await buildApp();
  const port = parseInt(process.env.PORT || '3002', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`Server running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
