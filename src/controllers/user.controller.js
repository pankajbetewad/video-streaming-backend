import { ApiError } from "../utils/ApiError.js";
import { asynchandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken().then(data => data);
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken }

  } catch (error) {
    throw new ApiError(500, "something went wrong while generating refresh and access token")
  }
}


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

const loginUser = asynchandler(async (req, res) => {

  // req body
  // email or username 
  // find the user
  // password check
  // aceess and refresh token generate
  // send cookie

  const { email, username, password } = req.body;

  if (!(username || email)) throw new ApiError(400, "username or email is required");

  const user = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (!user) throw new ApiError(404, "user does not exist")

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) throw new ApiError(401, "invalid user credentials")


  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken
        },
        "user logged in successfully"
      )
    )


})

const logoutUser = asynchandler(async (req, res) => {

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out"))
})

const refreshAccessToken = asynchandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unathorized request");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refresh token is expired or used")
    }

    const options = {
      httpOnly: true,
      secure: true
    }

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(new ApiResponse(
        200,
        {
          accessToken,
          refreshToken: newRefreshToken
        },
        "access token refreshed successfully"
      ))
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token")
  }

})

export { registeruser, loginUser, logoutUser, refreshAccessToken };