// 转换完成，未整理版，还没处理Music Tag信息
console.time('1');
const fs = require('fs');
const aes = require('aes-js');

const file = fs.readFileSync('1.ncm');
let globalOffset = 10;

const keyLength = file.readUInt32LE(10);
globalOffset += 4;
console.log('key length: ', keyLength);

const keyData = Buffer.alloc(keyLength);

file.copy(keyData, 0, globalOffset, globalOffset + keyLength);
globalOffset += keyLength;

for (let i = 0; i < keyLength; i++) {
    keyData[i] ^= 0x64;
}

const coreKey = new Uint8Array([0x68, 0x7A, 0x48, 0x52, 0x41, 0x6D, 0x73, 0x6F, 0x35, 0x6B, 0x49, 0x6E, 0x62, 0x61, 0x78, 0x57]);

const aesEcb = new aes.ModeOfOperation.ecb(coreKey);

const decodedKeyData = aesEcb.decrypt(keyData);

// for (let i = 0; i < decodedKeyData.length; i++) {
//     console.log(decodedKeyData[i].toString(2))
// }
const trimKeyData = decodedKeyData.slice(17, decodedKeyData.indexOf(15));
console.log(1, Buffer.from(decodedKeyData).toString('ascii'));

const metaLength = file.readUInt32LE(globalOffset);
globalOffset += 4;
console.log('meta length: ', metaLength);
const metaData = Buffer.alloc(metaLength);
file.copy(metaData, 0, globalOffset, globalOffset + metaLength);
globalOffset += metaLength;
for (let i = 0; i < metaLength; i++) {
    metaData[i] ^= 0x63;
}

const base64decode = Buffer.from(Buffer.from(metaData.slice(22)).toString('ascii'), 'base64');

const metaKey = new Uint8Array([0x23, 0x31, 0x34, 0x6C, 0x6A, 0x6B, 0x5F, 0x21, 0x5C, 0x5D, 0x26, 0x30, 0x55, 0x3C, 0x27, 0x28]);
const aseMeta = new aes.ModeOfOperation.ecb(metaKey);
const meatArray = aseMeta.decrypt(base64decode);
console.log(Buffer.from(meatArray).toString('ascii'));

// read crc32 check
file.readUInt32LE(globalOffset);
globalOffset += 4;
globalOffset += 5;
// read image length
const imageLength = file.readUInt32LE(globalOffset);
globalOffset += 4;
console.log('image length: %d', imageLength);
const imageBuffer = Buffer.alloc(imageLength);
file.copy(imageBuffer, 0, globalOffset, globalOffset + imageLength);
globalOffset += imageLength;
// write image to file
fs.writeFileSync('1.jpg', imageBuffer);

function buildKeyBox(key) {
    const keyLength = key.length;
    const box = Buffer.alloc(256);

    for (let i = 0; i < 256; i++) {
        box[i] = i;
    }

    let swap = 0;
    let c = 0;
    let lastByte = 0;
    let keyOffset = 0;

    for (let i = 0; i < 256; ++i) {
		swap = box[i];
		c = ((swap + lastByte + key[keyOffset++]) & 0xff);
		if (keyOffset >= keyLength) {
            keyOffset = 0;
        }
		box[i] = box[c];
        box[c] = swap;
		lastByte = c;
	}

    return box;
}

const box = buildKeyBox(trimKeyData);

let n = 0x8000;
let fmusic = [];
while (n > 1) {
    const buffer = Buffer.alloc(n);
    n = file.copy(buffer, 0, globalOffset, globalOffset + n);
    globalOffset += n;

    for (let i = 0; i < n; i++) {
        let j = (i + 1) & 0xff;
        buffer[i] ^= box[(box[j] + box[(box[j] + j) & 0xff]) & 0xff];
    }

    fmusic.push(buffer);
}

fs.writeFileSync('1.flac', Buffer.concat(fmusic));
console.timeEnd('1');
