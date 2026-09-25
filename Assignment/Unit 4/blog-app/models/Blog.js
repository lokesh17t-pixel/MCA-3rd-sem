import {model , Schema} from "mongoose";


const commentSchema = new Schema({
    userId : {
        type : Schema.Types.ObjectId,
        ref : "User"
    },
    username : {
        type : String,
        required  :true
    },
    text : {
        type : String,
        required : true
    }
},
{
    timestamps:true,
    strict:"throw"
})

const blogSchema = new Schema({
    title : {
        type:String,
        required : true
    },
    content:{
        type : String,
        required:true
    },
    author:{
        type:String,
        required:true
    },
    userId : {
        type : Schema.Types.ObjectId,
        ref : "User"
    },
    image : {
        type : String
    },
    likes : [{userId : String}],
    comments : [commentSchema]
},{
    timestamps : true,
    strict:"throw"
})


const Blog = model("Blog" , blogSchema)
export default Blog
