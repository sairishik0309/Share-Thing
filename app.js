require('dotenv').config();
const fast2sms =require('fast-two-sms');
const express = require('express');
const bodyParser = require('body-parser')
const mongoose = require('mongoose');
const ejs=require('ejs')
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const cookieparser=require('cookie-parser');
 const multer=require('multer');
 const fs=require('fs');
const path = require("path");
const cloudinary = require('cloudinary');
// article database
const Article = require('./models/article');
const { response } = require('express');

function generateOTP() {
 
    var digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < 4; i++ ) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
}

function sendop(p1,p2){
    var options={
        authorization:process.env.FTWSMSKEY,
        sender_id: "FTWSMS",
        message:p1,
        numbers:[p2]
    };
    fast2sms.sendMessage(options)
    .then((response)=>{
        console.log(response);
        console.log('success');
    
    }).catch((error)=>{
        console.log(error);
    })
}

const app = express();
//view engine
if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads");
}
  
// Multer setup
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});
  
var upload = multer({ storage: storage });

app.use(express.static('public'));
app.set('view engine','ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
  
app.use(express.static(__dirname + "/public"));
app.use("/uploads", express.static("uploads"));

// app.use(express.json());


app.use(session({
    secret:process.env.SECRET,
    resave: false,
    saveUninitialized: false,

}));

app.use(passport.initialize());
app.use(passport.session());
// app.use(fileUpload());

//mongoose db connection 
mongoose.set('strictQuery', false);
mongoose.connect(process.env.DATABASE, {
    useNewUrlParser: true,
});
// mongoose.set("useCreateIndex", true);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error: "));
db.once("open", function() {
    console.log("Connected to Database successfully");
});

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

// app.use(flash());
// mongo user schema
const userschema = new mongoose.Schema({
    Name:{
        type:String,
        required:true
    },
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,

    },
    avatar: {
        public_id: {
          type: String,
        //   required: true,
        },
        url: {
          type: String,
        //   required: true,
        },
    },
    mob:{
        type:Number,
        required:true

    },
    verifed:{
        type:Boolean,
    }
});
userschema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userschema);



passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


var gtotp=0;
app.get('/verifyotptest', (req, res) => {
    // console.log(__dirname);
    if(req.isAuthenticated()){
        console.log(gtotp);
        res.render('verifyotp');
    }else{
        res.redirect('/signup');
    }

})

app.post('/homepage',async(req,res)=>{
    
    if(req.isAuthenticated()){
        const ug=req.user;
        if(gtotp==req.body.otpverify){
            
            await User.findOneAndUpdate({_id:ug._id},{
                verifed:true
            },{new:true}
                );
            res.redirect('/home')
        }else{
            await User.findByIdAndDelete({_id:ug._id});
            res.redirect('/signup')
        }
    }else{
        res.redirect('/signup');
    }
})

//routes
app.get('/', (req, res) => {
    // console.log(__dirname);
    res.render('landing');

})

// login and signup routes
app.get('/login', (req, res) => {
    // console.log(__dirname);
    res.render('login');

})
app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { 
        return next(err); 
        }
      res.redirect('/');
    });
  });
app.get('/signup', (req, res) => {
    // console.log(__dirname);
    res.render('signup');

})

app.post('/register',upload.single('avatar'), async(req, res) => {
    try {
        const localfilepath=req.file.path;
        const myCloud = await cloudinary.v2.uploader.upload(localfilepath, {
            folder: "avatars",
            width: 150,
            crop: "scale",
          });
        const newUser = new User({
            Name:req.body.Name,
            username:req.body.username,
            avatar: {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            },
            mob:req.body.mob,
            verifed:false,
        });
        fs.unlinkSync(localfilepath);
    
        User.register(newUser,req.body.password,function(err,user){
            if (err) {
                console.log(err);
                res.redirect('/signup');
            } else {
                passport.authenticate("local")(req,res,function(){
                    // genrate otp fn
                    const otp=generateOTP();
                    gtotp=otp;
                    // send otp  1.send genrateed otp 2.number
                    sendop(otp,req.body.mob);
                   // console.log(otp);
                    res.redirect('/verifyotptest');
                });
                
        
            }
       });
        
    } catch (error) {
        console.log(error);
       /// console.log(fs.readFileSync(req.file.path));
        
    }
});
// saving new  data

app.post('/article',upload.single('productimg'),async(req,res)=>{
    try {

        const localfilepath=req.file.path;
        const myproduct = await cloudinary.v2.uploader.upload(localfilepath, {
            folder: "productimg",
            width: 150,
            crop: "scale",
        });


        fs.unlinkSync(localfilepath);
        const ug= req.user;
        const article=new Article({
        title:req.body.title,
        des:req.body.des,
        price:req.body.price,
        createid:ug._id,
        createdname:ug.Name,
        productimg: {
            public_id: myproduct.public_id,
            url: myproduct.secure_url,
        },
        mob:ug.mob,

        })

        article.save().then(()=>{
       
            res.redirect('/home');
        })
        
    } catch (error) {
        console.log(error);
        
    }
})

app.post('/login', (req, res) => {

    const user = new User({
        username: req.body.username,
        password: req.body.password,
    });
    req.login(user, function(err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect('/home');
            });
        }
    });



})

app.get('/home', async (req, res) => {
    const article = await Article.find();
    // res.render('index', { article: article });
    // console.log(article)
    
    if (req.isAuthenticated()) {
        const currUserObject = req.user;
        if(currUserObject.verifed){
            res.render('index', { 
                currentUserObj: currUserObject,
                article: article});
        }else{
            res.redirect('/login');
        }
        
       
    } else {
        res.redirect(`/login`);
    }
})

app.get("/profile/User", async(req, res) => {
   // console.log(req.user);
   const article = await Article.find();

    if(req.isAuthenticated()){
        const currUserObject = req.user;
        // console.log(currUserObject.avatar.url)
        if(currUserObject.verifed){
            res.render("profile", {
                currentUserObj: currUserObject,
                article:article });
        }else{
            res.redirect('/login');
        }
        
    }else{
        res.redirect('/');
    }
});

app.get('/article/new',(req, res) => {
    
   
    if (req.isAuthenticated()) {
        const ug=req.user;
        if(ug.verifed)res.render('new');
        else res.redirect('/login');
    } else {
        res.redirect(`/login`);
    }
})

// view more
app.get('/articleview/:slug',async(req,res)=>{
    if(req.isAuthenticated()){
        const article= await Article.findOne({slug:req.params.slug})
       if(article==null){res.redirect('/')}
       res.render('show',{article:article})
    }else{
        res.redirect('/login');
    }
})




// search api
app.get('/search/:key', async (req, res) => {
    let data = await Article.find({
        "$or": [
            { title: { $regex: req.params.key } },
            { createdname: { $regex: req.params.key } }
        ]
    })

    if (req.isAuthenticated()) {
        res.render('index', { article: data });
    } else {
        res.redirect(`/login`);
    }
})

app.post('/search', (req, res) => {
    const key = req.body.keyi;
    //  console.log(key);

    res.redirect('/search/' + key);
})

// update

app.get('/article/edit/:id',async(req,res)=>{
   if(req.isAuthenticated()){
    const article_data= await Article.findById({_id:req.params.id})
    res.render('edit',{article:article_data})
   }else{
    res.redirect('/login');
   }

})
app.post('/article/edit/:id',async(req,res)=>{
    try {
        const updatedres= await Article.findOneAndUpdate({_id:req.params.id},req.body,{new:true}
        );
        res.redirect('/home');
    } catch (error) {
        console.log(error);
        
    }
})
// delete post api
app.get('/article/delete/:id',async(req,res)=>{
    const ug= req.user;const article = await Article.find();
    const article_data= await Article.findById({_id:req.params.id});
    const mssg="YOU Cant DELETE";
    if(ug.Name===article_data.createdname){
        try {
            const dl= await Article.findByIdAndDelete({_id:req.params.id});
            res.redirect('/profile/user');
        } catch (error) {
            console.log('error');

            
        }

    }else{
         console.log("YOU CANT DELETE");
         res.redirect('/deletemsg');
    }

    
})
app.get('/deletemsg',(req,res)=>{
    if(req.isAuthenticated()){
        res.render('deletemsg');
    }else{
        res.redirect('/');
    }
    
})




app.get('/ajaysabal',(req,res)=>{
    res.sendFile(__dirname+'/views/check.html');
})
//port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log('working on port 8080');
})