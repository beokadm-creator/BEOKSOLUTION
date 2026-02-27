
import { sendAlimTalk } from './src/utils/nhnAlimTalk';
async function test() {
    const res = await sendAlimTalk({
        senderKey: '5926caba6cf20a2e3794b6de882b4bed186cb730', // Need to get actual senderKey
        templateCode: 'kaid0001',
        recipientNo: '01012345678',
        content: 'test',
        buttons: []
    });
    console.log(JSON.stringify(res, null, 2));
}
test();

