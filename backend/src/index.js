import app from './app.js';
import pool from './config/db.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test Database connection
    try {
      const dbTest = await pool.query('SELECT NOW()');
      console.log(`⚡ PostgreSQL connection validated successfully. Database time: ${dbTest.rows[0].now}`);
    } catch (dbError) {
      console.warn(`⚠️ Warning: Database connection failed during startup, continuing without DB: ${dbError.message}`);
    }

    // Start Express listener
    const server = app.listen(PORT, () => {
      console.log(`🚀 Emerald Backend running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });

    // Graceful Shutdown Logic
    const handleShutdown = async (signal) => {
      console.log(`⚡ Received ${signal}. Starting graceful shutdown of Emerald server...`);

      // 1. Stop receiving new API requests
      server.close(async () => {
        console.log('✔ Express HTTP server closed.');

        // 2. Shut down PostgreSQL client pool
        try {
          await pool.end();
          console.log('✔ PostgreSQL connection pool ended.');
          process.exit(0);
        } catch (dbError) {
          console.error('❌ Error shutting down PostgreSQL connection pool:', dbError);
          process.exit(1);
        }
      });

      // Timeout for forced termination if connections are hanging
      setTimeout(() => {
        console.error('🚨 Forced shutdown: Active connections did not close within timeout window.');
        process.exit(1);
      }, 10000);
    };

    // Listen for terminal signals
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to establish database connection. Server startup aborted:', error);
    process.exit(1);
  }
};

startServer();
