const fetch = require("node-fetch");
require("dotenv").config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing from .env");
}

fetch("https://api.openai.com/v1/models", {
    headers: {
        "Authorization": `Bearer ${apiKey}`
    }
})
.then(res => {
    if (res.status === 200) {
        console.log(" API KEY VALID");
    } else if (res.status === 401) {
        console.log(" API KEY TIDAK VALID");
    } else {
        console.log("⚠️ Status lain:", res.status);
    }
})
.catch(err => console.error(err));