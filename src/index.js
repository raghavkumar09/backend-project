import 'dotenv/config'
import connectionDB from './db/index.js'

connectionDB()
.then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`App listening on port ${process.env.PORT}`)
    })
})
.catch((error) => {
    console.log("Error in connection DB", error)
})

