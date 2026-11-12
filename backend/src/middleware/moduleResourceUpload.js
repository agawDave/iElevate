const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const resourceDirectory = path.join(__dirname, '../../module-resources');
fs.mkdirSync(resourceDirectory, { recursive: true });

const MAX_FILE_SIZE_MB = 100;
const MAX_FILES_PER_UPLOAD = 5;

// Some browsers report Office files as application/octet-stream when Office
// isn't installed; their contents are still checked by hasValidSignature().
const OFFICE_FALLBACK = 'application/octet-stream';
const FILE_TYPES = {
  '.pdf': { resourceType: 'pdf', mimeTypes: ['application/pdf'] },
  '.docx': {
    resourceType: 'docx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', OFFICE_FALLBACK],
  },
  '.xlsx': {
    resourceType: 'excel',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', OFFICE_FALLBACK],
  },
  '.xls': { resourceType: 'excel', mimeTypes: ['application/vnd.ms-excel', OFFICE_FALLBACK] },
  '.mp4': { resourceType: 'video', mimeTypes: ['video/mp4'] },
  '.m4v': { resourceType: 'video', mimeTypes: ['video/mp4', 'video/x-m4v'] },
  '.webm': { resourceType: 'video', mimeTypes: ['video/webm'] },
  '.ogv': { resourceType: 'video', mimeTypes: ['video/ogg'] },
  '.ogg': { resourceType: 'video', mimeTypes: ['video/ogg', 'application/ogg'] },
  '.mov': { resourceType: 'video', mimeTypes: ['video/quicktime'] },
};

// Served MIME type for each extension, regardless of what the browser reported.
const SERVED_MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
};

const uploadModuleResources = multer({
  storage: multer.diskStorage({
    destination: resourceDirectory,
    filename: (req, file, callback) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    const type = FILE_TYPES[path.extname(file.originalname).toLowerCase()];
    if (!type || !type.mimeTypes.includes(file.mimetype)) {
      const error = new Error('Upload PDF, Word (DOCX), Excel (XLSX or XLS), or video (MP4, WebM, MOV, OGG) files only.');
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: MAX_FILES_PER_UPLOAD,
    fields: 20,
    fieldSize: 2 * 1024 * 1024,
  },
});

// Turns multer's limit errors into readable 400 responses.
function handleUploadErrors(upload) {
  return (req, res, next) => upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: `Each file can be up to ${MAX_FILE_SIZE_MB} MB.`,
        LIMIT_FILE_COUNT: `Upload up to ${MAX_FILES_PER_UPLOAD} files at a time.`,
        LIMIT_UNEXPECTED_FILE: `Upload up to ${MAX_FILES_PER_UPLOAD} files at a time.`,
      };
      return res.status(400).json({ success: false, message: messages[error.code] || error.message });
    }
    return next(error);
  });
}

function fileTypeFor(originalName) {
  const extension = path.extname(originalName).toLowerCase();
  const type = FILE_TYPES[extension];
  return type ? { extension, resourceType: type.resourceType } : null;
}

async function hasValidSignature(filePath, extension) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const header = Buffer.alloc(8);
    await handle.read(header, 0, header.length, 0);
    if (extension === '.pdf') return header.subarray(0, 5).toString() === '%PDF-';
    if (extension === '.docx' || extension === '.xlsx') return header[0] === 0x50 && header[1] === 0x4b; // ZIP
    if (extension === '.xls') return header.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    return true;
  } finally {
    await handle.close();
  }
}

module.exports = {
  uploadModuleResources,
  handleUploadErrors,
  fileTypeFor,
  hasValidSignature,
  resourceDirectory,
  SERVED_MIME_TYPES,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_UPLOAD,
};
