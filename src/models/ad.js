const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String },
  image: { type: String, default: '' },
  // type of highlight: popular_search, rating_summary, newly_added, most_viewed_week, most_viewed_month, top_rated, nearby, custom
  kind: { type: String, required: true, index: true },
  // optional link to a facility
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', default: null },
  // arbitrary metadata useful to reconstruct or query the ad
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  source: { type: String, default: 'generated' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

AdSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ad', AdSchema);
