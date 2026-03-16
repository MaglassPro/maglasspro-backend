const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [80, 'Name cannot exceed 80 characters']
  },
  role: {
    type: String,
    trim: true,
    maxlength: [100, 'Role cannot exceed 100 characters'],
    default: ''
  },
  text: {
    type: String,
    required: [true, 'Review text is required'],
    trim: true,
    maxlength: [600, 'Review cannot exceed 600 characters']
  },
  visible: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', testimonialSchema);
