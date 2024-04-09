import { ApiError } from "../utils/ApiError.js";
import { asynchandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";


const registeruser = asynchandler(async (req, res) => {
  //  get user details from FE
  // validation - not empty
  // check if already exist
  // check for images, check for avatar
  // upload them to cloudinary
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return response

  const { fullname, username, email, password } = req.body

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "all fields are required")
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  })


  if (existedUser) {
    throw new ApiError(409, "user with username or email exist")
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverimageLocalPath = req.files?.coverimage[0]?.path;

  let coverimageLocalPath;
  if (req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length > 0) {
    coverimageLocalPath = req.files?.coverimage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar file is required");
  }


  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverimage = await uploadOnCloudinary(coverimageLocalPath)

  if (!avatar) {
    throw new ApiError(400, "avatar file is required");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverimage: coverimage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registring the user")
  }

  return res.status(201).json(
    new ApiResponse(200, createdUser, "user registered successfully")
  )



})

export { registeruser };