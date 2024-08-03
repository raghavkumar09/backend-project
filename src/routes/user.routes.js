import { Router } from "express";
import { accountDetailsUpdate, changePassword, currentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAvatar, updateCoverImage } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.route('/register')
    .post(
        upload.fields([
            { name: 'avatar', maxCount: 1 },
            { name: 'coverImage', maxCount: 1 }
        ]),
        registerUser
    )

router.route('/login').post(loginUser)

// secure routes
router.route('/logout').post(verifyToken, logoutUser)
router.route('/refresh-token').post(refreshAccessToken)
router.route('/change-password').post(verifyToken, changePassword)
router.route('/current-user').get(verifyToken, currentUser)
router.route('/account-update').patch(verifyToken, accountDetailsUpdate)

router.route('/avatar').patch(verifyToken, upload.single('avatar'), updateAvatar)
router.route('/cover-image').patch(verifyToken, upload.single('coverImage'), updateCoverImage)

router.route('/channel').get(verifyToken, getUserChannelProfile)
router.route('/watch-history').post(verifyToken, getWatchHistory)

export default router