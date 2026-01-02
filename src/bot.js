require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const sharp = require('sharp');
const {
  generateQRCode,
  extractColors,
  validateImage,
  convertToPNG,
  saveFixedAsset,
  loadFixedAsset,
  assetExists,
  loadAssetByBasename,
  assetExistsByBasename,
  isValidURL
} = require('./utils');
const { generateWallpaperWithRetry } = require('./generator');

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_TOKEN', 'GEMINI_API_KEY', 'ALLOWED_TELEGRAM_ID', 'DEFAULT_USER_NAME'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
bot.use(session());

// Security middleware
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  const allowedId = parseInt(process.env.ALLOWED_TELEGRAM_ID);
  if (userId !== allowedId) {
    console.warn(`[SECURITY] ⛔ Unauthorized access attempt from user ID: ${userId}`);
    return;
  }
  return next();
});

// Initialize session
bot.use((ctx, next) => {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.state) {
    ctx.session.state = null;
    ctx.session.data = {
      eventName: null,
      logoBuffer: null,
      logoSource: null,
      portraitBuffer: null,
      portraitSource: null,
      selectedHex: null,
      qrBuffer: null,
      qrSource: null,
      colorPalette: []
    };
  }
  return next();
});

// Logging middleware
bot.use((ctx, next) => {
  const timestamp = new Date().toISOString();
  const userId = ctx.from?.id;
  const messageType = ctx.updateType;
  const text = ctx.message?.text || ctx.callbackQuery?.data || '';
  console.log(`[${timestamp}] User ${userId} (${messageType}): ${text}`);
  return next();
});

// ============================================================================
// STATE HANDLERS
// ============================================================================

async function handleLogoState(ctx) {
  ctx.session.state = 'AWAITING_LOGO';
  const hasLogo = await assetExistsByBasename('logo_fixed');
  
  const buttons = [[Markup.button.callback('📤 Upload Logo', 'logo_onetime')]];
  if (hasLogo) {
    buttons.unshift([Markup.button.callback('💾 Use Saved Logo', 'logo_saved')]);
  }

  await ctx.reply(
    hasLogo ? 'You have a saved logo. What would you like to do?' : 'Please upload your logo. 🖼️',
    Markup.inlineKeyboard(buttons)
  );
}

async function handlePortraitState(ctx) {
  ctx.session.state = 'AWAITING_PORTRAIT';
  const hasPortrait = await assetExistsByBasename('portrait_fixed');
  
  const buttons = [
    [Markup.button.callback('📤 Upload Portrait', 'portrait_onetime')],
    [Markup.button.callback('⏭️ Skip Portrait', 'portrait_skip')]
  ];
  if (hasPortrait) {
    buttons.unshift([Markup.button.callback('💾 Use Saved Portrait', 'portrait_saved')]);
  }

  await ctx.reply(
    hasPortrait ? 'You have a saved portrait. What would you like to do?' : 'Would you like to add a portrait photo? 📸',
    Markup.inlineKeyboard(buttons)
  );
}

async function handleQRState(ctx) {
  ctx.session.state = 'AWAITING_QR';
  const hasQR = await assetExistsByBasename('qr_fixed');
  
  const buttons = [
    [Markup.button.callback('🔗 Generate QR from URL', 'qr_url')],
    [Markup.button.callback('📤 Upload QR Image', 'qr_onetime')]
  ];
  if (hasQR) {
    buttons.unshift([Markup.button.callback('💾 Use Saved QR Code', 'qr_saved')]);
  }

  await ctx.reply(
    hasQR ? 'You have a saved QR code. What would you like to do?' : 'Let\'s add your QR code! 📱',
    Markup.inlineKeyboard(buttons)
  );
}

// ============================================================================
// LOGIC HANDLERS
// ============================================================================

async function handleLogoUpload(ctx) {
  try {
    await ctx.reply('🎨 Processing logo...');
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    await validateImage(buffer);
    buffer = await convertToPNG(buffer);
    ctx.session.data.logoSource = 'onetime';
    ctx.session.data.logoBuffer = buffer;
    await ctx.reply('✅ Logo uploaded');
    await handleColorExtraction(ctx);
  } catch (error) {
    console.error('[ERROR] Logo upload failed:', error);
    await ctx.reply(`❌ ${error.message}\nPlease try again.`);
  }
}

async function handlePortraitUpload(ctx) {
  try {
    await ctx.reply('📸 Processing portrait...');
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    await validateImage(buffer);
    buffer = await convertToPNG(buffer);
    ctx.session.data.portraitSource = 'onetime';
    ctx.session.data.portraitBuffer = buffer;
    await ctx.reply('✅ Portrait uploaded');
    await handleQRState(ctx);
  } catch (error) {
    console.error('[ERROR] Portrait upload failed:', error);
    await ctx.reply(`❌ ${error.message}\nPlease try again.`);
  }
}

async function handleQRUpload(ctx) {
  try {
    await ctx.reply('📱 Processing QR code...');
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    await validateImage(buffer);
    buffer = await convertToPNG(buffer);
    ctx.session.data.qrSource = 'onetime';
    ctx.session.data.qrBuffer = buffer;
    await ctx.reply('✅ QR code uploaded');
    await handleGeneration(ctx);
  } catch (error) {
    console.error('[ERROR] QR upload failed:', error);
    await ctx.reply(`❌ ${error.message}\nPlease try again.`);
  }
}

async function handleColorExtraction(ctx) {
  try {
    await ctx.reply('🎨 Extracting colors from your logo...');
    const colors = await extractColors(ctx.session.data.logoBuffer);
    ctx.session.data.colorPalette = colors;
    
    const paletteImage = await generateColorPalette(colors);
    await ctx.replyWithPhoto({ source: paletteImage });
    
    const colorButtons = colors.map((hex, index) => [Markup.button.callback(`${index + 1}. ${hex}`, `color_${hex}`)]);
    colorButtons.push([Markup.button.callback('🌈 Enter Custom Color', 'color_custom')]);
    
    await ctx.reply('Select your neon accent color:', Markup.inlineKeyboard(colorButtons));
  } catch (error) {
    console.error('[ERROR] Color extraction failed:', error);
    await ctx.reply('❌ Color extraction failed. Please try again with /start');
  }
}

async function generateColorPalette(colors) {
  const swatchWidth = 100;
  const swatchHeight = 80;
  const totalWidth = swatchWidth * colors.length;
  
  const swatches = colors.map((color, index) => {
    const x = index * swatchWidth;
    const brightness = hexToBrightness(color);
    const textColor = brightness > 128 ? 'black' : 'white';
    return `
      <rect x="${x}" y="0" width="${swatchWidth}" height="${swatchHeight}" fill="${color}"/>
      <text x="${x + swatchWidth/2}" y="${swatchHeight - 10}" 
            font-family="Arial" font-size="14" font-weight="bold" 
            fill="${textColor}" text-anchor="middle">
        ${index + 1}
      </text>
    `;
  }).join('');
  
  const svg = `<svg width="${totalWidth}" height="${swatchHeight}">${swatches}</svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

function hexToBrightness(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const rgb = result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

async function handleGeneration(ctx) {
  ctx.session.state = 'GENERATING';
  try {
    await ctx.reply('🎨 Gemini is painting your wallpaper...\nThis may take 10-30 seconds.');
    const params = {
      personalName: ctx.session.data.personalName,
      eventName: ctx.session.data.eventName,
      selectedHex: ctx.session.data.selectedHex,
      logoBuffer: ctx.session.data.logoBuffer,
      portraitBuffer: ctx.session.data.portraitBuffer,
      qrBuffer: ctx.session.data.qrBuffer
    };
    const wallpaperBuffer = await generateWallpaperWithRetry(params);
    await ctx.replyWithDocument(
      { source: wallpaperBuffer, filename: `${params.eventName}_wallpaper.png` },
      { caption: '✅ Your wallpaper is ready!\nUse /start to create another one.' }
    );
    ctx.session.state = null;
  } catch (error) {
    console.error('[ERROR] Generation failed:', error);
    await ctx.reply(`❌ Generation failed: ${error.message}\nTry again with /start`);
  }
}

// ============================================================================
// BOT ACTIONS & COMMANDS
// ============================================================================

bot.command('start', async (ctx) => {
  ctx.session.state = 'AWAITING_NAME';
  ctx.session.data = { eventName: null, logoBuffer: null, logoSource: null, portraitBuffer: null, portraitSource: null, selectedHex: null, qrBuffer: null, qrSource: null, colorPalette: [] };
  
  const hasLogo = await assetExistsByBasename('logo_fixed');
  const hasPortrait = await assetExistsByBasename('portrait_fixed');
  const hasQR = await assetExistsByBasename('qr_fixed');
  
  let status = '';
  const found = [];
  if (hasLogo) found.push('logo');
  if (hasPortrait) found.push('portrait');
  if (hasQR) found.push('QR');
  
  if (found.length > 0) {
    status = `\n\n💾 Found saved ${found.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
  }

  await ctx.reply(
    `Welcome to Branded QR Wallpaper Generator! 🎨${status}\nChoose your name:`,
    Markup.inlineKeyboard([
      [Markup.button.callback(`⚡ Use Default Name (${process.env.DEFAULT_USER_NAME})`, 'name_default')],
      [Markup.button.callback('✏️ Enter Custom Name', 'name_custom')]
    ])
  );
});

bot.action('name_default', async (ctx) => {
  ctx.session.data.personalName = process.env.DEFAULT_USER_NAME;
  await ctx.editMessageText(`✅ Personal Name: *${ctx.session.data.personalName}*`, { parse_mode: 'Markdown' });
  ctx.session.state = 'AWAITING_EVENT';
  await ctx.reply('🎉 What\'s the event name?\n(e.g., TechGym, AI Summit 2025)');
});

bot.action('name_custom', async (ctx) => {
  await ctx.editMessageText('✏️ Please send your custom name:');
  ctx.session.state = 'AWAITING_NAME_INPUT';
});

bot.action('logo_saved', async (ctx) => {
  try {
    const logoBuffer = await loadAssetByBasename('logo_fixed');
    ctx.session.data.logoBuffer = logoBuffer;
    ctx.session.data.logoSource = 'fixed';
    await ctx.editMessageText('✅ Using saved logo');
    await handleColorExtraction(ctx);
  } catch (error) {
    await ctx.reply(`❌ Failed to load logo: ${error.message}`);
    await handleLogoState(ctx);
  }
});

bot.action('logo_onetime', async (ctx) => {
  ctx.session.state = 'AWAITING_LOGO_UPLOAD';
  await ctx.editMessageText('📤 Please upload your logo image:');
});

bot.action(/^color_#/, async (ctx) => {
  ctx.session.data.selectedHex = ctx.callbackQuery.data.replace('color_', '');
  await ctx.editMessageText(`✅ Selected color: *${ctx.session.data.selectedHex}*`, { parse_mode: 'Markdown' });
  await handlePortraitState(ctx);
});

bot.action('color_custom', async (ctx) => {
  ctx.session.state = 'AWAITING_COLOR_CUSTOM';
  await ctx.editMessageText('🌈 Please send your custom HEX color code:');
});

bot.action('portrait_saved', async (ctx) => {
  try {
    const buffer = await loadAssetByBasename('portrait_fixed');
    ctx.session.data.portraitBuffer = buffer;
    ctx.session.data.portraitSource = 'fixed';
    await ctx.editMessageText('✅ Using saved portrait');
    await handleQRState(ctx);
  } catch (error) {
    await ctx.reply(`❌ Failed to load portrait: ${error.message}`);
    await handlePortraitState(ctx);
  }
});

bot.action('portrait_onetime', async (ctx) => {
  ctx.session.state = 'AWAITING_PORTRAIT_UPLOAD';
  await ctx.editMessageText('📤 Please upload your portrait photo:');
});

bot.action('portrait_skip', async (ctx) => {
  ctx.session.data.portraitSource = 'skipped';
  await ctx.editMessageText('⏭️ Skipping portrait');
  await handleQRState(ctx);
});

bot.action('qr_saved', async (ctx) => {
  try {
    const buffer = await loadAssetByBasename('qr_fixed');
    ctx.session.data.qrBuffer = buffer;
    ctx.session.data.qrSource = 'fixed';
    await ctx.editMessageText('✅ Using saved QR code');
    await handleGeneration(ctx);
  } catch (error) {
    await ctx.reply(`❌ Failed to load QR: ${error.message}`);
    await handleQRState(ctx);
  }
});

bot.action('qr_url', async (ctx) => {
  ctx.session.state = 'AWAITING_QR_URL';
  await ctx.editMessageText('🔗 Please send the URL:');
});

bot.action('qr_onetime', async (ctx) => {
  ctx.session.state = 'AWAITING_QR_UPLOAD';
  await ctx.editMessageText('📤 Please upload your QR code image:');
});

bot.on('text', async (ctx) => {
  if (ctx.session.state === 'AWAITING_NAME_INPUT') {
    ctx.session.data.personalName = ctx.message.text;
    await ctx.reply(`✅ Personal Name: *${ctx.session.data.personalName}*`, { parse_mode: 'Markdown' });
    ctx.session.state = 'AWAITING_EVENT';
    await ctx.reply('🎉 What\'s the event name?\n(e.g., TechGym, AI Summit 2025)');
  } else if (ctx.session.state === 'AWAITING_EVENT') {
    ctx.session.data.eventName = ctx.message.text;
    await ctx.reply(`✅ Event: *${ctx.session.data.eventName}*`, { parse_mode: 'Markdown' });
    await handleLogoState(ctx);
  } else if (ctx.session.state === 'AWAITING_COLOR_CUSTOM') {
    let hex = ctx.message.text.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (!/^#[0-9A-F]{6}$/i.test(hex)) return ctx.reply('❌ Invalid HEX format.');
    ctx.session.data.selectedHex = hex.toUpperCase();
    await ctx.reply(`✅ Selected color: *${ctx.session.data.selectedHex}*`, { parse_mode: 'Markdown' });
    await handlePortraitState(ctx);
  } else if (ctx.session.state === 'AWAITING_QR_URL') {
    const url = isValidURL(ctx.message.text);
    if (!url) return ctx.reply('❌ Invalid URL.');
    try {
      ctx.session.data.qrBuffer = await generateQRCode(url);
      ctx.session.data.qrSource = 'generated';
      await ctx.reply('✅ QR generated!');
      await handleGeneration(ctx);
    } catch (error) {
      await ctx.reply(`❌ QR generation failed: ${error.message}`);
    }
  }
});

bot.on('photo', async (ctx) => {
  if (ctx.session.state === 'AWAITING_LOGO_UPLOAD') await handleLogoUpload(ctx);
  else if (ctx.session.state === 'AWAITING_PORTRAIT_UPLOAD') await handlePortraitUpload(ctx);
  else if (ctx.session.state === 'AWAITING_QR_UPLOAD') await handleQRUpload(ctx);
});

bot.launch().then(() => console.log('✅ Bot started')).catch(e => { console.error('❌ Start failed:', e); process.exit(1); });
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
