const mongoose=require('mongoose');

const myprojectschema=new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true,
  }
})

module.exports = mongoose.model('Myproject', myprojectschema);