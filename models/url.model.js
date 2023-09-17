const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  shortId: {
    type: String,
    required: true,
  },
  clickCount: {
    type: Number,
    required: true,
    default: 0,
  },
});

const ShortUrl = mongoose.model('ShortUrl', urlSchema);

module.exports = ShortUrl;
