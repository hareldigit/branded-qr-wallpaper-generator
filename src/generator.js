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
   - Line 1: "${personalName}" in MEDIUM-LARGE glowing ${selectedHex} futuristic font
   - Line 2: "${eventName}" in MEDIUM-LARGE white/light font (SAME SIZE as Line 1)
   - CRITICAL: Text width must NOT exceed 70% of screen width.
   - Maintain 15% SIDE PADDING on both left and right. Text must NOT touch edges.
   - If text is long, wrap to new line or reduce size to fit STRICTLY within the safe width.
   - Very close spacing between the two lines (almost stacked)
3. CENTRAL SUBJECT - Use the person from the portrait image EXACTLY AS THEY APPEAR (same clothes, same pose)
   - CRITICAL: Position the person's HEAD 30-40% down from the top (below where notifications appear)
   - This ensures their face is visible below the clock and notification area
   - Keep their natural appearance and clothing
   - Add cyberpunk atmosphere AROUND them (not changing them)
   - Illuminate them with ${selectedHex} neon rim-lighting
   - Add a glowing circular halo or frame around their head/shoulders
4. BACKGROUND - Complex tech environment (MAKE IT UNIQUE):
   - Variation seed: ${Math.random().toString(36).substring(7)}
   - Use DIFFERENT circuit board patterns, data flow directions, and holographic elements each time
   - Floating data streams and holographic UI elements in varied positions
   - Place the logo image as a holographic projection or glowing emblem in the scene
     * CRITICAL: Ensure logo has 15% SIDE MARGINS (never touch screen edges)
   - Use volumetric lighting with ${selectedHex} as primary light source
   - Add random tech elements: hex grids, wireframes, or glowing particles
5. BOTTOM - LARGE QR code with FUTURISTIC high-contrast frame:
   - Create a STUNNING frame design with advanced tech aesthetics:
     * Multi-layered metallic borders with depth and dimension
     * Glowing neon edges with ${selectedHex} pulsing effect
     * Holographic corner accents or geometric corner brackets
     * Subtle transparency/glass morphism with reflections
     * Optional: hexagonal tech panels, circuit traces, or energy flow animations
   - Frame should feel INNOVATIVE and state-of-the-art (like high-end sci-fi UI)
   - Frame color: ${selectedHex} with cyan/white accents for depth
   - Make QR code LARGER (roughly 25-30% of wallpaper width)
   - Must be fully scannable (white background, clear borders)
   - Center it with 12% SIDE MARGINS on left and right (CRITICAL: do not touch edges)
   - Add 8% margin from the very bottom edge

STYLE & ATMOSPHERE:
- Cyberpunk/Tech aesthetic with depth and layers
- Professional lighting: ${selectedHex} key light, cyan/blue fill light
- Atmospheric haze and glow effects
- Sharp details, cinematic quality

CRITICAL RULES:
- DO NOT render any dimension lines, arrows, percentage numbers (like "15%"), or padding indicators.
- The margin instructions (12%, 15%, etc.) are for YOUR INTERNAL LAYOUT LOGIC ONLY.
- The final image must be clean art, NO technical diagrams or measurements.
- DO NOT render any fake UI elements (status bars, battery icons, signal bars, etc.)
- The wallpaper should be CLEAN at the top - just the background and text
- Use the EXACT person from the portrait (don't change their body or clothes)
- Position portrait HEAD at 30-40% from top to avoid notification overlap
- Use the EXACT logo from the logo image (integrate it into the scene)
- Keep QR code 100% scannable
- Make each wallpaper UNIQUE with varied background patterns and QR frame design
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
