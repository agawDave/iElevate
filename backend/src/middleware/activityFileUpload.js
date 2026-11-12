const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Files for file tasks: the worksheet a specialist uploads, and the file or
// photo a learner sends back. Stored outside /uploads so they are never public;
// they are streamed through short-lived links (activityFileController).
const activityFileDirectory = path.join(__dirname, '../../activity-files');
fs.mkdirSync(activityFileDirectory, { recursive: true });

const MAX_ACTIVITY_FILE_MB = 20;
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // .doc / .xls / .ppt
const isZip = (header) => header[0] === 0x50 && header[1] === 0x4b; // .docx / .xlsx / .pptx
const FILE_TYPES = {
  '.pdf': { mimeType: 'application/pdf', matches: (h) => h.subarray(0, 5).toString() === '%PDF-' },
  '.doc': { mimeType: 'application/msword', matches: (h) => h.equals(OLE) },
  '.docx': { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', matches: isZip },
  '.xls': { mimeType: 'application/vnd.ms-excel', matches: (h) => h.equals(OLE) },
  '.xlsx': { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', matches: isZip },
  '.ppt': { mimeType: 'application/vnd.ms-powerpoint', matches: (h) => h.equals(OLE) },
  '.pptx': { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', matches: isZip },
  '.png': { mimeType: 'image/png', matches: (h) => h.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  '.jpg': { mimeType: 'image/jpeg', matches: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff },
  '.jpeg': { mimeType: 'image/jpeg', matches: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff },
};
const TYPE_MESSAGE = 'Upload a PDF, Word, Excel or PowerPoint file, or a JPG or PNG photo.';

const upload = multer({
  storage: multer.diskStorage({
    destination: activityFileDirectory,
    filename: (req, file, callback) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  // Only the extension is checked here; browsers report Office files
  // inconsistently. The contents are checked after upload (checkActivityFile).
  fileFilter: (req, file, callback) => {
    if (!FILE_TYPES[path.extname(file.originalname).toLowerCase()]) {
      const error = new Error(TYPE_MESSAGE);
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_ACTIVITY_FILE_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 64 * 1024 },
  // Browsers send file names as UTF-8 (ñ, é, …).
  defParamCharset: 'utf8',
});

// One optional file in the "file" field. Requests that aren't multipart (plain
// JSON) pass straight through.
function uploadActivityFile(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `The file can be up to ${MAX_ACTIVITY_FILE_MB} MB.`
        : 'Attach one file at a time.';
      return res.status(400).json({ success: false, message });
    }
    return next(error);
  });
}

function activityFilePath(storageName) {
  return path.join(activityFileDirectory, path.basename(storageName));
}

async function removeActivityFile(storageName) {
  if (!storageName) return;
  await fs.promises.unlink(activityFilePath(storageName)).catch((error) => {
    if (error.code !== 'ENOENT') console.error('Could not remove activity file', storageName, error.message);
  });
}

// Checks an uploaded file's first bytes against its extension. Returns what to
// save, or null (and deletes the file) if it isn't what its name claims.
async function checkActivityFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const type = FILE_TYPES[extension];
  let valid = false;
  if (type && file.size > 0) {
    const handle = await fs.promises.open(file.path, 'r');
    try {
      const header = Buffer.alloc(8);
      await handle.read(header, 0, header.length, 0);
      valid = type.matches(header);
    } finally {
      await handle.close();
    }
  }
  if (!valid) {
    await removeActivityFile(file.filename);
    return null;
  }
  const originalName = file.originalname.replace(/[\r\n"\\/]/g, '_').slice(0, 255);
  return { storageName: file.filename, originalName, mimeType: type.mimeType, size: file.size };
}

module.exports = {
  uploadActivityFile,
  checkActivityFile,
  activityFilePath,
  removeActivityFile,
  MAX_ACTIVITY_FILE_MB,
  TYPE_MESSAGE,
};
