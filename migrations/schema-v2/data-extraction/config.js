// Configuration for data extraction and migration
import { createClient } from '@supabase/supabase-js'
import winston from 'winston'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: './.env.local' })

// Database configuration
export const config = {
  // Supabase connection
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // Migration settings
  migration: {
    batchSize: 1000,
    outputDir: './migration-output',
    backupDir: './migration-backup',
    logLevel: 'info',
    dryRun: false, // Set to true for testing without actual data changes
  },
  
  // Data validation rules
  validation: {
    // Score format detection thresholds
    scoreThresholds: {
      minActualScore: 55,
      maxActualScore: 100,
      minRelativeScore: -20,
      maxRelativeScore: 25,
    },
    
    // Course par inference rules
    parInference: {
      defaultPar: 72,
      minPar: 68,
      maxPar: 74,
      scoreDistributionThreshold: 0.7 // Percentage of scores needed for confidence
    },
    
    // Player validation rules
    playerValidation: {
      minNameLength: 2,
      maxNameLength: 50,
      requiredFields: ['dg_id', 'name']
    },
    
    // Tournament validation rules
    tournamentValidation: {
      minTournamentNameLength: 5,
      requiredFields: ['event_id', 'event_name'],
      dateFormat: 'YYYY-MM-DD'
    }
  }
}

// Initialize Supabase client
export const supabase = createClient(config.supabase.url, config.supabase.key)

// Logger configuration
export const logger = winston.createLogger({
  level: config.migration.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: `${config.migration.outputDir}/migration-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.migration.outputDir}/migration.log` 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

// Ensure output directories exist
import fs from 'fs-extra'

await fs.ensureDir(config.migration.outputDir)
await fs.ensureDir(config.migration.backupDir)

export default config