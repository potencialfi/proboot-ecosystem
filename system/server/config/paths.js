import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Выходим: config -> server -> system -> proboot -> data
export const DATA_DIR = path.resolve(__dirname, '../../../data');
export const IMAGES_DIR = path.resolve(__dirname, '../../../images');
export const MASTER_FILE = path.join(DATA_DIR, 'master.json');

// Папка с собранным фронтендом (React)
export const DIST_DIR = path.resolve(__dirname, '../../dist');

export const PORT = 3005; // Новый порт системы