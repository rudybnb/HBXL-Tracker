import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DatabaseStorage } from './database-storage.js';
import { cashflowRoutes } from './routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const storage = new DatabaseStorage();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ERdesignandbuild-Cashflow',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', cashflowRoutes(storage));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`💰 ERdesignandbuild Cash Flow Server running on port ${PORT}`);
  console.log(`🔗 Connected to database: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
});