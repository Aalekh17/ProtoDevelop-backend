const path=require('path');
const express=require('express');

const JWT_EXPIRES_IN="1h";
require('dotenv').config();
const jwt = require('jsonwebtoken');
const multer=require('multer');
const { GridFSBucket, ObjectId } = require('mongodb');

const dbpath=process.env.MONGO_URI || "mongodb+srv://user:root@prototype.mk65d0n.mongodb.net/protodevelop?retryWrites=true&w=majority&appName=Prototype";

// const rootdir=require("./utils/pathutils");

const { default: mongoose } = require('mongoose');

const Project=require('./models/projects');
const Favourite=require('./models/favourites');
const Myproject=require('./models/myproject');
const User=require('./models/user');
const bcrypt = require("bcryptjs");

const app=express();
const cors=require('cors');
let bucket;

app.use(express.json());

app.use(express.urlencoded({extended:true}));

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://localhost:5173',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin) || /https:\/\/.*\.vercel\.app$/i.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods:["GET","POST","PUT","DELETE"],
  allowedHeaders:['Content-Type','Authorization']
}));

app.post('/postlogindata',async(req,res,next)=>{

  try{
    const {email,password}=req.body;
  
  const user=await User.findOne({email});
  

  
  const ismatch=await bcrypt.compare(password,user.hashedpassword);
  
  if(!user || !ismatch){
    return res.status(401).json('invalid credential')
  }

  const token=jwt.sign(
    {email:user.email,name:user.name,userid:user._id},
    process.env.JWT_SECRET,
    {expiresIn:JWT_EXPIRES_IN}
  );
  console.log({token});

  return res.json({token});
  }catch(err){
    next(err);
  } 
  
})

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if(req.method==='OPTIONS'){
    return res.sendStatus(200);
  }
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }


  
};

app.post('/postuserdata',async(req,res)=>{
  console.log(req.body);
  const {name,email,password,confirmpassword}=req.body;
  const hashedpassword=await bcrypt.hash(password,12);
  const hashedconfirmpassword=await bcrypt.hash(confirmpassword,12);
  const user=new User({name,email,hashedpassword,hashedconfirmpassword});
  user.save();
  res.status(201).json(user);

});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/addproject',authMiddleware,upload.single("image"), async(req,res)=>{
  console.log(req.body);
  const {name,description,tag,link}=req.body;
  console.log(req.user);
  const adminId=req.user.userid;

  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }

  if (!bucket) {
    return res.status(500).json({ message: 'Image storage is not ready yet' });
  }

  try {
    const uploadStream = bucket.openUploadStream(req.file.originalname || `project-${Date.now()}`, {
      contentType: req.file.mimetype
    });

    await new Promise((resolve, reject) => {
      uploadStream.on('error', reject);
      uploadStream.on('finish', resolve);
      uploadStream.end(req.file.buffer);
    });

    const proj=new Project({
      name,
      description,
      tag,
      link,
      admin: adminId,
      image: `/image/${uploadStream.id.toString()}`
    });

    await proj.save();
    return res.status(201).json(proj);
  } catch (error) {
    console.error('Product save failed:', error);
    if (error.name === 'ValidationError') {
      const details = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Product validation failed', errors: details });
    }
    return res.status(500).json({ message: 'Unable to save product', error: error.message });
  }
})

app.get('/image/:id', async (req, res) => {
  try {
    if (!bucket) {
      return res.status(500).json({ message: 'Image storage is not ready yet' });
    }

    const fileId = new ObjectId(req.params.id);
    const file = await mongoose.connection.db.collection('images.files').findOne({ _id: fileId });

    if (!file) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.set('Content-Type', file.contentType || 'application/octet-stream');
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ message: 'Image not found' });
      }
    });
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Image fetch failed:', error);
    res.status(400).json({ message: 'Invalid image id' });
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/getproject',(req,res)=>{
  Project.find().populate('admin','name' )
  .then(users=>res.json(users))
  .catch(err=>res.json(err));
})

app.get('/project/:id', async (req, res) => {
  const {id} = req.params;
  Project.findById(id).populate('admin members','name email' ).then((project)=>{
    if(!project){
      console.log("project not found");
    }
    else{
      res.json(project);
    }
  })
  
});

app.post('/postfav',authMiddleware, async (req, res) => {
  const full=req.user;
  const userid=full.userid;

  console.log(userid);

  const projectid=req.body.id;
  console.log(projectid);
  const hello=await User.findById(userid);
  if(!hello.favourites.includes(projectid)){
    hello.favourites.push(projectid)
    await hello.save();
  }
  res.status(201).json(hello);

});

app.get('/getfav',authMiddleware,async(req,res)=>{
  const full=req.user;
  const userid=full.userid;
  const user=await User.findById(userid).populate('favourites');
  console.log(user);
  res.json(user);

})

app.post('/postmyproj',authMiddleware, async (req, res) => {
  const full=req.user;
  const userid=full.userid;

  console.log(userid);

  const projectid=req.body.id;
  console.log(projectid);
  const hello=await User.findById(userid);
  if(!hello.myproject.includes(projectid)){
    hello.myproject.push(projectid)
    await hello.save();
  }
  const hi=await Project.findById(projectid);
  if(!hi.members.includes(userid)){
    hi.members.push(userid)
    await hi.save();
  }
  res.status(201).json(hello);

});

app.get('/getmyproj',authMiddleware,async(req,res)=>{
  const full=req.user;
  const userid=full.userid;
  const user=await User.findById(userid).populate('myproject');
  console.log(user);
  res.json(user);

})

app.delete('/deletefav/:id',authMiddleware,async(req,res)=>{
  const projectid=req.params.id;
  const full=req.user;
  const userid=full.userid;
  const user=await User.findById(userid);
  if(user.favourites.includes(projectid)){
    user.favourites=user.favourites.filter(fav=>fav!=projectid);
    await user.save();
  }

})

app.delete('/deletemyproj/:id',authMiddleware,async(req,res)=>{
  const projectid=req.params.id;
  const full=req.user;
  const userid=full.userid;
  const user=await User.findById(userid);
  if(user.myproject.includes(projectid)){
    user.myproject=user.myproject.filter(fav=>fav!=projectid);
    await user.save();
  }

  const project = await Project.findByIdAndUpdate(
            projectid,
            {
                $pull: { members: userid }
            },
            { new: true }
        );

  if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        res.json({
            message: "Left project successfully",
            project
        });

})

const PORT=process.env.PORT || 3000; 

mongoose.connect(dbpath).then(()=>{
  console.log("connected to mongo");
  bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'images' });
  console.log("GridFS bucket initialized for images");
  app.listen(PORT,()=>{
  console.log(`server running at http://localhost:${PORT}/`);
});
}).catch((error)=>{
  console.log("error while connecting to mongodb",error);
});