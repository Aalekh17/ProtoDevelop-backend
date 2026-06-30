const mongoose=require('mongoose');

const favouriteschema=new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  
})

module.exports = mongoose.model('Favourite', favouriteschema);