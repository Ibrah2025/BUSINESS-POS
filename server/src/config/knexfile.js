const env = require('./env');

module.exports = {
  development: {
    client: 'pg',
    connection: env.databaseUrl,
    migrations: {
      directory: '../models/migrations'
    },
    seeds: {
      directory: '../models/seeds'
    },
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 10000
    },
    acquireConnectionTimeout: 10000
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: env.databaseUrl,
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: '../models/migrations'
    },
    seeds: {
      directory: '../models/seeds'
    },
    pool: {
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 10000,
      afterCreate: (conn, done) => {
        conn.query('SET statement_timeout = 30000;', (err) => done(err, conn));
      }
    },
    acquireConnectionTimeout: 10000
  }
};
