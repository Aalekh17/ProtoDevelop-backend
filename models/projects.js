const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  tag: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true,
  },
  admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
      members:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    
      }],
      image: {
    type: String,
    required: true,
  }
  
});

module.exports = mongoose.model('Project', projectSchema);