
const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('https://us-central1-eregi-8fc1e.cloudfunctions.net/resendBadgePrepToken', {
            data: {
                confId: 'kadd_2026spring',
                regId: 'EXT-C3617636'
            }
        });
        console.log(res.data);
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();

