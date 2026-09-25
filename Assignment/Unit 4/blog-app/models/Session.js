import {model , Schema} from "mongoose"

const sessionSchema = new Schema({
    userId : {
        type : Schema.Types.ObjectId,
        ref : "User"
    },
    expiresAt : {
        type : Date,
        required : true
    }
},{
    timestamps : true
})

const Session = model("Session" , sessionSchema)
export default Session
