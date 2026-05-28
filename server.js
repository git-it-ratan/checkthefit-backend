const express = require('express')
const cors = require('cors')
const multer = require('multer')
const dotenv = require('dotenv')
const Groq = require('groq-sdk')

dotenv.config()
const app = express()
const upload = multer({ storage: multer.memoryStorage() })

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

app.use(cors())
app.use(express.json())



app.post('/analyse-outfit', upload.fields([
    { name: 'topImage', maxCount: 1 },
    { name: 'bottomImage', maxCount: 1 }
]), async (req, res) => {
    const topFile = req.files?.topImage?.[0]
    const bottomFile = req.files?.bottomImage?.[0]
    const occasion = req.body?.occasion

    if (!topFile || !bottomFile || !occasion) {
        return res.status(400).json({ error: 'Top image, bottom image and occasion are required.' })
    }

    try {
        const base64Top = topFile.buffer.toString('base64')
        const base64Bottom = bottomFile.buffer.toString('base64')
        const prompt = `
        I have sent you two images, one of a top and one of a bottom of an outfit. 
        The first image is the top part of an outfit and the second image is the bottom part of an outfit. 
        I want you to return the color and type of the top and bottom, like is the top is a shirt or t-shirt or a jacket, and the color of the top. 
        Do the same for the bottom like if it is a short or pant or something else. I want you to return the result in JSON format, specifying the type and color of the top and bottom. 
        NO bullet points, no markdown stuff, only a JSON response, giving the type and color of the top and bottom. 
        And one more important thing, if any of the image is not of an outfit, just write null as the value for that part such that i can check if the user has uploaded an image of an outfit or not. 
        Return the result in exactly this structure and nothing else:
        {
            "top": {
                "type": "...",
                "color": "the hex code of the color e.g. #4A7C59"
            },
            "bottom": {
                "type": "...",
                "color": "the hex code of the color e.g. #4A7C59"
            }
        }
        If an image is not a clothing item, set both type and color to null for that object.`

        const response = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:${topFile.mimetype};base64,${base64Top}` } },
                        { type: 'image_url', image_url: { url: `data:${bottomFile.mimetype};base64,${base64Bottom}` } }
                    ]
                }
            ],
            max_tokens: 300
        })

        const rawText = response.choices[0].message.content
        const cleaned = rawText.replace(/```json|```/g, '').trim()
        const outfitData = JSON.parse(cleaned)

        if (!outfitData.top.type || !outfitData.bottom.type) {
            return res.status(422).json({ error: 'One or both images are not clothing items. Please upload outfit photos.' })
        }

        return res.json({
            outfitData,
            occasion
        })
    }
    catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Something went wrong. Please try again.' })
    }

})

app.listen(3001, () => {
    console.log('Server is running on port 3001')
})