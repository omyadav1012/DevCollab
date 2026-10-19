import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


const userSchema = new mongoose.Schema(
    {
        fullName: {
            type:String,
            required:true,
            trim:true

        },
        email:{
             type:String,
            required:true,
            trim:true,
            unique:true,
            lowercase:true
        },
        password:{
            type:String,
            required:true,
            minlength:true
        },
        
        refreshToken: {
            type: String,
             default: null
        },
       
        resetPasswordToken: {
            type: String,
            default: null
        },
        resetPasswordExpiry: {
            type: Date,
            default: null
}

    },
{ timestamps: true }
);
userSchema.pre("save",async function () {
    if(!this.isModified("password"))
        return;
    this.password=await bcrypt.hash(this.password,10);
});
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  );
};
export const User=mongoose.model("User",userSchema)