# 🚀 Technical Specification: branded-qr-wallpaper-generator (Project "Anti-Gravity")

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
branded-qr-wallpaper-generator/
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
  state: 'AWAITING_NAME' | 'AWAITING_EVENT' | 'AWAITING_LOGO' | 'AWAITING_COLOR' | 'AWAITING_PORTRAIT' | 'AWAITING_QR' | 'GENERATING',
  data: {
    personalName: null,     // String: User's personal name
    eventName: null,        // String: Event name
    logoBuffer: null,       // Buffer: Logo image (from file or upload)
    logoSource: null,       // 'fixed' | 'onetime'
    portraitBuffer: null,   // Buffer: Portrait image (optional)
    portraitSource: null,   // 'fixed' | 'onetime' | 'skipped'
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
Check for saved assets (logo_fixed.*, portrait_fixed.*, qr_fixed.*)
  ↓
[AWAITING_NAME] → Personal Name Selection
  ↓
[AWAITING_EVENT] → Event Name Input
  ↓
[AWAITING_LOGO] → Logo Selection/Upload
  ↓
Extract colors with node-vibrant
  ↓
[AWAITING_COLOR] → Color Palette Selection
  ↓
[AWAITING_PORTRAIT] → Portrait Selection/Upload/Skip
  ↓
[AWAITING_QR] → QR Selection/Upload/Generation
  ↓
[GENERATING] → Call Gemini Nano Banana Pro API
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
2. Check if `storage/logo_fixed.*`, `storage/portrait_fixed.*`, and `storage/qr_fixed.*` exist
3. Display welcome message with personal name selection

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
Welcome to Branded QR Wallpaper Generator! 🎨

Let's create your personalized cyberpunk wallpaper.

What's your name (for display)?
```

**User Actions**:
- Click "⚡ Use Default Name" → Set `ctx.session.data.personalName = process.env.DEFAULT_USER_NAME` → Move to AWAITING_EVENT
- Click "✏️ Enter Custom Name" → Wait for text input
- Send text message → Set `ctx.session.data.personalName = ctx.message.text` → Move to AWAITING_EVENT

---

#### State 1.5: AWAITING_EVENT

**Trigger**: Personal name selected

**Actions**:
1. Prompt user for event name

**Message**:
```
🎉 What's the event name?
(e.g., TechGym, AI Summit 2025)
```

**User Actions**:
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
- Click any color button → Set `ctx.session.data.selectedHex = clickedColor` → Move to AWAITING_PORTRAIT
- Click "🌈 Open Vibrant Palette" → Send link to color picker website (optional feature)

---

#### State 3.5: AWAITING_PORTRAIT

**Trigger**: Color selected

**Actions**:
1. Check if `storage/portrait_fixed.*` exists
2. Display portrait selection options

**Scenario A: portrait_fixed.* EXISTS**

**Inline Keyboard**:
```
┌─────────────────────────────────┐
│ 💾 Use Saved Portrait           │
├─────────────────────────────────┤
│ 📤 Upload One-Time Portrait     │
├─────────────────────────────────┤
│ ⏭️ Skip Portrait                │
└─────────────────────────────────┘
```

**Message**:
```
Great! Now let's add your portrait. 🖼️

You have a saved portrait. What would you like to do?
```

**Scenario B: portrait_fixed.* DOES NOT EXIST**

**Inline Keyboard**:
```
┌─────────────────────────────────┐
│ 📤 Upload Portrait              │
├─────────────────────────────────┤
│ ⏭️ Skip Portrait                │
└─────────────────────────────────┘
```

**Message**:
```
Would you like to add your portrait to the wallpaper? 🖼️

You can upload your photo or skip this step.
```

**User Actions**:
- Click "💾 Use Saved Portrait" → Load `storage/portrait_fixed.*` → Set `portraitSource = 'fixed'` → Move to AWAITING_QR
- Click "📤 Upload One-Time Portrait" → Wait for photo → Store in memory → Set `portraitSource = 'onetime'` → Move to AWAITING_QR
- Click "⏭️ Skip Portrait" → Set `portraitSource = 'skipped'` → Move to AWAITING_QR

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
  personalName: ctx.session.data.personalName,
  eventName: ctx.session.data.eventName,
  selectedHex: ctx.session.data.selectedHex,
  logoBuffer: ctx.session.data.logoBuffer,
  portraitBuffer: ctx.session.data.portraitBuffer, // null if skipped
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

### Prompt Template (Nano Banana Pro)

```javascript
const prompt = `Create a stunning 9:16 vertical cyberpunk lock screen wallpaper with these exact specifications:

LAYOUT (Top to Bottom):
1. TOP SAFE ZONE - Minimal empty space (just enough for phone status bar - about 5-8%)
2. HEADER (Start close to top with minimal padding):
   - Line 1: "${params.personalName}" in LARGE glowing ${params.selectedHex} futuristic font
   - Line 2: "${params.eventName}" in LARGE white/light font (SAME SIZE as Line 1)
   - Very close spacing between the two lines (almost stacked)
3. CENTRAL SUBJECT - Use the person from the portrait image EXACTLY AS THEY APPEAR (same clothes, same pose)
   - Keep their natural appearance and clothing
   - Add cyberpunk atmosphere AROUND them (not changing them)
   - Illuminate them with ${params.selectedHex} neon rim-lighting
   - Add a glowing circular halo or frame around their head/shoulders
4. BACKGROUND - Complex tech environment:
   - Circuit board traces and digital patterns
   - Floating data streams and holographic UI elements
   - Place the logo image as a holographic projection or glowing emblem in the scene
   - Use volumetric lighting with ${params.selectedHex} as primary light source
5. BOTTOM - LARGE QR code with high-contrast neon frame in ${params.selectedHex}
   - Make QR code LARGER (roughly 25-30% of wallpaper width)
   - Must be fully scannable (white background, clear borders)
   - Center it with 8% margin from bottom and sides

STYLE & ATMOSPHERE:
- Cyberpunk/Tech aesthetic with depth and layers
- Professional lighting: ${params.selectedHex} key light, cyan/blue fill light
- Atmospheric haze and glow effects
- Sharp details, cinematic quality

CRITICAL RULES:
- Use the EXACT person from the portrait (don't change their body or clothes)
- Use the EXACT logo from the logo image (integrate it into the scene)
- Keep QR code 100% scannable
- NO WHITE BORDERS or frames around the image
- Output: 9:16 vertical format, single integrated image with NO padding or margins`;
```

### Image Attachments

The prompt is sent with **THREE image attachments** (portrait is optional):
1. **Logo Image**: `params.logoBuffer` (converted to base64)
2. **QR Code Image**: `params.qrBuffer` (converted to base64)
3. **Portrait Image**: `params.portraitBuffer` (converted to base64, null if skipped)

### Gemini API Call Structure (Nano Banana Pro)

```javascript
const model = genAI.getGenerativeModel({ 
  model: process.env.GEMINI_MODEL || 'gemini-3-pro-image-preview' 
});

const parts = [
  { text: "IMAGE 1 (BRAND LOGO):" },
  { inlineData: { data: bufferToBase64(logoBuffer), mimeType: 'image/png' } },
  { text: "\nIMAGE 2 (QR CODE):" },
  { inlineData: { data: bufferToBase64(qrBuffer), mimeType: 'image/png' } },
];

if (portraitBuffer) {
  parts.push({ text: "\nIMAGE 3 (USER PORTRAIT - CENTRAL SUBJECT):" });
  parts.push({ inlineData: { data: bufferToBase64(portraitBuffer), mimeType: 'image/png' } });
}

parts.push({ text: "\n\n" + prompt });

const result = await model.generateContent({
  contents: [{ role: 'user', parts }],
  generationConfig: {
    responseModalities: ["TEXT", "IMAGE"],
    temperature: 0.6
  }
});
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
  bot:
    build: .
    container_name: branded-qr-wallpaper-bot
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
├── logo_fixed.*       # Persistent saved logo (optional, any image format)
├── portrait_fixed.*   # Persistent saved portrait (optional, any image format)
└── qr_fixed.*         # Persistent saved QR code (optional, any image format)
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
REMOTE_DIR="/root/branded-qr-wallpaper-generator"

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
cd /root/branded-qr-wallpaper-generator
unzip -o deploy.zip
rm deploy.zip
docker compose down
docker compose up -d --build
docker image prune -f
ENDSSH

echo "🧹 Cleaning up local zip..."
rm deploy.zip

echo "✅ Done! Bot updated successfully."
echo "📊 Check logs with: ssh root@$SERVER_IP 'docker logs -f branded-qr-wallpaper-bot'"
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
  "name": "branded-qr-wallpaper-generator",
  "version": "1.0.0",
  "description": "AI-powered branded wallpaper generator with QR code integration",
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
