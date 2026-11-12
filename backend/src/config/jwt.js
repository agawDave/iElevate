const jwt = require('jsonwebtoken');

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function signModuleResourceToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '2h',
    issuer: 'ielevate-module-resources',
  });
}

function verifyModuleResourceToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    issuer: 'ielevate-module-resources',
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// Short-lived link to one certificate file, so it can open in a new tab.
function signCertificateToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '10m',
    issuer: 'ielevate-certificates',
  });
}

function verifyCertificateToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    issuer: 'ielevate-certificates',
  });
}

// Short-lived link to one file-task file (the worksheet or a learner's answer).
function signActivityFileToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '10m',
    issuer: 'ielevate-activity-files',
  });
}

function verifyActivityFileToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    issuer: 'ielevate-activity-files',
  });
}

module.exports = {
  signActivityFileToken,
  verifyActivityFileToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  signModuleResourceToken,
  verifyModuleResourceToken,
  verifyRefreshToken,
  signCertificateToken,
  verifyCertificateToken,
};
