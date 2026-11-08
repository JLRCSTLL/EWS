import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const brand = path.join(root, 'public/brand');
await mkdir(brand, {recursive:true});

// Scalable adaptation of the supplied AGILA eagle/A brand board.
const silhouette = 'M98 10H152L252 218H188L166 174H88L66 218H4Z';
const eagle = 'M59 82C88 89 121 92 146 99C162 103 170 109 167 116C185 115 198 125 201 142C190 133 183 136 180 149L178 155C170 142 157 144 143 152C120 166 99 190 85 218H66C84 181 105 151 130 137C141 131 152 127 163 125L48 134L55 120L117 108L62 95Z';
const mark = color => `<defs><mask id="eagle"><path d="${silhouette}" fill="white"/><path d="${eagle}" fill="black"/><path d="M151 117Q155 123 161 117Q157 120 151 117Z" fill="white"/></mask></defs><path d="${silhouette}" fill="${color}" mask="url(#eagle)"/>`;
const svg = (w,h,content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${content}</svg>`;
// Path lettering keeps the wordmark identical even before a web font has loaded.
const letters = `<path fill-rule="evenodd" d="M0 70L39 0H59L98 70H76L49 21L22 70ZM36 55L49 32L62 55Z"/><path d="M130 0H202L192 17H136Q123 17 123 35Q123 53 136 53H180V43H153V28H201V70H135Q103 70 103 35Q103 0 130 0Z"/><path d="M214 0H234V70H214ZM248 0H269V52H324V70H248Z"/><path fill-rule="evenodd" d="M335 70L374 0H394L433 70H411L384 21L357 70ZM371 55L384 32L397 55Z"/>`;
for (const [name,color] of [['white','#fff'],['black','#000']]) {
  await writeFile(path.join(brand,`agila-mark-${name}.svg`),svg(256,228,mark(color)));
  await writeFile(path.join(brand,`agila-wordmark-${name}.svg`),svg(433,70,`<g fill="${color}">${letters}</g>`));
  await writeFile(path.join(brand,`agila-logo-${name}.svg`),svg(780,228,`${mark(color)}<g fill="${color}" transform="translate(296 78)">${letters}</g>`));
}
const appIcon=svg(1024,1024,`<rect width="1024" height="1024" rx="208" fill="#111"/><rect x="2" y="2" width="1020" height="1020" rx="206" fill="none" stroke="#ffffff24" stroke-width="4"/><g transform="translate(205 180) scale(2.4)">${mark('#fff')}</g><g transform="translate(187 755) scale(1.5)" fill="#fff">${letters}</g>`);
await writeFile(path.join(root,'public/app-icon.svg'),appIcon);
for(const size of [180,192,512]) await sharp(Buffer.from(appIcon)).resize(size,size).png().toFile(path.join(root,`public/app-icon-${size}.png`));
const iosIcon=path.join(root,'ios/App/Assets.xcassets/AppIcon.appiconset/AppIcon.png');
await sharp(Buffer.from(appIcon)).flatten({background:'#111'}).png().toFile(iosIcon);
const iosMark=path.join(root,'ios/App/Assets.xcassets/AgilaMark.imageset');
await mkdir(iosMark,{recursive:true});
await sharp(Buffer.from(svg(256,228,mark('#fff')))).resize(512,456).png().toFile(path.join(iosMark,'agila-mark.png'));
await writeFile(path.join(iosMark,'Contents.json'),JSON.stringify({images:[{filename:'agila-mark.png',idiom:'universal'}],info:{author:'xcode',version:1}},null,2)+'\n');
await copyFile(path.join(iosMark,'agila-mark.png'),path.join(root,'desktop/assets/agila-mark.png'));
const iconSizes=[16,24,32,48,64,128,256],pngs=[];
for(const size of iconSizes) pngs.push(await sharp(Buffer.from(appIcon)).resize(size,size).png().toBuffer());
const ico=Buffer.alloc(6+16*pngs.length);ico.writeUInt16LE(1,2);ico.writeUInt16LE(pngs.length,4);
let offset=ico.length;
pngs.forEach((png,i)=>{const p=6+i*16,s=iconSizes[i];ico[p]=s===256?0:s;ico[p+1]=ico[p];ico.writeUInt16LE(1,p+4);ico.writeUInt16LE(32,p+6);ico.writeUInt32LE(png.length,p+8);ico.writeUInt32LE(offset,p+12);offset+=png.length;});
await writeFile(path.join(root,'desktop/assets/agila.ico'),Buffer.concat([ico,...pngs]));
const androidVector=`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="256" android:viewportHeight="256"><path android:fillColor="#111111" android:pathData="M0,0H256V256H0Z"/><group android:scaleX="0.68" android:scaleY="0.68" android:translateX="41" android:translateY="48"><path android:fillColor="#FFFFFF" android:pathData="${silhouette}"/><path android:fillColor="#111111" android:pathData="${eagle}"/><path android:fillColor="#FFFFFF" android:pathData="M151,117Q155,123 161,117Q157,120 151,117Z"/></group></vector>\n`;
await writeFile(path.join(root,'android/app/src/main/res/drawable/ic_launcher.xml'),androidVector);
await writeFile(path.join(brand,'README.md'),'# AGILA brand assets\n\nCode-native vector adaptation of the user-supplied AGILA brand board. Monochrome eagle/A mark, geometric wordmark, and app icons. No downloaded logo or external image service is used.\n\nAGILA: Advanced Geospatial Intelligence for Life Safety and Alerts. Black and white identity; charcoal matte glass surfaces. Operational maps retain their natural colors, and danger/warning indicators retain semantic red/amber colors.\n\nRegenerate icons with `node scripts/generate-brand-assets.mjs`. App identifiers and storage namespaces remain stable for upgrade compatibility.\n');
console.log('AGILA web, Windows, Android, and iPhone assets generated.');
