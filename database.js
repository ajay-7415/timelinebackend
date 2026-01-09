import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable-tracker';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Timetable Entry Schema
const timetableEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  start_time: {
    type: String,
    required: true
  },
  end_time: {
    type: String,
    required: true
  },
  is_recurring: {
    type: Boolean,
    default: true
  },
  exclude_days: {
    type: [Number],
    default: []  // Array of day numbers to exclude (0=Sunday, 6=Saturday)
  }
}, {
  timestamps: true
});

// Completion Tracking Schema
const completionTrackingSchema = new mongoose.Schema({
  timetable_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimetableEntry',
    required: true
  },
  completion_date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'missed'],
    required: true
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Create unique index for timetable_id and completion_date combination
completionTrackingSchema.index({ timetable_id: 1, completion_date: 1 }, { unique: true });

// Models
export const TimetableEntry = mongoose.model('TimetableEntry', timetableEntrySchema);
export const CompletionTracking = mongoose.model('CompletionTracking', completionTrackingSchema);

export default mongoose;
