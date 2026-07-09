import fs from 'fs';
import path from 'path';
import { writableDir } from './paths';

const LOGS_DIR = writableDir('logs');

function writeLog(file: string, message: string) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const logPath = path.join(LOGS_DIR, file);
    // Format timestamp in Asia/Kolkata timezone
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf-8');
  } catch (e) {
    console.error('Logger failed to write:', e);
  }
}

export const logger = {
  sheet: (msg: string) => writeLog('sheets.log', msg),
  gen: (msg: string) => writeLog('generation.log', msg),
  error: (msg: string) => {
    writeLog('errors.log', msg);
    console.error(msg); // also log to console for Next.js output
  }
};
