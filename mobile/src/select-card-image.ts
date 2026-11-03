import * as ImagePicker from 'expo-image-picker';

export async function selectCardImage():Promise<string|null>{
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.7,exif:false});
 return result.canceled?null:result.assets[0]?.uri??null;
}
