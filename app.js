const express = require('express');
const shortId = require('shortid');
const createHttpError = require('http-errors');
const mongoose = require('mongoose');
const path = require('path');
const ShortUrl = require('./models/url.model');
const qrcode = require('qrcode');
const History = require('./models/history.model');
const Statistics = require('./models/statistics.model');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

mongoose.connect('mongodb+srv://admin:1234@cluster0.yvaiuru.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // useCreateIndex: true, // อย่าใช้งาน useCreateIndex แล้ว เพราะมันไม่ได้รองรับแล้วใน mongoose 7.x
})
.then(() => console.log('mongoose connected 💾'))
.catch((error) => console.error('Error connecting to MongoDB:', error));

app.set('view engine', 'ejs');

app.get('/', async (req, res, next) => {
  try {
    const historyItems = await History.find().sort({ createdAt: 'desc' });
    const statistics = await Statistics.find().sort({ clickedAt: 'desc' });
    const shortUrls = await ShortUrl.find();

    // ดึงข้อมูลจาก URL model และเพิ่มเข้าไปในข้อมูลประวัติ
    for (const historyItem of historyItems) {
      const matchingShortUrl = shortUrls.find((shortUrl) => shortUrl.url === historyItem.originalUrl);
      if (matchingShortUrl) {
        historyItem.clickCount = matchingShortUrl.clickCount;
      }
    }

    res.render('index', { historyItems,  });
  } catch (error) {
    next(error);
  }
});

app.post('/', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      throw createHttpError.BadRequest('ใส่ URL');
    }
    const urlExists = await ShortUrl.findOne({ url });
    if (urlExists) {
      const shortUrlPath = `${req.protocol}://${req.get('host')}/${urlExists.shortId}`;

      // บันทึกประวัติการสร้างลิงก์ลงใน MongoDB
      const historyItem = new History({
        originalUrl: url,
        shortUrl: shortUrlPath,
      });
      await historyItem.save();

      // ตรวจสอบ Header X-QR-Scan หรือพารามิเตอร์ scan และนับคลิกตามเงื่อนไข
      if (req.header('X-QR-Scan') === 'true' || req.query.scan === 'true') {
        urlExists.clickCount++;
        await urlExists.save();
      }

      res.render('index', { short_url: shortUrlPath });
      return;
    }
    const shortIdValue = shortId.generate();
    const shortUrl = new ShortUrl({ url, shortId: shortIdValue });
    const result = await shortUrl.save();
    const shortUrlPath = `${req.protocol}://${req.get('host')}/${result.shortId}`;

    // บันทึกประวัติการสร้างลิงก์ลงใน MongoDB
    const historyItem = new History({
      originalUrl: url,
      shortUrl: shortUrlPath,
    });
    await historyItem.save();

    // ตรวจสอบ Header X-QR-Scan หรือพารามิเตอร์ scan และนับคลิกตามเงื่อนไข
    if (req.header('X-QR-Scan') === 'true' || req.query.scan === 'true') {
      shortUrl.clickCount++;
      await shortUrl.save();
    }
    
    res.render('index', { short_url: shortUrlPath });
  } catch (error) {
    next(error);
  }
});

app.get('/:shortUrl', async (req, res) => {
  try {
    const shortUrl = await ShortUrl.findOne({ shortId: req.params.shortUrl });

    if (shortUrl == null) {
      return res.sendStatus(404);
    }

    shortUrl.clickCount++; // เพิ่มค่า clickCount ที่นี่
    await shortUrl.save(); // บันทึกข้อมูล

    res.redirect(shortUrl.url); // เปลี่ยนเส้นทางไปยัง URL ต้นฉบับ
  } catch (error) {
    console.error('Error:', error);
    res.sendStatus(500);
  }
});

// เส้นทางสำหรับ QR code
app.get('/:shortId/qr', async (req, res, next) => {
  try {
    const { shortId } = req.params;
    const shortUrl = await ShortUrl.findOne({ shortId });
    if (!shortUrl) {
      throw createHttpError.NotFound('Short URL does not exist');
    }

    // ตรวจสอบค่า click จาก query params และเพิ่มค่า clickCount ตามที่ค่าระบุ
    if (req.query.click) {
      shortUrl.clickCount += parseInt(req.query.click, 10);
      await shortUrl.save();
    }

    const qrImageData = await qrcode.toDataURL(shortUrl.url);
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(qrImageData.split(',')[1], 'base64'));
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  next(createHttpError.NotFound());
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.render('index', { error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌏 Server is running on port ${PORT}...`));