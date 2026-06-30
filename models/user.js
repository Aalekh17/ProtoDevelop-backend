const mongoose=require('mongoose');

const userschema=mongoose.Schema({
  name:{
    type:String,
    required:[true,'name is required']
  },
  email:{
    type:String,
    reqired:[true,'email is required']
  },
  hashedpassword:{
    type:String,
    required:[true,'password is required']
  },
  hashedconfirmpassword:{
    type:String,
    required:[true,'confirmpassword is required']
  },
  favourites:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Project'

  }],
  myproject:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Project'

  }],
  
})

module.exports=mongoose.model('User',userschema);