const QRCode = require('qrcode');
const Vibrant = require('node-vibrant');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Ensure STORAGE_PATH is absolute relative to project root
const STORAGE_PATH = path.resolve(process.cwd(), 'storage');
console.log(`[STORAGE] Using absolute path: ${STORAGE_PATH}`);

/**
 * Generate QR code from URL
 * @param {string} url - URL to encode in QR code
 * @returns {Promise<Buffer>} QR code image buffer
 */
async function generateQRCode(url) {
  try {
    const buffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return buffer;
  } catch (error) {
    throw new Error(`QR generation failed: ${error.message}`);
  }
}

/**
 * Extract dominant colors from image buffer
 * @param {Buffer} imageBuffer - Image buffer to analyze
 * @returns {Promise<string[]>} Array of HEX color codes
 */
async function extractColors(imageBuffer) {
  try {
    const palette = await Vibrant.from(imageBuffer).getPalette();
    const colors = [
      palette.Vibrant?.hex,
      palette.DarkVibrant?.hex,
      palette.LightVibrant?.hex,
      palette.Muted?.hex,
      palette.DarkMuted?.hex,
      palette.LightMuted?.hex
    ].filter(Boolean);
    return colors.slice(0, 5);
  } catch (error) {
    throw new Error(`Color extraction failed: ${error.message}`);
  }
}

/**
 * Validate image buffer
 * @param {Buffer} buffer - Image buffer to validate
 * @returns {Promise<boolean>} True if valid
 */
async function validateImage(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    const supportedFormats = ['jpeg', 'png', 'webp', 'gif'];
    if (!supportedFormats.includes(metadata.format)) {
      throw new Error(`Unsupported format: ${metadata.format}`);
    }
    return true;
  } catch (error) {
    throw new Error(`Image validation failed: ${error.message}`);
  }
}

/**
 * Convert image buffer to PNG format
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Buffer>} PNG buffer
 */
async function convertToPNG(buffer) {
  try {
    return await sharp(buffer).png().toBuffer();
  } catch (error) {
    throw new Error(`Image conversion failed: ${error.message}`);
  }
}

/**
 * Save asset to storage directory
 */
async function saveFixedAsset(buffer, filename) {
  try {
    const filepath = path.join(STORAGE_PATH, filename);
    await fs.writeFile(filepath, buffer);
    console.log(`[STORAGE] Saved ${filename}`);
  } catch (error) {
    throw new Error(`Failed to save asset: ${error.message}`);
  }
}

/**
 * Load asset from storage directory
 */
async function loadFixedAsset(filename) {
  try {
    const filepath = path.join(STORAGE_PATH, filename);
    const buffer = await fs.readFile(filepath);
    console.log(`[STORAGE] Loaded ${filename}`);
    return buffer;
  } catch (error) {
    throw new Error(`Failed to load asset: ${error.message}`);
  }
}

/**
 * Check if asset exists in storage
 */
async function assetExists(filename) {
  try {
    const filepath = path.join(STORAGE_PATH, filename);
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find asset by basename (ignoring extension)
 */
async function findAssetByBasename(basename) {
  try {
    const files = await fs.readdir(STORAGE_PATH);
    const found = files.find(file => path.parse(file).name === basename);
    console.log(`[STORAGE] Check for '${basename}': ${found || 'not found'}`);
    return found || null;
  } catch (error) {
    console.warn(`[STORAGE] Error reading storage: ${error.message}`);
    return null;
  }
}

async function loadAssetByBasename(basename) {
  const filename = await findAssetByBasename(basename);
  if (!filename) throw new Error(`Asset not found: ${basename}`);
  return await loadFixedAsset(filename);
}

async function assetExistsByBasename(basename) {
  const filename = await findAssetByBasename(basename);
  return filename !== null;
}

function bufferToBase64(buffer) {
  return buffer.toString('base64');
}

function isValidURL(url) {
  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    new URL(normalizedUrl);
    return normalizedUrl;
  } catch {
    return false;
  }
}

module.exports = {
  generateQRCode,
  extractColors,
  validateImage,
  convertToPNG,
  loadAssetByBasename,
  assetExistsByBasename,
  bufferToBase64,
  isValidURL
};
