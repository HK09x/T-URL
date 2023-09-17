// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDN1TboNjuATvsf2ciRvfLWk74VvY8WFq0",
  authDomain: "tee1-a4a80.firebaseapp.com",
  databaseURL: "https://tee1-a4a80-default-rtdb.firebaseio.com",
  projectId: "tee1-a4a80",
  storageBucket: "tee1-a4a80.appspot.com",
  messagingSenderId: "66035979838",
  appId: "1:66035979838:web:bde0b73bc44b084ccf236f",
  measurementId: "G-FWCZ4MKMN9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const express = require('express');
const shortId = require('shortid');
const createHttpError = require('http-errors');
const mongoose = require('mongoose');
const path = require('path');
const ShortUrl = require('./web/models/url.model');
const qrcode = require('qrcode');
const History = require('./web/models/history.model');
const Statistics = require('./web/models/statistics.model');

const expressApp = express(); // เปลี่ยนชื่อตัวแปร 'app' เป็น 'expressApp'
expressApp.use(express.static(path.join(__dirname, 'public')));
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: false }));

mongoose.connect('mongodb+srv://admin:1234@cluster0.yvaiuru.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('mongoose connected 💾'))
.catch((error) => console.error('Error connecting to MongoDB:', error));

expressApp.set('view engine', 'ejs');

expressApp.get('/', async (req, res, next) => {
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

    res.render('index', { historyItems, statistics });
  } catch (error) {
    next(error);
  }
});

expressApp.post('/', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      throw createHttpError.BadRequest('Provide a valid URL');
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

expressApp.get('/:shortUrl', async (req, res) => {
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
expressApp.get('/:shortId/qr', async (req, res, next) => {
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

expressApp.use((req, res, next) => {
  next(createHttpError.NotFound());
});

expressApp.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.render('index', { error: err.message });
});

const PORT = process.env.PORT || 3000;
expressApp.listen(PORT, () => console.log(`🌏 Server is running on port ${PORT}...`));