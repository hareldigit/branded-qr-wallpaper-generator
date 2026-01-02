# 🚀 Technical Specification: brand-lock-ai (Project "Anti-Gravity")

## 1. System Architecture & Stack

**Runtime**: Node.js 20+ (Slim image for Docker)

**Bot Framework**: `telegraf` v4.16+ (Telegram Bot API wrapper)

**AI Engine**: `@google/genai` v1.34.0 (Google Generative AI SDK - official SDK replacing deprecated @google/generative-ai)

**Image Processing Libraries**:
* `node-vibrant` v4.0.3: Extract dominant color palettes from logo images
* `qrcode` v1.5.4: Generate QR codes from URLs in real-time
* `sharp` v0.34.5: Image buffer manipulation, validation, and format conversion

**Session Management**: In-memory session storage using `telegraf-session-local` or built-in context

**Persistence**: Docker Bind Mount Volume mapping `./storage` to `/app/storage`

**Deployment**: Docker Compose + Automated Bash Script with SCP

---

## 2. File Structure

```
brand-lock-ai/
├── src/
│   ├── bot.js            # Entry point, Telegraf initialization, State machine, Middleware
│   ├── generator.js      # Gemini API integration, Prompt engineering, Image generation
│   └── utils.js          # QR generation, Color extraction, Image validation, File I/O
├── storage/              # Persistent volume (bind mount) - stores logo_fixed.png & qr_fixed.png
├── .env                  # Environment configuration (NOT committed to git)
├── .env.example          # Template for environment variables
├── .gitignore            # Ignore node_modules, .env, storage/
├── package.json          # Dependencies and scripts
├── package-lock.json     # Locked dependency versions
├── Dockerfile            # Optimized Node.js 20 slim build
├── docker-compose.yml    # Service definition with volume mounts
├── deploy.sh             # SCP-based deployment automation
└── README.md             # Comprehensive documentation
```

---

## 3. Configuration (.env)

```env
# Telegram Bot Configuration
TELEGRAM_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789

# Google Gemini API
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Security - CRITICAL: Only this user ID can interact with the bot
ALLOWED_TELEGRAM_ID=123456789

# Default Configuration
DEFAULT_USER_NAME=Harel Dagan

# Storage Path (inside Docker container)
STORAGE_PATH=/app/storage

# Optional: Gemini Model Selection
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Environment Variables Explanation

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_TOKEN` | ✅ Yes | Bot token from @BotFather |
| `GEMINI_API_KEY` | ✅ Yes | API key from Google AI Studio |
| `ALLOWED_TELEGRAM_ID` | ✅ Yes | Telegram user ID for security validation |
| `DEFAULT_USER_NAME` | ✅ Yes | Default name for wallpaper generation |
| `STORAGE_PATH` | ✅ Yes | Path for persistent storage (Docker internal) |
| `GEMINI_MODEL` | ⚠️ Optional | Defaults to `gemini-2.0-flash-exp` |

---

## 4. Core Logic Requirements

### A. Security Middleware

**CRITICAL REQUIREMENT**: Every incoming message MUST pass through security validation.

```javascript
// Middleware function (runs before ANY handler)
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  const allowedId = parseInt(process.env.ALLOWED_TELEGRAM_ID);
  
  if (userId !== allowedId) {
    console.warn(`Unauthorized access attempt from user ID: ${userId}`);
    // Option 1: Silent ignore (recommended)
    return;
    
    // Option 2: Send error message (optional)
    // return ctx.reply('⛔ Unauthorized access.');
  }
  
  return next(); // Proceed to handlers
});
```

**Security Rules**:
- ✅ Check `ctx.from.id` against `process.env.ALLOWED_TELEGRAM_ID`
- ✅ Log unauthorized attempts for monitoring
- ✅ Either silently ignore OR send generic error message
- ❌ NEVER expose internal error details to unauthorized users

---

### B. State Machine (User Flow)

The bot uses a **session-based state machine** to track user progress through the wallpaper generation flow.

#### Session Structure

```javascript
ctx.session = {
  state: 'AWAITING_NAME' | 'AWAITING_LOGO' | 'AWAITING_COLOR' | 'AWAITING_QR' | 'GENERATING',
  data: {
    eventName: null,        // String: User's name or custom event
    logoBuffer: null,       // Buffer: Logo image (from file or upload)
    logoSource: null,       // 'fixed' | 'onetime'
    selectedHex: null,      // String: Selected HEX color (e.g., '#FF6B35')
    qrBuffer: null,         // Buffer: QR code image
    qrSource: null,         // 'fixed' | 'onetime' | 'generated'
    colorPalette: []        // Array: Extracted HEX colors from logo
  }
};
```

---

#### Flow Diagram

```
/start
  ↓
Check for saved assets (logo_fixed.png, qr_fixed.png)
  ↓
[AWAITING_NAME] → Name Selection
  ↓
[AWAITING_LOGO] → Logo Selection/Upload
  ↓
Extract colors with node-vibrant
  ↓
[AWAITING_COLOR] → Color Palette Selection
  ↓
[AWAITING_QR] → QR Selection/Upload/Generation
  ↓
[GENERATING] → Call Gemini API
  ↓
Send wallpaper to user
  ↓
Reset session
```

---

#### State 1: AWAITING_NAME

**Trigger**: `/start` command

**Actions**:
1. Initialize session
2. Check if `storage/logo_fixed.png` and `storage/qr_fixed.png` exist
3. Display welcome message with name selection

**Inline Keyboard**:
```
┌─────────────────────────────────┐
│ ⚡ Use Default Name             │
│ (Harel Dagan)                   │
├─────────────────────────────────┤
│ ✏️ Enter Custom Name            │
└─────────────────────────────────┘
```

**Message**:
```
Welcome to Brand Lock AI! 🎨

Let's create your personalized cyberpunk wallpaper.

Choose your name:
```

**User Actions**:
- Click "⚡ Use Default Name" → Set `ctx.session.data.eventName = process.env.DEFAULT_USER_NAME` → Move to AWAITING_LOGO
- Click "✏️ Enter Custom Name" → Wait for text input
- Send text message → Set `ctx.session.data.eventName = ctx.message.text` → Move to AWAITING_LOGO

---

#### State 2: AWAITING_LOGO

**Trigger**: Name selected

**Actions**:
1. Check if `storage/logo_fixed.png` exists
2. Display logo selection options

**Scenario A: logo_fixed.png EXISTS**

**Inline Keyboard**:
```
┌─────────────────────────────────┐
│ 💾 Use Saved Logo               │
├─────────────────────────────────┤
│ 📤 Upload One-Time Logo         │
├─────────────────────────────────┤
│ 🔄 Replace Saved Logo           │
└─────────────────────────────────┘
```

**Message**:
```
Great! Now let's select your logo. 🖼️

You have a saved logo. What would you like to do?
```

**User Actions**:
- Click "💾 Use Saved Logo" → Load `storage/logo_fixed.png` into buffer → Set `logoSource = 'fixed'` → Extract colors → Move to AWAITING_COLOR
- Click "📤 Upload One-Time Logo" → Wait for photo upload → Store in memory only → Set `logoSource = 'onetime'` → Extract colors → Move to AWAITING_COLOR
- Click "🔄 Replace Saved Logo" → Wait for photo upload → Overwrite `storage/logo_fixed.png` → Set `logoSource = 'fixed'` → Extract colors → Move to AWAITING_COLOR

**Scenario B: logo_fixed.png DOES NOT EXIST**

**Inline Keyboard**:
```
┌─────────────────────────────────┐
│ 📤 Upload Logo                  │
├─────────────────────────────────┤
│ 💾 Upload & Save for Future     │
└─────────────────────────────────┘
```

**Message**:
```
Please upload your logo. 🖼️

Choose an option:
```

**User Actions**:
- Click "📤 Upload Logo" → Wait for photo → Store in memory → Set `logoSource = 'onetime'` → Extract colors → Move to AWAITING_COLOR
- Click "💾 Upload & Save for Future" → Wait for photo → Save to `storage/logo_fixed.png` → Set `logoSource = 'fixed'` → Extract colors → Move to AWAITING_COLOR

---

#### State 3: AWAITING_COLOR

**Trigger**: Logo processed

**Actions**:
1. Extract color palette using `node-vibrant`
2. Get top 5 dominant colors
3. Display inline keyboard with color swatches

**Color Extraction Logic**:
```javascript
const Vibrant = require('node-vibrant');

async function extractColors(imageBuffer) {
  const palette = await Vibrant.from(imageBuffer).getPalette();
  
  // Extract HEX values from palette
  const colors = [
    palette.Vibrant?.hex,
    palette.DarkVibrant?.hex,
    palette.LightVibrant?.hex,
    palette.Muted?.hex,
    palette.DarkMuted?.hex
  ].filter(Boolean); // Remove null values
  
  return colors.slice(0, 5); // Return top 5
}
```

**Inline Keyboard** (Dynamic - 5 colors + palette link):
```
┌─────────────────────────────────┐
│ 🎨 #FF6B35                      │
├─────────────────────────────────┤
│ 🎨 #004E89                      │
├─────────────────────────────────┤
│ 🎨 #1A535C                      │
├─────────────────────────────────┤
│ 🎨 #FFE66D                      │
├─────────────────────────────────┤
│ 🎨 #F72585                      │
├─────────────────────────────────┤
│ 🌈 Open Vibrant Palette         │
└─────────────────────────────────┘
```

**Message**:
```
✅ Colors extracted successfully!

Select your neon accent color:
```

**User Actions**:
- Click any color button → Set `ctx.session.data.selectedHex = clickedColor` → Move to AWAITING_QR
- Click "🌈 Open Vibrant Palette" → Send link to color picker website (optional feature)

---

#### State 4: AWAITING_QR

**Trigger**: Color selected

**Actions**:
1. Check if `storage/qr_fixed.png` exists
2. Display QR selection options

**Scenario A: qr_fixed.png EXISTS**

**Inline Keyboard**:
```
┌─────────────────────────────────┐
│ 💾 Use Saved QR Code            │
├─────────────────────────────────┤
│ 🔗 Generate QR from URL         │
├─────────────────────────────────┤
│ 📤 Upload One-Time QR           │
├─────────────────────────────────┤
│ 🔄 Replace Saved QR             │
└─────────────────────────────────┘
```

**Message**:
```
Almost there! Now let's add your QR code. 📱

You have a saved QR code. What would you like to do?
```

**Scenario B: qr_fixed.png DOES NOT EXIST**

**Inline Keyboard**:
```
┌─────────────────────────────────┐
│ 🔗 Generate QR from URL         │
├─────────────────────────────────┤
│ 📤 Upload QR Image              │
├─────────────────────────────────┤
│ 💾 Upload & Save for Future     │
└─────────────────────────────────┘
```

**Message**:
```
Let's add your QR code! 📱

Choose an option:
```

**User Actions**:
- Click "💾 Use Saved QR Code" → Load `storage/qr_fixed.png` → Set `qrSource = 'fixed'` → Move to GENERATING
- Click "🔗 Generate QR from URL" → Wait for URL text → Generate QR with `qrcode` library → Store in memory → Set `qrSource = 'generated'` → Move to GENERATING
- Click "📤 Upload One-Time QR" → Wait for photo → Store in memory → Set `qrSource = 'onetime'` → Move to GENERATING
- Click "🔄 Replace Saved QR" → Wait for photo/URL → Save to `storage/qr_fixed.png` → Set `qrSource = 'fixed'` → Move to GENERATING

**CRITICAL RULE**: One-time QR codes (from URL or upload) are stored ONLY in `ctx.session.data.qrBuffer` and NEVER overwrite `storage/qr_fixed.png`.

---

#### State 5: GENERATING

**Trigger**: All assets collected

**Actions**:
1. Display "generating" status message
2. Compile all parameters
3. Call Gemini API with production prompt
4. Send generated wallpaper to user
5. Reset session

**Status Message**:
```
🎨 Gemini is painting your wallpaper...

This may take 10-30 seconds. Please wait.
```

**Parameters Sent to Gemini**:
```javascript
{
  eventName: ctx.session.data.eventName,
  selectedHex: ctx.session.data.selectedHex,
  logoBuffer: ctx.session.data.logoBuffer,
  qrBuffer: ctx.session.data.qrBuffer
}
```

**Success Response**:
```
✅ Your wallpaper is ready!

[Send image as document to preserve quality]

Use /start to create another one.
```

**Error Response**:
```
❌ Generation failed: [error message]

Please try again with /start
```

---

## 5. The "Nano Banana" Production Prompt

This is the **exact prompt** sent to Gemini API for image generation.

### Prompt Template

```javascript
const prompt = `Create a high-resolution 9:16 vertical lock screen wallpaper with the following specifications:

STYLE & AESTHETIC:
- Cyberpunk Identity / Tech-Premium visual language
- Volumetric lighting with atmospheric depth
- Neon bioluminescent effects
- Futuristic holographic elements
- Premium state-of-the-art quality

SAFE ZONE (CRITICAL):
- Leave the top 15% of the canvas completely empty
- This area is reserved for iOS/Android status bar and clock
- No visual elements should extend into this zone

COLOR TREATMENT:
- Primary accent color: ${params.selectedHex}
- Treat this color as a NEON/BIOLUMINESCENT light source
- Apply rim-lighting effects around all elements
- Use volumetric glow and atmospheric haze
- Create depth with gradient falloff
- NO FLAT COLORS - everything must have luminosity and depth

LAYOUT ELEMENTS (9:16 vertical format):

1. UPPER-MIDDLE SECTION (below safe zone):
   - Text: "${params.eventName}"
   - Font: 3D futuristic typeface with holographic effect
   - Treatment: Glowing edges, subtle transparency, depth shadows
   - Size: Large and prominent but not overwhelming

2. CENTER SECTION:
   - Element: Branded logo (provided as image)
   - Effect: Floating glass morphism with subtle reflections
   - Treatment: Semi-transparent with frosted glass effect
   - Lighting: Rim-lit from behind with ${params.selectedHex} glow
   - Shadow: Soft volumetric shadow beneath

3. BOTTOM SECTION:
   - Element: QR code (provided as image)
   - Frame: High-contrast illuminated border
   - Treatment: Neon frame in ${params.selectedHex} color
   - Background: Dark contrasting panel for scannability
   - CRITICAL: QR code must remain fully scannable - maintain high contrast

TECHNICAL REQUIREMENTS:
- Resolution: Minimum 1080x1920 pixels (9:16 aspect ratio)
- Format: PNG with transparency support where applicable
- Quality: Maximum detail and sharpness
- Text legibility: All text must be clearly readable
- QR scannability: QR code must be 100% scannable with standard QR readers

COMPOSITION RULES:
- Maintain visual hierarchy: Name → Logo → QR
- Use rule of thirds for element placement
- Create depth with layered elements
- Apply atmospheric perspective (distant elements more hazy)
- Balance negative space for breathing room

LIGHTING SETUP:
- Key light: ${params.selectedHex} neon source from top-right
- Fill light: Subtle cyan/blue ambient from bottom-left
- Rim light: Accent highlights on all major elements
- Atmospheric fog: Subtle volumetric haze throughout

DO NOT INCLUDE:
- Any device frames (phones, tablets, etc.)
- Any UI elements beyond the specified content
- Any watermarks or signatures
- Any text other than "${params.eventName}"

The final result should look like a premium, state-of-the-art cyberpunk lock screen that could be featured in a high-end tech showcase.`;
```

### Image Attachments

The prompt is sent with **TWO image attachments**:
1. **Logo Image**: `params.logoBuffer` (converted to base64)
2. **QR Code Image**: `params.qrBuffer` (converted to base64)

### Gemini API Call Structure

```javascript
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp' });

const result = await model.generateContent([
  prompt,
  {
    inlineData: {
      data: params.logoBuffer.toString('base64'),
      mimeType: 'image/png'
    }
  },
  {
    inlineData: {
      data: params.qrBuffer.toString('base64'),
      mimeType: 'image/png'
    }
  }
]);
```

---

## 6. Persistence & Docker

### Dockerfile

```dockerfile
FROM node:20-slim

# Install system dependencies for Sharp (image processing)
RUN apt-get update && \
    apt-get install -y libvips-dev && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy application source
COPY . .

# Create storage directory
RUN mkdir -p /app/storage

# Start the bot
CMD ["node", "src/bot.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  brand-lock-ai:
    build: .
    container_name: brand-lock-ai
    env_file: .env
    volumes:
      - ./storage:/app/storage
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Storage Directory Structure

```
storage/
├── logo_fixed.png    # Persistent saved logo (optional)
└── qr_fixed.png      # Persistent saved QR code (optional)
```

**Persistence Rules**:
- ✅ Files in `./storage` persist across container restarts
- ✅ Bind mount ensures data survives container recreation
- ❌ One-time uploads are NEVER written to `./storage`
- ❌ Session data is in-memory only (lost on restart)

---

## 7. Deployment Script (deploy.sh)

```bash
#!/bin/bash

# Configuration
SERVER_IP="1.2.3.4"  # ⚠️ MUST BE REPLACED WITH ACTUAL SERVER IP
REMOTE_DIR="/root/brand-lock-ai"

echo "📦 Zipping files..."
zip -r deploy.zip . \
  -x "node_modules/*" \
  -x ".env" \
  -x ".git/*" \
  -x "*.DS_Store" \
  -x "storage/*"

echo "🚀 Uploading to Server..."
scp deploy.zip root@$SERVER_IP:$REMOTE_DIR/

echo "🛠️  Building and Deploying on Server..."
ssh root@$SERVER_IP << 'ENDSSH'
cd /root/brand-lock-ai
unzip -o deploy.zip
rm deploy.zip
docker compose down
docker compose up -d --build
docker image prune -f
ENDSSH

echo "🧹 Cleaning up local zip..."
rm deploy.zip

echo "✅ Done! Bot updated successfully."
echo "📊 Check logs with: ssh root@$SERVER_IP 'docker logs -f brand-lock-ai'"
```

### Deployment Checklist

Before running `deploy.sh`:
1. ✅ Update `SERVER_IP` in the script
2. ✅ Ensure SSH key authentication is configured
3. ✅ Create `.env` file on the server manually (NOT deployed via script)
4. ✅ Ensure `storage/` directory exists on server
5. ✅ Test SSH connection: `ssh root@$SERVER_IP`

---

## 8. UX Guidelines (English Only)

### Button Design Patterns

All inline keyboard buttons MUST follow this emoji-first pattern:

| Action Type | Emoji | Example |
|-------------|-------|---------|
| Default/Quick Action | ⚡ | ⚡ Use Default Name |
| Custom Input | ✏️ | ✏️ Enter Custom Name |
| Saved Asset | 💾 | 💾 Use Saved Logo |
| Upload | 📤 | 📤 Upload Logo |
| Generate | 🔗 | 🔗 Generate QR from URL |
| Replace | 🔄 | 🔄 Replace Saved QR |
| Color Selection | 🎨 | 🎨 #FF6B35 |
| External Link | 🌈 | 🌈 Open Vibrant Palette |

### Status Messages

Provide clear feedback at every step:

```javascript
// Processing feedback
"🎨 Extracting colors from your logo..."
"✅ Colors extracted successfully!"
"🔗 Generating QR code from URL..."
"✅ QR code generated!"
"🎨 Gemini is painting your wallpaper..."
"✅ Your wallpaper is ready!"

// Error feedback
"❌ Invalid image format. Please upload PNG or JPEG."
"❌ Invalid URL. Please send a valid URL."
"❌ QR generation failed. Please try again."
"❌ Gemini API error: [brief description]"
"❌ File too large. Maximum size is 10MB."
```

### Error Handling Rules

1. **User-Facing Errors**: Always in English, clear, actionable
2. **Internal Logging**: Detailed technical errors logged to console
3. **Never Expose**: API keys, internal paths, stack traces
4. **Retry Guidance**: Always suggest next steps (e.g., "Please try again with /start")

### Message Formatting

```javascript
// Use markdown for emphasis
ctx.reply('*Bold text* for important info');
ctx.reply('_Italic text_ for subtle notes');
ctx.reply('`Code text` for technical terms');

// Use emojis for visual hierarchy
ctx.reply('✅ Success message');
ctx.reply('⚠️ Warning message');
ctx.reply('❌ Error message');
ctx.reply('ℹ️ Info message');
```

---

## 9. Implementation Details

### Package.json Dependencies

```json
{
  "name": "brand-lock-ai",
  "version": "1.0.0",
  "description": "AI-powered cyberpunk lock screen wallpaper generator",
  "main": "src/bot.js",
  "scripts": {
    "start": "node src/bot.js",
    "dev": "nodemon src/bot.js"
  },
  "dependencies": {
    "telegraf": "^4.16.3",
    "@google/genai": "^1.34.0",
    "node-vibrant": "^4.0.3",
    "qrcode": "^1.5.4",
    "sharp": "^0.34.5",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### File Size Limits

- **Logo Upload**: Maximum 10MB
- **QR Upload**: Maximum 5MB
- **Generated Wallpaper**: Approximately 2-5MB (1080x1920 PNG)

### Timeout Configuration

- **Gemini API Timeout**: 60 seconds
- **User Input Timeout**: None (session persists until completion)
- **Image Processing Timeout**: 30 seconds

### Logging Strategy

```javascript
// Log all user interactions
console.log(`[${new Date().toISOString()}] User ${ctx.from.id}: ${ctx.message.text}`);

// Log state transitions
console.log(`[STATE] ${ctx.from.id}: ${oldState} → ${newState}`);

// Log errors with context
console.error(`[ERROR] ${ctx.from.id} in ${ctx.session.state}:`, error);

// Log API calls
console.log(`[GEMINI] Generating wallpaper for ${ctx.from.id}`);
```

---

## 10. Testing Checklist

### Manual Testing Scenarios

#### ✅ Happy Path
1. Send `/start`
2. Select default name
3. Upload logo (save for future)
4. Select color from palette
5. Generate QR from URL
6. Receive wallpaper

#### ✅ Saved Assets Path
1. Complete happy path once
2. Send `/start` again
3. Use saved logo
4. Select different color
5. Use saved QR
6. Receive wallpaper

#### ✅ One-Time Assets Path
1. Send `/start`
2. Upload one-time logo (don't save)
3. Select color
4. Upload one-time QR image
5. Verify `storage/` unchanged
6. Receive wallpaper

#### ✅ Error Scenarios
1. Upload invalid image format → Expect error
2. Send invalid URL for QR → Expect error
3. Send oversized file → Expect error
4. Interrupt flow mid-session → Expect graceful recovery

#### ✅ Security Test
1. Send message from unauthorized user ID
2. Verify bot ignores or sends generic error
3. Verify no internal details exposed

---

## 11. README.md Content Outline

The README should include:

1. **Project Overview**: Brief description and features
2. **Prerequisites**: Node.js 20+, Docker, API keys
3. **Installation**:
   - Clone repository
   - Copy `.env.example` to `.env`
   - Fill in environment variables
4. **Local Development**:
   - `npm install`
   - `npm start`
5. **Docker Deployment**:
   - `docker compose up -d --build`
6. **Remote Deployment**:
   - Configure `deploy.sh`
   - Run `./deploy.sh`
7. **Usage Guide**: Step-by-step bot interaction flow
8. **Troubleshooting**: Common issues and solutions
9. **License**: MIT or appropriate license

---

## 12. Security Considerations

### Critical Security Rules

1. ✅ **User ID Validation**: EVERY message must pass through security middleware
2. ✅ **Environment Variables**: NEVER commit `.env` to git
3. ✅ **API Keys**: Store securely, never expose in logs or errors
4. ✅ **Input Validation**: Validate all user inputs (URLs, images, text)
5. ✅ **File Size Limits**: Prevent DoS attacks via large file uploads
6. ✅ **Error Messages**: Never expose internal details to users
7. ✅ **Session Isolation**: Each user has isolated session data
8. ✅ **Storage Access**: Only bot process can write to `./storage`

### .gitignore

```
node_modules/
.env
storage/
*.log
.DS_Store
deploy.zip
```

---

## 13. Performance Optimization

### Image Processing
- Use `sharp` for fast buffer operations
- Compress images before sending to Gemini
- Cache color palettes in session to avoid re-extraction

### API Calls
- Implement retry logic for Gemini API failures (max 3 retries)
- Use exponential backoff for rate limiting
- Set reasonable timeouts (60s for generation)

### Memory Management
- Clear session data after wallpaper generation
- Limit concurrent sessions (single user only in this case)
- Use streams for large file operations

---

## End of Specification

This specification is comprehensive and ready for implementation. All technical details, user flows, error handling, security measures, and deployment procedures are fully defined.
