const mongoose = require('mongoose');

const statisticsSchema = new mongoose.Schema({
  shortId: {
    type: String,
    required: true,
  },
  clickedAt: {
    type: Date,
    default: Date.now,
  },
  ipAddress: {
    type: String,
    required: true,
  },
});

const Statistics = mongoose.model('Statistics', statisticsSchema);

module.exports = Statistics;
