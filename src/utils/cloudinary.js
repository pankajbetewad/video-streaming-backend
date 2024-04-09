import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // upload file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto"
    })

    // const response = await cloudinary.uploader.upload(localFilePath,
    //   { resource_type: "auto" },
    //   function (error, result) { console.log("pankaj check actual", result, "*****", error); });


    // file has been uploaded successfully

    fs.unlinkSync(localFilePath)

    return response;

  } catch (err) {
    fs.unlinkSync(localFilePath)  //remove locally saved temp file as the upload operation got failed
    return null;
  }
}


export { uploadOnCloudinary }