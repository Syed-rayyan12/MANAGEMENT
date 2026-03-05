import { defineConfig } from '@prisma/internals';

export default defineConfig({
  datasource: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
