# 🎨 Branded QR Wallpaper Generator

AI-powered branded lock screen wallpaper generator with integrated QR codes for Telegram, using Google Gemini's Nano Banana Pro.

## ✨ Features

- 🤖 **Telegram Bot Interface**: Easy-to-use conversational flow
- 🎨 **AI-Generated Wallpapers**: Powered by Google Gemini's Nano Banana Pro (gemini-3-pro-image-preview)
- 🖼️ **Portrait Integration**: Upload your photo to appear in the wallpaper
- 🏷️ **Dual Text Display**: Personal name + Event name for perfect branding
- 🌈 **Smart Color Extraction**: Automatic palette generation from your logo
- 📱 **QR Code Integration**: Generate or upload QR codes for your wallpaper
- 💾 **Persistent Storage**: Save logos, portraits, and QR codes for future use
- 🔒 **Secure**: User ID validation ensures only authorized access
- 🐳 **Docker Ready**: Easy deployment with Docker Compose

## 📋 Prerequisites

- **Node.js** 20+ (for local development)
- **Docker** & **Docker Compose** (for deployment)
- **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather))
- **Google Gemini API Key** (from [Google AI Studio](https://makersuite.google.com/app/apikey))
- **Your Telegram User ID** (get it from [@userinfobot](https://t.me/userinfobot))

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd branded-qr-wallpaper-generator
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
TELEGRAM_TOKEN=your_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
ALLOWED_TELEGRAM_ID=your_telegram_user_id
DEFAULT_USER_NAME=Your Name
STORAGE_PATH=/app/storage
# Recommended: gemini-3-pro-image-preview (Nano Banana Pro) for best quality
GEMINI_MODEL=gemini-3-pro-image-preview
```

### 4. Run Locally

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## 🐳 Docker Deployment

### Local Docker

```bash
docker compose up -d --build
```

View logs:

```bash
docker logs -f branded-qr-wallpaper-bot
```

Stop the bot:

```bash
docker compose down
```

### Remote Server Deployment

1.  **Configure the deployment script**:

    Edit `deploy.sh` and replace `SERVER_IP`:

    ```bash
    SERVER_IP="your.server.ip.address"
    ```

2.  **Ensure SSH access is configured**:

    ```bash
    ssh root@your.server.ip.address
    ```

3.  **Create `.env` file on the server**:

    ```bash
    ssh root@your.server.ip.address
    mkdir -p /root/branded-qr-wallpaper-generator
    nano /root/branded-qr-wallpaper-generator/.env
    # Paste your environment variables
    ```

4.  **Run the deployment script**:

    ```bash
    ./deploy.sh
    ```

    The script will:
    - 📦 Zip the project files
    - 🚀 Upload to your server via SCP
    - 🛠️ Build and start the Docker container
    - 🧹 Clean up temporary files

## 📱 How to Use

1.  **Start the bot**: Send `/start` to your bot on Telegram

2.  **Choose your personal name**:
    - Use default name or enter a custom one

3.  **Enter event name**:
    - Specify the event or occasion (e.g., "TechGym", "AI Summit 2025")

4.  **Upload your logo**:
    - Upload a new logo or use a saved one
    - Option to save for future use

5.  **Select accent color**:
    - Bot extracts 5 dominant colors from your logo
    - Choose your preferred neon accent color

6.  **Upload your portrait** (optional):
    - Upload your photo to appear in the wallpaper
    - Use saved portrait or skip this step

7.  **Add QR code**:
    - Generate from URL
    - Upload an image
    - Use a saved QR code

8.  **Receive your wallpaper**:
    - AI generates a cyberpunk-style 9:16 wallpaper with your branding
    - Download and set as your lock screen!

## 🎨 Wallpaper Style

The bot generates **professional cyberpunk-themed lock screen wallpapers** with:

- 👤 **Your Portrait**: Integrated as the central subject with cyberpunk styling
- 🏷️ **Dual Branding**: Personal name (large) + Event name (large) in glowing neon
- ✨ Neon bioluminescent effects with volumetric lighting
- 🌟 Atmospheric depth and holographic elements
- 🔮 Integrated logo as holographic projection
- 💎 High-contrast QR code frame (larger, more scannable)
- 📐 9:16 aspect ratio optimized for mobile lock screens
- ⏰ Minimal top padding for status bar

## 🔧 Project Structure

```
branded-qr-wallpaper-generator/
├── src/
│   ├── bot.js          # Main bot logic & state machine
│   ├── generator.js    # Gemini API integration (Nano Banana Pro)
│   └── utils.js        # Image processing utilities
├── storage/            # Persistent storage (bind mount)
│   ├── logo_fixed.*    # Saved logo (optional)
│   ├── portrait_fixed.*# Saved portrait (optional)
│   └── qr_fixed.*      # Saved QR code (optional)
├── .env                # Environment configuration
├── .env.example        # Environment template
├── package.json        # Dependencies
├── Dockerfile          # Docker image definition
├── docker-compose.yml  # Docker service configuration
├── deploy.sh           # Deployment automation
└── README.md           # This file
```

## 🔒 Security

- **User ID Validation**: Only the specified `ALLOWED_TELEGRAM_ID` can interact with the bot
- **Environment Variables**: Sensitive data stored in `.env` (not committed to git)
- **Input Validation**: All user inputs are validated before processing
- **File Size Limits**: Maximum 10MB for logos, 5MB for QR codes

## 🐛 Troubleshooting

### Bot doesn't respond

- Check if the bot is running: `docker ps`
- View logs: `docker logs -f branded-qr-wallpaper-bot`
- Verify your Telegram user ID matches `ALLOWED_TELEGRAM_ID`

### Image processing errors

- Ensure `libvips-dev` is installed (included in Dockerfile)
- Check image format (supported: JPEG, PNG, WebP, GIF)
- Verify file size is under 10MB

### Gemini API errors

- Verify your API key is correct
- Check API quota limits
- Ensure you're using a supported model

### Deployment issues

- Verify SSH access to server
- Ensure `.env` file exists on server
- Check Docker and Docker Compose are installed on server

## 📊 Monitoring

View real-time logs:

```bash
# Local
docker logs -f branded-qr-wallpaper-bot

# Remote
ssh root@your.server.ip 'docker logs -f branded-qr-wallpaper-bot'
```

Check container status:

```bash
docker ps | grep branded-qr-wallpaper
```

## 🔄 Updates

To update the bot on your server:

```bash
./deploy.sh
```

The script handles everything automatically!

## 📝 Environment Variables Reference

| Variable | Required | Description |
| :------- | :------- | :---------- |
| `TELEGRAM_TOKEN` | ✅ Yes | Bot token from @BotFather |
| `GEMINI_API_KEY` | ✅ Yes | API key from Google AI Studio |
| `ALLOWED_TELEGRAM_ID` | ✅ Yes | Your Telegram user ID (security) |
| `DEFAULT_USER_NAME` | ✅ Yes | Default name for wallpapers |
| `STORAGE_PATH` | ✅ Yes | Storage path (use `/app/storage` in Docker) |
| `GEMINI_MODEL` | ⚠️ Optional | Gemini model - Recommended: `gemini-3-pro-image-preview` (Nano Banana Pro) for best quality |

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📄 License

MIT License - feel free to use and modify as needed.

## 🙏 Acknowledgments

- **Telegram Bot API** via [Telegraf](https://telegraf.js.org/)
-**AI Engine**: `@google/genai` v1.34.0 (Google Generative AI SDK - latest official SDK)
- **node-vibrant** for color extraction
- **Sharp** for image processing

---

**Made with ❤️ by Harel Dagan**

*Project "Anti-Gravity" 🚀*
