// --- ІМПОРТИ ---
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execPromise = promisify(exec);

// --- ПЕРЕВІРКА ТОКЕНА ---
if (!process.env.BOT_TOKEN) {
  console.error('❌ ПОМИЛКА: Відсутній BOT_TOKEN!');
  process.exit(1);
}

// --- ІНІЦІАЛІЗАЦІЯ ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- ЛОГІКА БОТА ---
bot.start((ctx) => {
  ctx.reply(
    '🎉 SaveMedia Бот - Універсальний завантажувач!\n\n' +
    '📱 Підтримка:\n' +
    '✅ TikTok, Instagram, YouTube\n' +
    '✅ Twitter/X, Facebook, Reddit\n' +
    '✅ Pinterest, Vimeo, Twitch\n' +
    '✅ 1000+ інших сайтів!\n\n' +
    '🚀 Просто відправ посилання!',
    Markup.keyboard([
      Markup.button.webApp('📥 Скачати Відео', 'https://save-media-fog3.vercel.app/')
    ]).resize()
  );
});

// --- ФУНКЦІЯ ЗАВАНТАЖЕННЯ ЧЕРЕЗ YT-DLP ---
async function downloadWithYtDlp(url) {
  const tempDir = '/tmp';
  const outputTemplate = path.join(tempDir, 'video_%(id)s.%(ext)s');

  try {
    console.log('🔍 Починаю завантаження через yt-dlp...');

    // Команда для отримання прямого посилання (без завантаження файлу)
    const ytdlpPath = path.join(__dirname, 'yt-dlp');
    const command = `${ytdlpPath} --no-warnings --no-playlist --format "best[ext=mp4]/best" --get-url "${url}"`;

    const { stdout, stderr } = await execPromise(command, {
      timeout: 30000, // 30 секунд максимум
      maxBuffer: 1024 * 1024 * 10 // 10MB буфер
    });

    if (stderr && !stdout) {
      throw new Error('yt-dlp не зміг обробити посилання');
    }

    const videoUrl = stdout.trim().split('\n')[0]; // Беремо перший рядок (пряме посилання)

    if (!videoUrl || !videoUrl.startsWith('http')) {
      throw new Error('Не вдалося отримати пряме посилання');
    }

    console.log('✅ Пряме посилання отримано!');
    return { success: true, videoUrl };

  } catch (error) {
    console.error('❌ Помилка yt-dlp:', error.message);
    return { success: false, error: error.message };
  }
}

// --- РЕЗЕРВНИЙ МЕТОД: TIKWM ДЛЯ TIKTOK ---
async function downloadTikTok(url) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.code === 0 && result.data) {
      const videoUrl = result.data.hdplay || result.data.play;
      return { success: true, videoUrl };
    }
  } catch (error) {
    console.log('TikWM резерв не спрацював');
  }
  return { success: false };
}

// --- ГОЛОВНА ФУНКЦІЯ ---
async function downloadVideo(url) {
  // Спочатку пробуємо yt-dlp (універсальний)
  let result = await downloadWithYtDlp(url);

  // Якщо не спрацювало і це TikTok - пробуємо резерв
  if (!result.success && url.includes('tiktok')) {
    console.log('🔄 Пробую резервний TikTok API...');
    result = await downloadTikTok(url);
  }

  return result;
}

// --- API ENDPOINT ---
app.post('/download', async (req, res) => {
  const { url, chatId } = req.body;

  if (!url || !chatId) {
    return res.status(400).json({ success: false, message: 'Немає URL' });
  }

  console.log(`📥 Запит: ${url}`);

  try {
    await bot.telegram.sendMessage(chatId, '⏳ Обробляю відео...');

    const result = await downloadVideo(url);

    if (!result.success) {
      throw new Error(result.error || 'Не вдалося завантажити відео');
    }

    console.log('📤 Відправляю відео...');

    // Відправляємо відео в Telegram
    await bot.telegram.sendVideo(chatId, result.videoUrl, {
      caption: '✅ Відео завантажено!\n🤖 @SaveMedia_bot',
      supports_streaming: true
    });

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Помилка:', error.message);

    try {
      await bot.telegram.sendMessage(
        chatId,
        `❌ Помилка: ${error.message}\n\n` +
        '💡 Поради:\n' +
        '• Перевір посилання\n' +
        '• Акаунт має бути публічним\n' +
        '• Відео не має бути видаленим'
      );
    } catch (e) {}

    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (_, res) => res.send('🤖 SaveMedia Server (yt-dlp powered)'));

// --- ЗАПУСК ---
app.listen(PORT, () => console.log(`✅ Сервер: ${PORT}`));

bot.launch()
  .then(() => console.log('✅ Бот запущений!'))
  .catch(err => {
    console.error('❌ Помилка:', err);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));