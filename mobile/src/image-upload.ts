import {File} from 'expo-file-system';

// Expo SDK 58's fetch accepts File/Blob parts, not RN's legacy {uri,name,type} parts.
export function appendImageFile(form:FormData,uri:string){
 if(!/^(?:file|content):\/\//i.test(uri))throw Error('写真を読み込めません。端末の写真を選び直してください。');
 const file=new File(uri);
 if(!file.exists||!file.size)throw Error('写真を読み込めません。撮影するか、写真を選び直してください。');
 if(file.size>3*1024*1024)throw Error('3MB以下の写真を選択してください。');
 form.append('file',file);
}
