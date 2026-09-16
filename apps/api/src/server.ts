import { env } from "./config/env.js";
import { createApp } from "./lib/app.js";
import { startAutomaticRaffleDrawWorker } from "./jobs/raffle-auto-draw.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`
Raven Oracle API
-------------------------
Server: http://localhost:${env.PORT}
Health: http://localhost:${env.PORT}/api/health
  `);
  startAutomaticRaffleDrawWorker();
});
