import fs from 'fs';
import path from 'path';
import multer from 'multer';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safe);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.mimetype) ||
      file.mimetype === 'application/pdf' ||
      (file.mimetype === 'application/octet-stream' &&
        /\.(jpe?g|png|webp|heic|heif)$/i.test(file.originalname));
    cb(null, allowed);
  },
});

export const voiceUploadMiddleware = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      /^audio\//i.test(file.mimetype) ||
      file.mimetype === 'video/mp4' || // .m4a is often reported as video/mp4
      (file.mimetype === 'application/octet-stream' &&
        /\.(m4a|mp3|aac|wav|caf|3gp|amr|ogg|webm|mp4)$/i.test(file.originalname));
    cb(null, allowed);
  },
});

export function publicUploadPath(filename: string): string {
  return `/uploads/${filename}`;
}
