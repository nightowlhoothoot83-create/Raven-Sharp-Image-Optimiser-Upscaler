/**
 * Raven Sharp Image Optimiser — Client-side Processing
 *
 * Standard image processing remains client-side. AI background removal is
 * performed by the authenticated backend so the provider/model and result can
 * be validated before the UI reports success.
 */

import api from "./api";

// ── Background removal via backend ─────────────────────────────────────────
async function removeBackground(fileOrObject, onProgress) {
  onProgress?.("Removing background…");
  const isFile = fileOrObject instanceof File;
  const dataURL = isFile ? await readFileAsDataURL(fileOrObject) : fileOrObject.dataURL;
  const [head, base64] = dataURL.split(",", 2);
  const mime = head.match(/:([^;]+);/)?.[1] || "image/png";

  const { data } = await api.post("/remove-background", {
    image_base64: base64,
    mime,
  });
  if (!data?.base64 || data?.mime !== "image/png") {
    throw new Error("Background removal returned no valid transparent PNG");
  }

  const blob = dataURLtoBlob(`data:image/png;base64,${data.base64}`);
  const baseName = isFile ? fileOrObject.name : (fileOrObject.name || "image");
  return new File([blob], baseName.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
}

export const PRESET_SIZES = [
  { label: "Custom", w: 0, h: 0 },
  { label: "A4 Print (300dpi) — 2480×3508", w: 2480, h: 3508 },
  { label: "A3 Print (300dpi) — 3508×4961", w: 3508, h: 4961 },
  { label: "Square POD — 3000×3000", w: 3000, h: 3000 },
  { label: "Instagram — 1080×1080", w: 1080, h: 1080 },
  { label: "Instagram Story — 1080×1920", w: 1080, h: 1920 },
  { label: "KDP 6×9 @300 — 1800×2700", w: 1800, h: 2700 },
  { label: "KDP 8.5×11 @300 — 2550×3300", w: 2550, h: 3300 },
];

export const OUTPUT_PRESETS = [
  { id: "none", label: "None", settings: {} },
  { id: "gelato", label: "Gelato Print Ready", settings: { dpi: 300, format: "png", quality: 100, sharpen: 2, compression: "quality", removeBg: false } },
  { id: "redbubble", label: "Redbubble", settings: { dpi: 150, format: "png", quality: 100, sharpen: 1, compression: "quality" } },
  { id: "etsy", label: "Etsy Listing", settings: { dpi: 96, format: "jpeg", quality: 88, sharpen: 1, compression: "balanced", width: 2000, height: 2000, lockAspect: true } },
  { id: "printify", label: "Printify", settings: { dpi: 300, format: "png", quality: 100, sharpen: 2, compression: "quality" } },
  { id: "instagram", label: "Instagram", settings: { dpi: 72, format: "jpeg", quality: 85, sharpen: 1, width: 1080, height: 1080, lockAspect: false } },
  { id: "merch", label: "Merch by Amazon", settings: { dpi: 300, format: "png", quality: 100, width: 4500, height: 5400, lockAspect: false } },
];

export const CROP_RATIOS = [
  { label: "Free", ratio: null }, { label: "1:1", ratio: 1 }, { label: "4:3", ratio: 4/3 },
  { label: "3:2", ratio: 3/2 }, { label: "16:9", ratio: 16/9 }, { label: "2:3", ratio: 2/3 },
  { label: "3:4", ratio: 3/4 }, { label: "A4", ratio: 1/1.41 },
];

export const DEFAULT_SETTINGS = {
  format: "jpeg", quality: 90, dpi: 300, compression: "balanced", maxKB: 0,
  width: 0, height: 0, preset: 0, lockAspect: true, upscale: false, bleed: false,
  sharpen: 2, brightness: 0, contrast: 0, saturation: 0, auto: false,
  removeBg: false, stripExif: false, watermarkText: "", watermarkPosition: "bottom-right",
  watermarkOpacity: 0.6, watermarkSize: 24, crop: null, outputPreset: "none",
};

export const readFileAsDataURL = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
});
export const loadImage = (src) => new Promise((res, rej) => {
  const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
});
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
function dataURLtoBlob(dataURL) {
  const [head, base] = dataURL.split(","); const mime = head.match(/:([^;]+);/)[1];
  const bin = atob(base); const arr = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr], {type:mime});
}
function applyPixelAdjustments(ctx,w,h,brightness,contrast,saturation) {
  if (brightness===0&&contrast===0&&saturation===0) return;
  const id=ctx.getImageData(0,0,w,h),d=id.data,cf=(259*(contrast+255))/(255*(259-contrast));
  for(let i=0;i<d.length;i+=4){let r=d[i],g=d[i+1],b=d[i+2];if(brightness){r+=brightness;g+=brightness;b+=brightness;}if(contrast){r=cf*(r-128)+128;g=cf*(g-128)+128;b=cf*(b-128)+128;}if(saturation){const gray=.2989*r+.587*g+.114*b,s=1+saturation/100;r=gray+(r-gray)*s;g=gray+(g-gray)*s;b=gray+(b-gray)*s;}d[i]=clamp(r,0,255);d[i+1]=clamp(g,0,255);d[i+2]=clamp(b,0,255);}ctx.putImageData(id,0,0);
}
function applySharpening(ctx,w,h,amount){if(!amount)return;const src=ctx.getImageData(0,0,w,h),out=ctx.createImageData(w,h),s=src.data,o=out.data,k=amount/5,ctr=1+4*k;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4;for(let c=0;c<3;c++){const v=s[i+c]*ctr-s[i-4+c]*k-s[i+4+c]*k-s[i-w*4+c]*k-s[i+w*4+c]*k;o[i+c]=clamp(v,0,255);}o[i+3]=s[i+3];}ctx.putImageData(out,0,0);}
function applyWatermark(ctx,w,h,text,position,opacity,size){if(!text)return;ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle="#fff";ctx.strokeStyle="rgba(0,0,0,.5)";ctx.lineWidth=2;ctx.font=`bold ${size}px 'Cabinet Grotesk', sans-serif`;ctx.textBaseline="bottom";const p=size*1.2,tw=ctx.measureText(text).width,th=size;let x,y;switch(position){case"top-left":x=p;y=p+th;break;case"top-center":x=(w-tw)/2;y=p+th;break;case"top-right":x=w-tw-p;y=p+th;break;case"center":x=(w-tw)/2;y=(h+th)/2;break;case"bottom-left":x=p;y=h-p;break;case"bottom-center":x=(w-tw)/2;y=h-p;break;default:x=w-tw-p;y=h-p;}ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.restore();}
function crc32(data){if(!crc32.t){crc32.t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc32.t[n]=c>>>0;}}let crc=0xffffffff;for(let i=0;i<data.length;i++)crc=(crc>>>8)^crc32.t[(crc^data[i])&255];return(crc^0xffffffff)>>>0;}
async function injectPNGDPI(blob,dpi){const buf=new Uint8Array(await blob.arrayBuffer()),ppm=Math.round(dpi*39.3701),data=new Uint8Array(9),dv=new DataView(data.buffer);dv.setUint32(0,ppm);dv.setUint32(4,ppm);data[8]=1;const type=new Uint8Array([0x70,0x48,0x59,0x73]),ci=new Uint8Array(type.length+data.length);ci.set(type);ci.set(data,type.length);const crc=crc32(ci),chunk=new Uint8Array(21);new DataView(chunk.buffer).setUint32(0,9);chunk.set(type,4);chunk.set(data,8);new DataView(chunk.buffer).setUint32(17,crc);const ihdrEnd=33;let cleaned=buf,pos=8;while(pos<cleaned.length-8){const len=new DataView(cleaned.buffer,cleaned.byteOffset+pos,4).getUint32(0),tt=String.fromCharCode(cleaned[pos+4],cleaned[pos+5],cleaned[pos+6],cleaned[pos+7]);if(tt==="pHYs"){const total=12+len,next=new Uint8Array(cleaned.length-total);next.set(cleaned.subarray(0,pos));next.set(cleaned.subarray(pos+total),pos);cleaned=next;break;}if(tt==="IDAT"||tt==="IEND")break;pos+=12+len;}const out=new Uint8Array(cleaned.length+chunk.length);out.set(cleaned.subarray(0,ihdrEnd));out.set(chunk,ihdrEnd);out.set(cleaned.subarray(ihdrEnd),ihdrEnd+chunk.length);return new Blob([out],{type:"image/png"});}
async function injectJPEGDPI(blob,dpi){const buf=new Uint8Array(await blob.arrayBuffer());if(buf[0]!==255||buf[1]!==216)return blob;let pos=2;while(pos<buf.length-4){if(buf[pos]===255&&buf[pos+1]===224){const uo=pos+11;buf[uo]=1;const dv=new DataView(buf.buffer,buf.byteOffset+uo+1,4);dv.setUint16(0,dpi);dv.setUint16(2,dpi);break;}if(buf[pos]!==255)break;const len=(buf[pos+2]<<8)|buf[pos+3];pos+=2+len;}return new Blob([buf],{type:"image/jpeg"});}

export async function processImage(fileOrObject, settings, onProgress) {
  let workingFile=fileOrObject;
  if(settings.removeBg){onProgress?.("Removing background…");workingFile=await removeBackground(workingFile,onProgress);}
  onProgress?.("Loading image…");
  const objURL=workingFile instanceof File?URL.createObjectURL(workingFile):workingFile.dataURL;
  const img=await loadImage(objURL);if(workingFile instanceof File)URL.revokeObjectURL(objURL);
  let s={...settings};if(s.outputPreset&&s.outputPreset!=="none"){const preset=OUTPUT_PRESETS.find(p=>p.id===s.outputPreset);if(preset)s={...s,...preset.settings};}
  if(settings.removeBg)s.format="png";
  if(s.auto){s.sharpen=Math.max(s.sharpen,3);s.contrast=6;s.saturation=4;s.dpi=Math.max(s.dpi,300);}
  let sourceImg=img;if(s.crop){const{x,y,width:cw,height:ch}=s.crop,c=document.createElement("canvas");c.width=cw;c.height=ch;c.getContext("2d").drawImage(img,x,y,cw,ch,0,0,cw,ch);sourceImg=await loadImage(c.toDataURL("image/png"));}
  let outW=s.width||sourceImg.naturalWidth,outH=s.height||sourceImg.naturalHeight;if(s.lockAspect&&s.width&&!s.height)outH=Math.round(s.width*sourceImg.naturalHeight/sourceImg.naturalWidth);if(s.lockAspect&&s.height&&!s.width)outW=Math.round(s.height*sourceImg.naturalWidth/sourceImg.naturalHeight);if(!s.upscale){outW=Math.min(outW,sourceImg.naturalWidth);outH=Math.min(outH,sourceImg.naturalHeight);}
  const bleedPx=s.bleed?Math.round((3/25.4)*s.dpi):0,cw=outW+bleedPx*2,ch=outH+bleedPx*2;onProgress?.("Rendering…");const canvas=document.createElement("canvas");canvas.width=cw;canvas.height=ch;const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";if(s.format==="jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,cw,ch);}ctx.drawImage(sourceImg,bleedPx,bleedPx,outW,outH);applyPixelAdjustments(ctx,cw,ch,s.brightness,s.contrast,s.saturation);if(s.sharpen>0)applySharpening(ctx,cw,ch,s.sharpen);if(s.watermarkText)applyWatermark(ctx,cw,ch,s.watermarkText,s.watermarkPosition,s.watermarkOpacity,s.watermarkSize);
  const mimeMap={jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};let q=clamp(s.quality,0,100)/100;if(s.compression==="smallest")q=Math.min(q,.7);if(s.compression==="balanced")q=Math.min(q,.85);let outDataURL=canvas.toDataURL(mimeMap[s.format],s.format==="png"?undefined:q),blob=dataURLtoBlob(outDataURL);if(s.maxKB>0&&s.format!=="png"){let qq=q;while(blob.size/1024>s.maxKB&&qq>.4){qq-=.05;outDataURL=canvas.toDataURL(mimeMap[s.format],qq);blob=dataURLtoBlob(outDataURL);}}
  if(s.format==="png")blob=await injectPNGDPI(blob,s.dpi);if(s.format==="jpeg")blob=await injectJPEGDPI(blob,s.dpi);
  const name=workingFile instanceof File?workingFile.name.replace(/\.[^.]+$/,""):(workingFile.name||"image"),ext=s.format==="jpeg"?"jpg":s.format;
  return{name:`${name}-optimised.${ext}`,blob,outputURL:URL.createObjectURL(blob),originalURL:null,originalSize:workingFile instanceof File?workingFile.size:(workingFile.originalSize||0),outputSize:blob.size,width:cw,height:ch,dpi:s.dpi,format:s.format};
}
