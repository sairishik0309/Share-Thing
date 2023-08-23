const mongoose=require('mongoose');
const slugify=require('slugify');

const articleSchema =new mongoose.Schema({
    productimg:{
        public_id: {
            type: String,
          //   required: true,
          },
          url: {
            type: String,
          //   required: true,
          },

    },
    title:{
        type:String,
        required:true

    },
    mob:{
        type:Number,
    },
    price:{
        type:Number,
        required:true
    },
    des:{
        type:String,
        required:true

    },
    
    createid:{
        type:String,
    },
    createdname:{
        type:String,
    },
    createdAt:{
        type:Date,
        default:Date.now()
    },
    slug:{
        type:String,
        required:true,
        unique:true
    },
   

})

articleSchema.pre('validate',function(next){
    if(this.title){
        this.slug=slugify(this.title,{lower:true,strict:true})
    }
    next()
})

module.exports=mongoose.model("Article",articleSchema)
