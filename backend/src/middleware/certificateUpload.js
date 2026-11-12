const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Certificates a specialist designed themself (in Canva, Word, etc.) and saved
// as a PDF or an image. Stored outside /uploads so they are never public: the
// certificate routes stream them only to the learner, the issuer and admins.
const certificateDirectory = path.join(__dirname, '../../certificates');
fs.mkdirSync(certificateDirectory, { recursive: true });

const MAX_CERTIFICATE_MB = 10;
const CERTIFICATE_TYPES = {
  '.pdf': { mimeType: 'application/pdf', reported: ['application/pdf'] },
  '.png': { mimeType: 'image/png', reported: ['image/png'] },
  '.jpg': { mimeType: 'image/jpeg', reported: ['image/jpeg', 'image/pjpeg'] },
  '.jpeg': { mimeType: 'image/jpeg', reported: ['image/jpeg', 'image/pjpeg'] },
};

const upload = multer({
  storage: multer.diskStorage({
    destination: certificateDirectory,
    filename: (req, file, callback) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    const type = CERTIFICATE_TYPES[path.extname(file.originalname).toLowerCase()];
    if (!type || !type.reported.includes(file.mimetype)) {
      const error = new Error('Upload the certificate as a PDF, PNG or JPG file.');
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_CERTIFICATE_MB * 1024 * 1024, files: 1, fields: 5 },
});

// One optional file in the "certificate" field, with readable limit errors.
function uploadCertificate(req, res, next) {
  upload.single('certificate')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `The certificate can be up to ${MAX_CERTIFICATE_MB} MB.`
        : 'Upload one certificate file (PDF, PNG or JPG).';
      return res.status(400).json({ success: false, message });
    }
    return next(error);
  });
}

// The file's real type from its first bytes, or null if it isn't what its
// extension claims (a renamed file, a broken export).
async function certificateMimeType(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const type = CERTIFICATE_TYPES[extension];
  if (!type) return null;
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const header = Buffer.alloc(8);
    await handle.read(header, 0, header.length, 0);
    const valid = extension === '.pdf'
      ? header.subarray(0, 5).toString() === '%PDF-'
      : extension === '.png'
        ? header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    return valid ? type.mimeType : null;
  } finally {
    await handle.close();
  }
}

function certificatePath(storageName) {
  return path.join(certificateDirectory, path.basename(storageName));
}

async function removeCertificateFile(storageName) {
  if (!storageName) return;
  await fs.promises.unlink(certificatePath(storageName)).catch((error) => {
    if (error.code !== 'ENOENT') console.error('Could not remove certificate file', storageName, error.message);
  });
}

module.exports = {
  uploadCertificate,
  certificateMimeType,
  certificatePath,
  removeCertificateFile,
  MAX_CERTIFICATE_MB,
};
