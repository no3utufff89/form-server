import "dotenv/config";
import { Bot } from '@maxhub/max-bot-api';
import express from 'express';
import rateLimit from 'express-rate-limit';
// ✅ Диагностика
console.log('📁 NODE_EXTRA_CA_CERTS из .env:', process.env.NODE_EXTRA_CA_CERTS);
console.log('📁 BOT_TOKEN из .env:', process.env.BOT_TOKEN ? '✅ загружен' : '❌ не загружен');
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = process.env.OWNER_ID;

if (!BOT_TOKEN || !OWNER_ID) {
    console.error('❌ Ошибка: не заданы BOT_TOKEN или OWNER_ID');
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3003;
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
    'https://turbinakaluga.ru',
    'https://www.turbinakaluga.ru',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];
// --- CORS ---
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }

    next();
});


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // максимум 5 заявок
    message: {
        success: false,
        error: 'Слишком много заявок. Пожалуйста, подождите 15 минут.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Применяем лимит ко всем POST-запросам
app.use(limiter);

// --- Обработчики ---

app.post('/price-request', async (req, res) => {
    const { phone, name, question, title = '📩 РАСЧЁТ СТОИМОСТИ РЕМОНТА' } = req.body;
    await sendToMax(phone, name, question, title, res);
});

app.post('/diagnost-request', async (req, res) => {
    const { phone, name, question, title = '📩 ЗАПИСЬ НА ДИАГНОСТИКУ' } = req.body;
    await sendToMax(phone, name, question, title, res);
});

app.post('/repair-request', async (req, res) => {
    const { phone, name, question, title = '📩 ЗАПИСЬ НА РЕМОНТ' } = req.body;
    await sendToMax(phone, name, question, title, res);
});

app.post('/question-request', async (req, res) => {
    const { phone, name, question } = req.body;
    const now = new Date();
    const dateTime = now.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const text = `
📩 НОВЫЙ ВОПРОС МАСТЕРУ
👤 Имя: ${name || 'Не указано'}
📱 Телефон: ${phone || 'Не указан'}
💬 Вопрос: ${question || 'Не задан'}
🕐 Время: ${dateTime}
    `;
    await sendToMaxWithText(text, res);
});

// --- Health-check для Render ---
app.get('/ping', (req, res) => {
    res.status(200).send('ok');
});
app.head('/', (req, res) => {
    res.status(200).end();
});
app.head('/ping', (req, res) => {
    res.status(200).end();
});
// --- Универсальная отправка ---
async function sendToMax(phone, name, question, title, res) {
    if (!phone || phone.length < 11) {
        return res.status(400).json({ success: false, error: 'Неверный номер' });
    }
    const now = new Date();
    const dateTime = now.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const text = `
👤 Имя: ${name || 'Не указано'}
📱 Телефон: ${phone}
💬 Вопрос: ${question || 'Не указан'}
📌 Тема: ${title}
🕐 Время: ${dateTime}
─────────────────
    `;

    try {
        await bot.api.sendMessageToUser(OWNER_ID, text, {
            format: 'HTML'
        });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
}

async function sendToMaxWithText(text, res) {
    try {
        await bot.api.sendMessageToUser(OWNER_ID, text);
        console.log('✅ Вопрос отправлен');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
}

bot.api.getMyInfo().then(info => {
    console.log(`🤖 Бот: ${info.name}`);
});

app.listen(PORT, () => {
    bot.start();
    console.log(`🚀 Сервер на порту ${PORT}`);
});