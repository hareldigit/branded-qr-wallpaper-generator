const { GoogleGenerativeAI } = require('@google/generative-ai');
const { bufferToBase64 } = require('./utils');
const fs = require('fs').promises;
const path = require('path');

// Initialize Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate cyberpunk wallpaper using Gemini AI ("Nano Banana" Style)
 * @param {Object} params - Generation parameters
 * @returns {Promise<Buffer>} Generated wallpaper image buffer
 */
async function generateWallpaper(params) {
  const { personalName, eventName, selectedHex, logoBuffer, portraitBuffer, qrBuffer } = params;

  console.log(`[GEMINI] 🎨 Creating Nano Banana wallpaper: ${personalName} @ ${eventName}`);
  console.log(`[GEMINI] Primary Color: ${selectedHex}`);

  // Look for style reference in storage (optional)
  let styleReferenceBuffer = null;
  try {
    const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
    styleReferenceBuffer = await fs.readFile(path.join(storagePath, 'style_reference.jpg'));
    console.log('[GEMINI] 📸 Style reference loaded.');
  } catch (e) {
    // No reference needed
  }

  // The "Nano Banana" Prompt - Simple and Effective
  const prompt = `Create a stunning 9:16 vertical cyberpunk lock screen wallpaper with these exact specifications:

LAYOUT (Top to Bottom):
1. TOP SAFE ZONE - Minimal empty space (just enough for phone status bar - about 5-8%)
2. HEADER (Start close to top with minimal padding):
   - Line 1: "${personalName}" in LARGE glowing ${selectedHex} futuristic font
   - Line 2: "${eventName}" in LARGE white/light font (SAME SIZE as Line 1)
   - Very close spacing between the two lines (almost stacked)
3. CENTRAL SUBJECT - Use the person from the portrait image EXACTLY AS THEY APPEAR (same clothes, same pose)
   - Keep their natural appearance and clothing
   - Add cyberpunk atmosphere AROUND them (not changing them)
   - Illuminate them with ${selectedHex} neon rim-lighting
   - Add a glowing circular halo or frame around their head/shoulders
4. BACKGROUND - Complex tech environment:
   - Circuit board traces and digital patterns
   - Floating data streams and holographic UI elements
   - Place the logo image as a holographic projection or glowing emblem in the scene
   - Use volumetric lighting with ${selectedHex} as primary light source
5. BOTTOM - LARGE QR code with high-contrast neon frame in ${selectedHex}
   - Make QR code LARGER (roughly 25-30% of wallpaper width)
   - Must be fully scannable (white background, clear borders)
   - Center it with 8% margin from bottom and sides

STYLE & ATMOSPHERE:
- Cyberpunk/Tech aesthetic with depth and layers
- Professional lighting: ${selectedHex} key light, cyan/blue fill light
- Atmospheric haze and glow effects
- Sharp details, cinematic quality

CRITICAL RULES:
- Use the EXACT person from the portrait (don't change their body or clothes)
- Use the EXACT logo from the logo image (integrate it into the scene)
- Keep QR code 100% scannable
- NO WHITE BORDERS or frames around the image
- Output: 9:16 vertical format, single integrated image with NO padding or margins`;

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
    });

    // Build parts array with clear labels
    const parts = [
      { text: "IMAGES PROVIDED:\n\n" },
      { text: "1. LOGO (integrate as hologram or emblem in scene):\n" },
      { inlineData: { data: bufferToBase64(logoBuffer), mimeType: 'image/png' } },
      { text: "\n\n2. QR CODE (place at bottom with neon frame):\n" },
      { inlineData: { data: bufferToBase64(qrBuffer), mimeType: 'image/png' } },
    ];

    if (portraitBuffer) {
      parts.push({ text: "\n\n3. PERSON (use EXACTLY as shown, don't change clothes or pose):\n" });
      parts.push({ inlineData: { data: bufferToBase64(portraitBuffer), mimeType: 'image/png' } });
    }

    if (styleReferenceBuffer) {
      parts.push({ text: "\n\n4. STYLE REFERENCE (match this composition and quality):\n" });
      parts.push({ inlineData: { data: bufferToBase64(styleReferenceBuffer), mimeType: 'image/jpeg' } });
    }

    parts.push({ text: "\n\n" + prompt });

    console.log('[GEMINI] Sending Nano Banana request...');

    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 0.6,
          topP: 0.9,
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout (60s)')), 60000)
      )
    ]);

    const response = await result.response;
    const candidate = response.candidates?.[0];
    
    if (!candidate) throw new Error('No response from Gemini');

    const imagePart = candidate.content?.parts?.find(part => part.inlineData);
    if (!imagePart?.inlineData?.data) {
      throw new Error(`Generation failed (${candidate.finishReason}). No image returned.`);
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    console.log(`[GEMINI] ✅ Wallpaper ready (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

    return imageBuffer;

  } catch (error) {
    console.error('[GEMINI] ❌', error.message);
    throw error;
  }
}

/**
 * Generate with retry logic
 */
async function generateWallpaperWithRetry(params, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[GEMINI] Attempt ${attempt}/${maxRetries}`);
      return await generateWallpaper(params);
    } catch (error) {
      lastError = error;
      console.warn(`[GEMINI] Attempt ${attempt} failed:`, error.message);
      if (error.message.includes('API key') || error.message.includes('quota')) throw error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

module.exports = {
  generateWallpaper,
  generateWallpaperWithRetry
};
