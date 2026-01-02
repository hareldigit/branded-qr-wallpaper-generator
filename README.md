# 🎨 Brand Lock AI

AI-powered cyberpunk lock screen wallpaper generator for Telegram using Google Gemini AI.

## ✨ Features

- 🤖 **Telegram Bot Interface**: Easy-to-use conversational flow
- 🎨 **AI-Generated Wallpapers**: Powered by Google Gemini 2.0 Flash
- 🌈 **Smart Color Extraction**: Automatic palette generation from your logo
- 📱 QR Code Integration: Generate or upload QR codes for your wallpaper
- 📱 **Image Processing Libraries**:
* `node-vibrant` v4.0.3: Extract dominant color palettes from logo images
* `qrcode` v1.5.4: Generate QR codes from URLs in real-time
* `sharp` v0.34.5: Image buffer manipulation, validation, and format conversionly authorized access
- 💾 **Persistent Storage**: Save logos and QR codes for future use
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
cd brand-lock-ai
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
GEMINI_MODEL=gemini-2.0-flash-exp
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
docker logs -f brand-lock-ai
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
    mkdir -p /root/brand-lock-ai
    nano /root/brand-lock-ai/.env
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

2.  **Choose your name**:
    - Use default name or enter a custom one

3.  **Upload your logo**:
    - Upload a new logo or use a saved one
    - Option to save for future use

4.  **Select accent color**:
    - Bot extracts 5 dominant colors from your logo
    - Choose your preferred neon accent color

5.  **Add QR code**:
    - Generate from URL
    - Upload an image
    - Use a saved QR code

6.  **Receive your wallpaper**:
    - AI generates a cyberpunk-style 9:16 wallpaper
    - Download and set as your lock screen!

## 🎨 Wallpaper Style

The bot generates **cyberpunk-themed lock screen wallpapers** with:

- ✨ Neon bioluminescent effects
- 🌟 Volumetric lighting and atmospheric depth
- 🔮 Holographic 3D text
- 💎 Glass morphism effects on logo
- 📱 High-contrast QR code frame
- 📐 9:16 aspect ratio (1080x1920px)
- ⏰ Safe zone for status bar and clock

## 🔧 Project Structure

```
brand-lock-ai/
├── src/
│   ├── bot.js          # Main bot logic & state machine
│   ├── generator.js    # Gemini AI integration
│   └── utils.js        # Image processing utilities
├── storage/            # Persistent storage (bind mount)
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
- View logs: `docker logs -f brand-lock-ai`
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
docker logs -f brand-lock-ai

# Remote
ssh root@your.server.ip 'docker logs -f brand-lock-ai'
```

Check container status:

```bash
docker ps | grep brand-lock-ai
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
| `GEMINI_MODEL` | ⚠️ Optional | Gemini model (default: `gemini-2.0-flash-exp`) |

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
