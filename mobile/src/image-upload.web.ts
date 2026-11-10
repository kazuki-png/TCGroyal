export async function appendImageFile(form:FormData,uri:string){
 if(!/^(blob:|data:image\/(jpeg|png|webp);base64,)/i.test(uri))throw Error('端末の写真を選び直してください。');
 const response=await fetch(uri);
 const blob=await response.blob();
 if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||!blob.size)throw Error('JPEG・PNG・WebPの画像を選んでください。');
 if(blob.size>3*1024*1024)throw Error('3MB以下の写真を選択してください。');
 form.append('file',blob,`card.${blob.type==='image/jpeg'?'jpg':blob.type.split('/')[1]}`);
}
