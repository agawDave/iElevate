const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { signModuleResourceToken, verifyModuleResourceToken } = require('../config/jwt');
const {
  resourceDirectory,
  fileTypeFor,
  hasValidSignature,
  SERVED_MIME_TYPES,
} = require('../middleware/moduleResourceUpload');

const MAX_MATERIALS_PER_SPECIALIST = 30;

// `resource` is a module_resources row joined with its learning module.
// Official resources (uploaded_by NULL) follow the topic's access rules; a
// specialist's own material is visible only to them and their matched learners.
async function isResourceVisible(resource, user) {
  const module = { ...resource, id: resource.module_id };
  const uploaderId = resource.uploaded_by ? Number(resource.uploaded_by) : null;
  if (module.is_elevate_program && uploaderId) {
    if (module.approval_status !== 'approved') return false;
    if (user.user_type === 'specialist') return uploaderId === Number(user.id);
    if (user.user_type !== 'beneficiary') return false;
    const [assignments] = await pool.query(
      `SELECT 1 FROM elevate_module_assignments
       WHERE module_id = ? AND beneficiary_id = ? AND specialist_id = ? AND assignment_status = 'assigned'`,
      [module.id, user.id, uploaderId]
    );
    return assignments.length > 0;
  }
  if (module.is_elevate_program) {
    if (!['beneficiary', 'specialist'].includes(user.user_type)) return false;
    const [assignments] = user.user_type === 'beneficiary'
      ? await pool.query(
        `SELECT 1 FROM elevate_module_assignments
         WHERE module_id = ? AND beneficiary_id = ?`,
        [module.id, user.id]
      )
      : await pool.query(
        `SELECT 1 FROM elevate_module_assignments
         WHERE module_id = ? AND specialist_id = ? AND assignment_status = 'assigned'
         UNION ALL
         SELECT 1 FROM module_skills ms
         JOIN user_skills us ON us.skill_id = ms.skill_id
           AND us.relation_type = 'teaches' AND us.user_id = ?
         WHERE ms.module_id = ? AND ms.is_primary = 1`,
        [module.id, user.id, user.id, module.id]
      );
    return module.approval_status === 'approved' && assignments.length > 0;
  }
  return module.approval_status === 'approved'
    || (String(module.owner_id) === String(user.id) && user.user_type === 'specialist');
}

async function createModuleResourceToken(req, res) {
  const [rows] = await pool.query(
    `SELECT mr.id, mr.module_id, mr.uploaded_by, lm.owner_id, lm.is_elevate_program, lm.approval_status,
            resource_user.user_type, resource_user.status
     FROM module_resources mr
     JOIN learning_modules lm ON lm.id = mr.module_id
     JOIN users resource_user ON resource_user.id = ?
     WHERE mr.id = ? AND lm.id = ?`,
    [req.user.id, req.params.resourceId, req.params.moduleId]
  );
  const resource = rows[0];
  if (!resource || resource.status !== 'active' || !(await isResourceVisible(resource, {
    id: req.user.id,
    user_type: resource.user_type,
  }))) {
    return res.status(404).json({ success: false, message: 'Module resource not found' });
  }

  const token = signModuleResourceToken({
    purpose: 'module-resource',
    resourceId: Number(resource.id),
    moduleId: Number(resource.module_id),
    userId: Number(req.user.id),
  });
  res.json({
    success: true,
    data: {
      url: `${req.protocol}://${req.get('host')}/api/modules/${resource.module_id}/resources/${resource.id}/file?token=${encodeURIComponent(token)}`,
      expiresIn: 7200,
    },
  });
}

async function streamModuleResource(req, res) {
  let token;
  try {
    token = verifyModuleResourceToken(req.query.token);
  } catch {
    return res.status(401).json({ success: false, message: 'Resource link expired or invalid. Reload the module and try again.' });
  }

  if (token.purpose !== 'module-resource'
    || Number(token.resourceId) !== Number(req.params.resourceId)
    || Number(token.moduleId) !== Number(req.params.moduleId)
    || !Number.isInteger(Number(token.userId))) {
    return res.status(403).json({ success: false, message: 'Resource access denied' });
  }

  const [rows] = await pool.query(
    `SELECT mr.module_id, mr.uploaded_by, mr.resource_type, mr.original_filename, mr.storage_filename, mr.mime_type,
            lm.owner_id, lm.is_elevate_program, lm.approval_status, resource_user.user_type, resource_user.status
     FROM module_resources mr
     JOIN learning_modules lm ON lm.id = mr.module_id
     JOIN users resource_user ON resource_user.id = ?
     WHERE mr.id = ? AND lm.id = ?`,
    [token.userId, req.params.resourceId, req.params.moduleId]
  );
  const resource = rows[0];
  if (!resource || resource.status !== 'active' || !(await isResourceVisible(resource, {
    id: Number(token.userId),
    user_type: resource.user_type,
  })) || !resource.storage_filename) {
    return res.status(404).json({ success: false, message: 'Module resource not found' });
  }

  const storageFilename = path.basename(resource.storage_filename);
  const filePath = path.join(resourceDirectory, storageFilename);
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Resource file is unavailable' });
    throw error;
  }
  if (!stat.isFile()) return res.status(404).json({ success: false, message: 'Resource file is unavailable' });

  const downloadName = (resource.original_filename || `module-resource.${resource.resource_type}`)
    .replace(/[\r\n"]/g, '_');
  const disposition = ['docx', 'excel'].includes(resource.resource_type) ? 'attachment' : 'inline';
  res.setHeader('Content-Type', resource.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }
    let start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
    let end = match[2] && match[1] ? Number(match[2]) : stat.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= stat.size) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }
    end = Math.min(end, stat.size - 1);
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(filePath).pipe(res);
}

// An approved ELEVATE topic the active specialist has registered as teaching.
async function findTaughtModule(userId, moduleId) {
  const [rows] = await pool.query(
    `SELECT lm.id, lm.title
     FROM learning_modules lm
     JOIN module_skills ms ON ms.module_id = lm.id AND ms.is_primary = 1
     JOIN user_skills us ON us.skill_id = ms.skill_id AND us.relation_type = 'teaches' AND us.user_id = ?
     JOIN users specialist ON specialist.id = us.user_id
       AND specialist.user_type = 'specialist' AND specialist.status = 'active'
     WHERE lm.id = ? AND lm.is_elevate_program = 1 AND lm.approval_status = 'approved'`,
    [userId, moduleId]
  );
  return rows[0] || null;
}

async function countAndNextOrder(moduleId, userId) {
  const [[row]] = await pool.query(
    `SELECT SUM(uploaded_by = ?) AS mine, COALESCE(MAX(sort_order), 0) AS max_order
     FROM module_resources WHERE module_id = ?`,
    [userId, moduleId]
  );
  return { mine: Number(row.mine) || 0, nextOrder: Number(row.max_order) + 1 };
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function discardFiles(files) {
  await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  })));
}

async function addMaterialFiles(req, res) {
  const files = req.files || [];
  const reject = async (status, message) => {
    await discardFiles(files);
    return res.status(status).json({ success: false, message });
  };
  const module = await findTaughtModule(req.user.id, req.params.moduleId);
  if (!module) return reject(403, 'You can only add materials to topics you teach.');
  if (!files.length) return reject(400, 'Choose at least one file to upload.');

  for (const file of files) {
    const type = fileTypeFor(file.originalname);
    if (!type || !(await hasValidSignature(file.path, type.extension))) {
      return reject(400, `${path.basename(file.originalname)} is not a valid ${type ? type.extension.slice(1).toUpperCase() : ''} file.`);
    }
  }
  const { mine, nextOrder } = await countAndNextOrder(module.id, req.user.id);
  if (mine + files.length > MAX_MATERIALS_PER_SPECIALIST) {
    return reject(400, `You can add up to ${MAX_MATERIALS_PER_SPECIALIST} materials per topic. Remove some first.`);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [index, file] of files.entries()) {
      const { extension, resourceType } = fileTypeFor(file.originalname);
      const originalName = path.basename(file.originalname);
      await connection.query(
        `INSERT INTO module_resources
           (module_id, uploaded_by, resource_type, title, original_filename, storage_filename, mime_type, file_size, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          module.id,
          req.user.id,
          resourceType,
          (path.basename(originalName, path.extname(originalName)).trim() || resourceType.toUpperCase()).slice(0, 190),
          originalName.slice(0, 255),
          path.basename(file.filename),
          SERVED_MIME_TYPES[extension] || file.mimetype,
          file.size,
          nextOrder + index,
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    await discardFiles(files);
    throw error;
  } finally {
    connection.release();
  }
  res.status(201).json({ success: true, message: `${files.length} file${files.length === 1 ? '' : 's'} added`, data: { added: files.length } });
}

async function addMaterialLink(req, res) {
  const module = await findTaughtModule(req.user.id, req.params.moduleId);
  if (!module) return res.status(403).json({ success: false, message: 'You can only add materials to topics you teach.' });
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!title || title.length > 190) {
    return res.status(400).json({ success: false, message: 'Give the link a title of up to 190 characters.' });
  }
  if (!url || url.length > 2048 || !isHttpUrl(url)) {
    return res.status(400).json({ success: false, message: 'Enter a valid link starting with http:// or https://.' });
  }
  const { mine, nextOrder } = await countAndNextOrder(module.id, req.user.id);
  if (mine >= MAX_MATERIALS_PER_SPECIALIST) {
    return res.status(400).json({ success: false, message: `You can add up to ${MAX_MATERIALS_PER_SPECIALIST} materials per topic. Remove some first.` });
  }
  await pool.query(
    `INSERT INTO module_resources (module_id, uploaded_by, resource_type, title, external_url, sort_order)
     VALUES (?, ?, 'link', ?, ?, ?)`,
    [module.id, req.user.id, title, new URL(url).toString(), nextOrder]
  );
  res.status(201).json({ success: true, message: 'Link added' });
}

async function deleteMaterial(req, res) {
  const [rows] = await pool.query(
    'SELECT id, storage_filename FROM module_resources WHERE id = ? AND module_id = ? AND uploaded_by = ?',
    [req.params.resourceId, req.params.moduleId, req.user.id]
  );
  const resource = rows[0];
  if (!resource) return res.status(404).json({ success: false, message: 'Material not found among your uploads.' });
  await pool.query('DELETE FROM module_resources WHERE id = ?', [resource.id]);
  if (resource.storage_filename) {
    const [stillUsed] = await pool.query(
      'SELECT 1 FROM module_resources WHERE storage_filename = ? LIMIT 1',
      [resource.storage_filename]
    );
    if (!stillUsed.length) {
      await fs.promises.unlink(path.join(resourceDirectory, path.basename(resource.storage_filename))).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
  res.json({ success: true, message: 'Material removed' });
}

module.exports = {
  createModuleResourceToken,
  streamModuleResource,
  addMaterialFiles,
  addMaterialLink,
  deleteMaterial,
};
